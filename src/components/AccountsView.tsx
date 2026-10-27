"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { formatRupee, formatShortId } from "@/lib/utils"
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
  ShoppingBag,
  FileText,
  Package,
  CreditCard,
  Link2,
  Check,
  Loader2,
  Building2,
} from "lucide-react"
import {
  updatePaymentStatus,
  deletePayment,
  assignAndResolveQuotationItem,
} from "@/app/actions/payment"
import { useRouter } from "next/navigation"
import { TransactionModal } from "./TransactionModal"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { sileo } from "sileo"

export function AccountsView({
  initialMetrics,
  initialEntries,
  quotations,
  pos,
  purchases,
  clients,
  suppliers = [],
  acceptedQuotations = [],
}: any) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalDefaults, setModalDefaults] = useState<{
    category?: string
    type?: "IN" | "OUT"
    entityId?: string
    amount?: string
    notes?: string
  } | null>(null)
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

  // Payables & Unprocured Tracker state
  const [payablesFilter, setPayablesFilter] = useState<"ALL" | "PO" | "PURCHASE">("ALL")
  const [payablesSearch, setPayablesSearch] = useState("")
  const [unprocuredSearch, setUnprocuredSearch] = useState("")

  // Assign & Resolve Unprocured Quotation Item Modal state
  const [assignModal, setAssignModal] = useState<any | null>(null)
  const [assignSupplierId, setAssignSupplierId] = useState("")
  const [assignUnitCp, setAssignUnitCp] = useState("")
  const [assignQty, setAssignQty] = useState(1)
  const [assignGstPercent, setAssignGstPercent] = useState(18)
  const [assignMode, setAssignMode] = useState<"DIRECT_PURCHASE" | "PO" | "TAG_ONLY">(
    "DIRECT_PURCHASE"
  )
  const [assignPaymentMode, setAssignPaymentMode] = useState<"PAY_NOW" | "LINK_UNTAGGED" | "LATER">(
    "PAY_NOW"
  )
  const [assignPayAmount, setAssignPayAmount] = useState("")
  const [assignPayMethod, setAssignPayMethod] = useState("BANK_TRANSFER")
  const [assignPayStatus, setAssignPayStatus] = useState<"CLEARED" | "PENDING">("CLEARED")
  const [assignPayRef, setAssignPayRef] = useState("")
  const [assignPayNotes, setAssignPayNotes] = useState("")
  const [assignUntaggedPaymentId, setAssignUntaggedPaymentId] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [activeTab, setActiveTab] = useState("OVERVIEW")

  const untaggedOutPayments = useMemo(
    () => (initialEntries || []).filter((e: any) => e.untagged && e.type === "OUT"),
    [initialEntries]
  )

  const unpaidPayablesList = useMemo(() => {
    const poRows = (pos || [])
      .map((p: any) => {
        const total = (p.totalAmount || 0) + (p.totalGst || 0)
        const paid = p.amountPaid || 0
        const due = total - paid
        return {
          id: p.id,
          docType: "PO" as const,
          docNumber: p.poNumber || `PO-${formatShortId(p.id)}`,
          date: p.createdAt,
          dueDate: p.paymentDueDate,
          status: p.status,
          supplierId: p.supplier?.id,
          supplierName: p.supplier?.name || "Unknown Supplier",
          quotationId: p.quotation?.id,
          quotationPrNo: p.quotation?.prNo,
          clientName: p.quotation?.client?.name,
          items: p.items || [],
          total,
          paid,
          due,
        }
      })
      .filter((r: any) => r.due > 0)

    const purchaseRows = (purchases || [])
      .map((p: any) => {
        const total = (p.totalAmount || 0) + (p.totalGst || 0)
        const paid = p.amountPaid || 0
        const due = total - paid
        return {
          id: p.id,
          docType: "PURCHASE" as const,
          docNumber: `BILL-${formatShortId(p.id)}`,
          date: p.date,
          dueDate: null,
          status: "RECORDED",
          supplierId: p.supplier?.id,
          supplierName: p.supplier?.name || "Unknown Supplier",
          quotationId: p.quotation?.id,
          quotationPrNo: p.quotation?.prNo,
          clientName: p.quotation?.client?.name,
          items: p.items || [],
          total,
          paid,
          due,
        }
      })
      .filter((r: any) => r.due > 0)

    return [...poRows, ...purchaseRows].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    )
  }, [pos, purchases])

  const filteredPayablesList = useMemo(() => {
    return unpaidPayablesList.filter((row) => {
      if (payablesFilter !== "ALL" && row.docType !== payablesFilter) return false
      if (payablesSearch.trim()) {
        const q = payablesSearch.toLowerCase()
        const matchDoc = row.docNumber.toLowerCase().includes(q) || row.id.toLowerCase().includes(q)
        const matchSup = row.supplierName.toLowerCase().includes(q)
        const matchQuote =
          (row.quotationId || "").toLowerCase().includes(q) ||
          (row.quotationPrNo || "").toLowerCase().includes(q) ||
          (row.clientName || "").toLowerCase().includes(q)
        const matchItem = row.items.some(
          (it: any) =>
            (it.product?.materialCode || "").toLowerCase().includes(q) ||
            (it.customDescription || it.product?.materialDescription || "")
              .toLowerCase()
              .includes(q)
        )
        if (!matchDoc && !matchSup && !matchQuote && !matchItem) return false
      }
      return true
    })
  }, [unpaidPayablesList, payablesFilter, payablesSearch])

  const unprocuredQuotationItems = useMemo(() => {
    const result: any[] = []
    for (const q of acceptedQuotations || []) {
      const remainingProcuredByProduct = new Map<string, number>()

      for (const po of q.purchaseOrders || []) {
        if (po.status === "CANCELLED") continue
        for (const poItem of po.items || []) {
          remainingProcuredByProduct.set(
            poItem.productId,
            (remainingProcuredByProduct.get(poItem.productId) || 0) + (poItem.quantity || 0)
          )
        }
      }

      for (const pur of q.purchases || []) {
        for (const purItem of pur.items || []) {
          remainingProcuredByProduct.set(
            purItem.productId,
            (remainingProcuredByProduct.get(purItem.productId) || 0) + (purItem.quantity || 0)
          )
        }
      }

      for (const item of q.items || []) {
        if (item.isConfirmed === false) continue
        const avail = remainingProcuredByProduct.get(item.productId) || 0
        const coveredQty = Math.min(item.quantity, avail)
        remainingProcuredByProduct.set(item.productId, avail - coveredQty)
        const unprocuredQty = item.quantity - coveredQty

        if (unprocuredQty > 0) {
          const lowestCatalogVendor = item.product?.productSuppliers?.[0]
          const unitCpPaise =
            item.cpSnapshot && item.cpSnapshot > 0
              ? item.cpSnapshot
              : lowestCatalogVendor?.costPrice && lowestCatalogVendor.costPrice > 0
              ? lowestCatalogVendor.costPrice
              : item.product?.costPrice || 0

          const taggedSupplier = item.supplier || null
          const suggestedSupplier =
            taggedSupplier || lowestCatalogVendor?.supplier || item.product?.supplier || null

          const gstPercent = item.gstPercent ?? item.product?.gstPercent ?? 18
          const estExclGst = unprocuredQty * unitCpPaise
          const estGst = Math.round(estExclGst * (gstPercent / 100))
          const estInclGst = estExclGst + estGst
          const sellingUnitPaise = item.unitPrice || 0
          const sellingExclGst = unprocuredQty * sellingUnitPaise

          result.push({
            quotationId: q.id,
            quotationPrNo: q.prNo,
            quotationStatus: q.status,
            clientName: q.client?.name || "Unknown Client",
            quotationItemId: item.id,
            productId: item.productId,
            materialCode: item.product?.materialCode || "ITEM",
            description:
              item.customDescription || item.product?.materialDescription || "Unnamed Item",
            unit: item.product?.unit || "Nos",
            totalQuotedQty: item.quantity,
            coveredQty,
            unprocuredQty,
            unitCpPaise,
            gstPercent,
            estExclGst,
            estGst,
            estInclGst,
            sellingUnitPaise,
            sellingExclGst,
            taggedSupplier,
            suggestedSupplier,
            productSuppliers: item.product?.productSuppliers || [],
          })
        }
      }
    }
    return result
  }, [acceptedQuotations])

  const filteredUnprocuredItems = useMemo(() => {
    if (!unprocuredSearch.trim()) return unprocuredQuotationItems
    const q = unprocuredSearch.toLowerCase()
    return unprocuredQuotationItems.filter(
      (it) =>
        it.quotationId.toLowerCase().includes(q) ||
        (it.quotationPrNo || "").toLowerCase().includes(q) ||
        it.clientName.toLowerCase().includes(q) ||
        it.materialCode.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        (it.suggestedSupplier?.name || "").toLowerCase().includes(q)
    )
  }, [unprocuredQuotationItems, unprocuredSearch])

  const openAssignModal = (item: any) => {
    const initialCpRupees = item.unitCpPaise > 0 ? (item.unitCpPaise / 100).toFixed(2) : ""
    const initialTotalRupees =
      item.estInclGst > 0 ? (item.estInclGst / 100).toFixed(2) : ""
    setAssignModal(item)
    setAssignSupplierId(item.suggestedSupplier?.id || "")
    setAssignUnitCp(initialCpRupees)
    setAssignQty(item.unprocuredQty)
    setAssignGstPercent(item.gstPercent ?? 18)
    setAssignMode("DIRECT_PURCHASE")
    setAssignPaymentMode("PAY_NOW")
    setAssignPayAmount(initialTotalRupees)
    setAssignPayMethod("BANK_TRANSFER")
    setAssignPayStatus("CLEARED")
    setAssignPayRef("")
    setAssignPayNotes(
      `Direct settlement for ${item.materialCode} (${item.unprocuredQty} ${item.unit}) on Quote #${formatShortId(item.quotationId)}`
    )
    setAssignUntaggedPaymentId("")
  }

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignModal) return
    if (!assignSupplierId) {
      sileo.warning({
        title: "Supplier Required",
        description: "Please select a vendor/supplier to assign this item to.",
      })
      return
    }
    const unitCpNum = Number(assignUnitCp)
    if (isNaN(unitCpNum) || unitCpNum <= 0) {
      sileo.warning({
        title: "Valid Cost Price Required",
        description: "Please enter a unit cost price greater than ₹0.",
      })
      return
    }

    setIsUpdating(true)
    try {
      const shouldRecordNow =
        assignMode !== "TAG_ONLY" &&
        assignPaymentMode === "PAY_NOW" &&
        Number(assignPayAmount) > 0

      const res = await assignAndResolveQuotationItem({
        quotationId: assignModal.quotationId,
        quotationItemId: assignModal.quotationItemId,
        productId: assignModal.productId,
        supplierId: assignSupplierId,
        quantity: Number(assignQty) || assignModal.unprocuredQty,
        unitCpPaise: Math.round(unitCpNum * 100),
        gstRate: Number(assignGstPercent) || 0,
        itemDescription: assignModal.description,
        mode: assignMode,
        existingUntaggedPaymentId:
          assignMode !== "TAG_ONLY" && assignPaymentMode === "LINK_UNTAGGED"
            ? assignUntaggedPaymentId || undefined
            : undefined,
        recordPaymentNow: shouldRecordNow,
        paymentAmountRupees: shouldRecordNow ? Number(assignPayAmount) : undefined,
        paymentMethod: shouldRecordNow ? assignPayMethod : undefined,
        paymentReference: shouldRecordNow ? assignPayRef : undefined,
        paymentStatus: shouldRecordNow ? assignPayStatus : undefined,
        paymentDate: shouldRecordNow ? new Date().toISOString().split("T")[0] : undefined,
      })

      if (res.success) {
        sileo.success({
          title:
            assignMode === "DIRECT_PURCHASE"
              ? "Direct Purchase & Payment Recorded"
              : assignMode === "PO"
              ? "Purchase Order Issued & Linked"
              : "Vendor Tagged to Quotation Item",
          description: `${assignModal.materialCode} (${assignQty} ${assignModal.unit}) has been resolved.`,
        })
        setAssignModal(null)
        router.refresh()
      } else {
        sileo.error({
          title: "Failed to Resolve Item",
          description: (res as any).error || "Could not assign and resolve this item.",
        })
      }
    } catch (err) {
      sileo.error({
        title: "Unexpected Error",
        description: "An error occurred while resolving the item.",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleResolve = async () => {
    if (!resolveModal || !resolvingQId) return
    setIsUpdating(true)
    try {
      const { resolveUntaggedPayment } = await import("@/app/actions/payment")
      const res = await resolveUntaggedPayment(resolveModal.paymentId, resolvingQId)
      if (res.success) {
        sileo.success({
          title: "Payment Resolved",
          description: "Untagged payment has been linked to the selected document.",
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
          onClick={() => setActiveTab("PAYABLES_TRACKER")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
            activeTab === "PAYABLES_TRACKER"
              ? "bg-orange-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <span className={activeTab === "PAYABLES_TRACKER" ? "text-white" : ""}>
            Vendor Payables & Unprocured Items
          </span>
          {unpaidPayablesList.length + unprocuredQuotationItems.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "PAYABLES_TRACKER"
                  ? "bg-white text-orange-700"
                  : "bg-orange-100 text-orange-800"
              }`}
            >
              {unpaidPayablesList.length + unprocuredQuotationItems.length}
            </span>
          )}
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

      {activeTab === "PAYABLES_TRACKER" && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Unpaid Purchase Orders
                </p>
                <span className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  {unpaidPayablesList.filter((r) => r.docType === "PO").length} POs
                </span>
              </div>
              <h3 className="text-2xl font-bold font-mono text-rose-700">
                {formatRupee(
                  unpaidPayablesList
                    .filter((r) => r.docType === "PO")
                    .reduce((acc, r) => acc + r.due, 0)
                )}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Formal POs issued to vendors awaiting payment
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Unpaid Direct Purchases
                </p>
                <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {unpaidPayablesList.filter((r) => r.docType === "PURCHASE").length} Bills
                </span>
              </div>
              <h3 className="text-2xl font-bold font-mono text-rose-700">
                {formatRupee(
                  unpaidPayablesList
                    .filter((r) => r.docType === "PURCHASE")
                    .reduce((acc, r) => acc + r.due, 0)
                )}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Direct purchase bills recorded without full payment
              </p>
            </div>

            <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Unprocured Quote Items
                </p>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  {unprocuredQuotationItems.length} Items
                </span>
              </div>
              <h3 className="text-2xl font-bold font-mono text-amber-800">
                {formatRupee(
                  unprocuredQuotationItems.reduce((acc, it) => acc + it.estInclGst, 0)
                )}
              </h3>
              <p className="text-[11px] text-amber-700 mt-1">
                Excl. GST:{" "}
                <span className="font-mono font-bold">
                  {formatRupee(
                    unprocuredQuotationItems.reduce((acc, it) => acc + it.estExclGst, 0)
                  )}
                </span>{" "}
                · Accepted items not yet in a PO/Purchase
              </p>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Total Pending Vendor Outflow
              </p>
              <h3 className="text-2xl font-bold font-mono text-orange-400">
                {formatRupee(
                  unpaidPayablesList.reduce((acc, r) => acc + r.due, 0) +
                    unprocuredQuotationItems.reduce((acc, it) => acc + it.estInclGst, 0)
                )}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Unpaid POs + Direct Bills + Est. Unprocured Items
              </p>
            </div>
          </div>

          {/* SECTION 1: UNPAID POs & DIRECT PURCHASES */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    1. Unpaid Purchase Orders & Direct Purchases
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  All issued POs and recorded direct purchases with pending balances. Click{" "}
                  <strong>Pay Now</strong> to directly record a payment or{" "}
                  <strong>Link Untagged</strong> to assign an existing untagged outgoing payment.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPayablesFilter("ALL")}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      payablesFilter === "ALL"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All ({unpaidPayablesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayablesFilter("PO")}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      payablesFilter === "PO"
                        ? "bg-white text-blue-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    POs ({unpaidPayablesList.filter((r) => r.docType === "PO").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayablesFilter("PURCHASE")}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      payablesFilter === "PURCHASE"
                        ? "bg-white text-indigo-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Direct Bills (
                    {unpaidPayablesList.filter((r) => r.docType === "PURCHASE").length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search PO, supplier, quote, item..."
                    value={payablesSearch}
                    onChange={(e) => setPayablesSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Document & Date</th>
                    <th className="px-5 py-3.5">Vendor / Supplier</th>
                    <th className="px-5 py-3.5">Linked Quotation</th>
                    <th className="px-5 py-3.5">Individual Items & Amounts</th>
                    <th className="px-5 py-3.5 text-right">Total Bill</th>
                    <th className="px-5 py-3.5 text-right">Paid</th>
                    <th className="px-5 py-3.5 text-right text-rose-700">Balance Due</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPayablesList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-500 text-xs">
                        No unpaid Purchase Orders or Direct Purchases match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPayablesList.map((row) => (
                      <tr
                        key={`${row.docType}-${row.id}`}
                        className="hover:bg-slate-50/80 transition-colors align-top"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                row.docType === "PO"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
                              }`}
                            >
                              {row.docType === "PO" ? "PO" : "DIRECT BILL"}
                            </span>
                            {row.docType === "PO" ? (
                              <Link
                                href={`/purchase-orders/${row.id}`}
                                className="font-mono font-bold text-xs text-slate-900 hover:text-orange-600 underline"
                              >
                                {row.docNumber}
                              </Link>
                            ) : (
                              <Link
                                href="/purchases"
                                className="font-mono font-bold text-xs text-slate-900 hover:text-orange-600 underline"
                              >
                                {row.docNumber}
                              </Link>
                            )}
                          </div>
                          {row.date && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              {new Date(row.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          )}
                          {row.dueDate && (
                            <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                              Due: {new Date(row.dueDate).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-xs text-slate-900">
                            {row.supplierName}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase mt-0.5">
                            {row.status}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {row.quotationId ? (
                            <div>
                              <Link
                                href={`/quotations/${row.quotationId}`}
                                className="inline-flex items-center gap-1 text-xs font-mono font-bold text-orange-600 hover:text-orange-700 underline"
                              >
                                #{formatShortId(row.quotationId)}
                              </Link>
                              {row.quotationPrNo && (
                                <span className="ml-1 text-[10px] text-slate-500 font-mono">
                                  ({row.quotationPrNo})
                                </span>
                              )}
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                {row.clientName}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Standalone / Stock</span>
                          )}
                        </td>

                        <td className="px-5 py-4 max-w-xs">
                          <div className="space-y-1.5">
                            {row.items.map((it: any) => {
                              const unitRate = it.unitPrice ?? it.costPrice ?? 0
                              const lineTotal = (it.quantity || 0) * unitRate
                              return (
                                <div
                                  key={it.id}
                                  className="text-xs bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <span className="font-mono font-bold text-slate-800 text-[11px]">
                                      {it.product?.materialCode || "ITEM"}
                                    </span>
                                    <span className="text-slate-500 text-[11px] ml-1.5 truncate block">
                                      {it.customDescription || it.product?.materialDescription}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-mono font-bold text-slate-900 text-[11px]">
                                      {formatRupee(lineTotal)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {it.quantity} × {formatRupee(unitRate)}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-xs font-semibold text-slate-900">
                          {formatRupee(row.total)}
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-xs text-emerald-700 font-semibold">
                          {formatRupee(row.paid)}
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-sm font-bold text-rose-700">
                          {formatRupee(row.due)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setModalDefaults({
                                  category: row.docType === "PO" ? "po" : "purchase",
                                  type: "OUT",
                                  entityId: row.id,
                                  amount: (row.due / 100).toFixed(2),
                                  notes: `Payment against ${row.docNumber} (${row.supplierName})`,
                                })
                                setIsModalOpen(true)
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs whitespace-nowrap"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-white" />
                              <span className="text-white">Pay Now</span>
                            </button>

                            {untaggedOutPayments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const firstUntagged = untaggedOutPayments[0]
                                  setResolvingQId(
                                    `${row.docType === "PO" ? "po" : "purchase"}:${row.id}`
                                  )
                                  setResolveModal({
                                    paymentId: firstUntagged.id,
                                    amount: firstUntagged.amount,
                                    type: "OUT",
                                  })
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Link2 className="w-3 h-3" />
                                Link Untagged ({untaggedOutPayments.length})
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: ACCEPTED QUOTATION ITEMS NOT YET TAGGED TO A PO OR DIRECT PURCHASE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    2. Accepted Quotation Items Not Yet Tagged to a PO or Direct Purchase
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Individual confirmed items from Accepted/Completed Quotations that have not yet
                  been ordered via a PO or recorded in Direct Purchases. Check their individual cost
                  amounts and directly assign a vendor, create a Direct Purchase / PO, or settle payment.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search quote, client, item, vendor..."
                  value={unprocuredSearch}
                  onChange={(e) => setUnprocuredSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Quotation & Client</th>
                    <th className="px-5 py-3.5">Individual Item</th>
                    <th className="px-5 py-3.5 text-center">Unprocured Qty</th>
                    <th className="px-5 py-3.5">Vendor Status</th>
                    <th className="px-5 py-3.5 text-right">Unit CP (vs SP)</th>
                    <th className="px-5 py-3.5 text-right">Est. Cost (Excl. GST)</th>
                    <th className="px-5 py-3.5 text-right text-amber-800">
                      Est. Payable (Incl. GST)
                    </th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUnprocuredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-500 text-xs">
                        All items in Accepted Quotations are already covered by Purchase Orders or
                        Direct Purchases!
                      </td>
                    </tr>
                  ) : (
                    filteredUnprocuredItems.map((it) => (
                      <tr
                        key={it.quotationItemId}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/quotations/${it.quotationId}`}
                              className="font-mono font-bold text-xs text-orange-600 hover:text-orange-700 underline"
                            >
                              #{formatShortId(it.quotationId)}
                            </Link>
                            {it.quotationPrNo && (
                              <span className="text-[10px] font-mono text-slate-500">
                                ({it.quotationPrNo})
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-900 mt-0.5">
                            {it.clientName}
                          </div>
                        </td>

                        <td className="px-5 py-4 max-w-xs">
                          <div className="font-mono font-bold text-xs text-slate-900">
                            {it.materialCode}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                            {it.description}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {it.unprocuredQty} {it.unit}
                          </span>
                          {it.coveredQty > 0 && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              ({it.coveredQty} of {it.totalQuotedQty} procured)
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {it.taggedSupplier ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Tagged on Quote
                              </span>
                              <div className="text-xs font-semibold text-slate-900 mt-1">
                                {it.taggedSupplier.name}
                              </div>
                            </div>
                          ) : it.suggestedSupplier ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                Lowest Catalog Vendor
                              </span>
                              <div className="text-xs font-medium text-slate-800 mt-1">
                                {it.suggestedSupplier.name}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              No Vendor Tagged
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="font-mono font-bold text-xs text-slate-900">
                            {it.unitCpPaise > 0 ? formatRupee(it.unitCpPaise) : "Not Set"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            SP: {formatRupee(it.sellingUnitPaise)}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right font-mono text-xs font-semibold text-slate-800">
                          {formatRupee(it.estExclGst)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="font-mono font-bold text-sm text-amber-800">
                            {formatRupee(it.estInclGst)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            +{it.gstPercent}% GST ({formatRupee(it.estGst)})
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openAssignModal(it)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            <span className="text-white">Assign & Resolve</span>
                          </button>
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

      {isModalOpen && (
        <TransactionModal
          onClose={() => {
            setIsModalOpen(false)
            setModalDefaults(null)
          }}
          quotations={quotations}
          pos={pos}
          purchases={purchases}
          clients={clients}
          initialDefaults={modalDefaults}
        />
      )}

      {assignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Assign Vendor & Resolve Unprocured Item
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quotation #{formatShortId(assignModal.quotationId)} · {assignModal.clientName}
                </p>
              </div>
              <button
                onClick={() => setAssignModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="assign-resolve-form"
              onSubmit={handleAssignSubmit}
              className="p-6 overflow-y-auto space-y-5"
            >
              {/* Item Summary Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono font-bold text-xs text-orange-600">
                    {assignModal.materialCode}
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5">
                    {assignModal.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
                    Qty: {assignQty} {assignModal.unit}
                  </span>
                </div>
              </div>

              {/* Known Catalog Vendor Quick Picks */}
              {assignModal.productSuppliers && assignModal.productSuppliers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Known Vendor Rates for this Product (Click to Auto-Fill)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {assignModal.productSuppliers.map((ps: any) => {
                      const isSelected = assignSupplierId === ps.supplierId
                      return (
                        <button
                          key={ps.supplierId}
                          type="button"
                          onClick={() => {
                            setAssignSupplierId(ps.supplierId)
                            if (ps.costPrice > 0) {
                              const cpR = (ps.costPrice / 100).toFixed(2)
                              setAssignUnitCp(cpR)
                              const newTotalIncl =
                                (ps.costPrice / 100) *
                                assignQty *
                                (1 + (Number(assignGstPercent) || 0) / 100)
                              setAssignPayAmount(newTotalIncl.toFixed(2))
                            }
                          }}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-orange-50 border-orange-500 text-orange-800"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{ps.supplier?.name}</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {formatRupee(ps.costPrice)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Supplier + Unit Cost + GST */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Vendor / Supplier *
                  </label>
                  <select
                    required
                    value={assignSupplierId}
                    onChange={(e) => setAssignSupplierId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Select Vendor --</option>
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Unit Cost (₹ Excl. GST) *
                  </label>
                  <SmartNumberInput
                    required
                    value={assignUnitCp}
                    onValueChange={(num, str) => {
                      setAssignUnitCp(str)
                      if (!isNaN(num) && num > 0) {
                        const totalIncl =
                          num * assignQty * (1 + (Number(assignGstPercent) || 0) / 100)
                        setAssignPayAmount(totalIncl.toFixed(2))
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quantity ({assignModal.unit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={assignModal.unprocuredQty}
                    value={assignQty}
                    onChange={(e) => {
                      const q = Math.max(1, Number(e.target.value) || 1)
                      setAssignQty(q)
                      const cpNum = Number(assignUnitCp) || 0
                      if (cpNum > 0) {
                        const totalIncl =
                          cpNum * q * (1 + (Number(assignGstPercent) || 0) / 100)
                        setAssignPayAmount(totalIncl.toFixed(2))
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GST %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={assignGstPercent}
                    onChange={(e) => {
                      const gst = Number(e.target.value) || 0
                      setAssignGstPercent(gst)
                      const cpNum = Number(assignUnitCp) || 0
                      if (cpNum > 0) {
                        const totalIncl = cpNum * assignQty * (1 + gst / 100)
                        setAssignPayAmount(totalIncl.toFixed(2))
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Live Cost Calculation Preview */}
              {Number(assignUnitCp) > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal (Excl. GST):</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatRupee(Math.round(Number(assignUnitCp) * 100 * assignQty))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({assignGstPercent}%):</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatRupee(
                        Math.round(
                          Number(assignUnitCp) * 100 * assignQty * (assignGstPercent / 100)
                        )
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-950 font-bold pt-1 border-t border-amber-200">
                    <span>Total Payable Amount (Incl. GST):</span>
                    <span className="font-mono text-sm">
                      {formatRupee(
                        Math.round(
                          Number(assignUnitCp) *
                            100 *
                            assignQty *
                            (1 + assignGstPercent / 100)
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Resolution Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  How would you like to resolve this item?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAssignMode("DIRECT_PURCHASE")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      assignMode === "DIRECT_PURCHASE"
                        ? "bg-orange-50 border-orange-500 ring-2 ring-orange-500/20"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Direct Purchase Bill</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Record in Purchases & link to Quotation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignMode("PO")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      assignMode === "PO"
                        ? "bg-orange-50 border-orange-500 ring-2 ring-orange-500/20"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Issue Formal PO</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Create an Issued PO linked to Quotation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignMode("TAG_ONLY")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      assignMode === "TAG_ONLY"
                        ? "bg-orange-50 border-orange-500 ring-2 ring-orange-500/20"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Tag Vendor Only</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Save vendor & CP on Quote for later
                    </div>
                  </button>
                </div>
              </div>

              {/* Payment Resolution Options when creating Direct Purchase or PO */}
              {assignMode !== "TAG_ONLY" && (
                <div className="space-y-4 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Payment Settlement
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignPaymentMode("PAY_NOW")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          assignPaymentMode === "PAY_NOW"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className={assignPaymentMode === "PAY_NOW" ? "text-white" : ""}>
                          Record Payment Now
                        </span>
                      </button>

                      {untaggedOutPayments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAssignPaymentMode("LINK_UNTAGGED")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            assignPaymentMode === "LINK_UNTAGGED"
                              ? "bg-amber-600 text-white border-amber-600"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={assignPaymentMode === "LINK_UNTAGGED" ? "text-white" : ""}
                          >
                            Link Existing Untagged Payment ({untaggedOutPayments.length})
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setAssignPaymentMode("LATER")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          assignPaymentMode === "LATER"
                            ? "bg-slate-800 text-white border-slate-800"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className={assignPaymentMode === "LATER" ? "text-white" : ""}>
                          Pay Later (Keep in Unpaid Payables)
                        </span>
                      </button>
                    </div>
                  </div>

                  {assignPaymentMode === "PAY_NOW" && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Payment Amount (₹)
                          </label>
                          <SmartNumberInput
                            required
                            value={assignPayAmount}
                            onValueChange={(_, str) => setAssignPayAmount(str)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Method
                          </label>
                          <select
                            value={assignPayMethod}
                            onChange={(e) => setAssignPayMethod(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900"
                          >
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="UPI">UPI</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="CASH">Cash</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Status
                          </label>
                          <select
                            value={assignPayStatus}
                            onChange={(e) =>
                              setAssignPayStatus(e.target.value as "CLEARED" | "PENDING")
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900"
                          >
                            <option value="CLEARED">Cleared</option>
                            <option value="PENDING">Pending (Cheque/PDC)</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            UTR / Cheque Ref (Optional)
                          </label>
                          <input
                            type="text"
                            value={assignPayRef}
                            onChange={(e) => setAssignPayRef(e.target.value)}
                            placeholder="e.g. UTR123456"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={assignPayNotes}
                            onChange={(e) => setAssignPayNotes(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {assignPaymentMode === "LINK_UNTAGGED" && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                      <label className="block text-xs font-bold text-amber-950 uppercase mb-1.5">
                        Select Untagged Outgoing Payment to Link
                      </label>
                      <select
                        required
                        value={assignUntaggedPaymentId}
                        onChange={(e) => setAssignUntaggedPaymentId(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900"
                      >
                        <option value="">-- Choose Untagged Outgoing Payment --</option>
                        {untaggedOutPayments.map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {formatRupee(u.amount)} — {new Date(u.date).toLocaleDateString()} (
                            {u.notes || u.reference || u.method})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </form>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignModal(null)}
                disabled={isUpdating}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="assign-resolve-form"
                disabled={isUpdating}
                className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Check className="w-4 h-4 text-white" />
                )}
                <span className="text-white">
                  {isUpdating
                    ? "Processing..."
                    : assignMode === "DIRECT_PURCHASE"
                    ? "Create Direct Purchase & Resolve"
                    : assignMode === "PO"
                    ? "Create PO & Resolve"
                    : "Save Vendor Tag"}
                </span>
              </button>
            </div>
          </div>
        </div>
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
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-600 mb-2">
                  Select which {resolveModal.type === "IN" ? "Client Quotation" : "Purchase Order or Direct Purchase"} to link this payment to:
                </p>
                {untaggedOutPayments.length > 1 && resolveModal.type === "OUT" && (
                  <div className="mb-3">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Untagged Payment Entry
                    </label>
                    <select
                      value={resolveModal.paymentId}
                      onChange={(e) => {
                        const found = untaggedOutPayments.find((u: any) => u.id === e.target.value)
                        if (found) {
                          setResolveModal({
                            paymentId: found.id,
                            amount: found.amount,
                            type: "OUT",
                          })
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                    >
                      {untaggedOutPayments.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {formatRupee(u.amount)} — {new Date(u.date).toLocaleDateString()} (
                          {u.notes || u.reference || u.method})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="text-xs text-slate-600">
                  Payment Amount:{" "}
                  <span className="text-slate-900 font-bold font-mono">
                    {formatRupee(resolveModal.amount)}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {resolveModal.type === "IN"
                    ? "Select Quotation to apply this payment"
                    : "Select PO / Direct Purchase to apply this payment"}
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
                            #{formatShortId(q.id)} - {q.client?.name} (Due: {formatRupee(due)})
                          </option>
                        )
                      })}
                  {resolveModal.type === "OUT" && (
                    <>
                      <optgroup label="Unpaid Purchase Orders">
                        {pos?.map((p: any) => {
                          const due =
                            (p.totalAmount || 0) + (p.totalGst || 0) - (p.amountPaid || 0)
                          return (
                            <option key={`po:${p.id}`} value={`po:${p.id}`} disabled={due <= 0}>
                              {p.poNumber || `PO-${formatShortId(p.id)}`} - {p.supplier?.name} (Due:{" "}
                              {formatRupee(due)})
                            </option>
                          )
                        })}
                      </optgroup>
                      <optgroup label="Unpaid Direct Purchases">
                        {purchases?.map((p: any) => {
                          const due =
                            (p.totalAmount || 0) + (p.totalGst || 0) - (p.amountPaid || 0)
                          return (
                            <option
                              key={`purchase:${p.id}`}
                              value={`purchase:${p.id}`}
                              disabled={due <= 0}
                            >
                              BILL-{formatShortId(p.id)} - {p.supplier?.name} (Due:{" "}
                              {formatRupee(due)})
                            </option>
                          )
                        })}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
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
