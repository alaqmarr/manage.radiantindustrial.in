import re

with open('src/components/RfqActions.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = code.replace(
    'import { Copy, Check, Edit, Trash2 } from "lucide-react"',
    'import { Copy, Check, Edit, Trash2, Send, X, Loader2, CheckCircle2, XCircle } from "lucide-react"'
)

if 'sendEmailAction' not in code:
    code = code.replace(
        'import { deleteRfq } from "@/app/actions/rfq"',
        'import { deleteRfq } from "@/app/actions/rfq"\nimport { sendEmailAction } from "@/app/actions/email"'
    )

# 2. State
state_block = '''
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
        subject: Purchase Order -  from ,
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
'''

code = code.replace('const router = useRouter()', 'const router = useRouter()' + state_block)

# 3. Add Email Button in actions
email_button = '''
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
          <span className="text-sm">Email PO</span>
        </button>
'''
code = code.replace(
    '<button \n          onClick={handleCopyEmail}',
    email_button + '\n        <button \n          onClick={handleCopyEmail}'
)

# 4. Add Modal at the end of the return statement
modal_code = '''
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
              {sendResults ? 'Sending Complete' : isSending ? 'Sending Emails...' : 'Send PO Directly'}
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
                  <span>Send PO</span>
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
'''
code = code.replace('</>\n  )\n}\n', modal_code + '\n  )\n}\n')

with open('src/components/RfqActions.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
