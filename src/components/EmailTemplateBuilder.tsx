"use client"

import { useState, useRef } from "react"
import { Copy, Check, Mail, Sparkles, Send, PartyPopper, Landmark, X, Loader2, CheckCircle2, AlertCircle, XCircle } from "lucide-react"
import { sendEmailAction } from "@/app/actions/email"

type TemplateType = 'custom' | 'intro' | 'followup' | 'festive' | 'bank'

interface EmailTemplateBuilderProps {
  settings: any
}

export function EmailTemplateBuilder({ settings }: EmailTemplateBuilderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('custom')
  const [copied, setCopied] = useState(false)
  const emailContainerRef = useRef<HTMLDivElement>(null)

  // Form State
  const [clientName, setClientName] = useState("")
  const [subject, setSubject] = useState("")
  const [customBody, setCustomBody] = useState("")
  const [festiveOccasion, setFestiveOccasion] = useState("Diwali")
  const [quotationId, setQuotationId] = useState("")

  // Send Modal State
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
      if (trimmed && emailRegex.test(trimmed)) {
        if (!newValidEmails.includes(trimmed)) {
          newValidEmails.push(trimmed);
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setValidEmails(newValidEmails);
    }
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
    const pastedText = e.clipboardData.getData('text');
    parseEmails(pastedText);
  };

  const removeEmail = (emailToRemove: string) => {
    setValidEmails(validEmails.filter(e => e !== emailToRemove));
  };

  const handleCopyEmail = async () => {
    if (!emailContainerRef.current) return;
    
    try {
      const htmlContent = emailContainerRef.current.innerHTML;
      
      const blobHtml = new Blob([htmlContent], { type: "text/html" });
      const blobText = new Blob([emailContainerRef.current.innerText], { type: "text/plain" });
      
      const data = [new ClipboardItem({
        "text/html": blobHtml,
        "text/plain": blobText,
      })];
      
      await navigator.clipboard.write(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email", err);
      alert("Failed to copy to clipboard.");
    }
  }

  const handleSendEmail = async () => {
    if (!emailContainerRef.current) return;
    
    let finalEmails = [...validEmails];
    if (emailInput.trim() && emailRegex.test(emailInput.trim())) {
      if (!finalEmails.includes(emailInput.trim())) finalEmails.push(emailInput.trim());
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
      const htmlContent = emailContainerRef.current.innerHTML;
      
      let finalSubject = subject;
      if (!finalSubject) {
        if (selectedTemplate === 'intro') finalSubject = `Introduction: ${settings?.companyName || "Radiant Industrial"}`;
        if (selectedTemplate === 'followup') finalSubject = `Following up on Quotation ${quotationId}`;
        if (selectedTemplate === 'festive') finalSubject = `Happy ${festiveOccasion}!`;
        if (selectedTemplate === 'bank') finalSubject = `Banking Details - ${settings?.companyName}`;
      }

      const result = await sendEmailAction({
        to: finalEmails,
        subject: finalSubject,
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

  const templates = [
    { id: 'custom', label: 'Custom Message', icon: Mail, description: 'A blank canvas with your company header and footer.' },
    { id: 'intro', label: 'Company Introduction', icon: Sparkles, description: 'Standard intro reaching out to new leads.' },
    { id: 'followup', label: 'Quotation Follow-up', icon: Send, description: 'Polite nudge regarding a sent quotation.' },
    { id: 'festive', label: 'Festive Greeting', icon: PartyPopper, description: 'Beautiful holiday wishes (Diwali, New Year, etc.).' },
    { id: 'bank', label: 'Banking Details', icon: Landmark, description: 'Share your account details for payments.' },
  ] as const

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-12rem)]">
        {/* LEFT PANEL: Builder Controls */}
        <div className="glass-panel p-6 flex flex-col h-full rounded-md">
          <h2 className="text-xl font-bold text-white mb-6 font-heading">Template Builder</h2>
          
          <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
            
            {/* Template Selection */}
            <div className="grid grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id as TemplateType)}
                  className={`p-4 rounded-md text-left transition-all border ${selectedTemplate === t.id ? 'bg-brand-orange/10 border-brand-orange text-white shadow-[0_0_15px_rgba(244,140,54,0.15)]' : 'bg-premium-surface/50 border-premium-border text-zinc-400 hover:bg-white/5 hover:text-zinc-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <t.icon className={`w-4 h-4 ${selectedTemplate === t.id ? 'text-brand-orange' : ''}`} />
                    <span className="font-semibold">{t.label}</span>
                  </div>
                  <p className="text-xs opacity-70 leading-relaxed">{t.description}</p>
                </button>
              ))}
            </div>

            <hr className="border-premium-border" />

            {/* Form Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. John Doe / Acme Corp"
                  className="w-full bg-premium-dark border border-premium-border rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all"
                />
              </div>

              {selectedTemplate === 'festive' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Occasion</label>
                  <input
                    type="text"
                    value={festiveOccasion}
                    onChange={(e) => setFestiveOccasion(e.target.value)}
                    placeholder="e.g. Diwali, New Year, Christmas"
                    className="w-full bg-premium-dark border border-premium-border rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all"
                  />
                </div>
              )}

              {selectedTemplate === 'followup' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Quotation / PR No.</label>
                  <input
                    type="text"
                    value={quotationId}
                    onChange={(e) => setQuotationId(e.target.value)}
                    placeholder="e.g. QT-10293 or PR-491"
                    className="w-full bg-premium-dark border border-premium-border rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all"
                  />
                </div>
              )}

              {selectedTemplate === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Subject (Optional)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject..."
                    className="w-full bg-premium-dark border border-premium-border rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  {selectedTemplate === 'custom' ? 'Message Body' : 'Additional Notes (Optional)'}
                </label>
                <textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  className="w-full bg-premium-dark border border-premium-border rounded-md px-4 py-2.5 text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 mt-auto border-t border-premium-border grid grid-cols-2 gap-4">
            <button 
              onClick={handleCopyEmail}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-premium-surface/50 border border-premium-border hover:bg-white/5 text-white font-medium rounded-md transition-all active:scale-95"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              <span>{copied ? "Copied!" : "Copy HTML"}</span>
            </button>
            <button 
              onClick={() => {
                setIsSendModalOpen(true)
                setSendResults(null)
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
              <span>Send Directly</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Live Preview */}
        <div className="glass-panel p-6 flex flex-col h-full rounded-md overflow-hidden relative">
          <h2 className="text-xl font-bold text-white mb-6 font-heading shrink-0">Live Preview</h2>
          
          <div className="flex-1 bg-white rounded-md overflow-y-auto custom-scrollbar p-8 text-black shadow-inner">
            {/* This ref holds the HTML we actually copy */}
            <div ref={emailContainerRef} style={{ color: "#1f2937", width: "100%", maxWidth: "600px", margin: "0 auto", boxSizing: "border-box", fontSize: "14px", lineHeight: "1.6", fontFamily: "Arial, sans-serif" }}>
              
              {/* Header */}
              <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ borderBottom: "2px solid #f3f4f6", paddingBottom: "16px", marginBottom: "24px" }}>
                <tbody>
                  <tr>
                    <td valign="middle" align="center">
                      {settings?.logoUrl ? (
                        <img src={settings.logoUrl} alt={settings.companyName} style={{ maxHeight: "60px" }} />
                      ) : (
                        <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700", color: "#111827" }}>{settings?.companyName || "Company Name"}</h1>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Banner (For Festive only) */}
              {selectedTemplate === 'festive' && (
                <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ marginBottom: "24px" }}>
                  <tbody>
                    <tr>
                      <td align="center" style={{ backgroundColor: "#fff7ed", padding: "30px", borderRadius: "8px", border: "1px solid #ffedd5" }}>
                        <h2 style={{ margin: "0 0 10px 0", color: "#ea580c", fontSize: "28px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px" }}>Happy {festiveOccasion || "Holidays"}!</h2>
                        <p style={{ margin: "0", color: "#9a3412", fontSize: "16px" }}>Wishing you joy and prosperity from our entire team.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Greeting */}
              <p style={{ margin: "0 0 16px 0", fontSize: "15px" }}>
                Dear {clientName || "[Client Name]"},
              </p>

              {/* Custom Subject (if custom) */}
              {selectedTemplate === 'custom' && subject && (
                <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "#111827" }}>{subject}</h3>
              )}

              {/* Intro Template Body */}
              {selectedTemplate === 'intro' && (
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ margin: "0 0 12px 0" }}>We would like to take this opportunity to introduce <strong>{settings?.companyName || "our company"}</strong>. We are a premier supplier and distributor specializing in high-quality industrial and marine products.</p>
                  <p style={{ margin: "0 0 12px 0" }}>Our product range includes valves, pipes, fittings, flanges, and various hardware tools sourced from trusted manufacturers. We pride ourselves on delivering competitive pricing without compromising on quality or delivery timelines.</p>
                  <p style={{ margin: "0 0 12px 0" }}>We would love to discuss how we can support your upcoming projects and supply chain needs. Please find our comprehensive product catalog attached for your reference.</p>
                </div>
              )}

              {/* Follow-up Template Body */}
              {selectedTemplate === 'followup' && (
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ margin: "0 0 12px 0" }}>I hope this email finds you well.</p>
                  <p style={{ margin: "0 0 12px 0" }}>I am writing to follow up on the quotation {quotationId ? `(Ref: ${quotationId}) ` : ''}we submitted recently. We wanted to check if you had the opportunity to review our proposal and if you require any further clarifications or technical details regarding the offered products.</p>
                  <p style={{ margin: "0 0 12px 0" }}>Please let us know if we can assist you further to help finalize your requirements.</p>
                </div>
              )}

              {/* Banking Details Template Body */}
              {selectedTemplate === 'bank' && (
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ margin: "0 0 12px 0" }}>As requested, please find our banking details below for processing the payment.</p>
                  <table width="100%" border={0} cellPadding={12} cellSpacing={0} style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", marginBottom: "16px" }}>
                    <tbody>
                      <tr>
                        <td width="30%" style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: "13px" }}>Bank Name:</td>
                        <td style={{ borderBottom: "1px solid #e5e7eb", fontWeight: "600", color: "#111827" }}>{settings?.bankName || "-"}</td>
                      </tr>
                      <tr>
                        <td width="30%" style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: "13px" }}>Account Name:</td>
                        <td style={{ borderBottom: "1px solid #e5e7eb", fontWeight: "600", color: "#111827" }}>{settings?.accountName || "-"}</td>
                      </tr>
                      <tr>
                        <td width="30%" style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: "13px" }}>Account Number:</td>
                        <td style={{ borderBottom: "1px solid #e5e7eb", fontWeight: "600", color: "#111827" }}>{settings?.accountNumber || "-"}</td>
                      </tr>
                      <tr>
                        <td width="30%" style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: "13px" }}>IFSC Code:</td>
                        <td style={{ borderBottom: "1px solid #e5e7eb", fontWeight: "600", color: "#111827" }}>{settings?.ifscCode || "-"}</td>
                      </tr>
                      {settings?.swiftCode && (
                        <tr>
                          <td width="30%" style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: "13px" }}>SWIFT Code:</td>
                          <td style={{ borderBottom: "1px solid #e5e7eb", fontWeight: "600", color: "#111827" }}>{settings?.swiftCode}</td>
                        </tr>
                      )}
                      {settings?.bankAddress && (
                        <tr>
                          <td width="30%" style={{ color: "#6b7280", fontSize: "13px" }}>Branch / Address:</td>
                          <td style={{ fontWeight: "600", color: "#111827" }}>{settings?.bankAddress}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <p style={{ margin: "0 0 12px 0" }}>Please let us know once the transfer is completed so we can proceed accordingly.</p>
                </div>
              )}

              {/* Custom Body Text (Common for all) */}
              {customBody && (
                <div style={{ marginBottom: "24px", whiteSpace: "pre-wrap" }}>
                  {customBody}
                </div>
              )}

              {/* Sign off */}
              <p style={{ margin: "0 0 24px 0" }}>
                {selectedTemplate === 'festive' ? 'Warm regards,' : 'Best regards,'}
              </p>

              {/* Footer Signature */}
              <table width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ borderTop: "2px solid #f3f4f6", paddingTop: "20px", marginTop: "24px" }}>
                <tbody>
                  <tr>
                    <td valign="top" style={{ paddingRight: "16px", width: "80px" }}>
                       {settings?.logoUrl && (
                          <img src={settings.logoUrl} alt="Logo" style={{ width: "80px", height: "auto" }} />
                       )}
                    </td>
                    <td valign="top" style={{ borderLeft: "2px solid #ea580c", paddingLeft: "16px" }}>
                      <p style={{ margin: "0 0 4px 0", fontWeight: "700", color: "#111827", fontSize: "16px" }}>{settings?.companyName || "Radiant Industrial Co."}</p>
                      {settings?.phone && <p style={{ margin: "0 0 2px 0", color: "#4b5563", fontSize: "13px" }}>📞 {settings.phone}</p>}
                      {settings?.email && <p style={{ margin: "0 0 2px 0", color: "#4b5563", fontSize: "13px" }}>✉️ {settings.email}</p>}
                      {settings?.address && <p style={{ margin: "0 0 0 0", color: "#4b5563", fontSize: "13px" }}>🏢 {settings.address}</p>}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Terms and Conditions / Additional Footer */}
              {settings?.bottomDetails && (
                <div 
                  style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #e5e7eb", fontSize: "12px", color: "#6b7280", lineHeight: "1.6" }}
                  dangerouslySetInnerHTML={{ __html: settings.bottomDetails }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Send Email Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
              {sendResults ? 'Sending Complete' : isSending ? 'Sending Emails...' : 'Send Email Directly'}
            </h3>
            
            {!sendResults && !isSending && (
              <p className="text-zinc-400 text-sm mb-6">
                Paste or type recipient email addresses. Invalid emails will be automatically ignored.
              </p>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
              
              {!sendResults && !isSending ? (
                /* Input Mode */
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
                        placeholder={validEmails.length === 0 ? "client@example.com, other@test.com" : ""}
                        className="flex-1 bg-transparent border-none outline-none text-white min-w-[200px] py-1 text-sm"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Progress & Results Mode */
                <div className="space-y-6 py-4">
                  {/* Summary Stats */}
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
                      <p className="text-zinc-400 font-medium">Processing your emails, please don't close this window...</p>
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
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                  <span>Send Emails</span>
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
