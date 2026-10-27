import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import {
  Plus,
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Info,
  ArrowRight,
  Building2,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { formatRupee, formatShortId } from "@/lib/utils"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteQuotations } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { QuotationStatusBadge } from "@/components/QuotationStatusBadge"

export const metadata: Metadata = {
  title: "Client Quotations",
}

export default async function QuotationsPage(props: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""
  const statusFilter = searchParams.status || ""

  const where: any = {}

  if (search) {
    where.OR = [
      { id: { contains: search } },
      { prNo: { contains: search } },
      { rfqNo: { contains: search } },
      { client: { name: { contains: search } } },
    ]
  }

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      items: {
        include: {
          product: {
            select: { id: true, materialCode: true, materialDescription: true, unit: true },
          },
        },
      },
      purchaseOrders: {
        where: { status: { not: "CANCELLED" } },
        include: {
          items: true,
        },
      },
      cocs: {
        select: { id: true },
      },
    },
  })

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  })

  const drafts = quotations.filter((q) => q.status === "DRAFT")
  const pending = quotations.filter((q) => q.status === "PENDING")
  const accepted = quotations.filter((q) => q.status === "ACCEPTED")
  const completed = quotations.filter((q) => q.status === "COMPLETED")
  const rejected = quotations.filter((q) => q.status === "REJECTED")

  const totalQuoted = quotations.reduce((s, q) => s + q.totalAmount, 0)
  const allSuccessful = [...accepted, ...completed]
  const totalAcceptedValue = allSuccessful.reduce((s, q) => s + q.totalAmount, 0)
  const totalProfit = allSuccessful.reduce(
    (s, q) =>
      s +
      q.items
        .filter((item) => item.isConfirmed !== false)
        .reduce((sum, item) => {
          const cp = item.cpSnapshot || 0
          const sp = item.spSnapshot || 0
          const addnl = item.additionalCost || 0
          return sum + ((sp - cp) * item.quantity - addnl)
        }, 0),
    0
  )
  const conversionRate =
    quotations.length > 0 ? Math.round((allSuccessful.length / quotations.length) * 100) : 0

  const statusGroups = [
    {
      key: "ACCEPTED",
      label: "Accepted Orders (Ready for PO / Delivery)",
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-emerald-800 border-emerald-200 bg-emerald-50",
      dotColor: "bg-emerald-600",
      items: accepted,
    },
    {
      key: "PENDING",
      label: "Pending Client Review",
      icon: <Clock className="w-4 h-4" />,
      color: "text-blue-800 border-blue-200 bg-blue-50",
      dotColor: "bg-blue-600",
      items: pending,
    },
    {
      key: "DRAFT",
      label: "Drafts & In Progress",
      icon: <FileEdit className="w-4 h-4" />,
      color: "text-slate-700 border-slate-200 bg-slate-100/80",
      dotColor: "bg-slate-500",
      items: drafts,
    },
    {
      key: "COMPLETED",
      label: "Completed & Fulfilled",
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-teal-800 border-teal-200 bg-teal-50",
      dotColor: "bg-teal-600",
      items: completed,
    },
    {
      key: "REJECTED",
      label: "Rejected / Lost",
      icon: <XCircle className="w-4 h-4" />,
      color: "text-rose-800 border-rose-200 bg-rose-50",
      dotColor: "bg-rose-600",
      items: rejected,
    },
  ]

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-black uppercase tracking-wider">
                Step B · Sales & Proposals
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Client Quotations
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Prepare commercial GST proposals, track profit margins over vendor cost, and convert won orders into Supplier POs.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <SearchBar placeholder="Search client, PR No, RFQ..." />
            <BatchDeleteButton deleteAction={deleteQuotations} entityName="quotations" />
            <Link
              href="/quotations/new"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
              <span className="text-white">Create Quotation</span>
            </Link>
          </div>
        </div>

        {/* Layman Workflow Guide Banner */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                How Quotations Connect to Procurement & Accounts
              </h2>
              <p className="text-xs text-blue-900 mt-0.5 leading-relaxed">
                <strong>1. Draft & Send:</strong> Select a <Link href="/clients" className="underline font-semibold">Client</Link> and add <Link href="/products" className="underline font-semibold">Catalog Products</Link> with your Selling Price (SP) and Vendor Cost Price (CP).{" "}
                <strong>2. Mark Accepted:</strong> When the client approves, change status to <strong>ACCEPTED</strong>.{" "}
                <strong>3. Issue Supplier PO & COC:</strong> Click <strong>+ Issue PO</strong> to order items from your vendor (duplicate POs are automatically blocked) and issue a <Link href="/cocs" className="underline font-semibold">Certificate of Conformance (COC)</Link>.
              </p>
            </div>
          </div>
          <Link
            href="/purchase-orders"
            className="text-xs font-bold text-blue-800 hover:text-blue-950 whitespace-nowrap flex items-center gap-1 self-end md:self-center"
          >
            Go to Step C: Supplier POs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Total Pipeline (Excl. GST)
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {formatRupee(totalQuoted)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{quotations.length} total quotations</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Won / Accepted Value
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">
              {formatRupee(totalAcceptedValue)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{allSuccessful.length} won / fulfilled</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Est. Net Profit (Won)
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">
              {formatRupee(totalProfit)}
            </p>
            <p className="text-xs text-slate-400 mt-1">SP minus Vendor CP & freight</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Win Conversion Rate
            </p>
            <p className="text-xl font-bold text-orange-600 mt-1 font-mono">{conversionRate}%</p>
            <p className="text-xs text-slate-400 mt-1">
              {allSuccessful.length} of {quotations.length} converted
            </p>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/quotations"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              !statusFilter
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            All ({quotations.length})
          </Link>
          {statusGroups.map((g) => (
            <Link
              key={g.key}
              href={`/quotations?status=${g.key}`}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                statusFilter === g.key
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {g.key} ({g.items.length})
            </Link>
          ))}
        </div>

        {/* Grouped Tables */}
        {statusGroups.map((group) => {
          if (group.items.length === 0) return null
          if (statusFilter && statusFilter !== group.key) return null

          return (
            <div key={group.key} className="space-y-2.5">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${group.color}`}>
                <div className={`w-2 h-2 rounded-full ${group.dotColor}`} />
                {group.icon}
                <span className="text-xs font-bold uppercase tracking-wider">{group.label}</span>
                <span className="text-xs font-semibold opacity-75">({group.items.length})</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5 w-10">
                          <SelectAllCheckbox allIds={group.items.map((q) => q.id)} />
                        </th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider">Quote & Refs</th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider">Client</th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider">Line Items Preview</th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider">PO & COC Fulfillment</th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider">Status</th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                          Value (Excl. / Incl. GST)
                        </th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                          Est. Profit
                        </th>
                        <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {group.items.map((quote) => {
                        // Compute PO fulfillment across confirmed items
                        const orderedMap = new Map<string, number>()
                        for (const po of quote.purchaseOrders) {
                          for (const pi of po.items) {
                            orderedMap.set(pi.productId, (orderedMap.get(pi.productId) || 0) + pi.quantity)
                          }
                        }
                        const confirmedItems = quote.items.filter((i) => i.isConfirmed !== false)
                        const isPartiallyConfirmed =
                          confirmedItems.length < quote.items.length ||
                          confirmedItems.some(
                            (i) => i.quotedQuantity != null && i.quantity < i.quotedQuantity
                          )
                        const isFullyOrdered =
                          confirmedItems.length > 0 &&
                          confirmedItems.every((i) => (orderedMap.get(i.productId) || 0) >= i.quantity)

                        const activeCalcItems =
                          quote.status === "ACCEPTED" || quote.status === "COMPLETED"
                            ? confirmedItems
                            : quote.items

                        const totalRevenue = activeCalcItems.reduce(
                          (s, i) => s + (i.spSnapshot || 0) * i.quantity,
                          0
                        )
                        const totalCost = activeCalcItems.reduce(
                          (s, i) =>
                            s + (i.cpSnapshot || 0) * i.quantity + (i.additionalCost || 0),
                          0
                        )
                        const profit = totalRevenue - totalCost
                        const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

                        return (
                          <tr
                            key={quote.id}
                            className="hover:bg-slate-50/90 transition-colors group"
                          >
                            <td className="px-4 py-3.5">
                              <RowCheckbox id={quote.id} />
                            </td>
                            <td className="px-4 py-3.5">
                              <Link
                                href={`/quotations/${quote.id}`}
                                className="font-bold text-slate-900 hover:text-orange-600 font-mono text-xs block"
                              >
                                #{formatShortId(quote.id)}
                              </Link>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {new Date(quote.createdAt).toLocaleDateString()}
                                {quote.prNo ? ` • PR: ${quote.prNo}` : ""}
                                {quote.rfqNo ? ` • RFQ: ${quote.rfqNo}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <Link
                                href={`/clients/${quote.clientId}`}
                                className="text-slate-900 font-semibold hover:text-orange-600 transition-colors inline-flex items-center gap-1.5"
                              >
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {quote.client.name}
                              </Link>
                              <div className="mt-0.5">
                                {quote.paymentStatus === "PAID" && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    PAID
                                  </span>
                                )}
                                {quote.paymentStatus === "PARTIALLY_PAID" && (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    PARTIAL ({formatRupee(quote.amountPaid)} paid)
                                  </span>
                                )}
                                {quote.paymentStatus === "UNPAID" &&
                                  (quote.status === "ACCEPTED" || quote.status === "COMPLETED") && (
                                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                      UNPAID
                                    </span>
                                  )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {activeCalcItems.slice(0, 2).map((item) => (
                                  <span
                                    key={item.id}
                                    className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700"
                                    title={item.product.materialDescription}
                                  >
                                    {item.product.materialCode} ×{item.quantity}
                                  </span>
                                ))}
                                {activeCalcItems.length > 2 && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-500">
                                    +{activeCalcItems.length - 2} more
                                  </span>
                                )}
                              </div>
                              {isPartiallyConfirmed && (
                                <div className="text-[10px] font-semibold text-emerald-700 mt-1">
                                  Partial Order: {confirmedItems.length} of {quote.items.length} item(s) confirmed
                                </div>
                              )}
                              {(() => {
                                const pending = activeCalcItems.filter(
                                  (i) => !i.cpSnapshot || i.cpSnapshot === 0
                                ).length
                                return pending > 0 ? (
                                  <div className="text-[10px] font-semibold text-amber-600 mt-1">
                                    {pending} item(s) missing Vendor CP
                                  </div>
                                ) : null
                              })()}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {quote.purchaseOrders.length > 0 ? (
                                  quote.purchaseOrders.map((po) => (
                                    <Link
                                      key={po.id}
                                      href={`/purchase-orders/${po.id}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                    >
                                      <ClipboardList className="w-3 h-3" />
                                      #{po.poNumber || formatShortId(po.id)}
                                    </Link>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400">No PO yet</span>
                                )}

                                {!isFullyOrdered && quote.status === "ACCEPTED" && (
                                  <Link
                                    href={`/purchase-orders/new?quotationId=${quote.id}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                                  >
                                    + Issue PO
                                  </Link>
                                )}

                                {quote.cocs.length > 0 && (
                                  <Link
                                    href={`/cocs/${quote.cocs[0].id}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                    title="View Certificate of Conformance"
                                  >
                                    <ShieldCheck className="w-3 h-3" /> COC
                                  </Link>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <QuotationStatusBadge
                                id={quote.id}
                                currentStatus={quote.status}
                                quotation={quote}
                              />
                            </td>
                            <td className="px-4 py-3.5 font-mono text-right">
                              <div className="font-bold text-slate-900">
                                {formatRupee(quote.totalAmount)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {formatRupee(quote.totalAmount + quote.totalGst)} incl. GST
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-semibold text-right">
                              <div
                                className={`inline-flex items-center justify-end gap-1.5 ${
                                  profit >= 0 ? "text-emerald-700" : "text-rose-600"
                                }`}
                              >
                                <span>{formatRupee(profit)}</span>
                                {marginPct < (settings?.marginAlertThreshold ?? 10) && (
                                  <span
                                    title="Low margin alert"
                                    className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
                                  />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {marginPct.toFixed(1)}% margin
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/quotations/${quote.id}`}
                                  className="text-xs font-semibold text-slate-700 hover:text-orange-700 bg-slate-100 hover:bg-orange-50 px-2.5 py-1.5 rounded-md transition-colors"
                                >
                                  Open
                                </Link>
                                <Link
                                  href={`/quotations/${quote.id}/edit`}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Edit Quotation"
                                >
                                  <FileEdit className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })}

        {quotations.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            No quotations found. Click <strong>Create Quotation</strong> to get started.
          </div>
        )}
      </div>
    </SelectionProvider>
  )
}
