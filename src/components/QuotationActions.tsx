"use client"
import { Printer, Copy, Check, Edit, Trash2 } from "lucide-react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { deleteQuotation } from "@/app/actions/quotation"

export function QuotationActions({ 
  quotation, 
  settings 
}: { 
  quotation: any, 
  settings: any 
}) {
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const emailTableRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const handlePrint = () => {
    window.print()
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
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to use Clipboard API, falling back to basic copy", err)
      try {
        // Fallback for non-HTTPS or browsers that don't support ClipboardItem
        const range = document.createRange()
        range.selectNodeContents(emailTableRef.current)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        // This requires the hidden div to actually be visible enough to be selected,
        // but since it's `hidden print:block`, standard `execCommand` might fail.
        // Let's temporarily make it visible for copying
        const originalClass = emailTableRef.current.parentElement?.className
        if (emailTableRef.current.parentElement) {
          emailTableRef.current.parentElement.className = 'w-full bg-white text-black p-8 absolute top-[-9999px] left-[-9999px]'
        }
        
        document.execCommand('copy')
        
        if (emailTableRef.current.parentElement && originalClass) {
          emailTableRef.current.parentElement.className = originalClass
        }
        
        selection?.removeAllRanges()
        
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackErr) {
        console.error("Fallback copy also failed", fallbackErr)
        alert("Failed to copy. Your browser might not support this feature.")
      }
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this quotation?")) return
    setIsDeleting(true)
    try {
      const res = await deleteQuotation(quotation.id)
      if (res.success) {
        router.push("/quotations")
        router.refresh()
      } else {
        alert(res.error)
      }
    } catch (e: any) {
      alert("Failed to delete quotation")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="flex gap-3 print:hidden">
        <button 
          onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-colors border border-premium-border active:scale-95"
        >
          <Edit className="w-4 h-4" />
          <span className="text-sm">Edit</span>
        </button>
        <button 
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-medium rounded-lg transition-colors border border-rose-500/20 active:scale-95 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">{isDeleting ? "Deleting..." : "Delete"}</span>
        </button>
        <button 
          onClick={handleCopyEmail}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-colors border border-premium-border active:scale-95"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="text-sm">{copied ? "Copied!" : "Copy for Email"}</span>
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-lg transition-all active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span className="text-sm">Print Quotation</span>
        </button>
      </div>

      {/* Print Template & Hidden Email Table */}
      {/* Print Template & Hidden Email Table */}
      <div className="hidden print:block w-full bg-white text-black">
        <style type="text/css" media="print">
          {`
            @page { margin: 15mm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
            * { font-family: 'Inter', system-ui, sans-serif; }
          `}
        </style>
        
        <div ref={emailTableRef} style={{ color: "#1f2937", maxWidth: "800px", margin: "0 auto", fontSize: "14px", lineHeight: "1.5" }}>
          
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #f3f4f6", paddingBottom: "24px", marginBottom: "32px" }}>
            <div>
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.companyName} style={{ maxHeight: "64px", marginBottom: "16px" }} />
              ) : (
                <h1 style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "700", color: "#111827" }}>{settings?.companyName || "Company Name"}</h1>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "800", color: "#f97316", textTransform: "uppercase", letterSpacing: "1px" }}>Quotation</h2>
              <p style={{ margin: "0 0 4px 0", color: "#4b5563" }}><strong>Date:</strong> {new Date(quotation.createdAt).toLocaleDateString()}</p>
              <p style={{ margin: "0", color: "#4b5563" }}><strong>Quote No:</strong> {quotation.id}</p>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
            <div style={{ flex: 1, paddingRight: "20px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "12px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Quote To</h3>
              <p style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600", color: "#111827" }}>{quotation.client.name}</p>
              {quotation.client.email && <p style={{ margin: "0 0 4px 0", color: "#4b5563" }}>{quotation.client.email}</p>}
            </div>
            
            <div style={{ flex: 1, paddingLeft: "20px", borderLeft: "1px solid #f3f4f6" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "12px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Reference</h3>
              {quotation.prNo && <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#4b5563" }}>PR No:</strong> {quotation.prNo}</p>}
              {quotation.rfqNo && <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#4b5563" }}>RFQ No:</strong> {quotation.rfqNo}</p>}
            </div>
          </div>

          {settings?.quotationMessage && (
            <div style={{ marginBottom: "32px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", color: "#374151" }}>
              <p style={{ margin: "0", whiteSpace: "pre-wrap" }}>{settings.quotationMessage}</p>
            </div>
          )}

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb", textAlign: "left", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", fontWeight: "600" }}>Item</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb", textAlign: "left", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", fontWeight: "600" }}>Description</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb", textAlign: "center", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", fontWeight: "600" }}>Qty</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb", textAlign: "right", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", fontWeight: "600" }}>Rate</th>
                <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb", textAlign: "right", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", fontWeight: "600" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.filter((item: any) => item.spSnapshot > 0).map((item: any) => (
                <tr key={item.id}>
                  <td style={{ padding: "16px 8px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" }}>
                    <span style={{ fontFamily: "monospace", color: "#4b5563" }}>{item.product.materialCode}</span>
                  </td>
                  <td style={{ padding: "16px 8px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" }}>
                    <div style={{ fontWeight: "600", color: "#111827", marginBottom: "4px" }}>{item.product.materialDescription}</div>
                    {item.product.specification && (
                      <div style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "pre-wrap", marginBottom: "4px" }}>{item.product.specification}</div>
                    )}
                    {item.comment && (
                      <div style={{ fontSize: "12px", color: "#555", fontStyle: "italic", whiteSpace: "pre-wrap", marginTop: "4px" }}>{item.comment}</div>
                    )}
                  </td>
                  <td style={{ padding: "16px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center", verticalAlign: "top" }}>
                    <span style={{ fontWeight: "500", color: "#374151" }}>{item.quantity}</span>
                    <span style={{ fontSize: "12px", color: "#9ca3af", marginLeft: "4px" }}>{item.product.unit}</span>
                  </td>
                  <td style={{ padding: "16px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right", verticalAlign: "top" }}>
                    ₹{(item.spSnapshot / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: "16px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right", verticalAlign: "top", fontWeight: "500", color: "#111827" }}>
                    ₹{(Math.round(item.spSnapshot * item.quantity) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "40px" }}>
            <div style={{ width: "300px", padding: "24px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", color: "#4b5563" }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: "500", color: "#111827" }}>₹{(quotation.totalAmount / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", color: "#4b5563" }}>
                <span>Total GST</span>
                <span style={{ fontWeight: "500", color: "#111827" }}>₹{(quotation.totalGst / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #e5e7eb", paddingTop: "16px", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
                <span>Grand Total</span>
                <span style={{ color: "#f97316" }}>₹{((quotation.totalAmount + quotation.totalGst) / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          {settings?.bottomDetails && (
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "24px", fontSize: "12px", color: "#6b7280", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
              {settings.bottomDetails}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
