"use client"

import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import { Plus, ArrowDownRight, ArrowUpRight, Clock, AlertTriangle, CheckCircle2, ChevronRight, Check, X, Search } from "lucide-react"
import { updatePaymentStatus } from "@/app/actions/payment"
import { useRouter } from "next/navigation"
import { TransactionModal } from "./TransactionModal"

export function AccountsView({ initialMetrics, initialEntries, quotations, pos }: any) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  const balance = initialMetrics?.balance || 0
  const pendingIn = initialMetrics?.pendingIn || 0
  const pendingOut = initialMetrics?.pendingOut || 0

  const isLowBalance = balance < pendingOut

  const handleStatusChange = async (id: string, status: string) => {
    setIsUpdating(true)
    try {
      await updatePaymentStatus(id, status)
      router.refresh()
    } catch (e) {
      alert("Error updating status")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {isLowBalance && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rose-500 font-medium">Low Balance Alert</h3>
            <p className="text-rose-400/80 text-sm mt-1">
              Your current balance ({formatRupee(balance / 100)}) is lower than your pending outgoing cheques ({formatRupee(pendingOut / 100)}). Please ensure sufficient funds are available before they clear.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold">₹</span>
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-400 mb-2">Current Balance</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-3xl font-bold tracking-tight ${balance < 0 ? 'text-rose-400' : 'text-white'}`}>
              {formatRupee(balance / 100)}
            </h3>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ArrowDownRight className="w-16 h-16 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-zinc-400 mb-2">Pending In (Cheques)</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold tracking-tight text-emerald-400">
              {formatRupee(pendingIn / 100)}
            </h3>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ArrowUpRight className="w-16 h-16 text-rose-500" />
          </div>
          <p className="text-sm font-medium text-zinc-400 mb-2">Pending Out (Cheques)</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold tracking-tight text-rose-400">
              {formatRupee(pendingOut / 100)}
            </h3>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-6 border-b border-premium-border flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Ledger Transactions</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-slate hover:bg-slate-500 text-white font-medium rounded-md transition-colors shadow-lg shadow-brand-slate/20"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Transaction</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-black/20 border-b border-premium-border">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Category / Against</th>
                <th className="px-6 py-4 font-medium">Method & Ref</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border/50">
              {initialEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                    No transactions found.
                  </td>
                </tr>
              ) : initialEntries.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-zinc-300">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {entry.type === 'IN' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-medium">
                        <ArrowDownRight className="w-3 h-3" /> IN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-400/10 px-2 py-1 rounded text-xs font-medium">
                        <ArrowUpRight className="w-3 h-3" /> OUT
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {entry.quotationId ? (
                      <div>
                        <div className="text-zinc-200">Quotation / Sale</div>
                        <div className="text-xs text-zinc-500">{entry.quotation?.client?.name}</div>
                      </div>
                    ) : entry.poId ? (
                      <div>
                        <div className="text-zinc-200">Purchase Order</div>
                        <div className="text-xs text-zinc-500">{entry.po?.supplier?.name} (PO: {entry.po?.poNumber})</div>
                      </div>
                    ) : (
                      <div className="text-zinc-200">Manual Entry</div>
                    )}
                    {entry.notes && <div className="text-xs text-zinc-500 mt-1">{entry.notes}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-zinc-200">{entry.method}</div>
                    {entry.reference && <div className="text-xs text-zinc-500 font-mono">{entry.reference}</div>}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatRupee(entry.amount / 100)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {entry.status === 'CLEARED' ? (
                      <span className="text-emerald-500 flex items-center justify-center gap-1 text-xs font-medium"><CheckCircle2 className="w-4 h-4"/> Cleared</span>
                    ) : entry.status === 'PENDING' ? (
                      <span className="text-amber-500 flex items-center justify-center gap-1 text-xs font-medium"><Clock className="w-4 h-4"/> Pending</span>
                    ) : (
                      <span className="text-rose-500 flex items-center justify-center gap-1 text-xs font-medium"><X className="w-4 h-4"/> {entry.status}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {entry.status === 'PENDING' && (
                      <button 
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(entry.id, 'CLEARED')}
                        className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-3 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        Mark Cleared
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <TransactionModal 
          onClose={() => setIsModalOpen(false)} 
          quotations={quotations}
          pos={pos}
        />
      )}
    </div>
  )
}
