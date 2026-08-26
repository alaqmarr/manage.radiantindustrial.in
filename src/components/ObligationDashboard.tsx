"use client"

import { useState } from "react"
import { formatRupee, parseRupee } from "@/lib/utils"
import { recordObligationPayment, ObligationQuotationDetail, ObligationType } from "@/app/actions/obligations"
import { Card } from "./ui/Card"
import { Button } from "./ui/Button"
import { Plus, Wallet, FileText, IndianRupee, HandCoins, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { ObligationPayment } from "@prisma/client"

interface ObligationDashboardProps {
  type: ObligationType
  title: string
  description: string
  totalDue: number
  totalPaid: number
  outstanding: number
  quotations: ObligationQuotationDetail[]
  payments: ObligationPayment[]
}

export function ObligationDashboard({
  type,
  title,
  description,
  totalDue,
  totalPaid,
  outstanding,
  quotations,
  payments
}: ObligationDashboardProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [amountStr, setAmountStr] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountPaise = parseRupee(amountStr)
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
        <Button onClick={() => setIsPaymentModalOpen(true)} className="flex items-center gap-2 bg-brand-slate hover:bg-brand-slate/90">
          <Plus className="w-4 h-4" />
          Mark as Paid
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-zinc-900 border-premium-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Due Generated</p>
              <h3 className="text-2xl font-bold text-white">{formatRupee(totalDue)}</h3>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 bg-zinc-900 border-premium-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Total Paid Out</p>
              <h3 className="text-2xl font-bold text-white">{formatRupee(totalPaid)}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-brand-slate/10 border-brand-slate/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-slate/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-brand-slate" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-slate">Outstanding Balance</p>
              <h3 className="text-2xl font-bold text-white">{formatRupee(outstanding)}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 bg-zinc-900 border-premium-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generated {title} Due from Quotations
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-400 border-y border-premium-border">
                <tr>
                  <th className="px-4 py-3 font-medium">Quotation</th>
                  <th className="px-4 py-3 font-medium">Profit</th>
                  <th className="px-4 py-3 font-medium">% Paid</th>
                  <th className="px-4 py-3 font-medium text-right text-brand-slate">{title} Due</th>
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
                      <div className="text-white">{formatRupee(q.totalProfit)}</div>
                      <div className="text-xs text-zinc-500">Value: {formatRupee(q.totalValue)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {Math.round((q.amountPaid / q.totalValue) * 100)}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-brand-slate">
                      {formatRupee(q.dueAmount)}
                    </td>
                  </tr>
                ))}
                {quotations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                      No profit generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 bg-zinc-900 border-premium-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Payment Ledger
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
                      {format(new Date(p.date), 'dd MMM yyyy')}
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
        </Card>
      </div>

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-premium-border rounded-lg shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Record {title} Payment</h2>
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
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-brand-slate hover:bg-brand-slate/90"
                >
                  {isSubmitting ? "Saving..." : "Mark as Paid"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
