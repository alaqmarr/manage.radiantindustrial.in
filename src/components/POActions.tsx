"use client"
import { Printer, Copy, Check, Edit, Trash2, Send, X, Loader2, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { deletePurchaseOrder } from "@/app/actions/purchaseOrder"
import { sendEmailAction } from "@/app/actions/email"
import { formatRupee, formatShortId } from "@/lib/utils"
import { sileo } from "sileo"
import {
  DocumentPrintPortal,
  CorporateDocumentTemplate,
  buildSmartPdfFilename,
  triggerPrintWithFilename,
} from "./DocumentTemplate"
import { ConfirmDeleteModal } from "./ConfirmDeleteModal"

export function POActions({ 
  po, 
  settings 
}: { 
  po: any, 
  settings: any 
}) {
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const emailTableRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [validEmails, setValidEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<{email: string, status: 'success'|'failed', error?: string}[] | null>(null)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const poLabel = po.poNumber || formatShortId(po.id)

  const pdfFilename = buildSmartPdfFilename({
    docType: "PurchaseOrder",
    docNumber: poLabel,
    partyName: po.supplier?.name,
    referenceNo: po.quotation?.prNo || (po.quotation?.id ? formatShortId(po.quotation.id) : po.rfqId),
    date: po.createdAt,
  })

  const parseEmails = (input: string) => {
    const parts = input.split(/[\s,;]+/)
    const newValidEmails = [...validEmails]
    let hasChanges = false
    parts.forEach(part => {
      const trimmed = part.trim()
      if (trimmed && emailRegex.test(trimmed) && !newValidEmails.includes(trimmed)) {
        newValidEmails.push(trimmed)
        hasChanges = true
      }
    })
    if (hasChanges) setValidEmails(newValidEmails)
  }

  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setEmailInput(val)
    if (val.endsWith(" ") || val.endsWith(",") || val.endsWith(";")) {
      parseEmails(val)
      setEmailInput("")
    }
  }

  const handleEmailInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    parseEmails(e.clipboardData.getData("text"))
  }

  const removeEmail = (emailToRemove: string) => {
    setValidEmails(validEmails.filter(e => e !== emailToRemove))
  }

  const handleSendEmail = async () => {
    if (!emailTableRef.current) return
    const finalEmails = [...validEmails]
    if (emailInput.trim() && emailRegex.test(emailInput.trim()) && !finalEmails.includes(emailInput.trim())) {
      finalEmails.push(emailInput.trim())
    }
    if (finalEmails.length === 0) {
      sileo.warning({
        title: "No Recipient Emails",
        description: "Please enter at least one valid supplier email address."
      })
      return
    }

    setValidEmails(finalEmails)
    setEmailInput("")
    setIsSending(true)
    setSendResults(null)
    try {
      const htmlContent = emailTableRef.current.innerHTML
      const result = await sendEmailAction({
        to: finalEmails,
        subject: `Purchase Order ${poLabel} from ${settings?.companyName || "Radiant Industrial Company"}`,
        html: htmlContent
      })

      if (result.error && !result.results) {
        sileo.error({
          title: "Email Delivery Failed",
          description: result.error
        })
      } else if (result.results) {
        setSendResults(result.results as any)
        const sentCount = (result.results as any[]).filter(r => r.status === "success").length
        sileo.success({
          title: "Purchase Order Sent",
          description: `Successfully emailed ${poLabel} to ${sentCount} recipient(s).`
        })
      }
    } catch (err) {
      sileo.error({
        title: "Network Error",
        description: "Failed to send Purchase Order email."
      })
    } finally {
      setIsSending(false)
    }
  }

  const handlePrint = () => {
    triggerPrintWithFilename(pdfFilename, `Purchase Order #${poLabel}`)
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
        title: "Purchase Order Copied",
        description: `Formatted HTML table for ${poLabel} copied to clipboard.`
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
          title: "Purchase Order Copied",
          description: "Formatted Purchase Order copied to clipboard."
        })
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackErr) {
        sileo.error({
          title: "Copy Failed",
          description: "Your browser blocked clipboard access."
        })
      }
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deletePurchaseOrder(po.id)
      if (res.success) {
        sileo.success({
          title: "Purchase Order Deleted",
          description: `${poLabel} has been deleted.`
        })
        setIsDeleteModalOpen(false)
        router.push("/purchase-orders")
        router.refresh()
      } else {
        sileo.error({
          title: "Delete Failed",
          description: res.error
        })
      }
    } catch (e: any) {
      sileo.error({
        title: "Delete Failed",
        description: "Could not delete Purchase Order."
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      
      const rows = po.items.map((item: any, index: number) => ({
        "SR NO": index + 1,
        "Code": item.product.materialCode,
        "Description": item.product.materialDescription,
        "Specification": item.product.specification || "",
        "Comment": item.comment || "",
        "Qty": item.quantity,
        "UOM": item.product.unit,
        "GST %": item.gstRate,
        "Rate (INR)": item.unitPrice / 100,
        "Amount (INR)": (item.quantity * item.unitPrice) / 100
      }))
      
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Subtotal (Excl. GST)",
        "Specification": "",
        "Comment": "",
        "Qty": "",
        "UOM": "",
        "GST %": "",
        "Rate (INR)": "",
        "Amount (INR)": po.totalAmount / 100
      } as any)
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Total GST",
        "Specification": "",
        "Comment": "",
        "Qty": "",
        "UOM": "",
        "GST %": "",
        "Rate (INR)": "",
        "Amount (INR)": po.totalGst / 100
      } as any)
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Grand Total (Incl. GST)",
        "Specification": "",
        "Comment": "",
        "Qty": "",
        "UOM": "",
        "GST %": "",
        "Rate (INR)": "",
        "Amount (INR)": (po.totalAmount + po.totalGst) / 100
      } as any)

      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 18 },
        { wch: 45 },
        { wch: 30 },
        { wch: 25 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 14 },
        { wch: 16 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Order")
      XLSX.writeFile(workbook, `${pdfFilename}.xlsx`)
      sileo.success({
        title: "Excel Exported",
        description: `Downloaded ${pdfFilename}.xlsx`
      })
    } catch (err) {
      sileo.error({
        title: "Export Failed",
        description: "Failed to export Purchase Order to Excel."
      })
    }
  }

  const deleteImpactItems: string[] = [
    `Supplier: ${po.supplier?.name || "Unknown Supplier"}`,
    `${po.items?.length || 0} PO line item(s) worth ${formatRupee((po.totalAmount || 0) + (po.totalGst || 0))} will be removed`,
  ]
  if (po.quotationId) {
    deleteImpactItems.push(
      `Linked Quotation #${formatShortId(po.quotationId)} fulfillment count will be released`
    )
  }
  if (po.deliveries?.length > 0) {
    deleteImpactItems.push(
      `${po.deliveries.length} Goods Receipt (GRN) record(s) will be removed`
    )
  }
  if (po.payments?.length > 0) {
    deleteImpactItems.push(
      `${po.payments.length} recorded vendor payment(s) will be removed`
    )
  }

  return (
    <>
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        title={`Delete Purchase Order ${poLabel}?`}
        description={`Are you sure you want to permanently delete this Purchase Order issued to ${
          po.supplier?.name || "this vendor"
        }? This action cannot be undone.`}
        impactItems={deleteImpactItems}
      />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button 
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Export Excel</span>
        </button>
        <button 
          onClick={handleCopyEmail}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
          <span>{copied ? "Copied!" : "Copy for Email"}</span>
        </button>
        <button 
          onClick={() => {
            setIsSendModalOpen(true)
            setSendResults(null)
            if (po.supplier?.email) {
              setValidEmails([po.supplier.email])
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Email PO</span>
        </button>
        <button 
          onClick={() => router.push(`/purchase-orders/${po.id}/edit`)}
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
          docType="PURCHASE ORDER"
          docNumber={poLabel}
          date={po.createdAt}
          filename={pdfFilename}
          settings={settings}
          metaRows={[
            ...(po.expectedDeliveryDate
              ? [
                  {
                    label: "Expected Delivery",
                    value: new Date(po.expectedDeliveryDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }),
                  },
                ]
              : []),
            ...(po.quotation?.id
              ? [{ label: "Quote Ref", value: formatShortId(po.quotation.id) }]
              : []),
            ...(po.rfqId ? [{ label: "RFQ Ref", value: formatShortId(po.rfqId) }] : []),
          ]}
          partyBox={{
            heading: "Vendor / Supplier",
            name: po.supplier?.name || "Vendor",
            location: po.supplier?.location,
            gstNumber: po.supplier?.gstNumber,
            contact: po.supplier?.contact,
            email: po.supplier?.email,
          }}
          summaryBox={{
            heading: "Ship & Bill To / Order Terms",
            title: settings?.companyName || "Radiant Industrial Company",
            subtitle: settings?.shippingAddress || settings?.address || undefined,
            rows: [
              { label: "Payment Terms", value: po.paymentTerms || "As per agreement" },
              { label: "Delivery Terms", value: po.deliveryTerms || "Ex-Works / Door Delivery" },
              {
                label: "Expected Delivery",
                value: po.expectedDeliveryDate
                  ? new Date(po.expectedDeliveryDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Immediate",
              },
            ],
          }}
          columns={[
            { label: "#", width: "6%", align: "center" },
            { label: "Material Code", width: "15%", align: "left" },
            { label: "Description & Specification", width: "37%", align: "left" },
            { label: "Qty / UOM", width: "10%", align: "center" },
            { label: "GST", width: "7%", align: "center" },
            { label: "Unit Rate", width: "12%", align: "right" },
            { label: "Amount", width: "13%", align: "right" },
          ]}
          rows={po.items.map((item: any, idx: number) => [
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
            </div>,
            <div key="qty">
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.quantity}</span>
              <span style={{ fontSize: "10px", color: "#64748b", display: "block" }}>
                {item.product.unit}
              </span>
            </div>,
            <span key="gst" style={{ fontSize: "11px", color: "#475569" }}>
              {item.gstRate}%
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
              {formatRupee(item.unitPrice)}
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
              {formatRupee(Math.round(item.quantity * item.unitPrice))}
            </span>,
          ])}
          totals={{
            subtotal: po.totalAmount,
            totalGst: po.totalGst,
            grandTotal: po.totalAmount + po.totalGst,
          }}
          notesBox={
            po.notes
              ? {
                  heading: "Special Instructions / Notes",
                  text: po.notes,
                }
              : null
          }
        />
      </DocumentPrintPortal>

      {isSendModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 shadow-xl relative max-h-[90vh] flex flex-col">
            {!isSending && (
              <button 
                onClick={() => setIsSendModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {sendResults ? "Email Delivery Summary" : isSending ? "Sending Purchase Order..." : `Email PO (${poLabel})`}
            </h3>
            
            {!sendResults && !isSending && (
              <p className="text-slate-500 text-sm mb-5">
                Enter or paste supplier email addresses below. Press Enter, Space, or Comma to add multiple recipients.
              </p>
            )}

            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              {!sendResults && !isSending ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Recipients</label>
                  <div
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-wrap gap-2 items-start min-h-[90px] focus-within:border-brand-orange focus-within:bg-white transition-all cursor-text"
                    onClick={() => document.getElementById("po-email-input")?.focus()}
                  >
                    {validEmails.map(email => (
                      <div key={email} className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-brand-orange px-2.5 py-1 rounded-md text-xs font-medium">
                        <span>{email}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeEmail(email); }} className="hover:text-orange-900">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <input
                      id="po-email-input"
                      type="text"
                      value={emailInput}
                      onChange={handleEmailInputChange}
                      onPaste={handleEmailInputPaste}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          if (emailInput.trim()) {
                            parseEmails(emailInput)
                            setEmailInput("")
                          }
                        } else if (e.key === "Backspace" && !emailInput && validEmails.length > 0) {
                          const newEmails = [...validEmails]
                          newEmails.pop()
                          setValidEmails(newEmails)
                        }
                      }}
                      placeholder={validEmails.length === 0 ? "supplier@company.com" : ""}
                      className="flex-1 bg-transparent border-none outline-none text-slate-900 min-w-[180px] py-1 text-sm"
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-slate-900">{validEmails.length}</div>
                      <div className="text-[11px] text-slate-500 font-semibold uppercase">Total</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {sendResults ? sendResults.filter(r => r.status === "success").length : "-"}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold uppercase">Sent</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-rose-600">
                        {sendResults ? sendResults.filter(r => r.status === "failed").length : "-"}
                      </div>
                      <div className="text-[11px] text-rose-700 font-semibold uppercase">Failed</div>
                    </div>
                  </div>

                  {isSending && !sendResults && (
                    <div className="flex flex-col items-center justify-center py-6 space-y-3">
                      <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
                      <p className="text-slate-600 text-sm font-medium">Dispatching Purchase Order email...</p>
                    </div>
                  )}

                  {sendResults && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="px-3 py-2.5 font-semibold">Recipient</th>
                            <th className="px-3 py-2.5 font-semibold">Status</th>
                            <th className="px-3 py-2.5 font-semibold">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sendResults.map((result, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2.5 text-slate-900 font-medium">{result.email}</td>
                              <td className="px-3 py-2.5">
                                {result.status === "success" ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                                    <XCircle className="w-3.5 h-3.5" /> Failed
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 font-mono">{result.error || "Delivered"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex justify-end gap-2">
              {!sendResults && !isSending ? (
                <>
                  <button
                    onClick={() => setIsSendModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSendEmail}
                    className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send PO Email</span>
                  </button>
                </>
              ) : sendResults ? (
                <button 
                  onClick={() => setIsSendModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                >
                  Done
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
