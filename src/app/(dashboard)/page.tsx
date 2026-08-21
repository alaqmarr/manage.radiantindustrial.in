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
  const allQuotations = await prisma.quotation.findMany({
    include: { items: true },
    orderBy: { createdAt: 'asc' }
  })
  
  const acceptedQuotations = allQuotations.filter(q => q.status === 'ACCEPTED')
  
  // Basic totals
  let totalSales = 0
  let totalPurchases = 0
  let totalSalesGst = 0
  let totalPurchaseGst = 0
  let profits = 0

  for (const q of acceptedQuotations) {
    totalSales += (q.totalAmount || 0)
    totalSalesGst += (q.totalGst || 0)
    
    for (const item of q.items) {
      const cp = item.cpSnapshot || 0
      const sp = item.spSnapshot || 0
      const qty = item.quantity
      const gstRate = item.gstSnapshot || 0

      const cost = cp * qty
      const costGst = cost * (gstRate / 100)

      totalPurchases += cost
      totalPurchaseGst += costGst
      profits += (sp - cp) * qty
    }
  }

  const gstToPay = totalSalesGst - totalPurchaseGst

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
    
    let daySales = 0
    let dayPurchases = 0
    
    for (const q of dayQuotes) {
      daySales += (q.totalAmount || 0)
      for (const item of q.items) {
        dayPurchases += (item.cpSnapshot || 0) * item.quantity
      }
    }
    
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
          trend="+12%" 
          trendUp={true}
        />
        <MetricCard 
          title="Total Purchases" 
          value={formatRupee(data.totalPurchases)} 
          icon={<ShoppingCart className="w-5 h-5 text-blue-500" />} 
        />
        <MetricCard 
          title="Net Profit" 
          value={formatRupee(data.profits)} 
          icon={<IndianRupee className="w-5 h-5 text-amber-500" />} 
          trend={data.profits >= 0 ? "+5%" : "-2%"} 
          trendUp={data.profits >= 0}
        />
        <MetricCard 
          title="Pending GST" 
          value={formatRupee(data.gstToPay)} 
          icon={<ReceiptText className="w-5 h-5 text-rose-500" />} 
          subtext="After input tax credit"
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
        {trend && (
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

