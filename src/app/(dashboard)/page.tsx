import { prisma } from "@/lib/prisma"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard"
}
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee,
  ShoppingCart,
  ReceiptText,
  Sparkles,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Building2,
  ArrowRight
} from "lucide-react"
import { formatRupee } from "@/lib/utils"
import { DashboardCharts } from "@/components/DashboardCharts"
import { DateRangePicker } from "@/components/DateRangePicker"
import Link from "next/link"

async function getDashboardData(fromStr?: string, toStr?: string) {
  const now = new Date()
  
  // Dates for trend calculations
  const currentPeriodStart = new Date(now)
  currentPeriodStart.setDate(currentPeriodStart.getDate() - 30)
  
  const previousPeriodStart = new Date(currentPeriodStart)
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 30)

  // Date filtering
  const fromDate = fromStr ? new Date(fromStr) : undefined
  let toDate = toStr ? new Date(toStr) : undefined
  if (toDate) {
    // End of the day
    toDate.setHours(23, 59, 59, 999)
  }

  const dateFilter = fromDate && toDate ? {
    createdAt: {
      gte: fromDate,
      lte: toDate
    }
  } : {}
  
  const purchaseDateFilter = fromDate && toDate ? {
    date: {
      gte: fromDate,
      lte: toDate
    }
  } : {}

  // Fetch Quotations (Sales)
  const allQuotations = await prisma.quotation.findMany({
    where: dateFilter,
    include: { items: true, client: true },
    orderBy: { createdAt: 'desc' }
  })
  
  // Fetch Purchase Orders (Purchases)
  const allPOs = await prisma.purchaseOrder.findMany({
    where: dateFilter,
    include: { supplier: true },
    orderBy: { createdAt: 'desc' }
  })

  // Fetch Purchases (stock intake)
  const allPurchases = await prisma.purchase.findMany({
    where: purchaseDateFilter,
    include: { supplier: true },
    orderBy: { date: 'desc' }
  })
  
  const acceptedQuotations = allQuotations.filter(q => q.status === 'ACCEPTED' || q.status === 'COMPLETED')
  const validPOs = allPOs.filter(po => po.status !== 'DRAFT' && po.status !== 'CANCELLED')
  
  // Basic totals (All Time)
  let totalSales = 0
  let totalSalesGst = 0
  let profits = 0

  for (const q of acceptedQuotations) {
    totalSales += (q.totalAmount || 0)
    totalSalesGst += (q.totalGst || 0)
    
    for (const item of q.items) {
      const cp = item.cpSnapshot || 0
      const sp = item.spSnapshot || 0
      profits += ((sp - cp) * item.quantity) - (item.additionalCost || 0)
    }
  }

  let totalPurchases = 0
  let totalPurchaseGst = 0
  for (const po of validPOs) {
    totalPurchases += (po.totalAmount || 0)
    totalPurchaseGst += (po.totalGst || 0)
  }

  // Calculate Current Month GST specifically
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthQuotations = acceptedQuotations.filter(q => q.createdAt >= currentMonthStart)
  const currentMonthPOs = validPOs.filter(po => po.createdAt >= currentMonthStart)
  
  const currentMonthSalesGst = currentMonthQuotations.reduce((acc, q) => acc + (q.totalGst || 0), 0)
  const currentMonthPurchaseGst = currentMonthPOs.reduce((acc, po) => acc + (po.totalGst || 0), 0)
  
  const gstToPay = currentMonthSalesGst - currentMonthPurchaseGst

  // Current Period (Last 30 days)
  const currentQuotations = acceptedQuotations.filter(q => q.createdAt >= currentPeriodStart)
  const currentPOs = validPOs.filter(po => po.createdAt >= currentPeriodStart)
  
  let currentSales = currentQuotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0)
  let currentPurchases = currentPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0)
  let currentProfits = currentQuotations.reduce((acc, q) => {
    return acc + q.items.reduce((sum, item) => sum + (((item.spSnapshot || 0) - (item.cpSnapshot || 0)) * item.quantity) - (item.additionalCost || 0), 0)
  }, 0)

  // Previous Period (31-60 days ago)
  const previousQuotations = acceptedQuotations.filter(q => q.createdAt >= previousPeriodStart && q.createdAt < currentPeriodStart)
  const previousPOs = validPOs.filter(po => po.createdAt >= previousPeriodStart && po.createdAt < currentPeriodStart)
  
  let previousSales = previousQuotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0)
  let previousPurchases = previousPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0)
  let previousProfits = previousQuotations.reduce((acc, q) => {
    return acc + q.items.reduce((sum, item) => sum + (((item.spSnapshot || 0) - (item.cpSnapshot || 0)) * item.quantity) - (item.additionalCost || 0), 0)
  }, 0)

  // Calculate Trends (%)
  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const salesTrend = calcTrend(currentSales, previousSales)
  const purchasesTrend = calcTrend(currentPurchases, previousPurchases)
  const profitsTrend = calcTrend(currentProfits, previousProfits)

  // Generate last 7 days chart data
  const chartData = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const nextDay = new Date(d)
    nextDay.setDate(d.getDate() + 1)
    
    const dayQuotes = acceptedQuotations.filter(q => q.createdAt >= d && q.createdAt < nextDay)
    const dayPOs = validPOs.filter(po => po.createdAt >= d && po.createdAt < nextDay)
    
    let daySales = dayQuotes.reduce((acc, q) => acc + (q.totalAmount || 0), 0)
    let dayPurchases = dayPOs.reduce((acc, po) => acc + (po.totalAmount || 0), 0)
    
    chartData.push({
      name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      sales: daySales,
      purchases: dayPurchases
    })
  }

  // Top clients by accepted quotation value
  const clientMap = new Map<string, { name: string, total: number, count: number }>()
  for (const q of acceptedQuotations) {
    const existing = clientMap.get(q.clientId)
    if (existing) {
      existing.total += q.totalAmount
      existing.count += 1
    } else {
      clientMap.set(q.clientId, { name: q.client.name, total: q.totalAmount, count: 1 })
    }
  }
  const topClients = [...clientMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  // Top suppliers by PO value
  const supplierMap = new Map<string, { name: string, total: number, count: number }>()
  for (const po of validPOs) {
    const existing = supplierMap.get(po.supplierId)
    if (existing) {
      existing.total += po.totalAmount
      existing.count += 1
    } else {
      supplierMap.set(po.supplierId, { name: po.supplier.name, total: po.totalAmount, count: 1 })
    }
  }
  const topSuppliers = [...supplierMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  // Recent activity (last 10 quotations of any status)
  const recentQuotations = allQuotations.slice(0, 8)

  // Recent purchases
  const recentPurchases = allPurchases.slice(0, 5)

  return {
    totalSales,
    totalPurchases,
    profits,
    gstToPay,
    chartData,
    trends: {
      sales: salesTrend,
      purchases: purchasesTrend,
      profits: profitsTrend
    },
    quotationCounts: {
      draft: allQuotations.filter(q => q.status === 'DRAFT').length,
      pending: allQuotations.filter(q => q.status === 'PENDING').length,
      accepted: allQuotations.filter(q => q.status === 'ACCEPTED').length,
      completed: allQuotations.filter(q => q.status === 'COMPLETED').length,
      rejected: allQuotations.filter(q => q.status === 'REJECTED').length,
    },
    poCounts: {
      draft: allPOs.filter(po => po.status === 'DRAFT').length,
      issued: allPOs.filter(po => po.status === 'ISSUED').length,
      acknowledged: allPOs.filter(po => po.status === 'ACKNOWLEDGED').length,
      cancelled: allPOs.filter(po => po.status === 'CANCELLED').length,
      total: allPOs.length,
    },
    topClients,
    topSuppliers,
    recentQuotations,
    recentPurchases,
    totalPurchaseSpend: allPurchases.reduce((s, p) => s + p.totalAmount, 0),
  }
}

export default async function DashboardPage(props: { searchParams: Promise<{ from?: string, to?: string }> }) {
  const { from, to } = await props.searchParams
  const data = await getDashboardData(from, to)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-orange/10 rounded-md">
            <Sparkles className="w-6 h-6 text-brand-orange" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-heading">Dashboard Overview</h1>
            <p className="text-zinc-400 mt-1 text-sm">Welcome back. Here's what's happening with your business.</p>
          </div>
        </div>
        <DateRangePicker />
      </div>

      {/* ── Primary KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Sales" 
          value={formatRupee(data.totalSales)} 
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} 
          trend={data.trends.sales > 0 ? `+${data.trends.sales}%` : `${data.trends.sales}%`}
          trendUp={data.trends.sales >= 0}
        />
        <MetricCard 
          title="Total Purchases" 
          value={formatRupee(data.totalPurchases)} 
          icon={<ShoppingCart className="w-5 h-5 text-blue-500" />} 
          trend={data.trends.purchases > 0 ? `+${data.trends.purchases}%` : `${data.trends.purchases}%`}
          trendUp={data.trends.purchases <= 0}
        />
        <MetricCard 
          title="Net Profit (Est.)" 
          value={formatRupee(data.profits)} 
          icon={<IndianRupee className="w-5 h-5 text-amber-500" />} 
          trend={data.trends.profits > 0 ? `+${data.trends.profits}%` : `${data.trends.profits}%`} 
          trendUp={data.trends.profits >= 0}
        />
        <MetricCard 
          title="Current Month GST" 
          value={formatRupee(Math.abs(data.gstToPay))} 
          icon={<ReceiptText className="w-5 h-5 text-rose-500" />} 
          subtext={data.gstToPay > 0 ? "Net Payable (Output > Input)" : "Input Tax Credit (Input > Output)"}
        />
      </div>

      {/* ── Quotation + PO Status Pipeline ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quotation Pipeline */}
        <div className="glass-panel rounded-md p-5 border border-premium-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Quotation Pipeline</h3>
            <Link href="/quotations" className="text-xs text-brand-slate hover:text-white transition-colors flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Link href="/quotations?status=DRAFT" className="text-center p-3 rounded-md bg-zinc-800/50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all">
              <p className="text-2xl font-bold text-white">{data.quotationCounts.draft}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Draft</p>
            </Link>
            <Link href="/quotations?status=PENDING" className="text-center p-3 rounded-md bg-blue-950/30 hover:bg-blue-950/50 border border-transparent hover:border-blue-900/50 transition-all">
              <p className="text-2xl font-bold text-blue-400">{data.quotationCounts.pending}</p>
              <p className="text-[10px] text-blue-400/60 uppercase tracking-wider mt-1">Pending</p>
            </Link>
            <Link href="/quotations?status=ACCEPTED" className="text-center p-3 rounded-md bg-emerald-950/30 hover:bg-emerald-950/50 border border-transparent hover:border-emerald-900/50 transition-all">
              <p className="text-2xl font-bold text-emerald-400">{data.quotationCounts.accepted}</p>
              <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider mt-1">Accepted</p>
            </Link>
            <Link href="/quotations?status=REJECTED" className="text-center p-3 rounded-md bg-rose-950/30 hover:bg-rose-950/50 border border-transparent hover:border-rose-900/50 transition-all">
              <p className="text-2xl font-bold text-rose-400">{data.quotationCounts.rejected}</p>
              <p className="text-[10px] text-rose-400/60 uppercase tracking-wider mt-1">Rejected</p>
            </Link>
          </div>
        </div>

        {/* PO Pipeline */}
        <div className="glass-panel rounded-md p-5 border border-premium-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Purchase Order Pipeline</h3>
            <Link href="/purchase-orders" className="text-xs text-brand-slate hover:text-white transition-colors flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Link href="/purchase-orders?status=DRAFT" className="text-center p-3 rounded-md bg-zinc-800/50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all">
              <p className="text-2xl font-bold text-white">{data.poCounts.draft}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Draft</p>
            </Link>
            <Link href="/purchase-orders?status=ISSUED" className="text-center p-3 rounded-md bg-blue-950/30 hover:bg-blue-950/50 border border-transparent hover:border-blue-900/50 transition-all">
              <p className="text-2xl font-bold text-blue-400">{data.poCounts.issued}</p>
              <p className="text-[10px] text-blue-400/60 uppercase tracking-wider mt-1">Issued</p>
            </Link>
            <Link href="/purchase-orders?status=ACKNOWLEDGED" className="text-center p-3 rounded-md bg-emerald-950/30 hover:bg-emerald-950/50 border border-transparent hover:border-emerald-900/50 transition-all">
              <p className="text-2xl font-bold text-emerald-400">{data.poCounts.acknowledged}</p>
              <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider mt-1">Acknowledged</p>
            </Link>
            <Link href="/purchase-orders?status=CANCELLED" className="text-center p-3 rounded-md bg-rose-950/30 hover:bg-rose-950/50 border border-transparent hover:border-rose-900/50 transition-all">
              <p className="text-2xl font-bold text-rose-400">{data.poCounts.cancelled}</p>
              <p className="text-[10px] text-rose-400/60 uppercase tracking-wider mt-1">Cancelled</p>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      <DashboardCharts data={data} />

      {/* ── Top Clients + Top Suppliers + Recent Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Clients */}
        <div className="glass-panel rounded-md p-5 border border-premium-border">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Top Clients (by Sales)</h3>
          </div>
          <div className="space-y-3">
            {data.topClients.length === 0 ? (
              <p className="text-xs text-zinc-600">No accepted quotations yet.</p>
            ) : data.topClients.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}.</span>
                  <span className="text-sm text-zinc-300 truncate">{c.name}</span>
                </div>
                <div className="text-right flex-none ml-3">
                  <p className="text-sm font-medium text-white">{formatRupee(c.total)}</p>
                  <p className="text-[10px] text-zinc-500">{c.count} orders</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="glass-panel rounded-md p-5 border border-premium-border">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Top Suppliers (by POs)</h3>
          </div>
          <div className="space-y-3">
            {data.topSuppliers.length === 0 ? (
              <p className="text-xs text-zinc-600">No purchase orders yet.</p>
            ) : data.topSuppliers.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}.</span>
                  <span className="text-sm text-zinc-300 truncate">{s.name}</span>
                </div>
                <div className="text-right flex-none ml-3">
                  <p className="text-sm font-medium text-white">{formatRupee(s.total)}</p>
                  <p className="text-[10px] text-zinc-500">{s.count} POs</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Quotations */}
        <div className="glass-panel rounded-md p-5 border border-premium-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Recent Quotations</h3>
            </div>
            <Link href="/quotations" className="text-xs text-brand-slate hover:text-white transition-colors">View All</Link>
          </div>
          <div className="space-y-2">
            {data.recentQuotations.length === 0 ? (
              <p className="text-xs text-zinc-600">No quotations yet.</p>
            ) : data.recentQuotations.map((q) => {
              const statusColor = q.status === 'ACCEPTED' ? 'bg-emerald-500' 
                : q.status === 'PENDING' ? 'bg-blue-500' 
                : q.status === 'REJECTED' ? 'bg-rose-500' 
                : 'bg-zinc-500'
              return (
                <Link key={q.id} href={`/quotations/${q.id}`} className="flex items-center justify-between py-2 hover:bg-white/5 -mx-2 px-2 rounded-md transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-none ${statusColor}`} />
                    <span className="text-sm text-zinc-300 truncate">{q.client.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white flex-none ml-2">{formatRupee(q.totalAmount)}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Recent Purchases ── */}
      {data.recentPurchases.length > 0 && (
        <div className="glass-panel rounded-md p-5 border border-premium-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-zinc-500" />
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Recent Purchases</h3>
            </div>
            <Link href="/purchases" className="text-xs text-brand-slate hover:text-white transition-colors flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase border-b border-premium-border">
                <tr>
                  <th className="pb-2 font-medium tracking-wider">Supplier</th>
                  <th className="pb-2 font-medium tracking-wider">Date</th>
                  <th className="pb-2 font-medium tracking-wider">Amount</th>
                  <th className="pb-2 font-medium tracking-wider">GST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-premium-border/50">
                {data.recentPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 text-zinc-300">{p.supplier.name}</td>
                    <td className="py-2.5 text-zinc-400">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="py-2.5 font-medium text-white">{formatRupee(p.totalAmount)}</td>
                    <td className="py-2.5 text-zinc-400">{formatRupee(p.totalGst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
  href
}: { 
  title: string, 
  value: string, 
  icon: React.ReactNode, 
  trend?: string, 
  trendUp?: boolean,
  subtext?: string,
  href?: string
}) {
  const content = (
    <div className={`glass-panel p-6 rounded-md relative overflow-hidden group transition-all duration-300 ${href ? 'hover:-translate-y-1 hover:border-brand-slate hover:shadow-lg cursor-pointer' : 'hover:-translate-y-1'}`}>
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-brand-orange/10 transition-colors" />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-zinc-400 font-medium tracking-wide text-sm">{title}</h3>
        <div className="p-2.5 bg-white/5 rounded-md border border-white/5 shadow-inner">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-3 relative z-10">
        <h2 className="text-3xl font-bold text-white tracking-tight">{value}</h2>
        {trend !== undefined && trend !== '0%' && (
          <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
            {trend}
          </span>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-zinc-500 mt-2 relative z-10 font-medium">{subtext}</p>
      )}
    </div>
  )

  if (href) {
    return <Link href={href} className="block outline-none">{content}</Link>
  }
  return content
}
