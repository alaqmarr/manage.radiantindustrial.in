import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { formatRupee, formatShortId } from "@/lib/utils"
import {
  Plus,
  Eye,
  FileEdit,
  FileText,
  Info,
  ArrowRight,
  Truck,
  FileSpreadsheet,
} from "lucide-react"
import { POStatusBadge } from "@/components/POStatusBadge"
import { SearchBar } from "@/components/SearchBar"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deletePurchaseOrders } from "@/app/actions/batchDelete"

export const dynamic = "force-dynamic"

export default async function PurchaseOrdersPage(props: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""
  const statusFilter = searchParams.status || ""

  const where: any = {}
  if (search) {
    where.OR = [
      { id: { contains: search } },
      { poNumber: { contains: search } },
      { supplier: { name: { contains: search } } },
      { quotation: { prNo: { contains: search } } },
      { quotation: { client: { name: { contains: search } } } },
    ]
  }
  if (statusFilter) {
    where.status = statusFilter
  }

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true } },
      quotation: {
        select: {
          id: true,
          prNo: true,
          client: { select: { id: true, name: true } },
        },
      },
      rfq: { select: { id: true } },
      items: {
        include: {
          product: {
            select: { id: true, materialCode: true, materialDescription: true },
          },
        },
      },
      deliveries: {
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  // Metrics across all active (non-cancelled) POs
  const activePos = pos.filter((p) => p.status !== "CANCELLED")
  const totalPoSpendInclGst = activePos.reduce((s, p) => s + p.totalAmount + p.totalGst, 0)
  const totalPaidToVendors = activePos.reduce((s, p) => s + p.amountPaid, 0)
  const totalPayablesDue = Math.max(0, totalPoSpendInclGst - totalPaidToVendors)
  const deliveredCount = pos.filter(
    (p) => p.status === "DELIVERED" || p.status === "COMPLETED"
  ).length

  const statuses = ["DRAFT", "ISSUED", "DELIVERED", "COMPLETED", "CANCELLED"]

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                Step C · Vendor Procurement
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Issue official Purchase Orders to suppliers, track goods deliveries, and manage vendor payment balances.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <SearchBar placeholder="Search PO #, supplier, quotation..." />
            <BatchDeleteButton deleteAction={deletePurchaseOrders} entityName="purchase orders" />
            <Link
              href="/purchase-orders/new"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
              <span className="text-white">Create PO</span>
            </Link>
          </div>
        </div>

        {/* Layman Workflow Guide Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                How Supplier Purchase Orders Work (Duplicate-Safe)
              </h2>
              <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
                <strong>1. Link to Quotation or RFQ:</strong> Create a PO directly from an accepted{" "}
                <Link href="/quotations" className="underline font-semibold">Client Quotation</Link> or{" "}
                <Link href="/rfq" className="underline font-semibold">Vendor RFQ</Link>. The system automatically tracks ordered quantities per item and blocks duplicate POs for already-ordered items.{" "}
                <strong>2. Track Delivery & Payables:</strong> Open any PO to log partial/full material deliveries and record supplier payments in{" "}
                <Link href="/accounts" className="underline font-semibold">Accounts & Ledger</Link>.
              </p>
            </div>
          </div>
          <Link
            href="/cocs"
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 whitespace-nowrap flex items-center gap-1 self-end md:self-center"
          >
            Issue Quality COC <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Active PO Spend (Incl. GST)
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {formatRupee(totalPoSpendInclGst)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{activePos.length} active purchase orders</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Paid to Suppliers
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">
              {formatRupee(totalPaidToVendors)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Recorded vendor disbursements</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Payables Due
            </p>
            <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
              {formatRupee(totalPayablesDue)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Pending balance to suppliers</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Delivered / Completed
            </p>
            <p className="text-xl font-bold text-blue-700 mt-1 font-mono">
              {deliveredCount} / {activePos.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">Orders received from vendors</p>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/purchase-orders"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              !statusFilter
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            All Statuses
          </Link>
          {statuses.map((st) => (
            <Link
              key={st}
              href={`/purchase-orders?status=${st}`}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                statusFilter === st
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {st}
            </Link>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <SelectAllCheckbox allIds={pos.map((po) => po.id)} />
                  </th>
                  <th className="px-4 py-3.5 font-semibold">PO Number & Date</th>
                  <th className="px-4 py-3.5 font-semibold">Supplier (Vendor)</th>
                  <th className="px-4 py-3.5 font-semibold">Linked Quotation / RFQ</th>
                  <th className="px-4 py-3.5 font-semibold">Ordered Items</th>
                  <th className="px-4 py-3.5 font-semibold">Order Status</th>
                  <th className="px-4 py-3.5 font-semibold">Payment Status</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Grand Total (Incl. GST)</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                      No purchase orders found. Click <strong>Create PO</strong> to issue one.
                    </td>
                  </tr>
                ) : (
                  pos.map((po) => {
                    const grandTotal = po.totalAmount + po.totalGst
                    const balanceDue = Math.max(0, grandTotal - po.amountPaid)

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/90 transition-colors group">
                        <td className="px-4 py-3.5">
                          <RowCheckbox id={po.id} />
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="font-mono font-bold text-slate-900 hover:text-orange-600 transition-colors text-xs block"
                          >
                            #{po.poNumber || formatShortId(po.id)}
                          </Link>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/suppliers/${po.supplier.id}`}
                            className="text-slate-900 font-semibold hover:text-orange-600 transition-colors inline-flex items-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            {po.supplier.name}
                          </Link>
                          {po.deliveries.length > 0 && (
                            <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                              {po.deliveries.length} delivery log(s)
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            {po.quotation ? (
                              <Link
                                href={`/quotations/${po.quotation.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold hover:bg-orange-100 transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                <span>
                                  #{formatShortId(po.quotation.id)} •{" "}
                                  {po.quotation.client.name}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">Direct Stock PO</span>
                            )}
                            {po.rfq && (
                              <Link
                                href={`/rfq/${po.rfq.id}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold hover:bg-blue-100"
                              >
                                <FileSpreadsheet className="w-3 h-3" />
                                RFQ #{formatShortId(po.rfq.id)}
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {po.items.slice(0, 2).map((item) => (
                              <span
                                key={item.id}
                                className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700"
                                title={item.product.materialDescription}
                              >
                                {item.product.materialCode} ×{item.quantity}
                              </span>
                            ))}
                            {po.items.length > 2 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-500">
                                +{po.items.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <POStatusBadge id={po.id} currentStatus={po.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          {po.paymentStatus === "PAID" && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              PAID
                            </span>
                          )}
                          {po.paymentStatus === "PARTIALLY_PAID" && (
                            <div>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                PARTIAL
                              </span>
                              <div className="text-[11px] font-mono text-rose-600 mt-0.5">
                                Due: {formatRupee(balanceDue)}
                              </div>
                            </div>
                          )}
                          {po.paymentStatus === "UNPAID" && (
                            <div>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                UNPAID
                              </span>
                              {po.status !== "CANCELLED" && po.status !== "DRAFT" && (
                                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  Due: {formatRupee(balanceDue)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-right">
                          <div className="font-bold text-slate-900">{formatRupee(grandTotal)}</div>
                          <div className="text-[11px] text-slate-400">
                            {formatRupee(po.totalAmount)} + GST
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/purchase-orders/${po.id}`}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-orange-700 bg-slate-100 hover:bg-orange-50 rounded-md transition-colors flex items-center gap-1"
                              title="View Purchase Order"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </Link>
                            <Link
                              href={`/purchase-orders/${po.id}/edit`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                              title="Edit PO"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                            </Link>
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
      </div>
    </SelectionProvider>
  )
}
