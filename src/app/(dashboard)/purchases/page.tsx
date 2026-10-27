import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import {
  Plus,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Package,
  Truck,
  ReceiptText,
  Building2,
  Info,
  ArrowRight,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { formatRupee } from "@/lib/utils"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deletePurchases } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { PurchaseModal } from "@/components/PurchaseModal"

export const metadata: Metadata = {
  title: "Direct Purchases & Bills",
}

export default async function PurchasesPage(props: {
  searchParams: Promise<{ search?: string }>
}) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search
    ? {
        OR: [{ id: { contains: search } }, { supplier: { name: { contains: search } } }],
      }
    : {}

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      supplier: true,
      quotation: {
        select: {
          id: true,
          prNo: true,
          client: { select: { name: true } },
        },
      },
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } })
  const products = await prisma.product.findMany({
    select: { id: true, materialCode: true, materialDescription: true, costPrice: true },
  })
  const quotations = await prisma.quotation.findMany({
    where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
    select: {
      id: true,
      prNo: true,
      client: { select: { name: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // ── Dashboard Metrics ──
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const thisMonthPurchases = purchases.filter((p) => new Date(p.date) >= thisMonthStart)
  const lastMonthPurchases = purchases.filter((p) => {
    const d = new Date(p.date)
    return d >= lastMonthStart && d <= lastMonthEnd
  })

  const totalPurchaseAmount = purchases.reduce((s, p) => s + p.totalAmount, 0)
  const totalPurchaseGst = purchases.reduce((s, p) => s + p.totalGst, 0)
  const thisMonthAmount = thisMonthPurchases.reduce((s, p) => s + p.totalAmount, 0)
  const lastMonthAmount = lastMonthPurchases.reduce((s, p) => s + p.totalAmount, 0)

  const monthTrend =
    lastMonthAmount > 0
      ? Math.round(((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100)
      : thisMonthAmount > 0
      ? 100
      : 0

  // Top suppliers by purchase volume
  const supplierMap = new Map<string, { id: string; name: string; total: number; count: number }>()
  for (const p of purchases) {
    const existing = supplierMap.get(p.supplierId)
    if (existing) {
      existing.total += p.totalAmount
      existing.count += 1
    } else {
      supplierMap.set(p.supplierId, {
        id: p.supplierId,
        name: p.supplier.name,
        total: p.totalAmount,
        count: 1,
      })
    }
  }
  const topSuppliers = [...supplierMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  // Top purchased items
  const itemMap = new Map<
    string,
    { id: string; code: string; desc: string; totalQty: number; totalValue: number }
  >()
  for (const p of purchases) {
    for (const item of p.items) {
      const existing = itemMap.get(item.productId)
      if (existing) {
        existing.totalQty += item.quantity
        existing.totalValue += item.quantity * item.cpSnapshot
      } else {
        itemMap.set(item.productId, {
          id: item.productId,
          code: item.product.materialCode,
          desc: item.product.materialDescription,
          totalQty: item.quantity,
          totalValue: item.quantity * item.cpSnapshot,
        })
      }
    }
  }
  const topItems = [...itemMap.values()].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5)

  const avgPurchaseValue =
    purchases.length > 0 ? Math.round(totalPurchaseAmount / purchases.length) : 0

  // Monthly data for mini chart (last 6 months)
  const monthLabels: string[] = []
  const monthValues: number[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    monthLabels.push(d.toLocaleString("default", { month: "short" }))
    const val = purchases
      .filter((p) => {
        const pd = new Date(p.date)
        return pd >= d && pd <= end
      })
      .reduce((s, p) => s + p.totalAmount, 0)
    monthValues.push(val)
  }
  const maxMonthVal = Math.max(...monthValues, 1)

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-black uppercase tracking-wider">
                Direct Vendor Bills
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Direct Purchases & Stock Intake
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Record direct cash/credit vendor bills, off-the-shelf purchases, and GST Input Tax Credit (ITC).
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <SearchBar placeholder="Search supplier, purchase ID..." />
            <BatchDeleteButton deleteAction={deletePurchases} entityName="purchases" />
            <Link
              href="?action=new-purchase"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
              <span className="text-white">Record Purchase Bill</span>
            </Link>
          </div>
        </div>

        {/* Layman Guide Banner */}
        <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Direct Purchases vs. Formal Purchase Orders (POs)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Use <strong>Direct Purchases</strong> when you buy stock immediately from a vendor counter or receive a direct bill without issuing a formal PO first. If you need a printable PDF order, delivery tracking, and duplicate-order protection against a client quote, use{" "}
                <Link href="/purchase-orders" className="underline font-semibold text-orange-600">
                  Purchase Orders
                </Link>{" "}
                instead.
              </p>
            </div>
          </div>
          <Link
            href="/purchase-orders"
            className="text-xs font-bold text-orange-600 hover:text-orange-700 whitespace-nowrap flex items-center gap-1 self-end md:self-center"
          >
            Go to Formal POs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ── Dashboard Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Total Direct Purchases
              </p>
              <IndianRupee className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {formatRupee(totalPurchaseAmount)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{purchases.length} recorded bills</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                This Month Spend
              </p>
              {monthTrend >= 0 ? (
                <TrendingUp className="w-4 h-4 text-rose-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {formatRupee(thisMonthAmount)}
            </p>
            <p
              className={`text-xs mt-1 font-medium ${
                monthTrend >= 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {monthTrend >= 0 ? "+" : ""}
              {monthTrend}% vs last month
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Input GST (Tax Credit)
              </p>
              <ReceiptText className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1 font-mono">
              {formatRupee(totalPurchaseGst)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Claimable GST ITC</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Avg. Bill Value
              </p>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {formatRupee(avgPurchaseValue)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Excl. GST per bill</p>
          </div>
        </div>

        {/* ── Mini Monthly Chart + Top Suppliers + Top Items ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Monthly Trend */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-4">
              Monthly Spend (Last 6 Months)
            </p>
            <div className="flex items-end gap-2.5 h-28">
              {monthValues.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full bg-orange-500/80 hover:bg-orange-600 transition-colors rounded-t-md"
                    style={{ height: `${Math.max((v / maxMonthVal) * 100, 6)}%` }}
                    title={formatRupee(v)}
                  />
                  <span className="text-[11px] font-medium text-slate-500">{monthLabels[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Suppliers */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                Top Vendors by Volume
              </p>
            </div>
            <div className="space-y-2.5">
              {topSuppliers.length === 0 ? (
                <p className="text-xs text-slate-400">No purchase data yet.</p>
              ) : (
                topSuppliers.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-slate-400 font-mono w-4">{i + 1}.</span>
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="text-sm font-semibold text-slate-800 hover:text-orange-600 truncate"
                      >
                        {s.name}
                      </Link>
                    </div>
                    <div className="text-right flex-none ml-3">
                      <p className="text-xs font-mono font-bold text-slate-900">
                        {formatRupee(s.total)}
                      </p>
                      <p className="text-[10px] text-slate-400">{s.count} bills</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Purchased Items */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                Top Purchased Materials
              </p>
            </div>
            <div className="space-y-2.5">
              {topItems.length === 0 ? (
                <p className="text-xs text-slate-400">No item data yet.</p>
              ) : (
                topItems.map((item, i) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-slate-400 font-mono w-4">{i + 1}.</span>
                      <div className="min-w-0">
                        <Link
                          href={`/products/${item.id}/edit`}
                          className="text-xs font-mono font-bold text-slate-800 hover:text-orange-600 truncate block"
                        >
                          {item.code}
                        </Link>
                        <p className="text-[11px] text-slate-500 truncate">{item.desc}</p>
                      </div>
                    </div>
                    <div className="text-right flex-none ml-3">
                      <p className="text-xs font-mono font-bold text-slate-900">
                        {formatRupee(item.totalValue)}
                      </p>
                      <p className="text-[10px] text-slate-400">Qty: {item.totalQty}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Purchase Records Table ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <SelectAllCheckbox allIds={purchases.map((p) => p.id)} />
                  </th>
                  <th className="px-4 py-3.5 font-semibold">Bill ID & Date</th>
                  <th className="px-4 py-3.5 font-semibold">Supplier</th>
                  <th className="px-4 py-3.5 font-semibold">Linked Quotation</th>
                  <th className="px-4 py-3.5 font-semibold">Purchased Items</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Subtotal</th>
                  <th className="px-4 py-3.5 font-semibold text-right">GST</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Grand Total</th>
                  <th className="px-4 py-3.5 font-semibold">Payment Status</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-slate-500">
                      No direct purchases recorded.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr
                      key={purchase.id}
                      className="hover:bg-slate-50/90 transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <RowCheckbox id={purchase.id} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 font-mono text-xs">
                          #{purchase.id.slice(-6).toUpperCase()}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(purchase.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/suppliers/${purchase.supplierId}`}
                          className="text-slate-900 font-semibold hover:text-orange-600 transition-colors"
                        >
                          {purchase.supplier.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        {purchase.quotation ? (
                          <Link
                            href={`/quotations/${purchase.quotation.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold hover:bg-orange-100"
                          >
                            <FileText className="w-3 h-3" />
                            #{purchase.quotation.prNo || purchase.quotation.id.slice(-6).toUpperCase()}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Stock / General</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {purchase.items.slice(0, 2).map((i) => (
                            <span
                              key={i.id}
                              className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700"
                            >
                              {i.product.materialCode} ×{i.quantity}
                            </span>
                          ))}
                          {purchase.items.length > 2 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-500">
                              +{purchase.items.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-right text-slate-700">
                        {formatRupee(purchase.totalAmount)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-right text-slate-500">
                        {formatRupee(purchase.totalGst)}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-right text-slate-900">
                        {formatRupee(purchase.totalAmount + purchase.totalGst)}
                      </td>
                      <td className="px-4 py-3.5">
                        {purchase.paymentStatus === "PAID" && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                            PAID
                          </span>
                        )}
                        {purchase.paymentStatus === "PARTIALLY_PAID" && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
                            PARTIAL
                          </span>
                        )}
                        {purchase.paymentStatus === "UNPAID" && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[11px] font-bold">
                            UNPAID
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`?action=edit-purchase&id=${purchase.id}`}
                          className="text-xs font-semibold text-orange-600 hover:text-orange-700 px-2.5 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
                        >
                          Edit Bill
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <PurchaseModal
          suppliers={suppliers}
          products={products}
          purchases={purchases}
          quotations={quotations}
        />
      </div>
    </SelectionProvider>
  )
}
