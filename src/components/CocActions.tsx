"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { deleteCocs, updateCocStatus } from "@/app/actions/coc"
import { Printer, Edit, Trash2, CheckCircle2, Ban } from "lucide-react"

export function CocActions({ id, currentStatus, coc, settings }: { id: string, currentStatus: string, coc: any, settings: any }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this Certificate of Conformance?")) return
    
    setIsDeleting(true)
    try {
      const res = await deleteCocs([id])
      if (res.success) {
        router.push("/cocs")
      } else {
        alert(res.error || "Failed to delete")
        setIsDeleting(false)
      }
    } catch (e) {
      alert("Error deleting COC")
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      const res = await updateCocStatus(id, newStatus)
      if (!res.success) {
        alert(res.error || "Failed to update status")
      }
    } catch (e) {
      alert("Error updating status")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {currentStatus === "DRAFT" && (
        <button
          onClick={() => handleStatusChange("ISSUED")}
          disabled={isUpdating}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-medium rounded-md transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">Mark as Issued</span>
        </button>
      )}

      {currentStatus === "ISSUED" && (
        <button
          onClick={() => handleStatusChange("CANCELLED")}
          disabled={isUpdating}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-medium rounded-md transition-colors disabled:opacity-50"
        >
          <Ban className="w-4 h-4" />
          <span className="text-sm">Cancel COC</span>
        </button>
      )}

      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 bg-brand-slate hover:bg-slate-500 text-white font-medium rounded-md transition-colors shadow-lg shadow-brand-slate/20"
      >
        <Printer className="w-4 h-4" />
        <span className="text-sm">Print COC</span>
      </button>

      <button
        onClick={() => router.push(`/cocs/${id}/edit`)}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-md transition-colors border border-premium-border"
      >
        <Edit className="w-4 h-4" />
        <span className="text-sm">Edit</span>
      </button>
      
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center justify-center p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-50"
        title="Delete COC"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Print Template */}
      <div className="hidden print:block w-full bg-white text-black min-h-screen relative overflow-hidden" style={{ margin: 0, padding: 0 }}>
        <style type="text/css" media="print">
          {`
            @page { margin: 15mm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
            * { font-family: var(--font-sans), 'Outfit', system-ui, sans-serif; }
            h1, h2, h3 { font-family: var(--font-heading), 'Montserrat', sans-serif !important; }
            
            /* Hide the global Next.js main layout elements if any leak through */
            nav, header, footer { display: none !important; }
          `}
        </style>
        
        {/* Background Watermark */}
        {settings?.logoUrl && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.05,
            pointerEvents: 'none',
            zIndex: 0,
            width: '60%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <img src={settings.logoUrl} style={{ width: '100%', height: 'auto', filter: 'grayscale(100%)' }} />
          </div>
        )}

        <div style={{ color: "#1f2937", width: "100%", maxWidth: "800px", margin: "0 auto", padding: "40px", boxSizing: "border-box", fontSize: "14px", lineHeight: "1.5", position: 'relative', zIndex: 10 }}>
          
          {/* Header */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ borderBottom: "2px solid #e5e7eb", paddingBottom: "20px", marginBottom: "30px" }}>
            <tbody>
              <tr>
                <td valign="top" width="50%">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt={settings.companyName} style={{ maxHeight: "60px", marginBottom: "16px" }} />
                  ) : (
                    <h1 style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "800", color: "#111827" }}>{settings?.companyName || "Company Name"}</h1>
                  )}
                  <div style={{ color: "#4b5563", fontSize: "12px", lineHeight: "1.4" }}>
                    {settings?.address && <div style={{ whiteSpace: "pre-wrap" }}>{settings.address}</div>}
                    {settings?.phone && <div>Tel: {settings.phone}</div>}
                    {settings?.email && <div>Email: {settings.email}</div>}
                  </div>
                </td>
                <td valign="top" width="50%" align="right">
                  <h2 style={{ margin: "0 0 12px 0", fontSize: "28px", fontWeight: "900", color: "#059669", textTransform: "uppercase", letterSpacing: "1px" }}>Certificate of Conformance</h2>
                  <table border={0} cellPadding={4} cellSpacing={0} style={{ display: "inline-block", textAlign: "left", fontSize: "12px" }}>
                    <tbody>
                      <tr>
                        <td style={{ color: "#6b7280", fontWeight: "bold", paddingRight: "16px" }}>COC Number:</td>
                        <td style={{ fontWeight: "600", color: "#111827" }}>{coc.cocNumber || coc.id.slice(0, 8)}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#6b7280", fontWeight: "bold", paddingRight: "16px" }}>Date of Issue:</td>
                        <td style={{ fontWeight: "600", color: "#111827" }}>{new Date(coc.date).toLocaleDateString()}</td>
                      </tr>
                      {coc.clientPoRef && (
                        <tr>
                          <td style={{ color: "#6b7280", fontWeight: "bold", paddingRight: "16px" }}>Client PO Ref:</td>
                          <td style={{ fontWeight: "600", color: "#111827" }}>{coc.clientPoRef}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Issued To */}
          <div style={{ marginBottom: "30px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "11px", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.5px", fontWeight: "700" }}>Issued To</h3>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#111827", marginBottom: "4px" }}>{coc.client.name}</div>
            {coc.client.address && <div style={{ color: "#4b5563", fontSize: "12px", whiteSpace: "pre-wrap" }}>{coc.client.address}</div>}
            {coc.client.gstNumber && <div style={{ color: "#4b5563", fontSize: "12px", marginTop: "4px" }}><strong>GSTIN:</strong> {coc.client.gstNumber}</div>}
          </div>

          {/* Statement */}
          <div style={{ marginBottom: "30px", fontSize: "15px", lineHeight: "1.6", color: "#374151", textAlign: "justify" }}>
            {coc.standardText ? (
              <div style={{ whiteSpace: "pre-wrap" }}>{coc.standardText}</div>
            ) : (
              <div>We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources.</div>
            )}
          </div>

          {/* Items Table */}
          <table width="100%" border={0} cellPadding={12} cellSpacing={0} style={{ borderCollapse: "collapse", marginBottom: "40px", border: "1px solid #e5e7eb" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb", textAlign: "left", fontSize: "11px", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.5px" }}>
                <th style={{ borderRight: "1px solid #e5e7eb" }}>#</th>
                <th style={{ borderRight: "1px solid #e5e7eb" }}>Product Description</th>
                <th style={{ borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Qty</th>
                <th style={{ borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Batch / Lot No.</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {coc.items.map((item: any, index: number) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb", fontSize: "12px" }}>
                  <td style={{ borderRight: "1px solid #e5e7eb", color: "#6b7280" }}>{index + 1}</td>
                  <td style={{ borderRight: "1px solid #e5e7eb" }}>
                    <div style={{ fontWeight: "600", color: "#111827", marginBottom: "2px" }}>{item.product.materialDescription}</div>
                    <div style={{ color: "#6b7280", fontSize: "11px" }}>{item.product.materialCode}</div>
                    {item.product.specification && (
                      <div style={{ color: "#6b7280", fontSize: "11px", marginTop: "2px" }}>{item.product.specification}</div>
                    )}
                  </td>
                  <td align="center" style={{ borderRight: "1px solid #e5e7eb", fontWeight: "600" }}>{item.quantity} <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: "normal" }}>{item.product.unit}</span></td>
                  <td align="center" style={{ borderRight: "1px solid #e5e7eb", fontWeight: "600", color: "#059669" }}>{item.batchNo || '-'}</td>
                  <td style={{ color: "#4b5563" }}>{item.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Remarks */}
          {coc.remarks && (
            <div style={{ marginBottom: "40px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "11px", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.5px", fontWeight: "700" }}>Additional Remarks</h3>
              <div style={{ fontSize: "13px", color: "#374151", whiteSpace: "pre-wrap", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px", border: "1px dashed #d1d5db" }}>
                {coc.remarks}
              </div>
            </div>
          )}

          {/* Signatures */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ marginTop: "60px", pageBreakInside: "avoid" }}>
            <tbody>
              <tr>
                <td valign="bottom" width="50%" align="left">
                </td>
                <td valign="bottom" width="50%" align="right">
                  <div style={{ display: "inline-block", textAlign: "center" }}>
                    <div style={{ fontWeight: "700", color: "#111827", fontSize: "14px", marginBottom: "4px" }}>For {settings?.companyName || "Company Name"}</div>
                    <div style={{ height: "60px" }}></div>
                    <div style={{ borderTop: "1px solid #9ca3af", paddingTop: "8px", color: "#4b5563", fontSize: "12px" }}>Authorized Signatory</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

        </div>
      </div>
    </div>
  )
}
