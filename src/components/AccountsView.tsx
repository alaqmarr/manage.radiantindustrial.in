"use client"

import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import { Plus, ArrowDownRight, ArrowUpRight, Clock, AlertTriangle, CheckCircle2, ChevronRight, Check, X, Search, Trash2 } from "lucide-react"
import { updatePaymentStatus, deletePayment } from "@/app/actions/payment"
import { useRouter } from "next/navigation"
import { TransactionModal } from "./TransactionModal"
import { toast } from "sonner"

export function AccountsView({ initialMetrics, initialEntries, quotations, pos, purchases, clients }: any) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  const [breakdownModal, setBreakdownModal] = useState<{ title: string, type: 'RECEIVABLES' | 'PAYABLES' | 'FULFILLMENTS' } | null>(null)
  const [resolveModal, setResolveModal] = useState<{ paymentId: string, amount: number, type: 'IN' | 'OUT' } | null>(null)
  const [resolvingQId, setResolvingQId] = useState("")
  
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [activeTab, setActiveTab] = useState("OVERVIEW")

  const handleResolve = async () => {
    if (!resolveModal || !resolvingQId) return
    setIsUpdating(true)
    try {
      // Need to import resolveUntaggedPayment from actions
      const { resolveUntaggedPayment } = await import("@/app/actions/payment")
      const res = await resolveUntaggedPayment(resolveModal.paymentId, resolvingQId)
      if (res.success) {
        toast.success("Payment resolved successfully")
        setResolveModal(null)
        setResolvingQId("")
        router.refresh()
      } else {
        toast.error(res.error || "Failed to resolve")
      }
    } catch (e) {
      toast.error("Error resolving payment")
    } finally {
      setIsUpdating(false)
    }
  }

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
  
  // Loans from server-side metrics
  const totalLent = initialMetrics?.totalLent || 0
  const totalBorrowed = initialMetrics?.totalBorrowed || 0
  const netLoanPosition = initialMetrics?.netLoanPosition || 0

  // Client credits
  const totalClientCredit = initialMetrics?.totalClientCredit || 0

  const totalExpectedCash = balance + accountsReceivable + pendingIn + totalLent
  const totalExpectedLiabilities = accountsPayable + pendingFulfillmentCost + pendingOut + totalBorrowed + totalClientCredit
  const workingCapital = (balance + accountsReceivable) - (accountsPayable + pendingFulfillmentCost + pendingOut) // legacy
  const businessBalance = totalExpectedCash - totalExpectedLiabilities
  
  // Cash After Obligations: what's left if you pay everything you owe right now
  const cashAfterObligations = balance - accountsPayable - pendingFulfillmentCost - pendingOut

  // P&L from server-side metrics (computed from ALL accepted/completed quotations)
  const totalRevenue = initialMetrics?.totalRevenue || 0
  const totalCogs = initialMetrics?.totalCogs || 0
  const totalAdditionalExpenses = initialMetrics?.totalAdditionalExpenses || 0
  const grossProfit = initialMetrics?.grossProfit || 0
  const netProfit = initialMetrics?.netProfit || 0
  const profitMargin = initialMetrics?.profitMargin || 0
  const pnlBreakdown = initialMetrics?.pnlBreakdown || []
  const pnlQuotationCount = initialMetrics?.pnlQuotationCount || 0

  const isLowBalance = balance < pendingOut

  // Loan entries for the LOANS tab table
  const loanEntries = (initialEntries || []).filter((e: any) => e.category === 'LOAN');

  // Running balance computation (from oldest to newest, for cleared entries only)
  const clearedEntriesOldestFirst = [...(initialEntries || [])].filter((e: any) => e.status === 'CLEARED').sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const runningBalanceMap = new Map<string, number>()
  let runningTotal = 0
  for (const entry of clearedEntriesOldestFirst) {
    runningTotal += entry.type === 'IN' ? entry.amount : -entry.amount
    runningBalanceMap.set(entry.id, runningTotal)
  }

  // Helper: relative date
  const relativeDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return d.toLocaleDateString()
  }

  // Category badge helper
  const categoryBadge = (entry: any) => {
    if (entry.untagged) return { label: 'UNTAGGED', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
    if (entry.quotationId) return { label: 'SALE', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    if (entry.poId) return { label: 'PO', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    if (entry.purchaseId) return { label: 'PURCHASE', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' }
    if (entry.category === 'LOAN') return { label: 'LOAN', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    if (entry.category === 'TRANSFER') return { label: 'TRANSFER', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' }
    if (entry.category === 'ADVANCE') return { label: 'ADVANCE', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' }
    return { label: 'MANUAL', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
  }

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
      
      {/* ── Always-visible P/L Banner ── */}
      <div className="glass-panel rounded-xl p-5 border border-premium-border/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {netProfit >= 0 ? '↑' : '↓'}
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Net Profit / Loss</p>
              <p className={`text-2xl font-bold tracking-tight ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netProfit >= 0 ? '' : '-'}{formatRupee(Math.abs(netProfit))}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {profitMargin.toFixed(1)}% margin · Based on {pnlQuotationCount} quotation{pnlQuotationCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:border-l md:border-premium-border/50 md:pl-6">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black ${cashAfterObligations >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              ₹
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Cash After All Obligations</p>
              <p className={`text-2xl font-bold tracking-tight ${cashAfterObligations >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatRupee(cashAfterObligations)}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {cashAfterObligations >= 0 ? 'Surplus — you can cover all dues' : 'Shortfall — need more funds to cover dues'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:border-l md:border-premium-border/50 md:pl-6">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black ${businessBalance >= 0 ? 'bg-brand-orange/10 text-brand-orange border border-brand-orange/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              ±
            </div>
            <div>
              <p className="text-xs text-brand-slate uppercase tracking-wider font-medium">True Business Balance</p>
              <p className={`text-2xl font-bold tracking-tight ${businessBalance >= 0 ? 'text-brand-orange' : 'text-rose-400'}`}>
                {formatRupee(businessBalance)}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Net equity (All assets minus all liabilities)
              </p>
            </div>
          </div>
        </div>
      </div>

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

      <div className="flex items-center gap-2 border-b border-premium-border/50 pb-2">
        <button 
          onClick={() => setActiveTab("OVERVIEW")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'OVERVIEW' ? 'bg-brand-orange text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Overview & Ledger
        </button>
        <button 
          onClick={() => setActiveTab("PNL")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'PNL' ? 'bg-brand-orange text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Profit & Loss
        </button>
        <button 
          onClick={() => setActiveTab("LOANS")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'LOANS' ? 'bg-brand-orange text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Loans & Transfers
        </button>
        <button 
          onClick={() => setActiveTab("UNTAGGED")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${activeTab === 'UNTAGGED' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Unresolved Payments
          {(initialEntries || []).filter((e: any) => e.untagged).length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {(initialEntries || []).filter((e: any) => e.untagged).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "OVERVIEW" && (
        <>

      <div className="glass-panel p-6 rounded-xl space-y-4">
        <h2 className="text-lg font-medium text-white">Working Capital Overview</h2>
        <p className="text-sm text-zinc-400">
          This shows the estimated cash flow considering unfulfilled obligations (Accepted Quotations and Unpaid POs). Mark quotations as COMPLETED when they are fulfilled to drop their estimated cost (since you would have already raised POs for them).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 pt-4 border-t border-premium-border/50">
          <div 
            onClick={() => setBreakdownModal({ title: 'Accounts Receivable', type: 'RECEIVABLES' })}
            className="cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors group"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 group-hover:text-zinc-300 transition-colors flex items-center gap-1">Receivables <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></p>
            <p className="text-lg font-bold text-emerald-400">+{formatRupee(accountsReceivable)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Unpaid on Quotes</p>
          </div>
          <div 
            onClick={() => setBreakdownModal({ title: 'Accounts Payable', type: 'PAYABLES' })}
            className="cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors group"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 group-hover:text-zinc-300 transition-colors flex items-center gap-1">Payables <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></p>
            <p className="text-lg font-bold text-rose-400">-{formatRupee(accountsPayable)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Unpaid on POs & Purchases</p>
          </div>
          <div 
            onClick={() => setBreakdownModal({ title: 'Pending Fulfillments', type: 'FULFILLMENTS' })}
            className="cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-lg transition-colors group"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 group-hover:text-zinc-300 transition-colors flex items-center gap-1">Fulfillments <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></p>
            <p className="text-lg font-bold text-amber-400">-{formatRupee(pendingFulfillmentCost)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Est. cost not covered by POs</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Net Loans</p>
            <p className={`text-lg font-bold ${netLoanPosition > 0 ? 'text-rose-400' : netLoanPosition < 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {netLoanPosition > 0 ? '-' : netLoanPosition < 0 ? '+' : ''}{formatRupee(Math.abs(netLoanPosition))}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">{netLoanPosition > 0 ? 'You owe (net borrowed)' : netLoanPosition < 0 ? 'Others owe you (net lent)' : 'No loans'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Client Credits</p>
            <p className={`text-lg font-bold ${totalClientCredit > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
              {formatRupee(totalClientCredit)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">{totalClientCredit > 0 ? 'Prepaid by clients (owed as goods)' : 'No advance credits'}</p>
          </div>
          <div className="pl-4 border-l border-premium-border/50">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Working Capital</p>
            <p className={`text-2xl font-bold ${workingCapital < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {formatRupee(workingCapital)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              {workingCapital < 0 ? "Additional funds needed" : "Surplus funds expected"}
            </p>
          </div>
          <div className="pl-4 border-l border-premium-border/50">
            <p className="text-xs text-brand-orange uppercase tracking-wider mb-1">Cash After Obligations</p>
            <p className={`text-2xl font-bold ${cashAfterObligations < 0 ? 'text-rose-500' : 'text-brand-orange'}`}>
              {formatRupee(cashAfterObligations)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Balance minus all payables, fulfillments & pending out
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-premium-border/30 bg-black/20 rounded-md p-4 text-xs font-mono flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-zinc-400 font-sans font-medium uppercase tracking-wider text-[10px]">Working Capital:</span>
          
          <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
            <span className="text-emerald-400 font-medium">Balance</span>
            <span className="text-emerald-400">{formatRupee(balance)}</span>
          </div>
          <span className="text-zinc-500 font-bold">+</span>
          <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
            <span className="text-emerald-400 font-medium">Receivables</span>
            <span className="text-emerald-400">{formatRupee(accountsReceivable)}</span>
          </div>
          
          <span className="text-zinc-500 font-bold ml-2">-</span>
          
          <div className="flex items-center gap-2 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 ml-2" title="Money you owe to suppliers">
            <span className="text-rose-400 font-medium">Payables</span>
            <span className="text-rose-400">{formatRupee(accountsPayable)}</span>
          </div>
          
          <span className="text-zinc-500 font-bold">-</span>
          <div className="flex items-center gap-2 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            <span className="text-amber-400 font-medium">Fulfillments</span>
            <span className="text-amber-400">{formatRupee(pendingFulfillmentCost)}</span>
          </div>

          <span className="text-zinc-500 font-bold">-</span>
          <div className="flex items-center gap-2 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
            <span className="text-rose-400 font-medium">Pending Out</span>
            <span className="text-rose-400">{formatRupee(pendingOut)}</span>
          </div>
          
          <span className="text-zinc-400 font-bold ml-2">=</span>
          <span className={`text-base ml-1 font-bold ${workingCapital < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
            {formatRupee(workingCapital)}
          </span>
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
                <th className="px-6 py-4 font-medium text-right text-brand-orange/80">Running Bal</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border/50">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">
                    No transactions found.
                  </td>
                </tr>
              ) : filteredEntries.map((entry: any) => {
                const cat = categoryBadge(entry);
                return (
                <tr key={entry.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-zinc-300 font-medium">{relativeDate(entry.date)}</div>
                    <div className="text-xs text-zinc-500 mt-1">{new Date(entry.date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    {entry.type === 'IN' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-medium border border-emerald-400/20">
                        <ArrowDownRight className="w-3 h-3" /> IN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-400/10 px-2 py-1 rounded text-xs font-medium border border-rose-400/20">
                        <ArrowUpRight className="w-3 h-3" /> OUT
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cat.color} ${entry.untagged ? 'animate-pulse' : ''}`}>
                        {cat.label}
                      </span>
                    </div>
                    {entry.quotationId ? (
                      <div className="text-zinc-300 text-sm">{entry.quotation?.client?.name}</div>
                    ) : entry.poId ? (
                      <div className="text-zinc-300 text-sm">{entry.po?.supplier?.name} <span className="text-zinc-500 text-xs">(PO: {entry.po?.poNumber})</span></div>
                    ) : entry.purchaseId ? (
                      <div className="text-zinc-300 text-sm">{entry.purchase?.supplier?.name}</div>
                    ) : entry.category === 'LOAN' || entry.category === 'TRANSFER' ? (
                      <div className="text-zinc-300 text-sm">{entry.entityName}</div>
                    ) : entry.clientId ? (
                      <div className="text-zinc-300 text-sm">{entry.client?.name}</div>
                    ) : entry.supplierId ? (
                      <div className="text-zinc-300 text-sm">{entry.supplier?.name}</div>
                    ) : (
                      <div className="text-zinc-300 text-sm">{entry.entityName || "Manual Entry"}</div>
                    )}
                    <div className={`text-xs text-zinc-500 mt-1 ${!entry.notes ? 'opacity-0' : ''}`}>{entry.notes || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-zinc-200">{entry.method}</div>
                    {entry.reference && <div className="text-xs text-zinc-500 font-mono">{entry.reference}</div>}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatRupee(entry.amount)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-brand-orange/90">
                    {entry.status === 'CLEARED' ? formatRupee(runningBalanceMap.get(entry.id) || 0) : <span className="text-zinc-500 text-xs italic">Pending</span>}
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
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
              )})}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {activeTab === "PNL" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-panel p-6 rounded-xl">
              <p className="text-sm font-medium text-zinc-400 mb-2">Total Revenue</p>
              <h3 className="text-2xl font-bold tracking-tight text-white">{formatRupee(totalRevenue)}</h3>
            </div>
            <div className="glass-panel p-6 rounded-xl">
              <p className="text-sm font-medium text-zinc-400 mb-2">Cost of Goods Sold (COGS)</p>
              <h3 className="text-2xl font-bold tracking-tight text-amber-400">-{formatRupee(totalCogs)}</h3>
            </div>
            <div className="glass-panel p-6 rounded-xl">
              <p className="text-sm font-medium text-zinc-400 mb-2">Additional Expenses</p>
              <h3 className="text-2xl font-bold tracking-tight text-amber-400">-{formatRupee(totalAdditionalExpenses)}</h3>
            </div>
            <div className="glass-panel p-6 rounded-xl border border-brand-orange/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="text-2xl font-bold">%</span>
              </div>
              <p className="text-sm font-medium text-zinc-400 mb-2">Net Profit</p>
              <h3 className={`text-2xl font-bold tracking-tight ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netProfit >= 0 ? '' : '-'}{formatRupee(Math.abs(netProfit))}
              </h3>
              <p className="text-xs text-brand-orange mt-1">Margin: {profitMargin.toFixed(2)}%</p>
            </div>
          </div>
          <div className="glass-panel rounded-xl overflow-hidden">
             <div className="p-4 border-b border-premium-border">
               <h2 className="text-lg font-medium text-white">Accepted & Completed Quotations P&L</h2>
               <p className="text-xs text-zinc-400 mt-1">Calculates Revenue, COGS, and additional expenses for active orders.</p>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-zinc-400 uppercase bg-black/20 border-b border-premium-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Quotation</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Revenue</th>
                      <th className="px-6 py-4 font-medium text-right">COGS</th>
                      <th className="px-6 py-4 font-medium text-right">Expenses</th>
                      <th className="px-6 py-4 font-medium text-right">Profit</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-premium-border/50">
                    {pnlBreakdown.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No quotations to analyze.</td></tr>
                    ) : pnlBreakdown.map((q: any) => (
                      <tr key={q.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-zinc-300">
                           <div className="font-medium text-white">{q.id}</div>
                           <div className="text-xs text-zinc-500 mt-1">{q.clientName}</div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${q.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{q.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-white">{formatRupee(q.revenue)}</td>
                        <td className="px-6 py-4 text-right text-amber-400">-{formatRupee(q.cogs)}</td>
                        <td className="px-6 py-4 text-right text-amber-400">-{formatRupee(q.expenses)}</td>
                        <td className={`px-6 py-4 text-right font-bold ${q.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {q.profit >= 0 ? '' : '-'}{formatRupee(Math.abs(q.profit))}
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === "LOANS" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
              <p className="text-sm font-medium text-zinc-400 mb-2">Total Lent (Money Out)</p>
              <h3 className="text-3xl font-bold tracking-tight text-emerald-400">{formatRupee(totalLent)}</h3>
            </div>
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
              <p className="text-sm font-medium text-zinc-400 mb-2">Total Borrowed (Money In)</p>
              <h3 className="text-3xl font-bold tracking-tight text-rose-400">{formatRupee(totalBorrowed)}</h3>
            </div>
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
              <p className="text-sm font-medium text-zinc-400 mb-2">Net Position</p>
              <h3 className={`text-3xl font-bold tracking-tight ${netLoanPosition > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {netLoanPosition > 0 ? "You owe: " : "You are owed: "}{formatRupee(Math.abs(netLoanPosition))}
              </h3>
            </div>
          </div>
          <div className="glass-panel rounded-xl overflow-hidden">
             <div className="p-4 border-b border-premium-border flex justify-between items-center">
               <div>
                 <h2 className="text-lg font-medium text-white">Loan & Transfer Ledger</h2>
                 <p className="text-xs text-zinc-400 mt-1">All transactions marked as LOAN.</p>
               </div>
               <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-slate hover:bg-slate-500 text-white font-medium rounded-md transition-colors shadow-lg shadow-brand-slate/20 text-sm"
               >
                 <Plus className="w-4 h-4" /> Add
               </button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-zinc-400 uppercase bg-black/20 border-b border-premium-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Entity / Note</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium text-right">Amount</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-premium-border/50">
                    {loanEntries.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-500">No loan transactions found.</td></tr>
                    ) : loanEntries.map((e: any) => (
                      <tr key={e.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-zinc-300">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                           <div className="text-white font-medium">{e.entityName || "Unknown"}</div>
                           <div className="text-xs text-zinc-500 mt-1">{e.notes}</div>
                        </td>
                        <td className="px-6 py-4">
                           {e.type === 'IN' ? (
                             <span className="text-emerald-400 text-xs bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">Money IN (Borrowed)</span>
                           ) : (
                             <span className="text-amber-400 text-xs bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">Money OUT (Lent)</span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-white">{formatRupee(e.amount)}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === "UNTAGGED" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="glass-panel rounded-xl overflow-hidden">
             <div className="p-4 border-b border-premium-border flex justify-between items-center">
               <div>
                 <h2 className="text-lg font-medium text-white">Unresolved Payments</h2>
                 <p className="text-xs text-zinc-400 mt-1">Payments recorded without a tagged quotation or order.</p>
               </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-zinc-400 uppercase bg-black/20 border-b border-premium-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Entity / Note</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium text-right">Amount</th>
                      <th className="px-6 py-4 font-medium text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-premium-border/50">
                    {(initialEntries || []).filter((e: any) => e.untagged).length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No unresolved payments found.</td></tr>
                    ) : (initialEntries || []).filter((e: any) => e.untagged).map((e: any) => (
                      <tr key={e.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-zinc-300">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                           <div className="text-white font-medium">{e.client?.name || e.supplier?.name || "Unknown"}</div>
                           <div className="text-xs text-zinc-500 mt-1">{e.notes || e.reference}</div>
                        </td>
                        <td className="px-6 py-4">
                           {e.type === 'IN' ? (
                             <span className="text-emerald-400 text-xs bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">Money IN (Receivable)</span>
                           ) : (
                             <span className="text-rose-400 text-xs bg-rose-400/10 px-2 py-1 rounded border border-rose-400/20">Money OUT (Payable)</span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-white">{formatRupee(e.amount)}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setResolveModal({ paymentId: e.id, amount: e.amount, type: e.type })}
                            className="text-xs bg-brand-orange text-black px-3 py-1.5 rounded-md font-medium hover:bg-orange-400 transition-colors"
                          >
                            Resolve
                          </button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <TransactionModal 
          onClose={() => setIsModalOpen(false)} 
          quotations={quotations}
          pos={pos}
          purchases={purchases}
          clients={clients}
        />
      )}

      {resolveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-premium-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-premium-border bg-white/[0.02]">
              <h2 className="text-xl font-semibold text-white">Resolve Untagged Payment</h2>
              <button onClick={() => setResolveModal(null)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-zinc-400 mb-4">
                Resolving payment of <span className="text-white font-bold">{formatRupee(resolveModal.amount)}</span>.
              </p>
              
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                {resolveModal.type === 'IN' ? 'Select Quotation to apply this payment' : 'Select PO / Purchase to apply this payment'}
              </label>
              <select
                value={resolvingQId}
                onChange={(e) => setResolvingQId(e.target.value)}
                className="w-full bg-black/50 border border-premium-border rounded-md px-3 py-2 text-white focus:outline-none focus:border-brand-slate"
              >
                <option value="">-- Select --</option>
                {resolveModal.type === 'IN' && quotations?.filter((q: any) => q.status === 'ACCEPTED' || q.status === 'COMPLETED').map((q: any) => {
                  const due = (q.totalAmount || 0) + (q.totalGst || 0) - (q.amountPaid || 0);
                  return (
                    <option key={q.id} value={q.id} disabled={due <= 0}>
                      {q.id} - {q.client?.name} (Due: {formatRupee(due)})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="p-6 border-t border-premium-border bg-white/[0.02] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResolveModal(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isUpdating || !resolvingQId}
                className="px-4 py-2 text-sm font-medium bg-brand-slate hover:bg-slate-500 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isUpdating ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : null}
                Resolve Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {breakdownModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-3xl rounded-xl border border-premium-border overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-premium-border/50">
              <div>
                <h3 className="text-xl font-bold text-white">{breakdownModal.title}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {breakdownModal.type === 'RECEIVABLES' && "Unpaid amounts on Accepted or Completed Quotations."}
                  {breakdownModal.type === 'PAYABLES' && "Unpaid amounts on Purchase Orders and Direct Purchases."}
                  {breakdownModal.type === 'FULFILLMENTS' && "Estimated material costs minus tagged Purchases and POs."}
                </p>
              </div>
              <button onClick={() => setBreakdownModal(null)} className="text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1">
              {breakdownModal.type === 'RECEIVABLES' && (
                <div className="space-y-3">
                  {initialMetrics?.receivablesBreakdown?.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{b.id}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border font-semibold ${b.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{b.status}</span>
                        </div>
                        <p className="text-sm text-zinc-400">{b.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold">{formatRupee(b.due)}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">{formatRupee(b.paid)} paid of {formatRupee(b.total)}</p>
                      </div>
                    </div>
                  ))}
                  {(!initialMetrics?.receivablesBreakdown || initialMetrics.receivablesBreakdown.length === 0) && (
                    <p className="text-center text-zinc-500 py-8">No receivables found.</p>
                  )}
                </div>
              )}

              {breakdownModal.type === 'PAYABLES' && (
                <div className="space-y-3">
                  {initialMetrics?.payablesBreakdown?.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{b.id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm border border-zinc-700 bg-zinc-800/50 text-zinc-300 font-semibold">{b.type}</span>
                        </div>
                        <p className="text-sm text-zinc-400">{b.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-rose-400 font-bold">{formatRupee(b.due)}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">{formatRupee(b.paid)} paid of {formatRupee(b.total)}</p>
                      </div>
                    </div>
                  ))}
                  {(!initialMetrics?.payablesBreakdown || initialMetrics.payablesBreakdown.length === 0) && (
                    <p className="text-center text-zinc-500 py-8">No payables found.</p>
                  )}
                </div>
              )}

              {breakdownModal.type === 'FULFILLMENTS' && (
                <div className="space-y-3">
                  {initialMetrics?.fulfillmentsBreakdown?.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{b.id}</span>
                        </div>
                        <p className="text-sm text-zinc-400">{b.name}</p>
                        <p className="text-xs text-zinc-500 mt-1">Est. Cost: {formatRupee(b.estCost)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-bold">{formatRupee(b.uncovered)}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">{formatRupee(b.alreadyPurchasedCost)} covered by POs/Purchases</p>
                      </div>
                    </div>
                  ))}
                  {(!initialMetrics?.fulfillmentsBreakdown || initialMetrics.fulfillmentsBreakdown.length === 0) && (
                    <p className="text-center text-zinc-500 py-8">No pending fulfillments found.</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-premium-border/50 bg-black/20 flex justify-end">
              <button onClick={() => setBreakdownModal(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
