import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import {
  ArrowLeft,
  Truck,
  Phone,
  Mail,
  MapPin,
  Plus,
  ClipboardList,
  Send,
  Wallet,
  Package,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

export default async function SupplierLedgerPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params

  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: true,
          quotation: { select: { id: true, client: { select: { name: true } } } },
        },
      },
      purchases: {
        orderBy: { date: "desc" },
        include: {
          quotation: { select: { id: true, client: { select: { name: true } } } },
        },
      },
      productSuppliers: {
        include: { product: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  })

  if (!supplier) notFound()

  const validPOs = supplier.purchaseOrders.filter(
    (po) => po.status !== "DRAFT" && po.status !== "CANCELLED"
  )

  const poBilled = validPOs.reduce((sum, po) => sum + po.totalAmount + po.totalGst, 0)
  const poPaid = validPOs.reduce((sum, po) => sum + po.amountPaid, 0)

  const purchaseBilled = supplier.purchases.reduce(
    (sum, p) => sum + p.totalAmount + p.totalGst,
    0
  )
  const purchasePaid = supplier.purchases.reduce((sum, p) => sum + p.amountPaid, 0)

  const totalBilled = poBilled + purchaseBilled
  const totalPaid = poPaid + purchasePaid
  const outstanding = Math.max(0, totalBilled - totalPaid)

  const ledgerEntries = [
    ...supplier.purchaseOrders.map((po) => ({
      id: po.id,
      date: new Date(po.createdAt),
      type: "Purchase Order",
      number: po.poNumber || `#${po.id.slice(-6).toUpperCase()}`,
      status: po.status,
      quotation: po.quotation,
      billed:
        po.status !== "DRAFT" && po.status !== "CANCELLED"
          ? po.totalAmount + po.totalGst
          : 0,
      rawTotal: po.totalAmount + po.totalGst,
      paid: po.amountPaid,
      link: `/purchase-orders/${po.id}`,
    })),
    ...supplier.purchases.map((p) => ({
      id: p.id,
      date: new Date(p.date),
      type: "Direct Purchase",
      number: `PUR-${p.id.slice(-6).toUpperCase()}`,
      status: "RECEIVED",
      quotation: p.quotation,
      billed: p.totalAmount + p.totalGst,
      rawTotal: p.totalAmount + p.totalGst,
      paid: p.amountPaid,
      link: `/purchases?action=edit-purchase&id=${p.id}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="space-y-6">
      {/* Supplier 360 Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link
              href="/suppliers"
              className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors mt-0.5"
              title="Back to Suppliers"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {supplier.name}
                </h1>
                {supplier.gstNumber && (
                  <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-md">
                    GSTIN: {supplier.gstNumber}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                {supplier.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {supplier.location}
                  </span>
                )}
                {supplier.contact && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {supplier.contact}
                  </span>
                )}
                {supplier.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {supplier.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/purchase-orders/new?supplierId=${supplier.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Purchase Order
            </Link>
            <Link
              href="/rfq/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-blue-600" /> Send RFQ
            </Link>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Record Payment
            </Link>
          </div>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Billed (Incl. GST)
            </p>
            <ShoppingCart className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {formatRupee(totalBilled)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {validPOs.length} POs + {supplier.purchases.length} direct purchases
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Total Paid
            </p>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-700">
            {formatRupee(totalPaid)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Payments settled with vendor</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Payable Balance Due
            </p>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600">
            {formatRupee(outstanding)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {outstanding > 0 ? "Remaining amount owed to vendor" : "All bills settled"}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Supplied Catalog Products
            </p>
            <Package className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {supplier.productSuppliers.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Items with saved vendor cost price</p>
        </div>
      </div>

      {/* Procurement Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            Procurement & Payment Ledger ({ledgerEntries.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All Purchase Orders and Direct Purchases recorded with {supplier.name}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Order Ref</th>
                <th className="py-3.5 px-4 font-semibold">Linked Client Quote</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Billed (Incl. GST)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Paid</th>
                <th className="py-3.5 px-4 font-semibold text-right">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerEntries.map((entry) => {
                const balance = Math.max(0, entry.billed - entry.paid)
                return (
                  <tr
                    key={`${entry.type}-${entry.id}`}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {entry.date.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
                          entry.type === "Purchase Order"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-violet-50 text-violet-700 border-violet-200"
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={entry.link}
                        className="text-orange-600 hover:underline font-mono font-bold text-xs"
                      >
                        {entry.number}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      {entry.quotation ? (
                        <Link
                          href={`/quotations/${entry.quotation.id}`}
                          className="text-xs font-mono text-slate-700 hover:text-orange-600 hover:underline"
                        >
                          #{entry.quotation.id.slice(-6).toUpperCase()} (
                          {entry.quotation.client.name})
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Stock / Direct</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${
                          ["ISSUED", "ACKNOWLEDGED", "RECEIVED", "COMPLETED"].includes(
                            entry.status
                          )
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : entry.status === "CANCELLED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupee(entry.rawTotal)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                      {entry.paid > 0 ? formatRupee(entry.paid) : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {entry.billed === 0 ? (
                        <span className="text-xs text-slate-400">Draft/Cancelled</span>
                      ) : balance > 0 ? (
                        <span className="font-bold text-rose-600">{formatRupee(balance)}</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          PAID
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {ledgerEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No Purchase Orders or Direct Purchases recorded for this supplier yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplied Products & Vendor Cost Prices */}
      {supplier.productSuppliers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Supplied Products & Vendor Cost Rates ({supplier.productSuppliers.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Catalog items linked to {supplier.name} along with their Cost Price (CP) and Catalog Selling Price (SP)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Material Code</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold text-center">UOM</th>
                  <th className="py-3 px-4 font-semibold text-right">Vendor Cost Price (CP)</th>
                  <th className="py-3 px-4 font-semibold text-right">Catalog Selling Price (SP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplier.productSuppliers.map((ps) => (
                  <tr key={ps.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/products/${ps.productId}/edit`}
                        className="font-mono text-xs font-bold text-orange-600 hover:underline"
                      >
                        {ps.product.materialCode}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {ps.product.materialDescription}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs text-slate-500">
                      {ps.product.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupee(ps.costPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                      {ps.product.sellingPrice > 0
                        ? formatRupee(ps.product.sellingPrice)
                        : "—"}
                    </td>
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
