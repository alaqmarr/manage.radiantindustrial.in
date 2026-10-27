import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import {
  Plus,
  Send,
  Globe,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
  Info,
  Trophy,
  Building2,
} from "lucide-react"
import Link from "next/link"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteRfqs } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { ClickableRow } from "@/components/ClickableRow"
import { RfqStatusBadge } from "@/components/RfqStatusBadge"

export const metadata: Metadata = {
  title: "RFQs (Request for Quotation)",
}

export default async function RfqsPage(props: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""
  const statusFilter = searchParams.status || ""

  const where: any = {}

  if (search) {
    where.OR = [
      { id: { contains: search } },
      { supplier: { name: { contains: search } } },
    ]
  }

  const rfqs = await prisma.rfq.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
      responses: true,
      purchaseOrders: {
        select: { id: true, poNumber: true, status: true },
      },
    },
  })

  const drafts = rfqs.filter((r) => r.status === "DRAFT")
  const issued = rfqs.filter((r) => r.status === "ISSUED")
  const completed = rfqs.filter((r) => r.status === "COMPLETED")
  const publicRfqs = rfqs.filter((r) => r.isPublic)
  const totalVendorBids = rfqs.reduce((acc, r) => acc + (r.responses?.length || 0), 0)

  const statusGroups = [
    { key: "DRAFT", label: "Draft", items: drafts },
    { key: "ISSUED", label: "Issued / Open", items: issued },
    { key: "COMPLETED", label: "Awarded / Completed", items: completed },
  ]

  const displayedRfqs = statusFilter
    ? rfqs.filter((r) => r.status === statusFilter)
    : rfqs

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Requests for Quotation (RFQs)
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Request supplier pricing for items before issuing a formal Purchase Order or quoting a client.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar placeholder="Search RFQ ID or supplier..." />
            <BatchDeleteButton deleteAction={deleteRfqs} entityName="RFQs" />
            <Link
              href="/rfq/new"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 shadow-xs text-white font-semibold rounded-lg transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create RFQ</span>
            </Link>
          </div>
        </div>

        {/* Layman Guide Banner */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mt-0.5 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                How RFQs Work
              </h3>
              <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                <strong>Direct RFQ:</strong> Send a price inquiry to a specific supplier. ·{" "}
                <strong>Public RFQ:</strong> Generate a shareable vendor portal link where multiple suppliers submit competitive bids, then click <strong>Award & Create PO</strong> in 1 click.
              </p>
            </div>
          </div>
          <Link
            href="/purchase-orders"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap flex items-center gap-1 self-end md:self-center"
          >
            Go to Purchase Orders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total RFQs
              </span>
              <Send className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1.5">{rfqs.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">{drafts.length} in draft</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Active / Issued
              </span>
              <Globe className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-700 font-mono mt-1.5">{issued.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {publicRfqs.length} public multi-vendor RFQs
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                Vendor Bids Received
              </span>
              <Trophy className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-600 font-mono mt-1.5">{totalVendorBids}</p>
            <p className="text-xs text-slate-400 mt-0.5">Submitted via public vendor link</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Awarded / Completed
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 font-mono mt-1.5">
              {completed.length}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Converted into Purchase Orders</p>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/rfq"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              !statusFilter
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            All RFQs ({rfqs.length})
          </Link>
          {statusGroups.map((g) => (
            <Link
              key={g.key}
              href={`/rfq?status=${g.key}`}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                statusFilter === g.key
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {g.label} ({g.items.length})
            </Link>
          ))}
        </div>

        {/* RFQ Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <SelectAllCheckbox allIds={displayedRfqs.map((q) => q.id)} />
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">RFQ Ref & Date</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Target Supplier / Mode</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Requested Items</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Vendor Bids / Linked PO</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Status</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRfqs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No RFQs found matching your filter. Click <strong>Create RFQ</strong> to request vendor pricing.
                    </td>
                  </tr>
                ) : (
                  displayedRfqs.map((rfq) => {
                    const itemPreview = rfq.items
                      .slice(0, 2)
                      .map((i) => `${i.product.materialCode} (${i.quantity})`)
                      .join(", ")
                    const extraItems = rfq.items.length > 2 ? ` +${rfq.items.length - 2} more` : ""

                    return (
                      <ClickableRow
                        key={rfq.id}
                        href={`/rfq/${rfq.id}`}
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3.5">
                          <RowCheckbox id={rfq.id} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-xs text-orange-600">
                            #{rfq.id.slice(-6).toUpperCase()}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(rfq.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {rfq.isPublic ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                              <Globe className="w-3.5 h-3.5" />
                              Public Multi-Vendor Portal
                            </div>
                          ) : rfq.supplier ? (
                            <div>
                              <Link
                                href={`/suppliers/${rfq.supplier.id}`}
                                className="font-semibold text-slate-900 hover:text-orange-600 transition-colors inline-flex items-center gap-1.5"
                              >
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                {rfq.supplier.name}
                              </Link>
                              {rfq.supplier.location && (
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {rfq.supplier.location}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs font-semibold text-slate-800">
                            {rfq.items.length} item{rfq.items.length !== 1 ? "s" : ""}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs mt-0.5">
                            {itemPreview}
                            {extraItems}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {rfq.isPublic && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                                  rfq.responses.length > 0
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                }`}
                              >
                                <Trophy className="w-3 h-3" /> {rfq.responses.length} bid
                                {rfq.responses.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {rfq.purchaseOrders.length > 0 ? (
                              rfq.purchaseOrders.map((po) => (
                                <Link
                                  key={po.id}
                                  href={`/purchase-orders/${po.id}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                >
                                  <ClipboardList className="w-3 h-3" />{" "}
                                  {po.poNumber || `#${po.id.slice(-6).toUpperCase()}`}
                                </Link>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No PO yet</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <RfqStatusBadge id={rfq.id} currentStatus={rfq.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                          {rfq.supplierId && rfq.purchaseOrders.length === 0 && (
                            <Link
                              href={`/purchase-orders/new?rfqId=${rfq.id}&supplierId=${rfq.supplierId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              + Create PO
                            </Link>
                          )}
                          <Link
                            href={`/rfq/${rfq.id}`}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </ClickableRow>
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
