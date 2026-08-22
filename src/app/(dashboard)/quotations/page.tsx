import { prisma } from "@/lib/prisma"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Quotations"
}
import { Plus, FileEdit, Clock, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { formatRupee } from "@/lib/utils"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteQuotations } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { ClickableRow } from "@/components/ClickableRow"
import { QuotationStatusBadge } from "@/components/QuotationStatusBadge"

export default async function QuotationsPage(props: { searchParams: Promise<{ search?: string, status?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""
  const statusFilter = searchParams.status || ""

  const where: any = {}
  
  if (search) {
    where.OR = [
      { prNo: { contains: search } },
      { rfqNo: { contains: search } },
      { client: { name: { contains: search } } },
    ]
  }

  if (statusFilter) {
    where.status = statusFilter
  }

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
      items: true
    }
  })

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  // Group by status priority: DRAFT first, then PENDING, then ACCEPTED, then REJECTED
  const drafts = quotations.filter(q => q.status === 'DRAFT')
  const pending = quotations.filter(q => q.status === 'PENDING')
  const accepted = quotations.filter(q => q.status === 'ACCEPTED')
  const rejected = quotations.filter(q => q.status === 'REJECTED')

  const allIds = quotations.map(q => q.id)

  // Quick stats
  const totalQuoted = quotations.reduce((s, q) => s + q.totalAmount, 0)
  const totalAcceptedValue = accepted.reduce((s, q) => s + q.totalAmount, 0)
  const totalProfit = accepted.reduce((s, q) => s + q.items.reduce((sum, item) => {
    const cp = item.cpSnapshot || 0
    const sp = item.spSnapshot || 0
    const addnl = item.additionalCost || 0
    return sum + ((sp - cp) * item.quantity - addnl)
  }, 0), 0)
  const conversionRate = quotations.length > 0 ? Math.round((accepted.length / quotations.length) * 100) : 0

  const statusGroups = [
    { 
      key: 'DRAFT', 
      label: 'Drafts & Unquoted', 
      icon: <FileEdit className="w-4 h-4" />,
      color: 'text-zinc-400 border-zinc-700 bg-zinc-800/30',
      dotColor: 'bg-zinc-500',
      items: drafts 
    },
    { 
      key: 'PENDING', 
      label: 'Pending Review', 
      icon: <Clock className="w-4 h-4" />,
      color: 'text-blue-400 border-blue-900/50 bg-blue-950/20',
      dotColor: 'bg-blue-500',
      items: pending 
    },
    { 
      key: 'ACCEPTED', 
      label: 'Accepted', 
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20',
      dotColor: 'bg-emerald-500',
      items: accepted 
    },
    { 
      key: 'REJECTED', 
      label: 'Rejected', 
      icon: <XCircle className="w-4 h-4" />,
      color: 'text-rose-400 border-rose-900/50 bg-rose-950/20',
      dotColor: 'bg-rose-500',
      items: rejected 
    },
  ]

  return (
    <SelectionProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Quotations</h1>
            <p className="text-zinc-400 mt-2">Manage client quotations and statuses.</p>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar placeholder="Search quotations..." />
            <BatchDeleteButton deleteAction={deleteQuotations} entityName="quotations" />
            <Link href="/quotations/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95">
              <Plus className="w-4 h-4" />
              <span className="text-sm">Create Quotation</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Quoted</p>
            <p className="text-xl font-bold text-white mt-1">{formatRupee(totalQuoted)}</p>
            <p className="text-xs text-zinc-500 mt-1">{quotations.length} quotations</p>
          </div>
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Accepted Value</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{formatRupee(totalAcceptedValue)}</p>
            <p className="text-xs text-zinc-500 mt-1">{accepted.length} accepted</p>
          </div>
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Est. Profit (Accepted)</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{formatRupee(totalProfit)}</p>
          </div>
          <div className="glass-panel rounded-md p-4 border border-premium-border">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Conversion Rate</p>
            <p className="text-xl font-bold text-brand-orange mt-1">{conversionRate}%</p>
            <p className="text-xs text-zinc-500 mt-1">{accepted.length} of {quotations.length}</p>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link 
            href="/quotations" 
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${!statusFilter ? 'bg-white/10 border-white/20 text-white' : 'border-premium-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}
          >
            All ({quotations.length})
          </Link>
          {statusGroups.map(g => (
            <Link
              key={g.key}
              href={`/quotations?status=${g.key}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${statusFilter === g.key ? 'bg-white/10 border-white/20 text-white' : 'border-premium-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}
            >
              {g.label} ({g.items.length})
            </Link>
          ))}
        </div>

        {/* Grouped Tables */}
        {statusGroups.map(group => {
          if (group.items.length === 0) return null
          if (statusFilter && statusFilter !== group.key) return null
          
          return (
            <div key={group.key} className="space-y-2">
              {/* Section Header */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-md border ${group.color}`}>
                <div className={`w-2 h-2 rounded-full ${group.dotColor}`} />
                {group.icon}
                <span className="text-sm font-semibold">{group.label}</span>
                <span className="text-xs opacity-60 ml-1">({group.items.length})</span>
              </div>

              <div className="glass-panel rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
                      <tr>
                        <th className="px-6 py-4 w-12"><SelectAllCheckbox allIds={group.items.map(q => q.id)} /></th>
                        <th className="px-6 py-4 font-medium tracking-wider">ID</th>
                        <th className="px-6 py-4 font-medium tracking-wider">Client</th>
                        <th className="px-6 py-4 font-medium tracking-wider">PR No</th>
                        <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                        <th className="px-6 py-4 font-medium tracking-wider">Total Amount</th>
                        <th className="px-6 py-4 font-medium tracking-wider">Est. Profit</th>
                        <th className="px-6 py-4 font-medium tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-premium-border">
                      {group.items.map((quote) => (
                        <ClickableRow 
                          key={quote.id} 
                          href={`/quotations/${quote.id}`}
                          className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4"><RowCheckbox id={quote.id} /></td>
                          <td className="px-6 py-4 font-medium text-white font-mono text-xs">{quote.id.slice(-6).toUpperCase()}</td>
                          <td className="px-6 py-4 text-zinc-300 font-medium group-hover:text-brand-orange transition-colors">{quote.client.name}</td>
                          <td className="px-6 py-4 text-zinc-300">{quote.prNo || '-'}</td>
                          <td className="px-6 py-4">
                            <QuotationStatusBadge id={quote.id} currentStatus={quote.status} />
                          </td>
                          <td className="px-6 py-4 font-medium text-white">{formatRupee(quote.totalAmount)}</td>
                          <td className="px-6 py-4 font-medium text-emerald-500 flex items-center gap-2">
                            {(() => {
                              const totalRevenue = quote.items.reduce((s, i) => s + (i.spSnapshot || 0) * i.quantity, 0);
                              const totalCost = quote.items.reduce((s, i) => s + (i.cpSnapshot || 0) * i.quantity + (i.additionalCost || 0), 0);
                              const profit = totalRevenue - totalCost;
                              const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
                              return (
                                <>
                                  {formatRupee(profit)}
                                  {marginPct < (settings?.marginAlertThreshold ?? 10) && (
                                    <span title="Low margin alert" className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link href={`/quotations/${quote.id}`} className="text-brand-slate hover:text-slate-400 font-medium">View</Link>
                          </td>
                        </ClickableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })}

        {quotations.length === 0 && (
          <div className="glass-panel rounded-md p-12 text-center text-zinc-500">
            No quotations found.
          </div>
        )}
      </div>
    </SelectionProvider>
  )
}
