"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { recordPayment } from "@/app/actions/payment"
import { Loader2, X, IndianRupee, CreditCard } from "lucide-react"
import { formatRupee } from "@/lib/utils"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { sileo } from "sileo"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  type: "quotation" | "po"
  entityId: string
  totalAmount: number // paise
  totalGst: number // paise
  amountPaid: number // paise
}

const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Cheque", "UPI", "Other"]

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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("CLEARED")
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

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

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
        date: date || undefined,
        status,
      })

      if (res?.error) {
        setError(res.error)
        sileo.error({ title: "Payment Error", description: res.error })
      } else if (res?.success) {
        sileo.success({
          title: "Payment Recorded",
          description: `₹${numericAmount.toLocaleString("en-IN")} recorded via ${method}.`,
        })
        router.refresh()
        onClose()
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
      sileo.error({
        title: "Payment Error",
        description: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Record Payment</h2>
              <p className="text-xs text-slate-500">
                {type === "quotation"
                  ? "Client Quotation Receipt"
                  : "Supplier Purchase Order Payment"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 hover:bg-slate-200/60 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar"
        >
          {/* Financial Summary */}
          <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Total Invoice
              </div>
              <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                {formatRupee(totalBillPaise)}
              </div>
            </div>
            <div className="border-x border-slate-200 px-2">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Already Paid
              </div>
              <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                {formatRupee(amountPaid || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Balance Due
              </div>
              <div
                className={`text-sm font-bold font-mono mt-0.5 ${
                  remainingPaise > 0 ? "text-rose-600" : "text-slate-400"
                }`}
              >
                {formatRupee(remainingPaise)}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Amount Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Payment Amount (₹) *
              </label>
              {remainingPaise > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount((remainingPaise / 100).toString())}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                >
                  Pay Full Remaining ({formatRupee(remainingPaise)})
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-10">
                <IndianRupee className="w-4 h-4" />
              </div>
              <SmartNumberInput
                required
                value={amount}
                onValueChange={(_, str) => setAmount(str)}
                placeholder="0.00 or e.g. 15000/2"
                className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
          </div>

          {/* Method, Date, and Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Method *
              </label>
              <select
                required
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-orange-600"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Status *
              </label>
              <select
                required
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-orange-600"
              >
                <option value="CLEARED">Cleared</option>
                <option value="PENDING">Pending (PDC)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          {/* Reference Field */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Reference / UTR / Cheque No
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Cheque No, UTR, UPI Ref ID"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-sm focus:outline-none focus:border-orange-600"
            />
          </div>

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment notes or comments..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 text-sm resize-none focus:outline-none focus:border-orange-600"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors border border-slate-300 disabled:opacity-50 text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50 text-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span className="text-white">Recording...</span>
                </>
              ) : (
                <span className="text-white">Record Payment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PaymentModal
