"use client"

import { useState } from "react"
import { formatRupee } from "@/lib/utils"
import {
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Search,
  Trash2,
} from "lucide-react"
import { updatePaymentStatus, deletePayment } from "@/app/actions/payment"
import { useRouter } from "next/navigation"
import { TransactionModal } from "./TransactionModal"
import { sileo } from "sileo"

export function AccountsView({
  initialMetrics,
  initialEntries,
  quotations,
  pos,
  purchases,
  clients,
}: any) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const [breakdownModal, setBreakdownModal] = useState<{
    title: string
    type: "RECEIVABLES" | "PAYABLES" | "FULFILLMENTS"
  } | null>(null)
  const [resolveModal, setResolveModal] = useState<{
    paymentId: string
    amount: number
    type: "IN" | "OUT"
  } | null>(null)
  const [resolvingQId, setResolvingQId] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [activeTab, setActiveTab] = useState("OVERVIEW")

  const handleResolve = async () => {
    if (!resolveModal || !resolvingQId) return
    setIsUpdating(true)
    try {
      const { resolveUntaggedPayment } = await import("@/app/actions/payment")
      const res = await resolveUntaggedPayment(resolveModal.paymentId, resolvingQId)
      if (res.success) {
        sileo.success({
          title: "Payment Resolved",
          description: "Untagged payment has been linked to the selected quotation.",
        })
        setResolveModal(null)
        setResolvingQId("")
        router.refresh()
      } else {
        sileo.error({
          title: "Resolution Failed",
          description: res.error || "Failed to resolve payment.",
        })
      }
    } catch (e) {
      sileo.error({
        title: "Resolution Error",
        description: "An unexpected error occurred while resolving the payment.",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredEntries = initialEntries.filter((entry: any) => {
    if (typeFilter !== "ALL" && entry.type !== typeFilter) return false

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const ref = (entry.reference || "").toLowerCase()
      const notes = (entry.notes || "").toLowerCase()
      const clientName = (entry.quotation?.client?.name || "").toLowerCase()
      const supplierName = (
        entry.po?.supplier?.name ||
        entry.purchase?.supplier?.name ||
        ""
      ).toLowerCase()
      const method = (entry.method || "").toLowerCase()
      const entityName = (entry.entityName || "").toLowerCase()

      if (
        !ref.includes(query) &&
        !notes.includes(query) &&
        !clientName.includes(query) &&
        !supplierName.includes(query) &&
        !method.includes(query) &&
        !entityName.includes(query)
      ) {
        return false
      }
    }
    return true
  })

  const isFiltered = searchQuery.trim() !== "" || typeFilter !== "ALL"

  const balance = isFiltered
    ? filteredEntries.reduce((acc: number, entry: any) => {
        if (entry.status === "CLEARED") {
          return entry.type === "IN" ? acc + entry.amount : acc - entry.amount
        }
        return acc
      }, 0)
    : initialMetrics?.balance || 0

  const pendingIn = isFiltered
    ? filteredEntries.reduce((acc: number, entry: any) => {
        if (entry.status === "PENDING" && entry.type === "IN") return acc + entry.amount
        return acc
      }, 0)
    : initialMetrics?.pendingIn || 0

  const pendingOut = isFiltered
    ? filteredEntries.reduce((acc: number, entry: any) => {
        if (entry.status === "PENDING" && entry.type === "OUT") return acc + entry.amount
        return acc
      }, 0)
    : initialMetrics?.pendingOut || 0

  const accountsReceivable = initialMetrics?.accountsReceivable || 0
  const accountsPayable = initialMetrics?.accountsPayable || 0
  const pendingFulfillmentCost = initialMetrics?.pendingFulfillmentCost || 0

  const totalLent = initialMetrics?.totalLent || 0
  const totalBorrowed = initialMetrics?.totalBorrowed || 0
  const netLoanPosition = initialMetrics?.netLoanPosition || 0

  const totalClientCredit = initialMetrics?.totalClientCredit || 0

  const totalExpectedCash = balance + accountsReceivable + pendingIn + totalLent
  const totalExpectedLiabilities =
    accountsPayable + pendingFulfillmentCost + pendingOut + totalBorrowed + totalClientCredit
  const workingCapital =
    balance + accountsReceivable - (accountsPayable + pendingFulfillmentCost + pendingOut)
  const businessBalance = totalExpectedCash - totalExpectedLiabilities

  const cashAfterObligations = balance - accountsPayable - pendingFulfillmentCost - pendingOut

  const totalRevenue = initialMetrics?.totalRevenue || 0
  const totalCogs = initialMetrics?.totalCogs || 0
  const totalAdditionalExpenses = initialMetrics?.totalAdditionalExpenses || 0
  const netProfit = initialMetrics?.netProfit || 0
  const profitMargin = initialMetrics?.profitMargin || 0
  const pnlBreakdown = initialMetrics?.pnlBreakdown || []
  const pnlQuotationCount = initialMetrics?.pnlQuotationCount || 0

  const isLowBalance = balance < pendingOut

  const loanEntries = (initialEntries || []).filter((e: any) => e.category === "LOAN")

  const clearedEntriesOldestFirst = [...(initialEntries || [])]
    .filter((e: any) => e.status === "CLEARED")
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const runningBalanceMap = new Map<string, number>()
  let runningTotal = 0
  for (const entry of clearedEntriesOldestFirst) {
    runningTotal += entry.type === "IN" ? entry.amount : -entry.amount
    runningBalanceMap.set(entry.id, runningTotal)
  }

  const relativeDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return d.toLocaleDateString()
  }

  const categoryBadge = (entry: any) => {
    if (entry.untagged)
      return { label: "UNTAGGED", color: "bg-rose-50 text-rose-700 border-rose-200" }
    if (entry.quotationId)
      return { label: "SALE", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    if (entry.poId) return { label: "PO", color: "bg-blue-50 text-blue-700 border-blue-200" }
    if (entry.purchaseId)
      return { label: "PURCHASE", color: "bg-indigo-50 text-indigo-700 border-indigo-200" }
    if (entry.category === "LOAN")
      return { label: "LOAN", color: "bg-amber-50 text-amber-700 border-amber-200" }
    if (entry.category === "TRANSFER")
      return { label: "TRANSFER", color: "bg-violet-50 text-violet-700 border-violet-200" }
    if (entry.category === "ADVANCE")
      return { label: "ADVANCE", color: "bg-cyan-50 text-cyan-700 border-cyan-200" }
    return { label: "MANUAL", color: "bg-slate-100 text-slate-600 border-slate-200" }
  }

  const handleStatusChange = async (id: string, status: string) => {
    setIsUpdating(true)
    try {
      await updatePaymentStatus(id, status)
      sileo.success({ title: "Status Updated", description: `Transaction marked as ${status}.` })
      router.refresh()
    } catch (e) {
      sileo.error({ title: "Update Error", description: "Failed to update transaction status." })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this transaction? This will impact your balances immediately."
      )
    )
      return

    setIsUpdating(true)
    try {
      await deletePayment(id)
      sileo.success({
        title: "Transaction Deleted",
        description: "Ledger entry removed and balances updated.",
      })
      router.refresh()
    } catch (e) {
      sileo.error({ title: "Delete Error", description: "Failed to delete transaction." })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* P/L Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${
                netProfit >= 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {netProfit >= 0 ? "↑" : "↓"}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                Net Profit / Loss
              </p>
              <p
                className={`text-2xl font-bold font-mono tracking-tight ${
                  netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {netProfit >= 0 ? "" : "-"}
                {formatRupee(Math.abs(netProfit))}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {profitMargin.toFixed(1)}% margin · Based on {pnlQuotationCount} quotation
                {pnlQuotationCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:border-l md:border-slate-200 md:pl-6">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${
                cashAfterObligations >= 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              ₹
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                Cash After All Obligations
              </p>
              <p
                className={`text-2xl font-bold font-mono tracking-tight ${
                  cashAfterObligations >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {formatRupee(cashAfterObligations)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {cashAfterObligations >= 0
                  ? "Surplus — you can cover all dues"
                  : "Shortfall — need more funds to cover dues"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:border-l md:border-slate-200 md:pl-6">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${
                businessBalance >= 0
                  ? "bg-orange-50 text-orange-600 border border-orange-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              ±
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                True Business Balance
              </p>
              <p
                className={`text-2xl font-bold font-mono tracking-tight ${
                  businessBalance >= 0 ? "text-orange-600" : "text-rose-700"
                }`}
              >
                {formatRupee(businessBalance)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Net equity (All assets minus all liabilities)
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLowBalance && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rose-900 font-bold text-sm">Low Balance Alert</h3>
            <p className="text-rose-700 text-xs mt-0.5">
              Your current cleared balance ({formatRupee(balance)}) is lower than your pending outgoing cheques ({formatRupee(pendingOut)}). Please ensure sufficient funds are available before they clear.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Current Cleared Balance
          </p>
          <h3
            className={`text-2xl font-bold font-mono tracking-tight ${
              balance < 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {formatRupee(balance)}
          </h3>
        </div>

        <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-200 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            Pending In (Cheques / PDC)
          </p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-emerald-700">
            {formatRupee(pendingIn)}
          </h3>
        </div>

        <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-200 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-1">
            Pending Out (Cheques / PDC)
          </p>
          <h3 className="text-2xl font-bold font-mono tracking-tight text-rose-700">
            {formatRupee(pendingOut)}
          </h3>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === "OVERVIEW"
              ? "bg-orange-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span className={activeTab === "OVERVIEW" ? "text-white" : ""}>Overview & Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab("PNL")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === "PNL"
              ? "bg-orange-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span className={activeTab === "PNL" ? "text-white" : ""}>Profit & Loss</span>
        </button>
        <button
          onClick={() => setActiveTab("LOANS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === "LOANS"
              ? "bg-orange-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span className={activeTab === "LOANS" ? "text-white" : ""}>Loans & Transfers</span>
        </button>
        <button
          onClick={() => setActiveTab("UNTAGGED")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
            activeTab === "UNTAGGED"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span className={activeTab === "UNTAGGED" ? "text-white" : ""}>Unresolved Payments</span>
          {(initialEntries || []).filter((e: any) => e.untagged).length > 0 && (
            <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {(initialEntries || []).filter((e: any) => e.untagged).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "OVERVIEW" && (
        <>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Working Capital Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click on Receivables, Payables, or Fulfillments below to inspect the exact quotation or purchase order breakdown.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 pt-4 border-t border-slate-100">
              <div
                onClick={() =>
                  setBreakdownModal({ title: "Accounts Receivable", type: "RECEIVABLES" })
                }
                className="cursor-pointer hover:bg-slate-50 p-2.5 -m-2.5 rounded-xl transition-colors group"
              >
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 group-hover:text-slate-900 flex items-center gap-1">
                  Receivables <ChevronRight className="w-3 h-3" />
                </p>
                <p className="text-base font-bold font-mono text-emerald-700">
                  +{formatRupee(accountsReceivable)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Unpaid on Quotes</p>
              </div>
              <div
                onClick={() => setBreakdownModal({ title: "Accounts Payable", type: "PAYABLES" })}
                className="cursor-pointer hover:bg-slate-50 p-2.5 -m-2.5 rounded-xl transition-colors group"
              >
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 group-hover:text-slate-900 flex items-center gap-1">
                  Payables <ChevronRight className="w-3 h-3" />
                </p>
                <p className="text-base font-bold font-mono text-rose-700">
                  -{formatRupee(accountsPayable)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Unpaid on POs & Purchases</p>
              </div>
              <div
                onClick={() =>
                  setBreakdownModal({ title: "Pending Fulfillments", type: "FULFILLMENTS" })
                }
                className="cursor-pointer hover:bg-slate-50 p-2.5 -m-2.5 rounded-xl transition-colors group"
              >
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 group-hover:text-slate-900 flex items-center gap-1">
                  Fulfillments <ChevronRight className="w-3 h-3" />
                </p>
                <p className="text-base font-bold font-mono text-amber-700">
                  -{formatRupee(pendingFulfillmentCost)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Est. cost not covered by POs</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Net Loans
                </p>
                <p
                  className={`text-base font-bold font-mono ${
                    netLoanPosition > 0
                      ? "text-rose-700"
                      : netLoanPosition < 0
                      ? "text-emerald-700"
                      : "text-slate-600"
                  }`}
                >
                  {netLoanPosition > 0 ? "-" : netLoanPosition < 0 ? "+" : ""}
                  {formatRupee(Math.abs(netLoanPosition))}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {netLoanPosition > 0
                    ? "You owe (net borrowed)"
                    : netLoanPosition < 0
                    ? "Others owe you"
                    : "No loans"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Client Credits
                </p>
                <p
                  className={`text-base font-bold font-mono ${
                    totalClientCredit > 0 ? "text-amber-700" : "text-slate-600"
                  }`}
                >
                  {formatRupee(totalClientCredit)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Prepaid by clients</p>
              </div>
              <div className="pl-4 border-l border-slate-200">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Working Capital
                </p>
                <p
                  className={`text-lg font-bold font-mono ${
                    workingCapital < 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {formatRupee(workingCapital)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {workingCapital < 0 ? "Additional funds needed" : "Surplus funds expected"}
                </p>
              </div>
              <div className="pl-4 border-l border-slate-200">
                <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-1">
                  Cash After Dues
                </p>
                <p
                  className={`text-lg font-bold font-mono ${
                    cashAfterObligations < 0 ? "text-rose-700" : "text-orange-600"
                  }`}
                >
                  {formatRupee(cashAfterObligations)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Balance minus all payables</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Ledger Transactions</h2>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Types</option>
                    <option value="IN">Money In (+)</option>
                    <option value="OUT">Money Out (-)</option>
                  </select>

                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors text-xs whitespace-nowrap shadow-xs"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span className="text-white">Record Entry</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Category / Party</th>
                    <th className="px-5 py-3.5">Method & Ref</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                    <th className="px-5 py-3.5 text-right text-orange-600">Running Bal</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry: any) => {
                      const cat = categoryBadge(entry)
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="text-slate-900 font-semibold text-xs">
                              {relativeDate(entry.date)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(entry.date).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {entry.type === "IN" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-bold border border-emerald-200">
                                <ArrowDownRight className="w-3 h-3" /> IN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-xs font-bold border border-rose-200">
                                <ArrowUpRight className="w-3 h-3" /> OUT
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cat.color}`}
                              >
                                {cat.label}
                              </span>
                            </div>
                            {entry.quotationId ? (
                              <div className="text-slate-900 font-medium text-xs">
                                {entry.quotation?.client?.name}
                              </div>
                            ) : entry.poId ? (
                              <div className="text-slate-900 font-medium text-xs">
                                {entry.po?.supplier?.name}{" "}
                                <span className="text-slate-400">
                                  (PO: {entry.po?.poNumber})
                                </span>
                              </div>
                            ) : entry.purchaseId ? (
                              <div className="text-slate-900 font-medium text-xs">
                                {entry.purchase?.supplier?.name}
                              </div>
                            ) : entry.category === "LOAN" || entry.category === "TRANSFER" ? (
                              <div className="text-slate-900 font-medium text-xs">
                                {entry.entityName}
                              </div>
                            ) : entry.clientId ? (
                              <div className="text-slate-900 font-medium text-xs">
                                {entry.client?.name}
                              </div>
                            ) : entry.supplierId ? (
                              <div className="text-slate-900 font-medium text-xs">
                                {entry.supplier?.name}
                              </div>
                            ) : (
                              <div className="text-slate-900 font-medium text-xs">
                                {entry.entityName || "Manual Entry"}
                              </div>
                            )}
                            {entry.notes && (
                              <div className="text-[11px] text-slate-500 mt-0.5">{entry.notes}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="text-slate-800 text-xs font-medium">{entry.method}</div>
                            {entry.reference && (
                              <div className="text-[11px] text-slate-400 font-mono">
                                {entry.reference}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                            {formatRupee(entry.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-semibold text-orange-600">
                            {entry.status === "CLEARED" ? (
                              formatRupee(runningBalanceMap.get(entry.id) || 0)
                            ) : (
                              <span className="text-slate-400 text-xs italic">Pending</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {entry.status === "CLEARED" ? (
                              <span className="text-emerald-700 flex items-center justify-center gap-1 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                              </span>
                            ) : entry.status === "PENDING" ? (
                              <span className="text-amber-700 flex items-center justify-center gap-1 text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </span>
                            ) : (
                              <span className="text-rose-700 flex items-center justify-center gap-1 text-xs font-semibold">
                                <X className="w-3.5 h-3.5" /> {entry.status}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {entry.status === "PENDING" && (
                                <button
                                  disabled={isUpdating}
                                  onClick={() => handleStatusChange(entry.id, "CLEARED")}
                                  className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50"
                                >
                                  Clear
                                </button>
                              )}
                              <button
                                disabled={isUpdating}
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete Transaction"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "PNL" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Total Revenue
              </p>
              <h3 className="text-2xl font-bold font-mono text-slate-900">
                {formatRupee(totalRevenue)}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Cost of Goods Sold (COGS)
              </p>
              <h3 className="text-2xl font-bold font-mono text-amber-700">
                -{formatRupee(totalCogs)}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Additional Expenses
              </p>
              <h3 className="text-2xl font-bold font-mono text-amber-700">
                -{formatRupee(totalAdditionalExpenses)}
              </h3>
            </div>
            <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-200 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                Net Profit ({profitMargin.toFixed(1)}%)
              </p>
              <h3
                className={`text-2xl font-bold font-mono ${
                  netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {netProfit >= 0 ? "" : "-"}
                {formatRupee(Math.abs(netProfit))}
              </h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                Accepted & Completed Quotations P&L
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculates Revenue, COGS, and additional expenses for active orders.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Quotation</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Revenue</th>
                    <th className="px-5 py-3.5 text-right">COGS</th>
                    <th className="px-5 py-3.5 text-right">Expenses</th>
                    <th className="px-5 py-3.5 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pnlBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No quotations to analyze.
                      </td>
                    </tr>
                  ) : (
                    pnlBreakdown.map((q: any) => (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-mono font-bold text-slate-900 text-xs">{q.id}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{q.clientName}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              q.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-900">
                          {formatRupee(q.revenue)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-amber-700">
                          -{formatRupee(q.cogs)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-amber-700">
                          -{formatRupee(q.expenses)}
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right font-mono font-bold ${
                            q.profit >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {q.profit >= 0 ? "" : "-"}
                          {formatRupee(Math.abs(q.profit))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "LOANS" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Total Lent (Money Out)
              </p>
              <h3 className="text-2xl font-bold font-mono text-emerald-700">
                {formatRupee(totalLent)}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Total Borrowed (Money In)
              </p>
              <h3 className="text-2xl font-bold font-mono text-rose-700">
                {formatRupee(totalBorrowed)}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Net Position
              </p>
              <h3
                className={`text-2xl font-bold font-mono ${
                  netLoanPosition > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {netLoanPosition > 0 ? "You owe: " : "You are owed: "}
                {formatRupee(Math.abs(netLoanPosition))}
              </h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Loan & Transfer Ledger</h2>
                <p className="text-xs text-slate-500 mt-0.5">All transactions marked as LOAN.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl text-xs"
              >
                <Plus className="w-4 h-4 text-white" />
                <span className="text-white">Record Loan</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Entity / Note</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loanEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        No loan transactions found.
                      </td>
                    </tr>
                  ) : (
                    loanEntries.map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {new Date(e.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-slate-900 font-semibold text-xs">
                            {e.entityName || "Unknown"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{e.notes}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          {e.type === "IN" ? (
                            <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Money IN (Borrowed)
                            </span>
                          ) : (
                            <span className="text-amber-700 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Money OUT (Lent)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                          {formatRupee(e.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "UNTAGGED" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Unresolved Payments</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Payments recorded without a tagged quotation or order.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Entity / Note</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(initialEntries || []).filter((e: any) => e.untagged).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No unresolved payments found.
                    </td>
                  </tr>
                ) : (
                  (initialEntries || [])
                    .filter((e: any) => e.untagged)
                    .map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {new Date(e.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-slate-900 font-semibold text-xs">
                            {e.client?.name || e.supplier?.name || "Unknown"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {e.notes || e.reference}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {e.type === "IN" ? (
                            <span className="text-emerald-700 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Money IN (Receivable)
                            </span>
                          ) : (
                            <span className="text-rose-700 text-xs font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              Money OUT (Payable)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                          {formatRupee(e.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() =>
                              setResolveModal({
                                paymentId: e.id,
                                amount: e.amount,
                                type: e.type,
                              })
                            }
                            className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                          >
                            <span className="text-white">Resolve</span>
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-base font-bold text-slate-900">Resolve Untagged Payment</h2>
              <button
                onClick={() => setResolveModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-600 mb-4">
                Resolving payment of{" "}
                <span className="text-slate-900 font-bold font-mono">
                  {formatRupee(resolveModal.amount)}
                </span>
                .
              </p>

              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {resolveModal.type === "IN"
                  ? "Select Quotation to apply this payment"
                  : "Select PO / Purchase to apply this payment"}
              </label>
              <select
                value={resolvingQId}
                onChange={(e) => setResolvingQId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none"
              >
                <option value="">-- Select --</option>
                {resolveModal.type === "IN" &&
                  quotations
                    ?.filter((q: any) => q.status === "ACCEPTED" || q.status === "COMPLETED")
                    .map((q: any) => {
                      const due =
                        (q.totalAmount || 0) + (q.totalGst || 0) - (q.amountPaid || 0)
                      return (
                        <option key={q.id} value={q.id} disabled={due <= 0}>
                          {q.id} - {q.client?.name} (Due: {formatRupee(due)})
                        </option>
                      )
                    })}
              </select>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResolveModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isUpdating || !resolvingQId}
                className="px-5 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                <span className="text-white">Resolve Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {breakdownModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{breakdownModal.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {breakdownModal.type === "RECEIVABLES" &&
                    "Unpaid amounts on Accepted or Completed Quotations."}
                  {breakdownModal.type === "PAYABLES" &&
                    "Unpaid amounts on Purchase Orders and Direct Purchases."}
                  {breakdownModal.type === "FULFILLMENTS" &&
                    "Estimated material costs minus tagged Purchases and POs."}
                </p>
              </div>
              <button
                onClick={() => setBreakdownModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1">
              {breakdownModal.type === "RECEIVABLES" && (
                <div className="space-y-2.5">
                  {initialMetrics?.receivablesBreakdown?.map((b: any) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-slate-900 font-mono font-bold text-xs">{b.id}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                              b.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{b.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-700 font-mono font-bold text-sm">
                          {formatRupee(b.due)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatRupee(b.paid)} paid of {formatRupee(b.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!initialMetrics?.receivablesBreakdown ||
                    initialMetrics.receivablesBreakdown.length === 0) && (
                    <p className="text-center text-slate-500 py-8 text-sm">
                      No receivables found.
                    </p>
                  )}
                </div>
              )}

              {breakdownModal.type === "PAYABLES" && (
                <div className="space-y-2.5">
                  {initialMetrics?.payablesBreakdown?.map((b: any) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-slate-900 font-mono font-bold text-xs">{b.id}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600 font-bold">
                            {b.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{b.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-rose-700 font-mono font-bold text-sm">
                          {formatRupee(b.due)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatRupee(b.paid)} paid of {formatRupee(b.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!initialMetrics?.payablesBreakdown ||
                    initialMetrics.payablesBreakdown.length === 0) && (
                    <p className="text-center text-slate-500 py-8 text-sm">No payables found.</p>
                  )}
                </div>
              )}

              {breakdownModal.type === "FULFILLMENTS" && (
                <div className="space-y-2.5">
                  {initialMetrics?.fulfillmentsBreakdown?.map((b: any) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div>
                        <div className="text-slate-900 font-mono font-bold text-xs mb-0.5">
                          {b.id}
                        </div>
                        <p className="text-xs text-slate-600">{b.name}</p>
                        <p className="text-[11px] text-slate-400">
                          Est. Cost: {formatRupee(b.estCost)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-700 font-mono font-bold text-sm">
                          {formatRupee(b.uncovered)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatRupee(b.alreadyPurchasedCost)} covered by POs/Purchases
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!initialMetrics?.fulfillmentsBreakdown ||
                    initialMetrics.fulfillmentsBreakdown.length === 0) && (
                    <p className="text-center text-slate-500 py-8 text-sm">
                      No pending fulfillments found.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setBreakdownModal(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-colors text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
