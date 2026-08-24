import { prisma } from "@/lib/prisma"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Purchases"
}
import { Plus, TrendingUp, TrendingDown, IndianRupee, Package, Truck, ReceiptText, Building2 } from "lucide-react"
import Link from "next/link"
import { formatRupee } from "@/lib/utils"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deletePurchases } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { PurchaseModal } from "@/components/PurchaseModal"
import { ClickableRow } from "@/components/ClickableRow"

export default async function PurchasesPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search ? {
    OR: [
      { id: { contains: search } },
      { supplier: { name: { contains: search } } },
    ]
  } : {}

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      supplier: true,
      items: {
        include: {
          product: true
        }
      }
    }
  })

  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } })
  const products = await prisma.product.findMany({ select: { id: true, materialCode: true, materialDescription: true, costPrice: true } })
  const quotations = await prisma.quotation.findMany({
    where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
    select: { id: true, prNo: true, client: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  })

  // ── Dashboard Metrics ──
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const thisMonthPurchases = purchases.filter(p => new Date(p.date) >= thisMonthStart)
  const lastMonthPurchases = purchases.filter(p => {
    const d = new Date(p.date)
    return d >= lastMonthStart && d <= lastMonthEnd
  })

  const totalPurchaseAmount = purchases.reduce((s, p) => s + p.totalAmount, 0)
  const totalPurchaseGst = purchases.reduce((s, p) => s + p.totalGst, 0)
  const thisMonthAmount = thisMonthPurchases.reduce((s, p) => s + p.totalAmount, 0)
  const lastMonthAmount = lastMonthPurchases.reduce((s, p) => s + p.totalAmount, 0)

  const monthTrend = lastMonthAmount > 0 
    ? Math.round(((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100) 
    : (thisMonthAmount > 0 ? 100 : 0)

  // Top suppliers by purchase volume
  const supplierMap = new Map<string, { name: string, total: number, count: number }>()
  for (const p of purchases) {
    const existing = supplierMap.get(p.supplierId)
    if (existing) {
      existing.total += p.totalAmount
      existing.count += 1
    } else {
      supplierMap.set(p.supplierId, { name: p.supplier.name, total: p.totalAmount, count: 1 })
    }
  }
  const topSuppliers = [...supplierMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Top purchased items
  const itemMap = new Map<string, { code: string, desc: string, totalQty: number, totalValue: number }>()
  for (const p of purchases) {
    for (const item of p.items) {
      const existing = itemMap.get(item.productId)
      if (existing) {
        existing.totalQty += item.quantity
        existing.totalValue += item.quantity * item.cpSnapshot
      } else {
        itemMap.set(item.productId, {
          code: item.product.materialCode,
          desc: item.product.materialDescription,
          totalQty: item.quantity,
          totalValue: item.quantity * item.cpSnapshot
        })
      }
    }
  }
  const topItems = [...itemMap.values()]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5)

  // Average purchase value
  const avgPurchaseValue = purchases.length > 0 ? Math.round(totalPurchaseAmount / purchases.length) : 0

  // Monthly data for mini chart (last 6 months)
  const monthLabels: string[] = []
  const monthValues: number[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    monthLabels.push(d.toLocaleString('default', { month: 'short' }))
    const val = purchases
      .filter(p => { const pd = new Date(p.date); return pd >= d && pd <= end })
      .reduce((s, p) => s + p.totalAmount, 0)
    monthValues.push(val)
  }
  const maxMonthVal = Math.max(...monthValues, 1)

  return (
    <SelectionProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Purchases</h1>
            <p className="text-zinc-400 mt-2">Manage your purchases and stock intake.</p>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar placeholder="Search purchases..." />
            <BatchDeleteButton deleteAction={deletePurchases} entityName="purchases" />
            <Link 
              href="?action=new-purchase"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Record Purchase</span>
            </Link>
          </div>
        </div>

        {/* ── Dashboard Metric Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Purchases</p>
              <IndianRupee className="w-4 h-4 text-zinc-600" />
            </div>
            <p className="text-xl font-bold text-white mt-2">{formatRupee(totalPurchaseAmount)}</p>
            <p className="text-xs text-zinc-500 mt-1">{purchases.length} transactions</p>
          </div>
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">This Month</p>
              {monthTrend >= 0 
                ? <TrendingUp className="w-4 h-4 text-rose-400" /> 
                : <TrendingDown className="w-4 h-4 text-emerald-400" />
              }
            </div>
            <p className="text-xl font-bold text-white mt-2">{formatRupee(thisMonthAmount)}</p>
            <p className={`text-xs mt-1 ${monthTrend >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {monthTrend >= 0 ? '+' : ''}{monthTrend}% vs last month
            </p>
          </div>
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Input GST (Tax Credit)</p>
              <ReceiptText className="w-4 h-4 text-zinc-600" />
            </div>
            <p className="text-xl font-bold text-blue-400 mt-2">{formatRupee(totalPurchaseGst)}</p>
            <p className="text-xs text-zinc-500 mt-1">Claimable ITC</p>
          </div>
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Avg. Purchase Value</p>
              <Package className="w-4 h-4 text-zinc-600" />
            </div>
            <p className="text-xl font-bold text-white mt-2">{formatRupee(avgPurchaseValue)}</p>
            <p className="text-xs text-zinc-500 mt-1">Per transaction</p>
          </div>
        </div>

        {/* ── Mini Monthly Chart + Top Suppliers + Top Items ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Monthly Trend (simple bar chart) */}
          <div className="glass-panel rounded-md p-5 border border-premium-border">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-4">Monthly Spend (6 months)</p>
            <div className="flex items-end gap-2 h-28">
              {monthValues.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-brand-orange/30 hover:bg-brand-orange/50 transition-colors rounded-t-sm" 
                    style={{ height: `${Math.max((v / maxMonthVal) * 100, 4)}%` }}
                    title={formatRupee(v)}
                  />
                  <span className="text-[10px] text-zinc-500">{monthLabels[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Suppliers */}
          <div className="glass-panel rounded-md p-5 border border-premium-border">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-zinc-500" />
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Top Suppliers</p>
            </div>
            <div className="space-y-3">
              {topSuppliers.length === 0 ? (
                <p className="text-xs text-zinc-500">No data yet.</p>
              ) : topSuppliers.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}.</span>
                    <span className="text-sm text-zinc-300 truncate">{s.name}</span>
                  </div>
                  <div className="text-right flex-none ml-3">
                    <p className="text-sm font-medium text-white">{formatRupee(s.total)}</p>
                    <p className="text-[10px] text-zinc-500">{s.count} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Purchased Items */}
          <div className="glass-panel rounded-md p-5 border border-premium-border">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-4 h-4 text-zinc-500" />
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Top Items Purchased</p>
            </div>
            <div className="space-y-3">
              {topItems.length === 0 ? (
                <p className="text-xs text-zinc-500">No data yet.</p>
              ) : topItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-300 truncate">{item.code}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{item.desc}</p>
                    </div>
                  </div>
                  <div className="text-right flex-none ml-3">
                    <p className="text-sm font-medium text-white">{formatRupee(item.totalValue)}</p>
                    <p className="text-[10px] text-zinc-500">Qty: {item.totalQty}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Purchase Records Table ── */}
        <div className="glass-panel rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
                <tr>
                  <th className="px-6 py-5 w-12"><SelectAllCheckbox allIds={purchases.map(p => p.id)} /></th>
                  <th className="px-6 py-5 font-medium tracking-wider">ID</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Supplier</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Date</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Items</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Total Amount</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Total GST</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Grand Total</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Payment Status</th>
                  <th className="px-6 py-5 font-medium tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-premium-border">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-zinc-500">
                      No purchases recorded.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <ClickableRow 
                      key={purchase.id} 
                      href={`?action=edit-purchase&id=${purchase.id}`}
                      className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4"><RowCheckbox id={purchase.id} /></td>
                      <td className="px-6 py-4 font-medium text-white font-mono text-xs">{purchase.id.slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-4 text-zinc-300 font-medium group-hover:text-brand-orange transition-colors">{purchase.supplier.name}</td>
                      <td className="px-6 py-4 text-zinc-300">{new Date(purchase.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-zinc-400">{purchase.items.length} items</td>
                      <td className="px-6 py-4 font-medium text-white">{formatRupee(purchase.totalAmount)}</td>
                      <td className="px-6 py-4 text-zinc-300">{formatRupee(purchase.totalGst)}</td>
                      <td className="px-6 py-4 font-medium text-white">{formatRupee(purchase.totalAmount + purchase.totalGst)}</td>
                      <td className="px-6 py-4">
                        {purchase.paymentStatus === "PAID" && <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-medium">PAID</span>}
                        {purchase.paymentStatus === "PARTIALLY_PAID" && <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-xs font-medium">PARTIAL</span>}
                        {purchase.paymentStatus === "UNPAID" && <span className="px-2 py-1 bg-rose-500/10 text-rose-500 rounded text-xs font-medium">UNPAID</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`?action=edit-purchase&id=${purchase.id}`} className="text-brand-slate hover:text-slate-400 font-medium">Edit</Link>
                      </td>
                    </ClickableRow>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <PurchaseModal suppliers={suppliers} products={products} purchases={purchases} quotations={quotations} />
      </div>
    </SelectionProvider>
  )
}
