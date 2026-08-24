"use client"
import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { deleteCocs, updateCocStatus } from "@/app/actions/coc"
import { Printer, Edit, Trash2, CheckCircle2, Ban } from "lucide-react"

export function CocActions({ id, currentStatus, coc, settings }: { id: string, currentStatus: string, coc: any, settings: any }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

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
    <>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
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
      </div>

      {mounted && createPortal(
        <div id="coc-print-view" className="hidden print:block w-full bg-white text-black" style={{ margin: 0, padding: 0 }}>
        <style type="text/css" media="print">
          {`
            @media print {
            @page { size: A4; margin: 0; }
            
            /* Remove all backdrop filters which create false containing blocks for position: fixed */
            * {
              -webkit-backdrop-filter: none !important;
              backdrop-filter: none !important;
            }

            .cert-container {
              box-sizing: border-box;
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 20mm;
              background-color: #fff;
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #222;
              display: flex;
              flex-direction: column;
              position: relative;
            }
            .cert-watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.05;
              width: 55%;
              max-width: 400px;
              pointer-events: none;
              z-index: 1;
            }
            .cert-title {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              font-size: 26px;
              font-weight: 300;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin: 30px 0 25px;
              color: #111;
            }
            .cert-table th {
              background-color: #fafafa;
              border-bottom: 2px solid #222;
              border-top: 2px solid #222;
              padding: 12px 10px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              text-align: left;
            }
            .cert-table td {
              padding: 14px 10px;
              border-bottom: 1px solid #eee;
              font-size: 12px;
              vertical-align: top;
            }
            } /* close @media print */
          `}
        </style>

        <div className="cert-container">
          {/* Watermark */}
          {settings?.logoUrl && (
            <div className="cert-watermark">
              <img src={settings.logoUrl} style={{ width: '100%', height: 'auto', filter: 'grayscale(100%)' }} alt="Watermark" />
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
            
            {/* Header: Logo & Company Name */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #eaeaea", paddingBottom: "25px", marginBottom: "20px" }}>
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.companyName} style={{ maxHeight: "75px", objectFit: "contain" }} />
              ) : (
                <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>{settings?.companyName || "Company Name"}</h1>
              )}
              
              <div style={{ textAlign: "right", fontSize: "11px", color: "#555", lineHeight: "1.6", maxWidth: "250px" }}>
                <div style={{ fontWeight: "bold", color: "#222", fontSize: "14px", marginBottom: "4px" }}>{settings?.companyName || "Company Name"}</div>
                {settings?.address && <div style={{ whiteSpace: "pre-wrap" }}>{settings.address}</div>}
                {(settings?.phone || settings?.email) && (
                  <div style={{ marginTop: "4px" }}>
                    {settings?.phone && <span>T: {settings.phone}<br/></span>}
                    {settings?.email && <span>E: {settings.email}</span>}
                  </div>
                )}
                {settings?.gstNumber && <div style={{ marginTop: "4px" }}>GSTIN: {settings.gstNumber}</div>}
              </div>
            </div>

            <div className="cert-title">
              Certificate of Conformance
            </div>

            {/* Certificate Meta */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px", backgroundColor: "#fafafa", padding: "15px 20px", borderRadius: "4px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Certificate No.</div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>{coc.cocNumber || coc.id.slice(0, 8)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                {coc.clientPoRef && (
                  <>
                    <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>PO Reference</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>{coc.clientPoRef}</div>
                  </>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "10px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Date of Issue</div>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#111" }}>{new Date(coc.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>

            {/* Statement & Client */}
            <div style={{ marginBottom: "35px", fontSize: "13px", lineHeight: "1.7", color: "#333", padding: "0 10px" }}>
              <p style={{ marginBottom: "25px", fontSize: "14px" }}>
                {coc.standardText ? coc.standardText : "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."}
              </p>
              <div style={{ fontSize: "11px", color: "#777", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Issued To</div>
              <div style={{ fontSize: "16px", fontWeight: "600", color: "#111" }}>{coc.client.name}</div>
              {coc.client.address && <div style={{ fontSize: "13px", color: "#555", marginTop: "4px", maxWidth: "400px" }}>{coc.client.address}</div>}
            </div>

            {/* Items Table */}
            <table className="cert-table" width="100%" cellSpacing={0} cellPadding={0} style={{ borderCollapse: "collapse", marginBottom: "40px" }}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th style={{ width: "50%" }}>Description of Goods</th>
                  <th style={{ textAlign: "center", width: "80px" }}>Qty</th>
                  <th style={{ textAlign: "center", width: "120px" }}>Batch / Heat No.</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {coc.items.map((item: any, index: number) => {
                  const attrs = item.attributes ? JSON.parse(item.attributes) : [];
                  return (
                    <tr key={item.id}>
                      <td style={{ color: "#777", fontWeight: "500" }}>{String(index + 1).padStart(2, '0')}</td>
                      <td>
                        <div style={{ fontWeight: "600", fontSize: "13px", color: "#111", marginBottom: "3px" }}>{item.product.materialDescription}</div>
                        <div style={{ color: "#666", fontSize: "11px" }}>Part Code: {item.product.materialCode}</div>
                        {attrs.length > 0 && (
                          <div style={{ marginTop: "8px" }}>
                            {attrs.map((attr: any, i: number) => attr.key && attr.value ? (
                              <div key={i} style={{ display: 'flex', marginBottom: '3px', fontSize: '11px' }}>
                                <span style={{ minWidth: '90px', color: '#777' }}>{attr.key}:</span>
                                <strong style={{ color: '#222', fontWeight: "500" }}>{attr.value}</strong>
                              </div>
                            ) : null)}
                          </div>
                        )}
                      </td>
                      <td align="center" style={{ fontWeight: "600", fontSize: "13px" }}>{item.quantity} <span style={{ fontSize: "11px", color: "#777", fontWeight: "normal" }}>{item.product.unit}</span></td>
                      <td align="center" style={{ fontWeight: "500" }}>{item.batchNo || '-'}</td>
                      <td style={{ color: "#555" }}>{item.remarks || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Footer Section flex pusher */}
            <div style={{ flex: 1 }}></div>

            {/* Bottom Section (Signatures & Details) */}
            <div style={{ borderTop: "1px solid #eaeaea", paddingTop: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "40px" }}>
              
              {/* Left: Notes (Removed per user request) */}
              <div style={{ width: "55%", fontSize: "11px", color: "#666", lineHeight: "1.6" }}>
              </div>

              {/* Right: Signature */}
              <div style={{ width: "35%", textAlign: "center" }}>
                <div style={{ height: "100px", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "15px" }}>
                  {settings?.signatureUrl && (
                    <img src={settings.signatureUrl} alt="Signature" style={{ maxHeight: "85px", maxWidth: "100%", objectFit: "contain" }} />
                  )}
                </div>
                <div style={{ borderTop: "1px solid #222", paddingTop: "10px", fontWeight: "600", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#111" }}>
                  Authorized Signatory
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
      , document.body)}
    </>
  )
}
