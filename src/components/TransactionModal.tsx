"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { recordManualPayment, recordPayment } from "@/app/actions/payment"
import { X } from "lucide-react"

export function TransactionModal({ onClose, quotations, pos, purchases }: any) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [category, setCategory] = useState("manual") // manual, quotation, po
  const [type, setType] = useState<"IN" | "OUT">("IN")
  const [entityId, setEntityId] = useState("")
  
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("BANK_TRANSFER")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState("CLEARED") // PENDING, CLEARED

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      if (category === "manual") {
        await recordManualPayment({
          type,
          amount: Number(amount),
          method,
          reference,
          notes,
          date,
          status
        })
      } else {
        await recordPayment({
          type: category as "quotation" | "po" | "purchase",
          entityId,
          amount: Number(amount),
          method,
          reference,
          notes,
          date,
          status
        })
      }
      router.refresh()
      onClose()
    } catch (err) {
      alert("Failed to save transaction")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-premium-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-premium-border bg-white/[0.02]">
          <h2 className="text-xl font-semibold text-white">Add Transaction</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Category</label>
                <select 
                  value={category} 
                  onChange={(e) => {
                    setCategory(e.target.value)
                    if (e.target.value === "quotation") setType("IN")
                    if (e.target.value === "po" || e.target.value === "purchase") setType("OUT")
                  }}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="quotation">Against Quotation / Sale</option>
                  <option value="po">Against Purchase Order</option>
                  <option value="purchase">Against Direct Purchase</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Direction</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value as "IN" | "OUT")}
                  disabled={category !== "manual"}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate disabled:opacity-50"
                >
                  <option value="IN">Money IN (+)</option>
                  <option value="OUT">Money OUT (-)</option>
                </select>
              </div>
            </div>

            {category === "quotation" && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Select Quotation</label>
                <select 
                  required
                  value={entityId} 
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                >
                  <option value="">-- Select --</option>
                  {quotations?.map((q: any) => (
                    <option key={q.id} value={q.id}>{q.prNo || q.id.slice(0,8)} - {q.client.name}</option>
                  ))}
                </select>
              </div>
            )}

            {category === "po" && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Select Purchase Order</label>
                <select 
                  required
                  value={entityId} 
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                >
                  <option value="">-- Select --</option>
                  {pos?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.poNumber || p.id.slice(0,8)} - {p.supplier.name}</option>
                  ))}
                </select>
              </div>
            )}

            {category === "purchase" && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Select Direct Purchase</label>
                <select 
                  required
                  value={entityId} 
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                >
                  <option value="">-- Select --</option>
                  {purchases?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.id.slice(0,8)} - {p.supplier.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Amount (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Date</label>
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Method</label>
                <select 
                  value={method} 
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                >
                  <option value="CLEARED">Cleared (Completed)</option>
                  <option value="PENDING">Pending (PDC / Uncleared)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Reference (Cheque No, UTR, etc)</label>
              <input 
                type="text" 
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Remarks / Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
                placeholder="Optional notes"
              />
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-premium-border bg-black/20 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="transaction-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-brand-slate hover:bg-slate-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Transaction"}
          </button>
        </div>
      </div>
    </div>
  )
}
