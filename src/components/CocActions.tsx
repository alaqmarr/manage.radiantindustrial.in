"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { deleteCocs, updateCocStatus } from "@/app/actions/coc"
import { Printer, Edit, Trash2, CheckCircle2, Ban } from "lucide-react"
import { sileo } from "sileo"
import {
  DocumentPrintPortal,
  CorporateDocumentTemplate,
  buildSmartPdfFilename,
  triggerPrintWithFilename,
} from "./DocumentTemplate"
import { ConfirmDeleteModal } from "./ConfirmDeleteModal"
import { formatShortId } from "@/lib/utils"

export function CocActions({ id, currentStatus, coc, settings }: { id: string, currentStatus: string, coc: any, settings: any }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const cocDisplayNo = coc.cocNumber || formatShortId(coc.id)
  const pdfFilename = buildSmartPdfFilename({
    docType: "COC",
    docNumber: cocDisplayNo,
    partyName: coc.client?.name,
    referenceNo: coc.clientPoRef,
    date: coc.date,
  })

  const handlePrint = () => {
    triggerPrintWithFilename(pdfFilename, `COC #${cocDisplayNo}`)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deleteCocs([id])
      if (res.success) {
        sileo.success({
          title: "Certificate Deleted",
          description: `COC ${cocDisplayNo} has been removed.`
        })
        setIsDeleteModalOpen(false)
        router.push("/cocs")
      } else {
        sileo.error({
          title: "Delete Failed",
          description: res.error || "Failed to delete Certificate of Conformance."
        })
        setIsDeleting(false)
      }
    } catch (e) {
      sileo.error({
        title: "Delete Failed",
        description: "Error deleting COC."
      })
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      const res = await updateCocStatus(id, newStatus)
      if (!res.success) {
        sileo.error({
          title: "Status Update Failed",
          description: res.error || "Failed to update status"
        })
      } else {
        sileo.success({
          title: `Certificate Marked as ${newStatus}`,
          description: `COC ${cocDisplayNo} status updated to ${newStatus}.`
        })
        router.refresh()
      }
    } catch (e) {
      sileo.error({
        title: "Status Update Error",
        description: "Could not update COC status."
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {currentStatus === "DRAFT" && (
          <button
            onClick={() => handleStatusChange("ISSUED")}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark as Issued</span>
          </button>
        )}

        {currentStatus === "ISSUED" && (
          <button
            onClick={() => handleStatusChange("CANCELLED")}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Ban className="w-4 h-4" />
            <span>Cancel COC</span>
          </button>
        )}

        <button
          onClick={() => router.push(`/cocs/${id}/edit`)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 shadow-xs"
        >
          <Edit className="w-4 h-4 text-slate-600" />
          <span>Edit</span>
        </button>

        <button
          onClick={() => setIsDeleteModalOpen(true)}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-600 text-xs font-medium rounded-lg transition-colors border border-rose-200 shadow-xs disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          title={`Save PDF as: ${pdfFilename}.pdf`}
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        title={`Delete COC #${cocDisplayNo}?`}
        description={`Are you sure you want to permanently delete Certificate of Conformance #${cocDisplayNo} for ${coc.client?.name || "this client"}?`}
        impactItems={
          coc.status === "ISSUED"
            ? ["This Certificate of Conformance has already been marked as ISSUED."]
            : []
        }
      />

      <DocumentPrintPortal filename={pdfFilename}>
        <CorporateDocumentTemplate
          docType="CERTIFICATE OF CONFORMANCE"
          docNumber={cocDisplayNo}
          date={coc.date}
          filename={pdfFilename}
          metaRows={[
            ...(coc.clientPoRef ? [{ label: "Client PO Ref", value: coc.clientPoRef }] : []),
            ...(coc.quotationId ? [{ label: "Quotation Ref", value: formatShortId(coc.quotationId) }] : []),
          ]}
          settings={settings}
          partyBox={{
            heading: "Issued To (Client)",
            name: coc.client?.name || "Client",
            address: coc.client?.address,
            gstNumber: coc.client?.gstNumber,
            contact: coc.client?.contactPerson || coc.client?.phone,
            email: coc.client?.email,
          }}
          summaryBox={{
            heading: "Conformance Declaration",
            declarationText:
              coc.standardText ||
              settings?.cocMessage ||
              "We hereby certify that the materials supplied against this order conform strictly to your company standards and specifications, and have been procured from genuine, verified sources.",
          }}
          columns={[
            { label: "#", width: "6%", align: "center" },
            { label: "Material Code", width: "16%", align: "left" },
            { label: "Description & Technical Attributes", width: "40%", align: "left" },
            { label: "Qty / UOM", width: "12%", align: "center" },
            { label: "Batch / Heat No.", width: "13%", align: "center" },
            { label: "Remarks", width: "13%", align: "left" },
          ]}
          rows={coc.items.map((item: any, index: number) => [
            <span key="idx" style={{ color: "#64748b", fontSize: "11px", fontWeight: 600 }}>{index + 1}</span>,
            <span key="code" style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>
              {item.product.materialCode}
            </span>,
            <div key="desc">
              <div style={{ fontWeight: 700, fontSize: "12px", color: "#0f172a" }}>
                {item.itemDescription || item.product.materialDescription}
              </div>
              {item.product.specification && (
                <div style={{ fontSize: "10.5px", color: "#475569", whiteSpace: "pre-wrap", marginTop: "2px" }}>
                  {item.product.specification}
                </div>
              )}
              {(() => {
                try {
                  const parsed = JSON.parse(item.attributes || "[]")
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    return (
                      <div style={{ marginTop: "6px", paddingTop: "4px", borderTop: "1px dashed #e2e8f0" }}>
                        {parsed.map((attr: { key: string; value: string }, i: number) =>
                          attr.key && attr.value ? (
                            <div key={i} style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>
                              <span style={{ color: "#64748b" }}>{attr.key}:</span>{" "}
                              <strong style={{ color: "#0f172a" }}>{attr.value}</strong>
                            </div>
                          ) : null
                        )}
                      </div>
                    )
                  }
                } catch {
                  return null
                }
                return null
              })()}
            </div>,
            <div key="qty">
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.quantity}</span>
              <span style={{ fontSize: "10px", color: "#64748b", display: "block", fontWeight: 600 }}>
                {item.product.unit}
              </span>
            </div>,
            <span key="batch" style={{ fontWeight: 700, color: "#0f172a", fontSize: "11px", fontFamily: "monospace" }}>
              {item.batchNo || "—"}
            </span>,
            <span key="rem" style={{ color: "#475569", fontSize: "11px" }}>
              {item.remarks || "Verified Conforming"}
            </span>,
          ])}
          notesBox={
            coc.remarks
              ? {
                  heading: "Additional Certificate Remarks",
                  text: coc.remarks,
                }
              : null
          }
        />
      </DocumentPrintPortal>
    </>
  )
}
