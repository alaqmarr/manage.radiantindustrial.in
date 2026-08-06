import { prisma } from "@/lib/prisma"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Quotations"
}
import { Plus } from "lucide-react"
import Link from "next/link"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteQuotations } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { ClickableRow } from "@/components/ClickableRow"

function formatRupee(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(paise / 100)
}

export default async function QuotationsPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search ? {
    OR: [
      { prNo: { contains: search } },
      { rfqNo: { contains: search } },
      { client: { name: { contains: search } } },
    ]
  } : {}

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
      items: true
    }
  })

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
          <Link href="/quotations/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Create Quotation</span>
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
              <tr>
                <th className="px-6 py-5 w-12"><SelectAllCheckbox allIds={quotations.map(q => q.id)} /></th>
                <th className="px-6 py-5 font-medium tracking-wider">ID</th>
                <th className="px-6 py-5 font-medium tracking-wider">Client</th>
                <th className="px-6 py-5 font-medium tracking-wider">PR No</th>
                <th className="px-6 py-5 font-medium tracking-wider">Status</th>
                <th className="px-6 py-5 font-medium tracking-wider">Total Amount</th>
                <th className="px-6 py-5 font-medium tracking-wider">Est. Profit</th>
                <th className="px-6 py-5 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">
                    No quotations found.
                  </td>
                </tr>
              ) : (
                quotations.map((quote) => (
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
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        quote.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                        quote.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                        'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{formatRupee(quote.totalAmount)}</td>
                    <td className="px-6 py-4 font-medium text-emerald-500">
                      {formatRupee(
                        quote.items.reduce((sum, item) => {
                          const cp = item.cpSnapshot || 0;
                          const sp = item.spSnapshot || 0;
                          return sum + (sp - cp) * item.quantity;
                        }, 0)
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/quotations/${quote.id}`} className="text-brand-slate hover:text-slate-400 font-medium">View</Link>
                    </td>
                  </ClickableRow>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </SelectionProvider>
  )
}
