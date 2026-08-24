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

      {/* Print Template - Certificate Style */}
      <div className="hidden print:block w-full bg-white text-black relative" style={{ margin: 0, padding: 0, minHeight: "100vh" }}>
        <style type="text/css" media="print">
          {`
            @page { margin: 0; size: A4 portrait; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; margin: 0; padding: 0; }
            * { box-sizing: border-box; }
            nav, header, footer { display: none !important; }
            
            .cert-container {
              width: 210mm;
              min-height: 297mm;
              padding: 20mm;
              position: relative;
              background-color: #fff;
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #111;
            }
            .cert-border {
              position: absolute;
              top: 10mm; left: 10mm; right: 10mm; bottom: 10mm;
              border: 1px solid #111;
              padding: 2mm;
            }
            .cert-inner-border {
              width: 100%;
              height: 100%;
              border: 3px solid #111;
              position: relative;
              z-index: 10;
              padding: 15mm;
              display: flex;
              flex-direction: column;
            }
            .cert-watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.04;
              width: 60%;
              pointer-events: none;
              z-index: 1;
            }
            .cert-title {
              font-family: 'Georgia', serif;
              font-size: 32px;
              font-weight: bold;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 4px;
              margin: 20px 0;
              color: #000;
            }
            .cert-table th {
              background-color: #f8f9fa;
              border-bottom: 2px solid #000;
              border-top: 1px solid #000;
              padding: 10px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              text-align: left;
            }
            .cert-table td {
              padding: 12px 10px;
              border-bottom: 1px dashed #ccc;
              font-size: 12px;
              vertical-align: top;
            }
          `}
        </style>

        <div className="cert-container">
          <div className="cert-border">
            <div className="cert-inner-border">
              
              {/* Watermark */}
              {settings?.logoUrl && (
                <div className="cert-watermark">
                  <img src={settings.logoUrl} style={{ width: '100%', height: 'auto', filter: 'grayscale(100%)' }} alt="Watermark" />
                </div>
              )}

              <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                {/* Header Logo */}
                <div style={{ textAlign: "center", marginBottom: "10px" }}>
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt={settings.companyName} style={{ maxHeight: "80px", objectFit: "contain" }} />
                  ) : (
                    <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "bold", fontFamily: "'Georgia', serif" }}>{settings?.companyName || "Company Name"}</h1>
                  )}
                </div>

                <div className="cert-title">
                  Certificate of Conformance
                </div>

                {/* Certificate Meta */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px", borderBottom: "1px solid #000", paddingBottom: "15px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Certificate No.</div>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000" }}>{coc.cocNumber || coc.id.slice(0, 8)}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {coc.clientPoRef && (
                      <>
                        <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>PO Reference</div>
                        <div style={{ fontSize: "14px", fontWeight: "bold", color: "#000" }}>{coc.clientPoRef}</div>
                      </>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Date of Issue</div>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000" }}>{new Date(coc.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>

                {/* Statement & Client */}
                <div style={{ marginBottom: "30px", fontSize: "14px", lineHeight: "1.6", textAlign: "center", padding: "0 20px" }}>
                  <p style={{ marginBottom: "15px" }}>
                    {coc.standardText ? coc.standardText : "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."}
                  </p>
                  <div style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "1px", marginTop: "25px", marginBottom: "5px" }}>Issued To</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "'Georgia', serif" }}>{coc.client.name}</div>
                  {coc.client.address && <div style={{ fontSize: "12px", color: "#444", marginTop: "4px" }}>{coc.client.address}</div>}
                </div>

                {/* Items Table */}
                <table className="cert-table" width="100%" cellSpacing={0} cellPadding={0} style={{ borderCollapse: "collapse", marginBottom: "30px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>#</th>
                      <th style={{ width: "45%" }}>Description of Goods</th>
                      <th style={{ textAlign: "center", width: "100px" }}>Qty</th>
                      <th style={{ textAlign: "center", width: "130px" }}>Batch / Heat No.</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coc.items.map((item: any, index: number) => {
                      const attrs = item.attributes ? JSON.parse(item.attributes) : [];
                      return (
                        <tr key={item.id}>
                          <td style={{ color: "#666", fontWeight: "bold" }}>{String(index + 1).padStart(2, '0')}</td>
                          <td>
                            <div style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>{item.product.materialDescription}</div>
                            <div style={{ color: "#666", fontSize: "11px", marginBottom: "4px" }}>Part Code: {item.product.materialCode}</div>
                            {item.product.specification && (
                              <div style={{ color: "#444", fontSize: "11px", marginBottom: "6px" }}>{item.product.specification}</div>
                            )}
                            {attrs.length > 0 && (
                              <div style={{ marginTop: "6px" }}>
                                {attrs.map((attr: any, i: number) => attr.key && attr.value ? (
                                  <div key={i} style={{ display: 'flex', marginBottom: '2px', fontSize: '11px' }}>
                                    <span style={{ minWidth: '90px', color: '#666' }}>{attr.key}:</span>
                                    <strong style={{ color: '#000' }}>{attr.value}</strong>
                                  </div>
                                ) : null)}
                              </div>
                            )}
                          </td>
                          <td align="center" style={{ fontWeight: "bold", fontSize: "13px" }}>{item.quantity} <span style={{ fontSize: "10px", color: "#666", fontWeight: "normal" }}>{item.product.unit}</span></td>
                          <td align="center" style={{ fontWeight: "bold" }}>{item.batchNo || 'N/A'}</td>
                          <td style={{ color: "#444" }}>{item.remarks || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Footer Section flex pusher */}
                <div style={{ flex: 1 }}></div>

                {/* Bottom Section (Signatures & Company Details) */}
                <div style={{ borderTop: "1px solid #000", paddingTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  
                  {/* Left: Company details / notes */}
                  <div style={{ width: "50%", fontSize: "10px", color: "#666", lineHeight: "1.5" }}>
                    <div style={{ fontWeight: "bold", color: "#000", marginBottom: "4px", fontSize: "12px" }}>{settings?.companyName || "Company Name"}</div>
                    {settings?.address && <div style={{ whiteSpace: "pre-wrap", marginBottom: "4px" }}>{settings.address}</div>}
                    <div>
                      {settings?.phone && <span style={{ marginRight: '10px' }}>T: {settings.phone}</span>}
                      {settings?.email && <span>E: {settings.email}</span>}
                    </div>
                    {settings?.gstApiKey && <div style={{ marginTop: "2px" }}>GSTIN: {settings.gstApiKey}</div>}
                    {settings?.bottomDetails && (
                      <div style={{ marginTop: "10px", whiteSpace: "pre-wrap", color: "#444" }}>
                        {settings.bottomDetails}
                      </div>
                    )}
                  </div>

                  {/* Right: Signature */}
                  <div style={{ width: "40%", textAlign: "center" }}>
                    <div style={{ height: "90px", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "10px" }}>
                      {settings?.signatureUrl && (
                        <img src={settings.signatureUrl} alt="Signature" style={{ maxHeight: "80px", maxWidth: "200px", objectFit: "contain" }} />
                      )}
                    </div>
                    <div style={{ borderTop: "1px solid #000", paddingTop: "8px", fontWeight: "bold", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Authorized Signatory
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
