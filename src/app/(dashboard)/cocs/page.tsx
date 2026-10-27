import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import {
  Plus,
  ShieldCheck,
  CheckCircle2,
  Building2,
  FileText,
  PackageCheck,
  Info,
} from "lucide-react"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteCocs } from "@/app/actions/coc"
import { SearchBar } from "@/components/SearchBar"
import { ClickableRow } from "@/components/ClickableRow"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Certificates of Conformance (COC)",
}

export default async function CocsPage(props: {
  searchParams: Promise<{ search?: string }>
}) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search
    ? {
        OR: [
          { cocNumber: { contains: search } },
          { client: { name: { contains: search } } },
          { clientPoRef: { contains: search } },
        ],
      }
    : {}

  const cocs = await prisma.certificateOfConformance.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      quotation: {
        select: { id: true, prNo: true },
      },
      items: {
        include: { product: { select: { materialCode: true } } },
      },
    },
  })

  const issuedCount = cocs.filter((c) => c.status === "ISSUED").length
  const totalCertifiedItems = cocs.reduce((acc, c) => acc + c.items.length, 0)
  const uniqueClientIds = new Set(cocs.map((c) => c.clientId)).size

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Certificates of Conformance (COC)
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Generate and manage quality compliance & batch traceability certificates for client deliveries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar placeholder="Search COC No, Client, PO Ref..." />
            <BatchDeleteButton deleteAction={deleteCocs} entityName="COCs" />
            <Link
              href="/cocs/new"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 shadow-xs text-white font-semibold rounded-lg transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Certificate</span>
            </Link>
          </div>
        </div>

        {/* Layman Guide Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mt-0.5 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              What is a Certificate of Conformance (COC)?
            </h3>
            <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
              When delivering industrial supplies to a client, a COC certifies that the supplied items, batch/lot numbers, and technical parameters strictly conform to the client&apos;s Purchase Order and Quotation specifications.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Certificates
              </span>
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1.5">{cocs.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">All quality records</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Issued & Active
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 font-mono mt-1.5">{issuedCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Ready for client print/PDF</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                Certified Line Items
              </span>
              <PackageCheck className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-600 font-mono mt-1.5">
              {totalCertifiedItems}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Batches & lots verified</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Clients Served
              </span>
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-700 font-mono mt-1.5">{uniqueClientIds}</p>
            <p className="text-xs text-slate-400 mt-0.5">Distinct client accounts</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <SelectAllCheckbox allIds={cocs.map((c) => c.id)} />
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">COC Number & Date</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Client</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">
                    Client PO / Linked Quote
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Certified Items</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Status</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No Certificates of Conformance found. Click <strong>Create Certificate</strong> to issue one.
                    </td>
                  </tr>
                ) : (
                  cocs.map((coc) => {
                    const codes = coc.items
                      .slice(0, 2)
                      .map((i) => i.product.materialCode)
                      .join(", ")

                    return (
                      <ClickableRow
                        key={coc.id}
                        href={`/cocs/${coc.id}`}
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3.5">
                          <RowCheckbox id={coc.id} />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono font-bold text-xs text-orange-600">
                            {coc.cocNumber || `COC-${coc.id.slice(-6).toUpperCase()}`}
                          </span>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(coc.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/clients/${coc.clientId}`}
                            className="font-semibold text-slate-900 hover:text-orange-600 transition-colors"
                          >
                            {coc.client.name}
                          </Link>
                          {coc.client.location && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {coc.client.location}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            {coc.clientPoRef ? (
                              <span className="inline-block text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                PO: {coc.clientPoRef}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">No PO Ref</span>
                            )}
                            {coc.quotation && (
                              <div>
                                <Link
                                  href={`/quotations/${coc.quotation.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-mono text-orange-600 hover:underline"
                                >
                                  <FileText className="w-3 h-3" /> Quote #
                                  {coc.quotation.id.slice(-6).toUpperCase()}
                                </Link>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                            {coc.items.length} item{coc.items.length !== 1 ? "s" : ""}
                          </span>
                          {codes && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">
                              {codes}
                              {coc.items.length > 2 ? ` +${coc.items.length - 2}` : ""}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider border ${
                              coc.status === "ISSUED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : coc.status === "CANCELLED"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {coc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/cocs/${coc.id}`}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            View & Print
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
