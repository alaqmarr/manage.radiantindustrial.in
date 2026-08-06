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
      <div className="hidden print:block w-full bg-white text-black p-8">
        <div ref={emailTableRef} style={{ fontFamily: "sans-serif", color: "#333", maxWidth: "800px", margin: "0 auto" }}>
          {settings?.logoUrl && (
            <div style={{ marginBottom: "20px" }}>
              <img src={settings.logoUrl} alt={settings.companyName} style={{ maxHeight: "80px" }} />
            </div>
          )}
          
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ color: "#556270", margin: "0 0 10px 0" }}>{settings?.companyName || "Quotation"}</h2>
            <p style={{ margin: "0 0 5px 0" }}><strong>To:</strong> {quotation.client.name}</p>
            {quotation.prNo && <p style={{ margin: "0 0 5px 0" }}><strong>PR No:</strong> {quotation.prNo}</p>}
            {quotation.rfqNo && <p style={{ margin: "0 0 15px 0" }}><strong>RFQ No:</strong> {quotation.rfqNo}</p>}
            
            {settings?.quotationMessage && (
              <p style={{ margin: "0 0 20px 0" }}>{settings.quotationMessage}</p>
            )}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
            <thead>
              <tr style={{ backgroundColor: "#556270", color: "white" }}>
                <th style={{ padding: "10px", border: "1px solid #ddd", textAlign: "left" }}>Code</th>
                <th style={{ padding: "10px", border: "1px solid #ddd", textAlign: "left" }}>Description</th>
                <th style={{ padding: "10px", border: "1px solid #ddd", textAlign: "center" }}>UOM</th>
                <th style={{ padding: "10px", border: "1px solid #ddd", textAlign: "center" }}>Qty</th>
                {quotation.status !== "DRAFT" && (
                  <>
                    <th style={{ padding: "10px", border: "1px solid #ddd", textAlign: "right" }}>Rate (₹)</th>
                    <th style={{ padding: "10px", border: "1px solid #ddd", textAlign: "right" }}>Amount (₹)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item: any) => (
                <tr key={item.id}>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>{item.product.materialCode}</td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>{item.product.materialDescription}</td>
                  <td style={{ padding: "10px", border: "1px solid #ddd", textAlign: "center" }}>{item.product.unit}</td>
                  <td style={{ padding: "10px", border: "1px solid #ddd", textAlign: "center" }}>{item.quantity}</td>
                  {quotation.status !== "DRAFT" && (
                    <>
                      <td style={{ padding: "10px", border: "1px solid #ddd", textAlign: "right" }}>
                        {(item.spSnapshot / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: "10px", border: "1px solid #ddd", textAlign: "right" }}>
                        {((item.spSnapshot * item.quantity) / 100).toFixed(2)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {quotation.status !== "DRAFT" && (
            <div style={{ textAlign: "right", marginBottom: "30px" }}>
              <p style={{ margin: "0 0 5px 0" }}><strong>Total (excl. GST):</strong> ₹{(quotation.totalAmount / 100).toFixed(2)}</p>
              <p style={{ margin: "0 0 5px 0" }}><strong>GST:</strong> ₹{(quotation.totalGst / 100).toFixed(2)}</p>
              <p style={{ margin: "0", fontSize: "1.1em", color: "#f48c36" }}><strong>Grand Total:</strong> ₹{((quotation.totalAmount + quotation.totalGst) / 100).toFixed(2)}</p>
            </div>
          )}

          {settings?.bottomDetails && (
            <div style={{ borderTop: "1px solid #ddd", paddingTop: "20px", fontSize: "0.9em", color: "#666", whiteSpace: "pre-wrap" }}>
              {settings.bottomDetails}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
