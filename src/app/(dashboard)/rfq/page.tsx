import { prisma } from "@/lib/prisma"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "rfqs / RFQs"
}
import { Plus } from "lucide-react"
import Link from "next/link"
import { formatRupee } from "@/lib/utils"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteRfqs } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { ClickableRow } from "@/components/ClickableRow"

import { RfqStatusBadge } from "@/components/RfqStatusBadge"



export default async function RfqsPage(props: { searchParams: Promise<{ search?: string, status?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""
  const statusFilter = searchParams.status || ""

  const where: any = {}
  
  if (search) {
    where.OR = [
      { id: { contains: search } },
      { rfqNo: { contains: search } },
      { supplier: { name: { contains: search } } },
    ]
  }

  if (statusFilter) {
    where.status = statusFilter
  }

  const rfqs = await prisma.rfq.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: true,
      items: true
    }
  })

  return (
    <SelectionProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">rfqs / RFQs</h1>
          <p className="text-zinc-400 mt-2">Manage supplier rfqs and statuses.</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar placeholder="Search rfqs..." />
          <BatchDeleteButton deleteAction={deleteRfqs} entityName="rfqs" />
          <Link href="/rfq/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Create Rfq</span>
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-md overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
              <tr>
                <th className="px-6 py-5 w-12"><SelectAllCheckbox allIds={rfqs.map(q => q.id)} /></th>
                <th className="px-6 py-5 font-medium tracking-wider">ID</th>
                <th className="px-6 py-5 font-medium tracking-wider">Supplier</th>
                
                <th className="px-6 py-5 font-medium tracking-wider">Status</th>
                                
                <th className="px-6 py-5 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {rfqs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No rfqs found.
                  </td>
                </tr>
              ) : (
                rfqs.map((quote) => (
                  <ClickableRow 
                    key={quote.id} 
                    href={`/rfq/${quote.id}`}
                    className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4"><RowCheckbox id={quote.id} /></td>
                    <td className="px-6 py-4 font-medium text-white font-mono text-xs">{quote.id.slice(-6).toUpperCase()}</td>
                    <td className="px-6 py-4 text-zinc-300 font-medium group-hover:text-brand-orange transition-colors">{quote.supplier.name}</td>
                    
                    <td className="px-6 py-4">
                      <RfqStatusBadge id={quote.id} currentStatus={quote.status} />
                    </td>
                                        
                    <td className="px-6 py-4 text-right">
                      <Link href={`/rfq/${quote.id}`} className="text-brand-slate hover:text-slate-400 font-medium">View</Link>
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

