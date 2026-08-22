"use client"
import { useState } from "react"
import { PaymentModal } from "./PaymentModal"
import { PaymentStatusBadge } from "./PaymentStatusBadge"
import { formatRupee } from "@/lib/utils"
import { Plus } from "lucide-react"

export function PaymentSection({ 
  type, 
  entityId, 
  totalAmount, 
  totalGst, 
  amountPaid,
  paymentStatus,
  paymentDueDate,
  payments 
}: { 
  type: 'quotation' | 'po'
  entityId: string
  totalAmount: number
  totalGst: number
  amountPaid: number
  paymentStatus: string
  paymentDueDate: Date | null
  payments: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const balance = totalAmount + totalGst - amountPaid

  return (
    <div className="glass-panel p-8 rounded-lg mt-6 print:hidden">
      <div className="flex items-center justify-between mb-6 border-b border-premium-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Payment Tracking</h2>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-sm">Status:</span>
            <PaymentStatusBadge status={paymentStatus} dueDate={paymentDueDate} />
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={balance <= 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white/5 border border-premium-border p-4 rounded-md">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Amount</p>
          <p className="text-xl font-bold text-white">{formatRupee(totalAmount + totalGst)}</p>
        </div>
        <div className="bg-white/5 border border-premium-border p-4 rounded-md">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Amount Paid</p>
          <p className="text-xl font-bold text-emerald-400">{formatRupee(amountPaid)}</p>
        </div>
        <div className="bg-white/5 border border-premium-border p-4 rounded-md">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Balance Due</p>
          <p className="text-xl font-bold text-rose-400">{formatRupee(balance)}</p>
        </div>
      </div>

      {payments.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-white mb-4">Payment History</h3>
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-y border-premium-border">
              <tr>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Method</th>
                <th className="py-3 px-4 font-medium">Reference</th>
                <th className="py-3 px-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="py-3 px-4 text-zinc-300">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-zinc-300">{p.method}</td>
                  <td className="py-3 px-4 text-zinc-400">{p.reference || '-'}</td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-400">{formatRupee(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-8 text-zinc-500 bg-white/5 rounded-md border border-premium-border/50">
          No payments recorded yet.
        </div>
      )}

      {isModalOpen && (
        <PaymentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          type={type}
          entityId={entityId}
          totalAmount={totalAmount}
          totalGst={totalGst}
          amountPaid={amountPaid}
        />
      )}
    </div>
  )
}
