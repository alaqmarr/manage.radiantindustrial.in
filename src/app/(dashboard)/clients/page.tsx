import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import {
  Plus,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileText,
} from "lucide-react"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteClients } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { ClientModal } from "@/components/ClientModal"
import { ClickableRow } from "@/components/ClickableRow"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Clients Directory & Receivables",
}

export default async function ClientsPage(props: {
  searchParams: Promise<{ search?: string }>
}) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { contact: { contains: search } },
          { gstNumber: { contains: search } },
          { location: { contains: search } },
        ],
      }
    : {}

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      quotations: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          totalGst: true,
          amountPaid: true,
        },
      },
      _count: {
        select: { quotations: true, cocs: true },
      },
    },
  })

  // Compute aggregated metrics across clients
  let totalAcceptedInvoiced = 0
  let totalCollected = 0
  let totalReceivables = 0
  let activeBuyersCount = 0

  const enrichedClients = clients.map((client) => {
    const acceptedQuotes = client.quotations.filter(
      (q) => q.status === "ACCEPTED" || q.status === "COMPLETED"
    )
    const invoiced = acceptedQuotes.reduce(
      (sum, q) => sum + (q.totalAmount || 0) + (q.totalGst || 0),
      0
    )
    const paid = acceptedQuotes.reduce((sum, q) => sum + (q.amountPaid || 0), 0)
    const due = Math.max(0, invoiced - paid)

    if (acceptedQuotes.length > 0) activeBuyersCount++
    totalAcceptedInvoiced += invoiced
    totalCollected += paid
    totalReceivables += due

    return {
      ...client,
      acceptedQuotesCount: acceptedQuotes.length,
      invoiced,
      paid,
      due,
    }
  })

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clients & Receivables Directory
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Manage buyer accounts, GST details, quotation history, and outstanding receivables.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar placeholder="Search client, GSTIN, city..." />
            <BatchDeleteButton deleteAction={deleteClients} entityName="clients" />
            <Link
              href="?action=new-client"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 shadow-xs text-white font-semibold rounded-lg transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Client</span>
            </Link>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Clients
              </span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1.5">
              {clients.length}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeBuyersCount} with accepted orders
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Total Billed (Incl. GST)
              </span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1.5">
              {formatRupee(totalAcceptedInvoiced)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Across accepted & completed quotes</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Total Collected
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 font-mono mt-1.5">
              {formatRupee(totalCollected)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Payments received from clients</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                Receivables Due
              </span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-600 font-mono mt-1.5">
              {formatRupee(totalReceivables)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Pending collection from clients</p>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <SelectAllCheckbox allIds={enrichedClients.map((c) => c.id)} />
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Client & GSTIN</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Contact Info</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-center">
                    Quotations
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                    Total Billed
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                    Receivable Due
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrichedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No clients found. Click <strong>Add Client</strong> to register a new buyer.
                    </td>
                  </tr>
                ) : (
                  enrichedClients.map((client) => (
                    <ClickableRow
                      key={client.id}
                      href={`/clients/${client.id}`}
                      className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <RowCheckbox id={client.id} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                          {client.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {client.gstNumber && (
                            <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                              GST: {client.gstNumber}
                            </span>
                          )}
                          {client.location && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 text-slate-400" /> {client.location}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 text-xs text-slate-600">
                          {client.contact ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" /> {client.contact}
                            </div>
                          ) : null}
                          {client.email ? (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400" /> {client.email}
                            </div>
                          ) : null}
                          {!client.contact && !client.email && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-mono">
                          <span className="font-bold text-emerald-700">
                            {client.acceptedQuotesCount} won
                          </span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-700">{client._count.quotations} total</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        <div className="font-bold text-slate-900">
                          {formatRupee(client.invoiced)}
                        </div>
                        {client.paid > 0 && (
                          <div className="text-[11px] text-emerald-600">
                            Paid: {formatRupee(client.paid)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {client.due > 0 ? (
                          <span className="inline-block font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                            {formatRupee(client.due)}
                          </span>
                        ) : client.creditBalance > 0 ? (
                          <span className="inline-block font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                            Cr: {formatRupee(client.creditBalance)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Settled</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/quotations/new?clientId=${client.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors"
                        >
                          <FileText className="w-3 h-3" /> + Quote
                        </Link>
                        <Link
                          href={`/clients/${client.id}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Ledger
                        </Link>
                        <Link
                          href={`?action=edit-client&id=${client.id}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          Edit
                        </Link>
                      </td>
                    </ClickableRow>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <ClientModal clients={clients} />
      </div>
    </SelectionProvider>
  )
}
