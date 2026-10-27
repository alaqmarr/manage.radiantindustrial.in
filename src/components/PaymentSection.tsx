"use client"
import { useState } from "react"
import { PaymentModal } from "./PaymentModal"
import { PaymentStatusBadge } from "./PaymentStatusBadge"
import { formatRupee } from "@/lib/utils"
import { Plus, CreditCard } from "lucide-react"

export function PaymentSection({
  type,
  entityId,
  totalAmount,
  totalGst,
  amountPaid,
  paymentStatus,
  paymentDueDate,
  payments,
}: {
  type: "quotation" | "po"
  entityId: string
  totalAmount: number
  totalGst: number
  amountPaid: number
  paymentStatus: string
  paymentDueDate: Date | null
  payments: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const balance = Math.max(0, totalAmount + totalGst - amountPaid)

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs mt-6 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              {type === "quotation"
                ? "Client Payment Collection Tracking"
                : "Vendor Payment Disbursement Tracking"}
            </h2>
            <PaymentStatusBadge status={paymentStatus} dueDate={paymentDueDate} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            All recorded payments automatically sync with Accounts & Financial Ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={balance <= 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span className="text-white">Record Payment</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Total Invoice (Incl. GST)
          </p>
          <p className="text-lg font-bold font-mono text-slate-900">
            {formatRupee(totalAmount + totalGst)}
          </p>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
            Amount Paid / Settled
          </p>
          <p className="text-lg font-bold font-mono text-emerald-700">
            {formatRupee(amountPaid)}
          </p>
        </div>
        <div className="bg-rose-50/60 border border-rose-200 p-4 rounded-xl">
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1">
            Balance Remaining Due
          </p>
          <p className="text-lg font-bold font-mono text-rose-600">{formatRupee(balance)}</p>
        </div>
      </div>

      {payments.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Payment Method</th>
                <th className="py-3 px-4 font-semibold">UTR / Cheque Reference</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 text-slate-700 text-xs">
                    {new Date(p.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-medium text-xs">{p.method}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                    {p.reference || "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                    {formatRupee(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-6 text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No payments recorded against this document yet.
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
