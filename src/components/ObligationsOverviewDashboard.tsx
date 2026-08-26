"use client"

import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import { FileText, IndianRupee, Wallet, AlertCircle, Plus, Layers, HeartHandshake } from "lucide-react"
import { recordCombinedObligationPayment, recordCombinedObligationAda } from "@/app/actions/obligations"

interface Summary {
  totalExpectedDue: number
  totalDue: number
  totalPaid: number
  totalAda: number
  holdingBalance: number
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
  const [isAdaModalOpen, setIsAdaModalOpen] = useState(false)
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

  const handleRecordAda = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amountStr) return

    const amountPaise = Math.round(parseFloat(amountStr) * 100)
    if (amountPaise <= 0) return

    setIsSubmitting(true)
    try {
      const result = await recordCombinedObligationAda({
        amount: amountPaise,
        date: new Date(),
        notes
      })

      if (result.success) {
        setIsAdaModalOpen(false)
        setAmountStr("")
        setNotes("")
      } else {
        alert(result.error)
      }
    } catch (e: any) {
      alert("Error saving Ada")
    } finally {
      setIsSubmitting(false)
    }
  }

  const combinedExpected = khumusSummary.totalExpectedDue + zakaatSummary.totalExpectedDue
  const combinedDue = khumusSummary.totalDue + zakaatSummary.totalDue
  const combinedPaid = khumusSummary.totalPaid + zakaatSummary.totalPaid
  const combinedAda = khumusSummary.totalAda + zakaatSummary.totalAda
  const combinedHolding = khumusSummary.holdingBalance + zakaatSummary.holdingBalance
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
        <div className="flex gap-3">
          <button onClick={() => setIsPaymentModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700">
            <Plus className="w-4 h-4" />
            Combined Payment
          </button>
          <button onClick={() => setIsAdaModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white bg-brand-slate hover:bg-brand-slate/90 transition-colors">
            <HeartHandshake className="w-4 h-4" />
            Mark Combined Ada
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider" title="Expected total once all invoices are paid">Total Expected</p>
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(combinedExpected)}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <IndianRupee className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider" title="Actually generated from received payments">Total Due (Realized)</p>
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(combinedDue)}</h3>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 relative">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">In Paid Account</p>
              <h3 className="text-xl font-bold text-green-400 mt-1">{formatRupee(combinedHolding)}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-slate/10 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6 text-brand-slate" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Total Ada</p>
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(combinedAda)}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 bg-brand-slate/10 border-brand-slate/30 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-slate/20 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-brand-slate" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-brand-slate uppercase tracking-wider">Outstanding</p>
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(combinedOutstanding)}</h3>
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
              <span className="text-zinc-400">In Paid Account</span>
              <span className="text-green-400 font-bold">{formatRupee(khumusSummary.holdingBalance)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Ada</span>
              <span className="text-brand-slate font-medium">{formatRupee(khumusSummary.totalAda)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Outstanding Balance</span>
              <span className="text-red-400 font-bold">{formatRupee(khumusSummary.outstanding)}</span>
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
              <span className="text-zinc-400">In Paid Account</span>
              <span className="text-green-400 font-bold">{formatRupee(zakaatSummary.holdingBalance)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-premium-border">
              <span className="text-zinc-400">Total Ada</span>
              <span className="text-brand-slate font-medium">{formatRupee(zakaatSummary.totalAda)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Outstanding Balance</span>
              <span className="text-red-400 font-bold">{formatRupee(zakaatSummary.outstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-premium-border rounded-lg shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Transfer to Paid Account (Combined)</h2>
            <p className="text-sm text-zinc-400 mb-4">Payment will be allocated to Khumus first, then Zakaat.</p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
                  placeholder="0.00"
                />
                <p className="text-xs text-zinc-500 mt-1">Total Outstanding: {formatRupee(combinedOutstanding)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate min-h-[80px]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 px-4 py-2 text-white bg-zinc-800 hover:bg-zinc-700 rounded-md font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 text-white bg-brand-slate hover:bg-brand-slate/90 rounded-md font-medium transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-premium-border rounded-lg shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Mark as Ada (Combined)</h2>
            <p className="text-sm text-zinc-400 mb-4">Hand over the collected amount. Will be allocated to Khumus first, then Zakaat.</p>
            <form onSubmit={handleRecordAda} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate"
                  placeholder="0.00"
                />
                <p className="text-xs text-zinc-500 mt-1">Combined Holding Balance Available: <span className="font-bold text-green-400">{formatRupee(combinedHolding)}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate min-h-[80px]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAdaModalOpen(false)} className="flex-1 px-4 py-2 text-white bg-zinc-800 hover:bg-zinc-700 rounded-md font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 text-white bg-brand-slate hover:bg-brand-slate/90 rounded-md font-medium transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
