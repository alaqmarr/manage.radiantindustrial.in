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
  XCircle
} from "lucide-react"
import { formatRupee } from "@/lib/utils"
import { DashboardCharts } from "@/components/DashboardCharts"
import Link from "next/link"

async function getDashboardData() {
  const now = new Date()
  
  // Dates for trend calculations
  const currentPeriodStart = new Date(now)
  currentPeriodStart.setDate(currentPeriodStart.getDate() - 30)
  
  const previousPeriodStart = new Date(currentPeriodStart)
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 30)

  // Fetch Quotations (Sales)
  const allQuotations = await prisma.quotation.findMany({
    include: { items: true },
    orderBy: { createdAt: 'asc' }
  })
  
  // Fetch Purchase Orders (Purchases)
  const allPOs = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: 'asc' }
  })
  
  const acceptedQuotations = allQuotations.filter(q => q.status === 'ACCEPTED')
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
      accepted: acceptedQuotations.length,
      rejected: allQuotations.filter(q => q.status === 'REJECTED').length,
    }
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-brand-orange/10 rounded-md">
          <Sparkles className="w-6 h-6 text-brand-orange" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-heading">Dashboard Overview</h1>
          <p className="text-zinc-400 mt-1 text-sm">Welcome back. Here's what's happening with your business today.</p>
        </div>
      </div>

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
          trendUp={data.trends.purchases <= 0} // Less purchases means better for cashflow, so trendUp = true visually
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Draft Quotations" 
          value={data.quotationCounts.draft.toString()} 
          icon={<FileText className="w-5 h-5 text-zinc-400" />} 
          href="/quotations?status=DRAFT"
        />
        <MetricCard 
          title="Pending Approval" 
          value={data.quotationCounts.pending.toString()} 
          icon={<Clock className="w-5 h-5 text-blue-500" />} 
          href="/quotations?status=PENDING"
        />
        <MetricCard 
          title="Accepted Quotations" 
          value={data.quotationCounts.accepted.toString()} 
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} 
          href="/quotations?status=ACCEPTED"
        />
        <MetricCard 
          title="Rejected Quotations" 
          value={data.quotationCounts.rejected.toString()} 
          icon={<XCircle className="w-5 h-5 text-rose-500" />} 
          href="/quotations?status=REJECTED"
        />
      </div>

      <DashboardCharts data={data} />
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
