"use client"

import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import { Plus, ArrowDownRight, ArrowUpRight, Clock, AlertTriangle, CheckCircle2, ChevronRight, Check, X, Search, Trash2 } from "lucide-react"
import { updatePaymentStatus, deletePayment } from "@/app/actions/payment"
import { useRouter } from "next/navigation"
import { TransactionModal } from "./TransactionModal"
import { toast } from "sonner"

export function AccountsView({ initialMetrics, initialEntries, quotations, pos, purchases }: any) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")

  const filteredEntries = initialEntries.filter((entry: any) => {
    if (typeFilter !== 'ALL' && entry.type !== typeFilter) return false;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const ref = (entry.reference || "").toLowerCase();
      const notes = (entry.notes || "").toLowerCase();
      const clientName = (entry.quotation?.client?.name || "").toLowerCase();
      const supplierName = (entry.po?.supplier?.name || entry.purchase?.supplier?.name || "").toLowerCase();
      const method = (entry.method || "").toLowerCase();
      const entityName = (entry.entityName || "").toLowerCase();
      
      if (!ref.includes(query) && !notes.includes(query) && !clientName.includes(query) && !supplierName.includes(query) && !method.includes(query) && !entityName.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const isFiltered = searchQuery.trim() !== "" || typeFilter !== "ALL";

  const balance = isFiltered ? filteredEntries.reduce((acc: number, entry: any) => {
    if (entry.status === 'CLEARED') {
      return entry.type === 'IN' ? acc + entry.amount : acc - entry.amount;
    }
    return acc;
  }, 0) : (initialMetrics?.balance || 0);

  const pendingIn = isFiltered ? filteredEntries.reduce((acc: number, entry: any) => {
    if (entry.status === 'PENDING' && entry.type === 'IN') return acc + entry.amount;
    return acc;
  }, 0) : (initialMetrics?.pendingIn || 0);

  const pendingOut = isFiltered ? filteredEntries.reduce((acc: number, entry: any) => {
    if (entry.status === 'PENDING' && entry.type === 'OUT') return acc + entry.amount;
    return acc;
  }, 0) : (initialMetrics?.pendingOut || 0);
  
  const accountsReceivable = initialMetrics?.accountsReceivable || 0
  const accountsPayable = initialMetrics?.accountsPayable || 0
  const pendingFulfillmentCost = initialMetrics?.pendingFulfillmentCost || 0
  
  const totalExpectedCash = balance + accountsReceivable
  const totalExpectedLiabilities = accountsPayable + pendingFulfillmentCost + pendingOut
  const workingCapital = totalExpectedCash - totalExpectedLiabilities

  const isLowBalance = balance < pendingOut

  const handleStatusChange = async (id: string, status: string) => {
    setIsUpdating(true)
    try {
      await updatePaymentStatus(id, status)
      router.refresh()
    } catch (e) {
      toast.error("Error updating status")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction? This will impact your balances immediately.")) return
    
    setIsUpdating(true)
    try {
      await deletePayment(id)
      router.refresh()
    } catch (e) {
      toast.error("Error deleting transaction")
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
              Your current balance ({formatRupee(balance)}) is lower than your pending outgoing cheques ({formatRupee(pendingOut)}). Please ensure sufficient funds are available before they clear.
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
              {formatRupee(balance)}
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
              {formatRupee(pendingIn)}
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
              {formatRupee(pendingOut)}
            </h3>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl space-y-4">
        <h2 className="text-lg font-medium text-white">Working Capital Overview</h2>
        <p className="text-sm text-zinc-400">
          This shows the estimated cash flow considering unfulfilled obligations (Accepted Quotations and Unpaid POs). Mark quotations as COMPLETED when they are fulfilled to drop their estimated cost (since you would have already raised POs for them).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-premium-border/50">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Accounts Receivable</p>
            <p className="text-lg font-bold text-emerald-400">+{formatRupee(accountsReceivable)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Unpaid on Accepted/Completed Quotes</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Accounts Payable</p>
            <p className="text-lg font-bold text-rose-400">-{formatRupee(accountsPayable)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Unpaid on Purchase Orders & Purchases</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pending Fulfillments</p>
            <p className="text-lg font-bold text-amber-400">-{formatRupee(pendingFulfillmentCost)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Est. cost for Accepted Quotes (not yet PO'd)</p>
          </div>
          <div className="pl-4 border-l border-premium-border/50">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Working Capital</p>
            <p className={`text-2xl font-bold ${workingCapital < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {formatRupee(workingCapital)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              {workingCapital < 0 ? "Additional funds needed" : "Surplus funds available"}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-premium-border flex flex-col md:flex-row gap-4 items-center justify-between">
          <h2 className="text-lg font-medium text-white">Ledger Transactions</h2>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-premium-border rounded-md pl-9 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-slate/50 transition-colors"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full sm:w-auto bg-black/20 border border-premium-border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-slate/50 transition-colors"
              >
                <option value="ALL">All Types</option>
                <option value="IN">Money In</option>
                <option value="OUT">Money Out</option>
              </select>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-slate hover:bg-slate-500 text-white font-medium rounded-md transition-colors shadow-lg shadow-brand-slate/20 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add</span>
              </button>
            </div>
          </div>
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
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                    No transactions found.
                  </td>
                </tr>
              ) : filteredEntries.map((entry: any) => (
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
                    ) : entry.purchaseId ? (
                      <div>
                        <div className="text-zinc-200">Direct Purchase</div>
                        <div className="text-xs text-zinc-500">{entry.purchase?.supplier?.name}</div>
                      </div>
                    ) : entry.category === 'LOAN' || entry.category === 'TRANSFER' ? (
                      <div>
                        <div className="text-zinc-200">
                          {entry.category === 'LOAN' ? 'Loan' : 'Internal Transfer'}
                          <span className="text-xs text-brand-orange ml-2">({Math.floor((new Date().getTime() - new Date(entry.date).getTime()) / (1000 * 3600 * 24))} days ago)</span>
                        </div>
                        <div className="text-xs text-zinc-500">{entry.entityName}</div>
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
                    {formatRupee(entry.amount)}
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
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                    {entry.status === 'PENDING' && (
                      <button 
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(entry.id, 'CLEARED')}
                        className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-3 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        Mark Cleared
                      </button>
                    )}
                    <button
                      disabled={isUpdating}
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-50"
                      title="Delete Transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
          purchases={purchases}
        />
      )}
    </div>
  )
}
