import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Plus,
  FileText,
  ClipboardList,
  ShieldCheck,
  Wallet,
} from "lucide-react"

export default async function ClientLedgerPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      quotations: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: true,
          items: true,
          purchaseOrders: {
            where: { status: { not: "CANCELLED" } },
            select: { id: true, poNumber: true, status: true },
          },
        },
      },
      cocs: {
        orderBy: { date: "desc" },
        include: { items: true },
      },
    },
  })

  if (!client) notFound()

  const allQuotations = client.quotations
  const acceptedQuotations = allQuotations.filter(
    (q) => q.status === "ACCEPTED" || q.status === "COMPLETED"
  )

  const totalInvoiced = acceptedQuotations.reduce(
    (sum, q) => sum + q.totalAmount + q.totalGst,
    0
  )
  const totalPaid = acceptedQuotations.reduce((sum, q) => sum + q.amountPaid, 0)
  const outstanding = Math.max(0, totalInvoiced - totalPaid)
  const winRate =
    allQuotations.length > 0
      ? Math.round((acceptedQuotations.length / allQuotations.length) * 100)
      : 0

  return (
    <div className="space-y-6">
      {/* Client 360 Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link
              href="/clients"
              className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors mt-0.5"
              title="Back to Clients"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {client.name}
                </h1>
                {client.gstNumber && (
                  <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-md">
                    GSTIN: {client.gstNumber}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                {client.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {client.location}
                  </span>
                )}
                {client.contact && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {client.contact}
                  </span>
                )}
                {client.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {client.email}
                  </span>
                )}
              </div>
              {client.address && (
                <p className="text-xs text-slate-500 mt-1">{client.address}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/quotations/new?clientId=${client.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Quotation
            </Link>
            <Link
              href="/cocs/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Issue COC
            </Link>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Wallet className="w-3.5 h-3.5 text-blue-600" /> Record Payment
            </Link>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Billed (Incl. GST)
            </p>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {formatRupee(totalInvoiced)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            From {acceptedQuotations.length} accepted quotation{acceptedQuotations.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Total Received
            </p>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-700">
            {formatRupee(totalPaid)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {client.creditBalance > 0
              ? `Advance Credit: ${formatRupee(client.creditBalance)}`
              : "Cleared payments"}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              Outstanding Balance
            </p>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600">
            {formatRupee(outstanding)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {outstanding > 0 ? "Pending receivable from client" : "All accepted invoices settled"}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quotation Conversion
            </p>
            <FileText className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900">{winRate}%</p>
          <p className="text-xs text-slate-400 mt-1">
            {acceptedQuotations.length} won out of {allQuotations.length} total quotes
          </p>
        </div>
      </div>

      {/* Quotations & Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Client Quotations & Invoice Ledger ({allQuotations.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All quotations sent to {client.name}, linked Purchase Orders, and payment status
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Quotation Ref</th>
                <th className="py-3.5 px-4 font-semibold">Client PR / RFQ</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Linked Supplier POs</th>
                <th className="py-3.5 px-4 font-semibold text-right">Quote Value (Incl. GST)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Paid</th>
                <th className="py-3.5 px-4 font-semibold text-right">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allQuotations.map((q) => {
                const isAccepted = q.status === "ACCEPTED" || q.status === "COMPLETED"
                const quoteTotal = q.totalAmount + q.totalGst
                const invoiced = isAccepted ? quoteTotal : 0
                const balance = Math.max(0, invoiced - q.amountPaid)

                return (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {new Date(q.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="text-orange-600 hover:underline font-mono font-bold text-xs"
                      >
                        #{q.id.slice(-6).toUpperCase()}
                      </Link>
                      <span className="text-xs text-slate-400 ml-1.5">
                        ({q.items.length} items)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                      {q.prNo ? `PR: ${q.prNo}` : q.rfqNo ? `RFQ: ${q.rfqNo}` : "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${
                          q.status === "COMPLETED"
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : q.status === "ACCEPTED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : q.status === "PENDING"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : q.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {q.purchaseOrders.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {q.purchaseOrders.map((po) => (
                            <Link
                              key={po.id}
                              href={`/purchase-orders/${po.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            >
                              <ClipboardList className="w-3 h-3" />
                              {po.poNumber || `#${po.id.slice(-6).toUpperCase()}`}
                            </Link>
                          ))}
                        </div>
                      ) : isAccepted ? (
                        <Link
                          href={`/purchase-orders/new?quotationId=${q.id}`}
                          className="text-xs font-semibold text-orange-600 hover:underline"
                        >
                          + Issue PO
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupee(quoteTotal)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                      {q.amountPaid > 0 ? formatRupee(q.amountPaid) : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {!isAccepted ? (
                        <span className="text-xs text-slate-400">Not Billed</span>
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
              {allQuotations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No quotations created for this client yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Certificates of Conformance for this Client */}
      {client.cocs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Certificates of Conformance Issued ({client.cocs.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">COC Number</th>
                  <th className="py-3 px-4 font-semibold">Client PO Ref</th>
                  <th className="py-3 px-4 font-semibold">Certified Items</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {client.cocs.map((coc) => (
                  <tr key={coc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {new Date(coc.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/cocs/${coc.id}`}
                        className="font-mono text-xs font-bold text-orange-600 hover:underline"
                      >
                        {coc.cocNumber || `COC-${coc.id.slice(-6).toUpperCase()}`}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      {coc.clientPoRef || "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {coc.items.length} item{coc.items.length !== 1 ? "s" : ""}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {coc.status}
                      </span>
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
