"use client"

import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import { FileText, IndianRupee, Wallet, AlertCircle, Plus, Layers } from "lucide-react"
import { recordCombinedObligationPayment } from "@/app/actions/obligations"

interface Summary {
  totalExpectedDue: number
  totalDue: number
  totalPaid: number
  outstanding: number
}

interface ObligationsOverviewDashboardProps {
  khumusSummary: Summary
  zakaatSummary: Summary
}

export function ObligationsOverviewDashboard({
  khumusSummary,
  zakaatSummary,
}: ObligationsOverviewDashboardProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [amountStr, setAmountStr] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountStr) return

    const amountPaise = Math.round(parseFloat(amountStr) * 100)
    if (amountPaise <= 0) return

    setIsSubmitting(true)
    try {
      const result = await recordCombinedObligationPayment({
        amount: amountPaise,
        date: new Date(),
        notes
      })

      if (result.success) {
        setIsPaymentModalOpen(false)
        setAmountStr("")
        setNotes("")
      } else {
        alert(result.error)
      }
    } catch (e: any) {
      alert("Error saving payment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const combinedExpected = khumusSummary.totalExpectedDue + zakaatSummary.totalExpectedDue
  const combinedDue = khumusSummary.totalDue + zakaatSummary.totalDue
  const combinedPaid = khumusSummary.totalPaid + zakaatSummary.totalPaid
  const combinedOutstanding = khumusSummary.outstanding + zakaatSummary.outstanding

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-slate" />
            Religious Obligations Overview
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Combined overview of your Khumus and Zakaat obligations.
          </p>
        </div>
        <button onClick={() => setIsPaymentModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white bg-brand-slate hover:bg-brand-slate/90">
          <Plus className="w-4 h-4" />
          Combined Payment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400" title="Expected total once all invoices are paid">Total Expected</p>
              <h3 className="text-2xl font-bold text-white">{formatRupee(combinedExpected)}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400" title="Actually generated from received payments">Total Due (Realized)</p>
              <h3 className="text-2xl font-bold text-white">{formatRupee(combinedDue)}</h3>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Paid Out</p>
              <h3 className="text-2xl font-bold text-white">{formatRupee(combinedPaid)}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 bg-brand-slate/10 border-brand-slate/30 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-slate/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-brand-slate" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-slate">Outstanding Bal.</p>
              <h3 className="text-2xl font-bold text-white">{formatRupee(combinedOutstanding)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-white mb-4">Khumus Breakdown</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Expected</span>
              <span className="text-white font-medium">{formatRupee(khumusSummary.totalExpectedDue)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Due (Realized)</span>
              <span className="text-white font-medium">{formatRupee(khumusSummary.totalDue)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Paid</span>
              <span className="text-green-400 font-medium">{formatRupee(khumusSummary.totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Outstanding</span>
              <span className="text-brand-slate font-bold">{formatRupee(khumusSummary.outstanding)}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-white mb-4">Zakaat Breakdown</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Expected</span>
              <span className="text-white font-medium">{formatRupee(zakaatSummary.totalExpectedDue)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Due (Realized)</span>
              <span className="text-white font-medium">{formatRupee(zakaatSummary.totalDue)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Paid</span>
              <span className="text-green-400 font-medium">{formatRupee(zakaatSummary.totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Outstanding</span>
              <span className="text-brand-slate font-bold">{formatRupee(zakaatSummary.outstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-premium-border rounded-lg shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-2">Record Combined Payment</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Payment will first be applied to your Khumus outstanding balance ({formatRupee(khumusSummary.outstanding)}). Any remaining amount will be applied to Zakaat.
            </p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
                  placeholder="E.g., Bank transfer reference..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-md font-medium text-sm border border-premium-border text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-md font-medium text-sm bg-brand-slate text-white hover:bg-brand-slate/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
