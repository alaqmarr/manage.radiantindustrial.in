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
  Sparkles
} from "lucide-react"
import { DashboardCharts } from "@/components/DashboardCharts"

async function getDashboardData() {
  const acceptedQuotations = await prisma.quotation.findMany({
    where: { status: 'ACCEPTED' },
    include: { items: true },
    orderBy: { createdAt: 'asc' }
  })
  
  // Basic totals
  let totalSales = 0
  let totalPurchases = 0
  let totalSalesGst = 0
  let totalPurchaseGst = 0
  let profits = 0

  for (const q of acceptedQuotations) {
    totalSales += q.totalAmount
    totalSalesGst += q.totalGst
    
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
      daySales += q.totalAmount
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
    chartData
  }
}

function formatRupee(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(paise / 100)
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h1>
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
  subtext
}: { 
  title: string, 
  value: string, 
  icon: React.ReactNode, 
  trend?: string, 
  trendUp?: boolean,
  subtext?: string
}) {
  return (
    <div className="glass-panel p-6 rounded-md relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
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
}

