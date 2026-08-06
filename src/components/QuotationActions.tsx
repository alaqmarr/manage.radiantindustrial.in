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

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      
      const rows = quotation.items.filter((item: any) => item.spSnapshot > 0).map((item: any, index: number) => ({
        "SR NO": index + 1,
        "Code": item.product.materialCode,
        "Description": item.product.materialDescription,
        "Specification": item.product.specification || "",
        "Comment": item.comment || "",
        "Qty": item.quantity,
        "UOM": item.product.unit,
        "Rate": (item.spSnapshot / 100).toFixed(2),
        "Amount": (Math.round(item.spSnapshot * item.quantity) / 100).toFixed(2)
      }));
      
      // Calculate totals
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Subtotal",
        "Specification": "",
        "Comment": "",
        "Qty": "",
        "UOM": "",
        "Rate": "",
        "Amount": (quotation.totalAmount / 100).toFixed(2)
      } as any);
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Total GST",
        "Specification": "",
        "Comment": "",
        "Qty": "",
        "UOM": "",
        "Rate": "",
        "Amount": (quotation.totalGst / 100).toFixed(2)
      } as any);
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Grand Total",
        "Specification": "",
        "Comment": "",
        "Qty": "",
        "UOM": "",
        "Rate": "",
        "Amount": ((quotation.totalAmount + quotation.totalGst) / 100).toFixed(2)
      } as any);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      
      // Auto-size columns roughly
      const columnWidths = [
        { wch: 8 },  // SR NO
        { wch: 20 }, // Code
        { wch: 50 }, // Description
        { wch: 30 }, // Specification
        { wch: 30 }, // Comment
        { wch: 8 },  // Qty
        { wch: 8 },  // UOM
        { wch: 12 }, // Rate
        { wch: 15 }, // Amount
      ];
      worksheet['!cols'] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Quotation");
      
      XLSX.writeFile(workbook, `Quotation_${quotation.id.slice(-6)}.xlsx`);
    } catch (err) {
      console.error("Failed to export to Excel", err);
      alert("Failed to export to Excel.");
    }
  }

  return (
    <>
      <div className="flex gap-3 print:hidden">
        <button 
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-medium rounded-md transition-colors border border-emerald-500/20 active:scale-95"
        >
          <span className="text-sm">Export Excel</span>
        </button>
        <button 
          onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-md transition-colors border border-premium-border active:scale-95"
        >
          <Edit className="w-4 h-4" />
          <span className="text-sm">Edit</span>
        </button>
        <button 
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-500 font-medium rounded-md transition-colors border border-red-500/20 active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">{isDeleting ? "Deleting..." : "Delete"}</span>
        </button>
        <button 
          onClick={handleCopyEmail}
          className="flex items-center gap-2 px-4 py-2 bg-brand-slate hover:bg-brand-slate/80 text-white font-medium rounded-md transition-colors border border-brand-slate/50 active:scale-95"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="text-sm">{copied ? "Copied!" : "Copy for Email"}</span>
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95"
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
            * { font-family: var(--font-sans), 'Outfit', system-ui, sans-serif; }
            h1, h2, h3 { font-family: var(--font-heading), 'Montserrat', sans-serif !important; }
          `}
        </style>
        
        <div ref={emailTableRef} style={{ color: "#1f2937", width: "100%", maxWidth: "800px", margin: "0 auto", padding: "40px", boxSizing: "border-box", fontSize: "12px", lineHeight: "1.4", fontFamily: "Arial, sans-serif" }}>
          
          {/* Header */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ borderBottom: "2px solid #f3f4f6", paddingBottom: "16px", marginBottom: "24px" }}>
            <tbody>
              <tr>
                <td valign="top" width="50%">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt={settings.companyName} style={{ maxHeight: "48px", marginBottom: "12px" }} />
                  ) : (
                    <h1 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "700", color: "#111827", fontFamily: "var(--font-heading), 'Montserrat', Arial, sans-serif" }}>{settings?.companyName || "Company Name"}</h1>
                  )}
                </td>
                <td valign="top" width="50%" align="right">
                  <h2 style={{ margin: "0 0 6px 0", fontSize: "22px", fontWeight: "800", color: "#f97316", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-heading), 'Montserrat', Arial, sans-serif" }}>Quotation</h2>
                  <p style={{ margin: "0 0 2px 0", color: "#4b5563" }}><strong>Date:</strong> {new Date(quotation.createdAt).toLocaleDateString()}</p>
                  <p style={{ margin: "0", color: "#4b5563", wordBreak: "break-all" }}><strong>Quote No:</strong> {quotation.id}</p>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Details */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ marginBottom: "24px" }}>
            <tbody>
              <tr>
                <td valign="top" width="50%" style={{ paddingRight: "16px" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "10px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Quote To</h3>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#111827" }}>{quotation.client.name}</p>
                  {quotation.client.email && <p style={{ margin: "0 0 2px 0", color: "#4b5563" }}>{quotation.client.email}</p>}
                </td>
                <td valign="top" width="50%" style={{ paddingLeft: "16px", borderLeft: "1px solid #f3f4f6" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "10px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Reference</h3>
                  {quotation.prNo && <p style={{ margin: "0 0 2px 0" }}><strong style={{ color: "#4b5563" }}>PR No:</strong> {quotation.prNo}</p>}
                  {quotation.rfqNo && <p style={{ margin: "0 0 2px 0" }}><strong style={{ color: "#4b5563" }}>RFQ No:</strong> {quotation.rfqNo}</p>}
                </td>
              </tr>
            </tbody>
          </table>

          {settings?.quotationMessage && (
            <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px", color: "#374151" }}>
              <p style={{ margin: "0", whiteSpace: "pre-wrap" }}>{settings.quotationMessage}</p>
            </div>
          )}

          {/* Table */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", border: "1px solid #d1d5db", marginBottom: "24px", tableLayout: "fixed" }}>
            <thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Code</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "45%" }}>Description</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "10%" }}>Qty</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Rate</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.filter((item: any) => item.spSnapshot > 0).map((item: any) => (
                <tr key={item.id}>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", verticalAlign: "top", wordBreak: "break-word" }}>
                    <span style={{ fontFamily: "monospace", color: "#4b5563" }}>{item.product.materialCode}</span>
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", verticalAlign: "top", wordBreak: "break-word" }}>
                    <div style={{ fontWeight: "600", color: "#111827", marginBottom: "4px", fontSize: "13px" }}>{item.product.materialDescription}</div>
                    {item.product.specification && (
                      <div style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "pre-wrap", marginBottom: "4px" }}>{item.product.specification}</div>
                    )}
                    {item.comment && (
                      <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: "bold", whiteSpace: "pre-wrap", marginTop: "4px" }}>{item.comment}</div>
                    )}
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", verticalAlign: "top" }}>
                    <span style={{ fontWeight: "600", color: "#374151", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{item.quantity}</span>
                    <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "4px" }}>{item.product.unit}</span>
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", verticalAlign: "top", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                    ₹{(item.spSnapshot / 100).toFixed(2)}
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "right", verticalAlign: "top", fontWeight: "600", color: "#111827", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                    ₹{(Math.round(item.spSnapshot * item.quantity) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals - Email Safe */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ marginBottom: "40px" }}>
            <tbody>
              <tr>
                <td width="40%"></td>
                <td width="60%" align="right">
                  <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ border: "1px solid #d1d5db", backgroundColor: "#f9fafb", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "12px 16px", color: "#4b5563", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Subtotal</td>
                        <td style={{ padding: "12px 16px", fontWeight: "600", color: "#111827", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontVariantNumeric: "tabular-nums" }}>₹{(quotation.totalAmount / 100).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "12px 16px", color: "#4b5563", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Total GST</td>
                        <td style={{ padding: "12px 16px", fontWeight: "600", color: "#111827", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontVariantNumeric: "tabular-nums" }}>₹{(quotation.totalGst / 100).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "16px", fontSize: "16px", fontWeight: "800", color: "#111827", textAlign: "left" }}>Grand Total</td>
                        <td style={{ padding: "16px", fontSize: "16px", fontWeight: "800", color: "#f97316", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{((quotation.totalAmount + quotation.totalGst) / 100).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

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

