"use client"
import { Printer, Copy, Check, Edit, Trash2, FileSpreadsheet, Clock, ClipboardList, CheckSquare, Layers } from "lucide-react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { deleteQuotation } from "@/app/actions/quotation"
import { formatRupee, formatShortId } from "@/lib/utils"
import { sileo } from "sileo"
import {
  DocumentPrintPortal,
  CorporateDocumentTemplate,
  buildSmartPdfFilename,
  triggerPrintWithFilename,
} from "./DocumentTemplate"
import { QuotationOrderConfirmModal } from "./QuotationOrderConfirmModal"
import { ConfirmDeleteModal } from "./ConfirmDeleteModal"
import { SmartMultiPoModal } from "./SmartMultiPoModal"

export function QuotationActions({ 
  quotation, 
  settings,
  suppliers = [],
  isFullyOrdered = false,
  existingPosCount = 0
}: { 
  quotation: any, 
  settings: any,
  suppliers?: { id: string; name: string }[],
  isFullyOrdered?: boolean,
  existingPosCount?: number
}) {
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isSmartSplitModalOpen, setIsSmartSplitModalOpen] = useState(false)
  const emailTableRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const pdfFilename = buildSmartPdfFilename({
    docType: "Quotation",
    docNumber: formatShortId(quotation.id),
    partyName: quotation.client?.name,
    referenceNo: quotation.prNo || quotation.rfqNo,
    date: quotation.createdAt,
  })

  const handlePrint = () => {
    triggerPrintWithFilename(pdfFilename, `Quotation #${formatShortId(quotation.id)}`)
  }

  const handleCopyEmail = async () => {
    if (!emailTableRef.current) return
    const htmlStr = emailTableRef.current.innerHTML

    try {
      const blobHtml = new Blob([htmlStr], { type: "text/html" })
      const blobText = new Blob([emailTableRef.current.innerText], { type: "text/plain" })
      
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        }),
      ])
      
      setCopied(true)
      sileo.success({
        title: "Quotation Copied for Email",
        description: `Formatted HTML table for Quotation #${formatShortId(quotation.id)} is ready to paste into your email client.`
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      try {
        const range = document.createRange()
        range.selectNodeContents(emailTableRef.current)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.execCommand("copy")
        selection?.removeAllRanges()
        setCopied(true)
        sileo.success({
          title: "Quotation Copied",
          description: "Formatted quotation copied to clipboard."
        })
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackErr) {
        sileo.error({
          title: "Clipboard Copy Failed",
          description: "Your browser blocked clipboard access. Please try printing to PDF instead."
        })
      }
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deleteQuotation(quotation.id)
      if (res.success) {
        sileo.success({
          title: "Quotation Deleted",
          description: `Quotation #${formatShortId(quotation.id)} has been permanently removed.`
        })
        setIsDeleteModalOpen(false)
        router.push("/quotations")
        router.refresh()
      } else {
        sileo.error({
          title: "Could Not Delete Quotation",
          description: res.error || "An error occurred while deleting."
        })
      }
    } catch (e: any) {
      sileo.error({
        title: "Delete Error",
        description: e.message || "Failed to delete quotation."
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyLeadTime = async () => {
    const lines = quotation.items.map((item: any) => {
      const desc = item.product.materialDescription
      const lt = item.leadTime || "To be informed"
      return `${desc} - ${lt}`
    }).join("\n")
    
    try {
      await navigator.clipboard.writeText(lines)
      sileo.success({
        title: "Lead Times Copied",
        description: `Copied lead times for ${quotation.items.length} item(s) to clipboard.`
      })
    } catch (err) {
      sileo.error({
        title: "Copy Failed",
        description: "Unable to copy lead times to clipboard."
      })
    }
  }

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      
      const rows = quotation.items.filter((item: any) => item.spSnapshot > 0).map((item: any, index: number) => ({
        "SR NO": index + 1,
        "Code": item.product.materialCode,
        "Description": item.product.materialDescription,
        "Specification": item.product.specification || "",
        "Comment": item.comment || "",
        "Lead Time": item.leadTime || "",
        "Qty": item.quantity,
        "UOM": item.product.unit,
        "GST %": item.gstSnapshot || item.product.gstRate,
        "Rate (INR)": item.spSnapshot / 100,
        "Amount (INR)": Math.round(item.spSnapshot * item.quantity) / 100
      }))
      
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Subtotal (Excl. GST)",
        "Specification": "",
        "Comment": "",
        "Lead Time": "",
        "Qty": "",
        "UOM": "",
        "GST %": "",
        "Rate (INR)": "",
        "Amount (INR)": quotation.totalAmount / 100
      } as any)
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Total GST",
        "Specification": "",
        "Comment": "",
        "Lead Time": "",
        "Qty": "",
        "UOM": "",
        "GST %": "",
        "Rate (INR)": "",
        "Amount (INR)": quotation.totalGst / 100
      } as any)
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Grand Total (Incl. GST)",
        "Specification": "",
        "Comment": "",
        "Lead Time": "",
        "Qty": "",
        "UOM": "",
        "GST %": "",
        "Rate (INR)": "",
        "Amount (INR)": (quotation.totalAmount + quotation.totalGst) / 100
      } as any)

      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 18 },
        { wch: 45 },
        { wch: 30 },
        { wch: 25 },
        { wch: 16 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 14 },
        { wch: 16 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Quotation")
      XLSX.writeFile(workbook, `${pdfFilename}.xlsx`)
      sileo.success({
        title: "Excel Exported",
        description: `Downloaded ${pdfFilename}.xlsx`
      })
    } catch (err) {
      sileo.error({
        title: "Excel Export Failed",
        description: "Could not generate spreadsheet file."
      })
    }
  }

  const activeItems =
    quotation.status === "ACCEPTED" || quotation.status === "COMPLETED"
      ? quotation.items.filter((item: any) => item.isConfirmed !== false)
      : quotation.items
  const quotedItems = activeItems.filter((item: any) => item.spSnapshot > 0)
  const displayItems = quotedItems.length > 0 ? quotedItems : activeItems
  const confirmedCount = quotation.items.filter((item: any) => item.isConfirmed !== false).length

  const deleteImpactItems: string[] = [
    `${quotation.items?.length || 0} quotation line item(s) will be permanently removed`,
  ]
  const totalPosCount = quotation.purchaseOrders?.length ?? existingPosCount ?? 0
  if (totalPosCount > 0) {
    deleteImpactItems.push(
      `${totalPosCount} linked Purchase Order(s) will be unlinked from this quotation`
    )
  }
  if (quotation.purchases?.length > 0) {
    deleteImpactItems.push(
      `${quotation.purchases.length} linked Direct Purchase bill(s) will be unlinked from this quotation`
    )
  }
  if (quotation.cocs?.length > 0) {
    deleteImpactItems.push(
      `${quotation.cocs.length} linked Quality Certificate(s) (COC) will be unlinked`
    )
  }
  if (quotation.payments?.length > 0) {
    deleteImpactItems.push(
      `${quotation.payments.length} recorded payment transaction(s) will be removed`
    )
  }

  return (
    <>
      <QuotationOrderConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        quotationId={quotation.id}
        clientName={quotation.client?.name || "Client"}
        prNo={quotation.prNo}
        items={quotation.items}
      />

      <SmartMultiPoModal
        isOpen={isSmartSplitModalOpen}
        onClose={() => setIsSmartSplitModalOpen(false)}
        quotation={quotation}
        suppliers={suppliers}
        existingPos={quotation.purchaseOrders}
        existingPurchases={quotation.purchases}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        title={`Delete Quotation #${formatShortId(quotation.id)}?`}
        description={`Are you sure you want to permanently delete this quotation for ${
          quotation.client?.name || "this client"
        }? This action cannot be undone.`}
        impactItems={deleteImpactItems}
      />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setIsConfirmModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
          title="Select which items and quantities were confirmed by the client"
        >
          <CheckSquare className="w-4 h-4 text-white" />
          <span className="text-white">
            {quotation.status === "ACCEPTED" || quotation.status === "COMPLETED"
              ? `Confirmed Items (${confirmedCount}/${quotation.items.length})`
              : "Confirm Order (Full / Partial)"}
          </span>
        </button>

        {(quotation.status === "ACCEPTED" || quotation.status === "COMPLETED") && (
          <>
            <button
              onClick={() => {
                if (isFullyOrdered) {
                  sileo.warning({
                    title: "All Items Already Ordered",
                    description: "Purchase Orders have already been generated for all items in this quotation."
                  })
                  return
                }
                router.push(`/purchase-orders/new?quotationId=${quotation.id}`)
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all border ${
                isFullyOrdered
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>{isFullyOrdered ? "PO Fully Created" : "Create PO"}</span>
            </button>

            {!isFullyOrdered && (
              <button
                type="button"
                onClick={() => setIsSmartSplitModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-2xs"
                title="Split quotation items across multiple vendors and generate all POs in one click"
              >
                <Layers className="w-4 h-4 text-orange-600" />
                <span>Smart Split POs</span>
              </button>
            )}
          </>
        )}
        <button 
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Export Excel</span>
        </button>
        <button 
          onClick={handleCopyLeadTime}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Copy Lead Times</span>
        </button>
        <button 
          onClick={handleCopyEmail}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
          <span>{copied ? "Copied!" : "Copy for Email"}</span>
        </button>
        <button 
          onClick={() => router.push(`/quotations/new?duplicateFrom=${quotation.id}`)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          <Copy className="w-4 h-4 text-indigo-600" />
          <span>Duplicate</span>
        </button>
        <button 
          onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          <Edit className="w-4 h-4 text-slate-600" />
          <span>Edit</span>
        </button>
        <button 
          onClick={() => setIsDeleteModalOpen(true)}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-600 text-xs font-medium rounded-lg transition-colors border border-rose-200 shadow-xs"
        >
          <Trash2 className="w-4 h-4" />
          <span>{isDeleting ? "Deleting..." : "Delete"}</span>
        </button>
        <button 
          onClick={handlePrint}
          title={`Auto-filename: ${pdfFilename}.pdf`}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Printer className="w-4 h-4 text-white" />
          <span className="text-white">Print / Save PDF</span>
        </button>
      </div>

      {/* Unified Print & Email Template */}
      <DocumentPrintPortal filename={pdfFilename}>
        <CorporateDocumentTemplate
          ref={emailTableRef}
          docType="QUOTATION"
          docNumber={formatShortId(quotation.id)}
          date={quotation.createdAt}
          filename={pdfFilename}
          settings={settings}
          showBankDetails={true}
          metaRows={[
            ...(quotation.prNo ? [{ label: "Client PR No", value: quotation.prNo }] : []),
            ...(quotation.rfqNo ? [{ label: "Client RFQ No", value: quotation.rfqNo }] : []),
          ]}
          partyBox={{
            heading: "Quotation For (Client)",
            name: quotation.client?.name || "Client",
            address: quotation.client?.address,
            location: quotation.client?.location,
            gstNumber: quotation.client?.gstNumber,
            contact: quotation.client?.contact,
            email: quotation.client?.email,
          }}
          summaryBox={{
            heading: "Commercial Offer Summary",
            rows: [
              { label: "Total Line Items", value: `${displayItems.length} item(s)` },
              { label: "Currency", value: "INR (₹)" },
              ...(quotation.prNo ? [{ label: "PR Reference", value: quotation.prNo }] : []),
              ...(quotation.rfqNo ? [{ label: "RFQ Reference", value: quotation.rfqNo }] : []),
              {
                label: "Offer Status",
                value: quotation.status === "ACCEPTED" || quotation.status === "COMPLETED" ? "Confirmed Order" : "Commercial Offer",
              },
            ],
          }}
          introHtml={settings?.quotationMessage}
          columns={[
            { label: "#", width: "6%", align: "center" },
            { label: "Material Code", width: "15%", align: "left" },
            { label: "Description & Specification", width: "37%", align: "left" },
            { label: "Qty / UOM", width: "10%", align: "center" },
            { label: "GST", width: "7%", align: "center" },
            { label: "Unit Rate", width: "12%", align: "right" },
            { label: "Amount", width: "13%", align: "right" },
          ]}
          rows={displayItems.map((item: any, idx: number) => [
            <span key="idx" style={{ color: "#64748b", fontSize: "11px" }}>
              {idx + 1}
            </span>,
            <span
              key="code"
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {item.product.materialCode}
            </span>,
            <div key="desc">
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px" }}>
                {item.product.materialDescription}
              </div>
              {item.product.specification && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#475569",
                    whiteSpace: "pre-wrap",
                    marginTop: "3px",
                  }}
                >
                  {item.product.specification}
                </div>
              )}
              {item.comment && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#c2410c",
                    fontWeight: 600,
                    whiteSpace: "pre-wrap",
                    marginTop: "3px",
                  }}
                >
                  Note: {item.comment}
                </div>
              )}
              {item.leadTime && (
                <div
                  style={{
                    fontSize: "10.5px",
                    color: "#1d4ed8",
                    fontWeight: 600,
                    marginTop: "3px",
                  }}
                >
                  Lead Time: {item.leadTime}
                </div>
              )}
            </div>,
            <div key="qty">
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.quantity}</span>
              <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>
                {item.product.unit}
              </span>
            </div>,
            <span key="gst" style={{ fontSize: "11px", color: "#475569" }}>
              {item.gstSnapshot ?? item.product.gstRate}%
            </span>,
            <span
              key="rate"
              style={{
                fontSize: "11.5px",
                color: "#0f172a",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
              }}
            >
              {formatRupee(item.spSnapshot)}
            </span>,
            <span
              key="amt"
              style={{
                fontWeight: 700,
                color: "#0f172a",
                fontSize: "11.5px",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
              }}
            >
              {formatRupee(Math.round(item.spSnapshot * item.quantity))}
            </span>,
          ])}
          totals={{
            subtotal: quotation.totalAmount,
            totalGst: quotation.totalGst,
            grandTotal: quotation.totalAmount + quotation.totalGst,
          }}
        />
      </DocumentPrintPortal>
    </>
  )
}
