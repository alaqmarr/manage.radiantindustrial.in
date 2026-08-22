"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { recordPayment } from "@/app/actions/payment"
import { Loader2, X, IndianRupee, CreditCard } from "lucide-react"
import { formatRupee } from "@/lib/utils"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  type: "quotation" | "po"
  entityId: string
  totalAmount: number // paise
  totalGst: number // paise
  amountPaid: number // paise
}

const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cash",
  "Cheque",
  "UPI",
  "Other"
]

export function PaymentModal({
  isOpen,
  onClose,
  type,
  entityId,
  totalAmount,
  totalGst,
  amountPaid,
}: PaymentModalProps) {
  const router = useRouter()

  const totalBillPaise = (totalAmount || 0) + (totalGst || 0)
  const remainingPaise = Math.max(0, totalBillPaise - (amountPaid || 0))
  const defaultAmountRupees = remainingPaise > 0 ? (remainingPaise / 100).toString() : "0"

  const [amount, setAmount] = useState(defaultAmountRupees)
  const [method, setMethod] = useState("Bank Transfer")
  const [reference, setReference] = useState("")
  const [date, setDate] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (isOpen) {
      const remaining = Math.max(0, (totalAmount || 0) + (totalGst || 0) - (amountPaid || 0))
      setAmount(remaining > 0 ? (remaining / 100).toString() : "0")
      setMethod("Bank Transfer")
      setReference("")
      setDate(new Date().toISOString().split("T")[0])
      setNotes("")
      setError("")
      setIsSubmitting(false)
    }
  }, [isOpen, totalAmount, totalGst, amountPaid])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numericAmount = parseFloat(amount)

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid positive payment amount.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const res = await recordPayment({
        type,
        entityId,
        amount: numericAmount,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        date: date || undefined
      })

      if (res?.error) {
        setError(res.error)
      } else if (res?.success) {
        router.refresh()
        onClose()
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Card */}
      <div className="relative bg-zinc-900 border border-premium-border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-premium-border bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-brand-orange/10 border border-brand-orange/20 text-brand-orange">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Record Payment</h2>
              <p className="text-xs text-zinc-400">
                {type === "quotation" ? "Customer Quotation Payment" : "Supplier Purchase Order Payment"}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-zinc-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Financial Summary */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-950/80 rounded-md border border-premium-border text-center">
            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Total Amount</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {formatRupee(totalBillPaise)}
              </div>
            </div>
            <div className="border-x border-premium-border px-2">
              <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Already Paid</div>
              <div className="text-sm font-bold text-emerald-500 mt-0.5">
                {formatRupee(amountPaid || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Balance Due</div>
              <div className={`text-sm font-bold mt-0.5 ${remainingPaise > 0 ? "text-amber-500" : "text-zinc-400"}`}>
                {formatRupee(remainingPaise)}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* Amount Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Payment Amount (₹) *
              </label>
              {remainingPaise > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount((remainingPaise / 100).toString())}
                  className="text-xs text-brand-orange hover:text-brand-orange-light transition-colors"
                >
                  Pay Remaining ({formatRupee(remainingPaise)})
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <IndianRupee className="w-4 h-4" />
              </div>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-950 border border-premium-border rounded-md pl-10 pr-4 py-2 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-slate text-sm font-medium"
              />
            </div>
          </div>

          {/* Method and Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Payment Method *
              </label>
              <select
                required
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-zinc-950 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="bg-zinc-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Payment Date *
              </label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-zinc-950 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate text-sm [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Reference Field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Reference / Transaction ID
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Cheque No, UTR, UPI Ref ID"
              className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-slate text-sm"
            />
          </div>

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment notes or comments..."
              className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-slate text-sm resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-premium-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium rounded-md transition-colors border border-premium-border disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95 disabled:opacity-50 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Record Payment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PaymentModal
