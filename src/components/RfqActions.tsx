"use client"
import { Printer, Copy, Check, Edit, Trash2, Send, X, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { deleteRfq } from "@/app/actions/rfq"
import { sendEmailAction } from "@/app/actions/email"
import { formatRupee, numberToWordsRupees } from "@/lib/utils"

export function RfqActions({ 
  rfq, 
  settings 
}: { 
  rfq: any, 
  settings: any 
}) {
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const emailTableRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [validEmails, setValidEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<{email: string, status: 'success'|'failed', error?: string}[] | null>(null)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const parseEmails = (input: string) => {
    const parts = input.split(/[\s,;]+/);
    const newValidEmails = [...validEmails];
    let hasChanges = false;
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed && emailRegex.test(trimmed) && !newValidEmails.includes(trimmed)) {
        newValidEmails.push(trimmed);
        hasChanges = true;
      }
    });
    if (hasChanges) setValidEmails(newValidEmails);
  };

  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmailInput(val);
    if (val.endsWith(' ') || val.endsWith(',') || val.endsWith(';')) {
      parseEmails(val);
      setEmailInput('');
    }
  };

  const handleEmailInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    parseEmails(e.clipboardData.getData('text'));
  };

  const removeEmail = (emailToRemove: string) => {
    setValidEmails(validEmails.filter(e => e !== emailToRemove));
  };

  const handleSendEmail = async () => {
    if (!emailTableRef.current) return;
    let finalEmails = [...validEmails];
    if (emailInput.trim() && emailRegex.test(emailInput.trim()) && !finalEmails.includes(emailInput.trim())) {
      finalEmails.push(emailInput.trim());
    }
    if (finalEmails.length === 0) {
      alert("Please enter at least one valid recipient email address.");
      return;
    }

    setValidEmails(finalEmails);
    setEmailInput('');
    setIsSending(true);
    setSendResults(null);
    try {
      const htmlContent = emailTableRef.current.innerHTML;
      const result = await sendEmailAction({
        to: finalEmails,
        subject: `Request for Quotation - ${rfq.id.slice(-6).toUpperCase()} from ${settings?.companyName || "Our Company"}`,
        html: htmlContent
      });

      if (result.error && !result.results) {
        alert(result.error);
      } else if (result.results) {
        setSendResults(result.results as any);
      }
    } catch (err) {
      console.error("Failed to send email", err);
      alert("Failed to send email due to a network error.");
    } finally {
      setIsSending(false);
    }
  }


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
    if (!confirm("Are you sure you want to delete this rfq?")) return
    setIsDeleting(true)
    try {
      const res = await deleteRfq(rfq.id)
      if (res.success) {
        router.push("/rfqs")
        router.refresh()
      } else {
        alert(res.error)
      }
    } catch (e: any) {
      alert("Failed to delete rfq")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      
      const rows = rfq.items.map((item: any, index: number) => ({
        "SR NO": index + 1,
        "Code": item.product.materialCode,
        "Description": item.product.materialDescription,
        "Specification": item.product.specification || "",
        "Comment": item.comment || "",
        "Qty": item.quantity,
        "UOM": item.product.unit,
        
        
      }));
      
      
      rows.push({
        "SR NO": "",
        "Code": "",
        "Description": "Total GST",
        "Specification": "",
        "Comment": "",
        "Qty": "",
        "UOM": "",
        "Rate": "",
        "Amount": rfq.totalGst / 100
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
        "Amount": (rfq.totalAmount + rfq.totalGst) / 100
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
        
        
      ];
      worksheet['!cols'] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Request for Quotation");
      
      XLSX.writeFile(workbook, `RFQ_${rfq.id.slice(-6)}.xlsx`);
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
          onClick={() => router.push(`/rfqs/${rfq.id}/edit`)}
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
          onClick={() => {
            setIsSendModalOpen(true)
            setSendResults(null)
            if (rfq.supplier?.email) {
              setValidEmails([rfq.supplier.email])
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 shadow-lg shadow-blue-500/20 text-white font-medium rounded-md transition-all active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span className="text-sm">Email RFQ</span>
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
          <span className="text-sm">Print RFQ</span>
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
                  <h2 style={{ margin: "0 0 6px 0", fontSize: "22px", fontWeight: "800", color: "#f97316", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-heading), 'Montserrat', Arial, sans-serif" }}>REQUEST FOR QUOTATION</h2>
                  <p style={{ margin: "0 0 2px 0", color: "#4b5563" }}><strong>Date:</strong> {new Date(rfq.createdAt).toLocaleDateString()}</p>
                  <p style={{ margin: "0", color: "#4b5563", wordBreak: "break-all" }}><strong>RFQ No:</strong> {rfq.id}</p>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Details */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ marginBottom: "24px" }}>
            <tbody>
              <tr>
                <td valign="top" width="50%" style={{ paddingRight: "16px" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "10px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Vendor</h3>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#111827" }}>{rfq.supplier.name}</p>
                  {rfq.supplier.email && <p style={{ margin: "0 0 2px 0", color: "#4b5563" }}>{rfq.supplier.email}</p>}
                </td>
                <td valign="top" width="50%" style={{ paddingLeft: "16px", borderLeft: "1px solid #f3f4f6" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "10px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Ship To</h3>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#111827" }}>{settings?.companyName}</p>
                  {settings?.shippingAddress && <p style={{ margin: "0 0 2px 0", color: "#4b5563", whiteSpace: "pre-wrap" }}>{settings.shippingAddress}</p>}
                </td>
              </tr>
            </tbody>
          </table>

          {settings?.rfqMessage && (
            <div 
              style={{ marginBottom: "24px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px", color: "#374151" }}
              dangerouslySetInnerHTML={{ __html: settings.rfqMessage }}
            />
          )}

          {/* Table */}
          <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", border: "1px solid #d1d5db", marginBottom: "24px", tableLayout: "fixed" }}>
            <thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "15%" }}>Code</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "left", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "45%" }}>Description</th>
                <th style={{ border: "1px solid #d1d5db", padding: "10px 8px", textAlign: "center", color: "#374151", fontSize: "11px", textTransform: "uppercase", fontWeight: "700", width: "10%" }}>Qty</th>
                
                
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item: any) => (
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
                  
                </tr>
              ))}
            </tbody>
          </table>

          
                  


          {/* Footer */}
          {settings?.bottomDetails && (
            <div 
              style={{ borderTop: "1px solid #e5e7eb", paddingTop: "24px", fontSize: "12px", color: "#6b7280", lineHeight: "1.6" }}
              dangerouslySetInnerHTML={{ __html: settings.bottomDetails }}
            />
          )}
        </div>
      </div>
    
      {isSendModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-premium-dark border border-premium-border rounded-lg w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            {!isSending && (
              <button 
                onClick={() => setIsSendModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            
            <h3 className="text-xl font-bold text-white mb-2 font-heading">
              {sendResults ? 'Sending Complete' : isSending ? 'Sending Emails...' : 'Send RFQ Directly'}
            </h3>
            
            {!sendResults && !isSending && (
              <p className="text-zinc-400 text-sm mb-6">
                Paste or type recipient email addresses. Invalid emails will be automatically ignored.
              </p>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
              {!sendResults && !isSending ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">To:</label>
                    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 flex flex-wrap gap-2 items-start min-h-[100px] focus-within:border-brand-orange focus-within:ring-1 focus-within:ring-brand-orange transition-all cursor-text" onClick={() => document.getElementById('email-input')?.focus()}>
                      {validEmails.map(email => (
                        <div key={email} className="flex items-center gap-1 bg-brand-orange/20 text-brand-orange px-2 py-1 rounded-md text-sm">
                          <span>{email}</span>
                          <button onClick={(e) => { e.stopPropagation(); removeEmail(email); }} className="hover:text-white transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <input
                        id="email-input"
                        type="text"
                        value={emailInput}
                        onChange={handleEmailInputChange}
                        onPaste={handleEmailInputPaste}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (emailInput.trim()) {
                              parseEmails(emailInput);
                              setEmailInput('');
                            }
                          } else if (e.key === 'Backspace' && !emailInput && validEmails.length > 0) {
                            const newEmails = [...validEmails];
                            newEmails.pop();
                            setValidEmails(newEmails);
                          }
                        }}
                        placeholder={validEmails.length === 0 ? "supplier@example.com" : ""}
                        className="flex-1 bg-transparent border-none outline-none text-white min-w-[200px] py-1 text-sm"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-premium-surface/50 border border-premium-border rounded-md p-4 text-center">
                      <div className="text-3xl font-black text-white">{validEmails.length + (emailInput.trim() && emailRegex.test(emailInput.trim()) && !validEmails.includes(emailInput.trim()) ? 1 : 0)}</div>
                      <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Total</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-4 text-center">
                      <div className="text-3xl font-black text-emerald-500">
                        {sendResults ? sendResults.filter(r => r.status === 'success').length : (isSending ? '-' : '0')}
                      </div>
                      <div className="text-xs text-emerald-500/70 font-bold uppercase tracking-widest mt-1">Sent</div>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-md p-4 text-center">
                      <div className="text-3xl font-black text-rose-500">
                        {sendResults ? sendResults.filter(r => r.status === 'failed').length : (isSending ? '-' : '0')}
                      </div>
                      <div className="text-xs text-rose-500/70 font-bold uppercase tracking-widest mt-1">Failed</div>
                    </div>
                  </div>

                  {isSending && !sendResults && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
                      <p className="text-zinc-400 font-medium">Sending your emails, please don't close this window...</p>
                    </div>
                  )}

                  {sendResults && (
                    <div className="mt-6">
                      <h4 className="text-sm font-bold text-white mb-3 tracking-wide">Detailed Logs</h4>
                      <div className="border border-premium-border rounded-md overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-premium-surface/80 border-b border-premium-border">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-zinc-300">Email</th>
                              <th className="px-4 py-3 font-semibold text-zinc-300">Status</th>
                              <th className="px-4 py-3 font-semibold text-zinc-300">Log</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-premium-border bg-black/20">
                            {sendResults.map((result, idx) => (
                              <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-white font-medium">{result.email}</td>
                                <td className="px-4 py-3">
                                  {result.status === 'success' ? (
                                    <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                                      <CheckCircle2 className="w-4 h-4" /> Success
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-rose-500 text-xs font-bold uppercase tracking-wider">
                                      <XCircle className="w-4 h-4" /> Failed
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-zinc-400 text-xs font-mono break-words max-w-[200px]">
                                  {result.error || 'OK'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-premium-border">
              {!sendResults && !isSending ? (
                <button 
                  onClick={handleSendEmail}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 shadow-lg shadow-blue-500/20 text-white font-medium rounded-md transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                  <span>Send RFQ</span>
                </button>
              ) : sendResults ? (
                <button 
                  onClick={() => setIsSendModalOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-premium-surface/50 border border-premium-border hover:bg-white/5 text-white font-medium rounded-md transition-all active:scale-95"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>

  )
}

