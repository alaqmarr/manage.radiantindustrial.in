"use client"

import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import { recordObligationPayment, recordObligationAda, ObligationQuotationDetail, ObligationType } from "@/app/actions/obligations"
import { Plus, Wallet, FileText, IndianRupee, HandCoins, AlertCircle, HeartHandshake } from "lucide-react"
import { ObligationPayment, ObligationAda } from "@/generated/prisma/client"

interface ObligationDashboardProps {
  type: ObligationType
  title: string
  description: string
  totalDue: number
  totalExpectedDue: number
  totalPaid: number
  totalAda: number
  holdingBalance: number
  outstanding: number
  quotations: ObligationQuotationDetail[]
  payments: ObligationPayment[]
  adas: ObligationAda[]
}

export function ObligationDashboard({
  type,
  title,
  description,
  totalDue,
  totalExpectedDue,
  totalPaid,
  totalAda,
  holdingBalance,
  outstanding,
  quotations,
  payments,
  adas
}: ObligationDashboardProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isAdaModalOpen, setIsAdaModalOpen] = useState(false)
  const [amountStr, setAmountStr] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountPaise = Math.round(parseFloat(amountStr) * 100)
    if (amountPaise <= 0) return alert("Enter a valid amount")
    
    setIsSubmitting(true)
    const res = await recordObligationPayment({
      type,
      amount: amountPaise,
      date: new Date(),
      notes
    })
    setIsSubmitting(false)
    if (res.success) {
      setIsPaymentModalOpen(false)
      setAmountStr("")
      setNotes("")
    } else {
      alert("Failed to record payment: " + res.error)
    }
  }

  const handleRecordAda = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountPaise = Math.round(parseFloat(amountStr) * 100)
    if (amountPaise <= 0) return alert("Enter a valid amount")
    
    setIsSubmitting(true)
    const res = await recordObligationAda({
      type,
      amount: amountPaise,
      date: new Date(),
      notes
    })
    setIsSubmitting(false)
    if (res.success) {
      setIsAdaModalOpen(false)
      setAmountStr("")
      setNotes("")
    } else {
      alert("Failed to record Ada: " + res.error)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-brand-slate" />
            {title} Tracking
          </h1>
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsPaymentModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700">
            <Plus className="w-4 h-4" />
            Transfer to Paid
          </button>
          <button onClick={() => setIsAdaModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white bg-brand-slate hover:bg-brand-slate/90 transition-colors">
            <HeartHandshake className="w-4 h-4" />
            Mark as Ada
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
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(totalExpectedDue)}</h3>
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
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(totalDue)}</h3>
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
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider" title="Amount transferred to separate holding account">In Paid Account</p>
              <h3 className="text-xl font-bold text-green-400 mt-1">{formatRupee(holdingBalance)}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-slate/10 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6 text-brand-slate" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider" title="Amount handed over (Ada)">Total Ada</p>
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(totalAda)}</h3>
            </div>
          </div>
        </div>

        <div className="p-6 bg-brand-slate/10 border-brand-slate/30 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-slate/20 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-brand-slate" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-brand-slate uppercase tracking-wider" title="Remaining to transfer to Paid account">Outstanding</p>
              <h3 className="text-xl font-bold text-white mt-1">{formatRupee(outstanding)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generated {title} Due
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-400 border-y border-premium-border">
                <tr>
                  <th className="px-4 py-3 font-medium">Quotation</th>
                  <th className="px-4 py-3 font-medium">% Paid</th>
                  <th className="px-4 py-3 font-medium text-right text-brand-slate">Realized / Exp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-premium-border">
                {quotations.map((q) => (
                  <tr key={q.quotationId} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{q.quotationId}</div>
                      <div className="text-xs text-zinc-500">{q.clientName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {Math.round((q.amountPaid / (q.totalValue || 1)) * 100)}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-brand-slate">{formatRupee(q.dueAmount)}</div>
                      <div className="text-xs text-zinc-500">Exp: {formatRupee(q.expectedDueAmount)}</div>
                    </td>
                  </tr>
                ))}
                {quotations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                      No profit generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Paid Ledger
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-400 border-y border-premium-border">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium text-right text-green-400">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-premium-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-zinc-300">
                      {new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {p.notes || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-400">
                      {formatRupee(p.amount)}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border-premium-border rounded-xl border shadow-sm">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <HeartHandshake className="w-5 h-5" />
            Ada Ledger
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-400 border-y border-premium-border">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right text-brand-slate">Amount Ada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-premium-border">
                {adas.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-zinc-300">
                      {new Date(a.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <div className="text-xs text-zinc-500">{a.notes || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-brand-slate">
                      {formatRupee(a.amount)}
                    </td>
                  </tr>
                ))}
                {adas.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-zinc-500">
                      No Ada recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-premium-border rounded-lg shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Transfer to Paid Account</h2>
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
                <p className="text-xs text-zinc-500 mt-1">Outstanding Due: {formatRupee(outstanding)}</p>
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
            <h2 className="text-xl font-bold text-white mb-4">Mark as Ada</h2>
            <p className="text-sm text-zinc-400 mb-4">Hand over the collected amount.</p>
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
                <p className="text-xs text-zinc-500 mt-1">Holding Balance Available: <span className="font-bold text-green-400">{formatRupee(holdingBalance)}</span></p>
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
