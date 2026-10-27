import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import {
  TrendingUp,
  IndianRupee,
  ShoppingCart,
  ReceiptText,
  FileText,
  Users,
  Building2,
  ArrowRight,
  Package,
  ClipboardList,
  ShieldCheck,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Plus,
} from "lucide-react"
import { formatRupee, formatShortId } from "@/lib/utils"
import { DashboardCharts } from "@/components/DashboardCharts"
import { DateRangePicker } from "@/components/DateRangePicker"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Executive Dashboard",
}

async function getDashboardData(fromStr?: string, toStr?: string) {
  const now = new Date()

  const currentPeriodStart = new Date(now)
  currentPeriodStart.setDate(currentPeriodStart.getDate() - 30)

  const previousPeriodStart = new Date(currentPeriodStart)
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 30)

  const fromDate = fromStr ? new Date(fromStr) : undefined
  const toDate = toStr ? new Date(toStr) : undefined
  if (toDate) {
    toDate.setHours(23, 59, 59, 999)
  }

  const dateFilter =
    fromDate && toDate
      ? {
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        }
      : {}

  const purchaseDateFilter =
    fromDate && toDate
      ? {
          date: {
            gte: fromDate,
            lte: toDate,
          },
        }
      : {}

  const [allQuotations, allPOs, allPurchases, allRfqs, totalProducts, totalClients, totalSuppliers] =
    await Promise.all([
      prisma.quotation.findMany({
        where: dateFilter,
        include: {
          items: true,
          client: true,
          purchaseOrders: {
            where: { status: { not: "CANCELLED" } },
            include: { items: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseOrder.findMany({
        where: dateFilter,
        include: { supplier: true, quotation: { include: { client: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchase.findMany({
        where: purchaseDateFilter,
        include: { supplier: true },
        orderBy: { date: "desc" },
      }),
      prisma.rfq.findMany({
        include: { supplier: true, responses: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count(),
      prisma.client.count(),
      prisma.supplier.count(),
    ])

  const acceptedQuotations = allQuotations.filter(
    (q) => q.status === "ACCEPTED" || q.status === "COMPLETED"
  )
  const validPOs = allPOs.filter((po) => po.status !== "DRAFT" && po.status !== "CANCELLED")

  let totalSales = 0
  let totalSalesGst = 0
  let profits = 0
  let unpaidReceivables = 0

  for (const q of acceptedQuotations) {
    totalSales += q.totalAmount || 0
    totalSalesGst += q.totalGst || 0
    const grandTotal = (q.totalAmount || 0) + (q.totalGst || 0)
    unpaidReceivables += Math.max(0, grandTotal - (q.amountPaid || 0))

    for (const item of q.items) {
      if (item.isConfirmed === false) continue
      const cp = item.cpSnapshot || 0
      const sp = item.spSnapshot || 0
      profits += (sp - cp) * item.quantity - (item.additionalCost || 0)
    }
  }

  let totalPurchases = 0
  let totalPurchaseGst = 0
  let unpaidPayables = 0
  for (const po of validPOs) {
    totalPurchases += po.totalAmount || 0
    totalPurchaseGst += po.totalGst || 0
    const poGrand = (po.totalAmount || 0) + (po.totalGst || 0)
    unpaidPayables += Math.max(0, poGrand - (po.amountPaid || 0))
  }

  // Accepted quotations that still need POs issued (for confirmed items)
  const acceptedNeedingPo = allQuotations.filter((q) => {
    if (q.status !== "ACCEPTED") return false
    const orderedMap = new Map<string, number>()
    for (const po of q.purchaseOrders || []) {
      for (const item of po.items || []) {
        orderedMap.set(item.productId, (orderedMap.get(item.productId) || 0) + item.quantity)
      }
    }
    return q.items
      .filter((qi) => qi.isConfirmed !== false)
      .some((qi) => (orderedMap.get(qi.productId) || 0) < qi.quantity)
  })

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthQuotations = acceptedQuotations.filter(
    (q) => q.createdAt >= currentMonthStart
  )
  const currentMonthPOs = validPOs.filter((po) => po.createdAt >= currentMonthStart)

  const currentMonthSalesGst = currentMonthQuotations.reduce(
    (acc, q) => acc + (q.totalGst || 0),
    0
  )
  const currentMonthPurchaseGst = currentMonthPOs.reduce(
    (acc, po) => acc + (po.totalGst || 0),
    0
  )

  const gstToPay = currentMonthSalesGst - currentMonthPurchaseGst

  const currentQuotations = acceptedQuotations.filter((q) => q.createdAt >= currentPeriodStart)
  const currentPOs = validPOs.filter((po) => po.createdAt >= currentPeriodStart)

  const currentSales = currentQuotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0)
  const currentPurchases = currentPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0)
  const currentProfits = currentQuotations.reduce((acc, q) => {
    return (
      acc +
      q.items.reduce(
        (sum, item) =>
          sum +
          ((item.spSnapshot || 0) - (item.cpSnapshot || 0)) * item.quantity -
          (item.additionalCost || 0),
        0
      )
    )
  }, 0)

  const previousQuotations = acceptedQuotations.filter(
    (q) => q.createdAt >= previousPeriodStart && q.createdAt < currentPeriodStart
  )
  const previousPOs = validPOs.filter(
    (po) => po.createdAt >= previousPeriodStart && po.createdAt < currentPeriodStart
  )

  const previousSales = previousQuotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0)
  const previousPurchases = previousPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0)
  const previousProfits = previousQuotations.reduce((acc, q) => {
    return (
      acc +
      q.items.reduce(
        (sum, item) =>
          sum +
          ((item.spSnapshot || 0) - (item.cpSnapshot || 0)) * item.quantity -
          (item.additionalCost || 0),
        0
      )
    )
  }, 0)

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const salesTrend = calcTrend(currentSales, previousSales)
  const purchasesTrend = calcTrend(currentPurchases, previousPurchases)
  const profitsTrend = calcTrend(currentProfits, previousProfits)

  const chartData = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const nextDay = new Date(d)
    nextDay.setDate(d.getDate() + 1)

    const dayQuotes = acceptedQuotations.filter((q) => q.createdAt >= d && q.createdAt < nextDay)
    const dayPOs = validPOs.filter((po) => po.createdAt >= d && po.createdAt < nextDay)

    const daySales = dayQuotes.reduce((acc, q) => acc + (q.totalAmount || 0), 0)
    const dayPurchases = dayPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0)

    chartData.push({
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      sales: daySales / 100,
      purchases: dayPurchases / 100,
    })
  }

  const clientMap = new Map<string, { id: string; name: string; total: number; count: number }>()
  for (const q of acceptedQuotations) {
    const existing = clientMap.get(q.clientId)
    if (existing) {
      existing.total += q.totalAmount
      existing.count += 1
    } else {
      clientMap.set(q.clientId, {
        id: q.clientId,
        name: q.client.name,
        total: q.totalAmount,
        count: 1,
      })
    }
  }
  const topClients = [...clientMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  const supplierMap = new Map<
    string,
    { id: string; name: string; total: number; count: number }
  >()
  for (const po of validPOs) {
    const existing = supplierMap.get(po.supplierId)
    if (existing) {
      existing.total += po.totalAmount
      existing.count += 1
    } else {
      supplierMap.set(po.supplierId, {
        id: po.supplierId,
        name: po.supplier.name,
        total: po.totalAmount,
        count: 1,
      })
    }
  }
  const topSuppliers = [...supplierMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  const recentQuotations = allQuotations.slice(0, 6)
  const recentPOs = allPOs.slice(0, 6)
  const recentPurchases = allPurchases.slice(0, 5)

  return {
    totalSales,
    totalPurchases,
    profits,
    gstToPay,
    unpaidReceivables,
    unpaidPayables,
    acceptedNeedingPo,
    totalProducts,
    totalClients,
    totalSuppliers,
    openRfqsCount: allRfqs.filter((r) => r.status === "ISSUED").length,
    chartData,
    trends: {
      sales: salesTrend,
      purchases: purchasesTrend,
      profits: profitsTrend,
    },
    quotationCounts: {
      draft: allQuotations.filter((q) => q.status === "DRAFT").length,
      pending: allQuotations.filter((q) => q.status === "PENDING").length,
      accepted: allQuotations.filter((q) => q.status === "ACCEPTED").length,
      completed: allQuotations.filter((q) => q.status === "COMPLETED").length,
      rejected: allQuotations.filter((q) => q.status === "REJECTED").length,
      total: allQuotations.length,
    },
    poCounts: {
      draft: allPOs.filter((po) => po.status === "DRAFT").length,
      issued: allPOs.filter((po) => po.status === "ISSUED").length,
      acknowledged: allPOs.filter((po) => po.status === "ACKNOWLEDGED").length,
      cancelled: allPOs.filter((po) => po.status === "CANCELLED").length,
      total: allPOs.length,
    },
    topClients,
    topSuppliers,
    recentQuotations,
    recentPOs,
    recentPurchases,
    totalPurchaseSpend: allPurchases.reduce((s, p) => s + p.totalAmount, 0),
  }
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await props.searchParams
  const data = await getDashboardData(from, to)

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
              <Sparkles className="w-3 h-3" /> Command Center
            </span>
            <span className="text-xs text-slate-400">
              {data.totalClients} Clients · {data.totalSuppliers} Suppliers · {data.totalProducts} Catalog Items
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Executive Overview
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Complete visibility across your quotation pipeline, supplier procurement, margins, and cash flow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangePicker />
          <Link
            href="/quotations/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Quotation
          </Link>
          <Link
            href="/purchase-orders/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New PO
          </Link>
        </div>
      </div>

      {/* ── ABC OF RADIANT: Interactive End-to-End Supply Chain Guide ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              How Radiant Works · End-to-End Business Workflow (A → B → C → D)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Click any stage to jump directly to that workspace
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Link
            href="/products"
            className="group relative p-4 rounded-xl bg-slate-50/70 hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-200 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold">
                A
              </span>
              <Package className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-orange-700">
              1. Catalog & RFQs
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Manage <strong className="text-slate-700">{data.totalProducts} products</strong> (Cost & Selling Price history) or send RFQs (<strong className="text-slate-700">{data.openRfqsCount} open</strong>) to vendors.
            </p>
          </Link>

          <Link
            href="/quotations"
            className="group relative p-4 rounded-xl bg-slate-50/70 hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-200 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-orange-600 text-white text-xs font-bold">
                B
              </span>
              <FileText className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-orange-700">
              2. Client Quotations
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Create & email GST quotes to <strong className="text-slate-700">{data.totalClients} clients</strong>. Currently <strong className="text-blue-600">{data.quotationCounts.pending} pending</strong> & <strong className="text-emerald-600">{data.quotationCounts.accepted} accepted</strong>.
            </p>
          </Link>

          <Link
            href="/purchase-orders"
            className="group relative p-4 rounded-xl bg-slate-50/70 hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-200 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-bold">
                C
              </span>
              <ClipboardList className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
              3. POs & Quality (COC)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Convert accepted quotes into supplier POs (<strong className="text-slate-700">{data.poCounts.total} POs</strong>, duplicate-protected) & issue COC certificates.
            </p>
          </Link>

          <Link
            href="/accounts"
            className="group relative p-4 rounded-xl bg-slate-50/70 hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-200 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-600 text-white text-xs font-bold">
                D
              </span>
              <Wallet className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">
              4. Accounts & Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Track receivables (<strong className="text-emerald-700">{formatRupee(data.unpaidReceivables)}</strong>) & payables (<strong className="text-rose-600">{formatRupee(data.unpaidPayables)}</strong>) in real time.
            </p>
          </Link>
        </div>
      </div>

      {/* ── ACTION REQUIRED BANNER (If Accepted Quotes Need POs or Pending Quotes Exist) ── */}
      {(data.acceptedNeedingPo.length > 0 || data.quotationCounts.pending > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.acceptedNeedingPo.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900">
                    {data.acceptedNeedingPo.length} Accepted Quotation{data.acceptedNeedingPo.length > 1 ? "s" : ""} Need Supplier POs
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    These quotations were accepted by clients, but some or all items have not been ordered from suppliers yet:
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {data.acceptedNeedingPo.slice(0, 4).map((q) => (
                      <Link
                        key={q.id}
                        href={`/purchase-orders/new?quotationId=${q.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors"
                      >
                        #{formatShortId(q.id)} · {q.client.name} <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {data.quotationCounts.pending > 0 && (
            <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-900">
                    {data.quotationCounts.pending} Pending Quotation{data.quotationCounts.pending > 1 ? "s" : ""} Awaiting Client Approval
                  </h3>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Follow up with clients or mark approved quotations as <strong>ACCEPTED</strong> to unlock PO fulfillment and revenue tracking.
                  </p>
                  <div className="mt-2.5">
                    <Link
                      href="/quotations?status=PENDING"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-white text-blue-800 border border-blue-300 hover:bg-blue-100 transition-colors"
                    >
                      Review Pending Quotations <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Accepted Sales (Excl. GST)"
          value={formatRupee(data.totalSales)}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          trend={data.trends.sales > 0 ? `+${data.trends.sales}%` : `${data.trends.sales}%`}
          trendUp={data.trends.sales >= 0}
          subtext={`Receivable Due: ${formatRupee(data.unpaidReceivables)}`}
          href="/quotations?status=ACCEPTED"
        />
        <MetricCard
          title="Issued PO Spend"
          value={formatRupee(data.totalPurchases)}
          icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
          trend={
            data.trends.purchases > 0
              ? `+${data.trends.purchases}%`
              : `${data.trends.purchases}%`
          }
          trendUp={data.trends.purchases <= 0}
          subtext={`Payable Due: ${formatRupee(data.unpaidPayables)}`}
          href="/purchase-orders"
        />
        <MetricCard
          title="Net Estimated Profit"
          value={formatRupee(data.profits)}
          icon={<IndianRupee className="w-5 h-5 text-orange-600" />}
          trend={
            data.trends.profits > 0 ? `+${data.trends.profits}%` : `${data.trends.profits}%`
          }
          trendUp={data.trends.profits >= 0}
          subtext="Selling Price minus Cost & Extra Expenses"
          href="/accounts"
        />
        <MetricCard
          title="Current Month GST"
          value={formatRupee(Math.abs(data.gstToPay))}
          icon={<ReceiptText className="w-5 h-5 text-indigo-600" />}
          subtext={
            data.gstToPay > 0
              ? "Net Payable (Output GST > Input GST)"
              : "Input Tax Credit (Input GST > Output GST)"
          }
          href="/accounts"
        />
      </div>

      {/* Quotation + PO Status Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Sales Quotation Pipeline ({data.quotationCounts.total})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any status to filter client quotations
              </p>
            </div>
            <Link
              href="/quotations"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
            >
              All Quotations <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-5 gap-2.5">
            <Link
              href="/quotations?status=DRAFT"
              className="text-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <p className="text-xl font-bold text-slate-800">{data.quotationCounts.draft}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                Draft
              </p>
            </Link>
            <Link
              href="/quotations?status=PENDING"
              className="text-center p-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 transition-all"
            >
              <p className="text-xl font-bold text-blue-700">{data.quotationCounts.pending}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-1">
                Pending
              </p>
            </Link>
            <Link
              href="/quotations?status=ACCEPTED"
              className="text-center p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 transition-all"
            >
              <p className="text-xl font-bold text-emerald-700">{data.quotationCounts.accepted}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">
                Accepted
              </p>
            </Link>
            <Link
              href="/quotations?status=COMPLETED"
              className="text-center p-3 rounded-xl bg-violet-50/70 hover:bg-violet-100/70 border border-violet-200 transition-all"
            >
              <p className="text-xl font-bold text-violet-700">{data.quotationCounts.completed}</p>
              <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mt-1">
                Completed
              </p>
            </Link>
            <Link
              href="/quotations?status=REJECTED"
              className="text-center p-3 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200 transition-all"
            >
              <p className="text-xl font-bold text-rose-700">{data.quotationCounts.rejected}</p>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">
                Rejected
              </p>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Supplier Purchase Order Pipeline ({data.poCounts.total})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Track procurement orders sent to suppliers
              </p>
            </div>
            <Link
              href="/purchase-orders"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
            >
              All POs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Link
              href="/purchase-orders?status=DRAFT"
              className="text-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <p className="text-xl font-bold text-slate-800">{data.poCounts.draft}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                Draft
              </p>
            </Link>
            <Link
              href="/purchase-orders?status=ISSUED"
              className="text-center p-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 transition-all"
            >
              <p className="text-xl font-bold text-blue-700">{data.poCounts.issued}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-1">
                Issued
              </p>
            </Link>
            <Link
              href="/purchase-orders?status=ACKNOWLEDGED"
              className="text-center p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 transition-all"
            >
              <p className="text-xl font-bold text-emerald-700">{data.poCounts.acknowledged}</p>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">
                Confirmed
              </p>
            </Link>
            <Link
              href="/purchase-orders?status=CANCELLED"
              className="text-center p-3 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200 transition-all"
            >
              <p className="text-xl font-bold text-rose-700">{data.poCounts.cancelled}</p>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">
                Cancelled
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts data={data} />

      {/* Top Clients + Top Suppliers + Recent Quotations & POs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotations with Linked POs */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-600" />
              <h3 className="text-xs text-slate-700 uppercase tracking-wider font-bold">
                Recent Client Quotations
              </h3>
            </div>
            <Link
              href="/quotations"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentQuotations.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No quotations yet.</p>
            ) : (
              data.recentQuotations.map((q) => {
                const statusBadge =
                  q.status === "ACCEPTED" || q.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : q.status === "PENDING"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : q.status === "REJECTED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/quotations/${q.id}`}
                          className="text-xs font-mono font-bold text-orange-600 hover:underline"
                        >
                          #{formatShortId(q.id)}
                        </Link>
                        <Link
                          href={`/clients/${q.clientId}`}
                          className="text-sm font-semibold text-slate-900 hover:text-orange-600 truncate"
                        >
                          {q.client.name}
                        </Link>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadge}`}
                        >
                          {q.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>{new Date(q.createdAt).toLocaleDateString("en-IN")}</span>
                        <span>· {q.items.length} items</span>
                        {q.purchaseOrders.length > 0 && (
                          <span className="text-blue-600 font-medium">
                            · {q.purchaseOrders.length} PO{q.purchaseOrders.length > 1 ? "s" : ""} linked
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-none ml-3">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="text-sm font-mono font-bold text-slate-900 hover:text-orange-600"
                      >
                        {formatRupee(q.totalAmount)}
                      </Link>
                      <div className="text-[10px] text-slate-400">Excl. GST</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Recent Purchase Orders */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs text-slate-700 uppercase tracking-wider font-bold">
                Recent Supplier Purchase Orders
              </h3>
            </div>
            <Link
              href="/purchase-orders"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentPOs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No purchase orders yet.</p>
            ) : (
              data.recentPOs.map((po) => {
                const statusBadge =
                  po.status === "ACKNOWLEDGED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : po.status === "ISSUED"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : po.status === "CANCELLED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                return (
                  <div
                    key={po.id}
                    className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="text-xs font-mono font-bold text-blue-600 hover:underline"
                        >
                          {po.poNumber || `#${formatShortId(po.id)}`}
                        </Link>
                        <Link
                          href={`/suppliers/${po.supplierId}`}
                          className="text-sm font-semibold text-slate-900 hover:text-orange-600 truncate"
                        >
                          {po.supplier.name}
                        </Link>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadge}`}
                        >
                          {po.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>{new Date(po.createdAt).toLocaleDateString("en-IN")}</span>
                        {po.quotation && (
                          <Link
                            href={`/quotations/${po.quotation.id}`}
                            className="text-orange-600 hover:underline font-medium"
                          >
                            · Quote #{formatShortId(po.quotation.id)} ({po.quotation.client.name})
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-none ml-3">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="text-sm font-mono font-bold text-slate-900 hover:text-blue-600"
                      >
                        {formatRupee(po.totalAmount)}
                      </Link>
                      <div className="text-[10px] text-slate-400">Excl. GST</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Top Clients & Top Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-600" />
              <h3 className="text-xs text-slate-700 uppercase tracking-wider font-bold">
                Top Clients (By Accepted Value)
              </h3>
            </div>
            <Link
              href="/clients"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              Client Directory <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {data.topClients.length === 0 ? (
              <p className="text-xs text-slate-400">No accepted quotations yet.</p>
            ) : (
              data.topClients.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 hover:text-orange-600 truncate">
                      {c.name}
                    </span>
                  </div>
                  <div className="text-right flex-none ml-3">
                    <p className="text-sm font-mono font-bold text-slate-900">
                      {formatRupee(c.total)}
                    </p>
                    <p className="text-[10px] text-slate-400">{c.count} accepted quotes</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs text-slate-700 uppercase tracking-wider font-bold">
                Top Suppliers (By Issued PO Value)
              </h3>
            </div>
            <Link
              href="/suppliers"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              Supplier Directory <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {data.topSuppliers.length === 0 ? (
              <p className="text-xs text-slate-400">No purchase orders yet.</p>
            ) : (
              data.topSuppliers.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/suppliers/${s.id}`}
                  className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 hover:text-blue-600 truncate">
                      {s.name}
                    </span>
                  </div>
                  <div className="text-right flex-none ml-3">
                    <p className="text-sm font-mono font-bold text-slate-900">
                      {formatRupee(s.total)}
                    </p>
                    <p className="text-[10px] text-slate-400">{s.count} POs</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon,
  trend,
  trendUp,
  subtext,
  href,
}: {
  title: string
  value: string
  icon: React.ReactNode
  trend?: string
  trendUp?: boolean
  subtext?: string
  href?: string
}) {
  const content = (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">{title}</h3>
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">{value}</h2>
        {trend !== undefined && trend !== "0%" && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              trendUp
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {subtext && <p className="text-xs text-slate-500 mt-1.5 font-medium">{subtext}</p>}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block outline-none">
        {content}
      </Link>
    )
  }
  return content
}
