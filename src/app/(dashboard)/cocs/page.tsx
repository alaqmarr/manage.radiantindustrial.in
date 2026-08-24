import { prisma } from "@/lib/prisma"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Certificates of Conformance"
}
import { Plus } from "lucide-react"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteCocs } from "@/app/actions/coc"
import { SearchBar } from "@/components/SearchBar"
import { ClickableRow } from "@/components/ClickableRow"
import Link from "next/link"

export default async function CocsPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search ? {
    OR: [
      { cocNumber: { contains: search } },
      { client: { name: { contains: search } } },
      { clientPoRef: { contains: search } },
    ]
  } : {}

  const cocs = await prisma.certificateOfConformance.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
      _count: {
        select: { items: true }
      }
    }
  })

  return (
    <SelectionProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Certificates of Conformance</h1>
            <p className="text-zinc-400 mt-2">Manage quality certificates issued to clients.</p>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar placeholder="Search COCs..." />
            <BatchDeleteButton deleteAction={deleteCocs} entityName="COCs" />
            <Link href="/cocs/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 text-white font-medium rounded-md transition-all active:scale-95">
              <Plus className="w-4 h-4" />
              <span className="text-sm">Create COC</span>
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-md overflow-hidden border border-premium-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
                <tr>
                  <th className="px-6 py-5 w-12"><SelectAllCheckbox allIds={cocs.map(c => c.id)} /></th>
                  <th className="px-6 py-5 font-medium tracking-wider">Date</th>
                  <th className="px-6 py-5 font-medium tracking-wider">COC No</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Client</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Status</th>
                  <th className="px-6 py-5 font-medium tracking-wider">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-premium-border">
                {cocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      No certificates found.
                    </td>
                  </tr>
                ) : (
                  cocs.map((coc) => (
                    <ClickableRow 
                      key={coc.id} 
                      href={`/cocs/${coc.id}`}
                      className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4"><RowCheckbox id={coc.id} /></td>
                      <td className="px-6 py-4 text-zinc-300">{new Date(coc.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-brand-slate group-hover:text-brand-slate-light font-medium transition-colors">
                          {coc.cocNumber || coc.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white">{coc.client.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
                          coc.status === 'ISSUED' ? 'bg-emerald-500/10 text-emerald-500' :
                          coc.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-500' :
                          'bg-zinc-500/10 text-zinc-400'
                        }`}>
                          {coc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-300">
                        <span className="bg-white/5 border border-premium-border px-2 py-1 rounded text-xs font-mono">{coc._count.items}</span>
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
