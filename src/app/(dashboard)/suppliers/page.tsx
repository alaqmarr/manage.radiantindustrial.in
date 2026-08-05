import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteSuppliers } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { SupplierModal } from "@/components/SupplierModal"
import { ClickableRow } from "@/components/ClickableRow"
import Link from "next/link"

export default async function SuppliersPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search ? {
    OR: [
      { name: { contains: search } },
      { contact: { contains: search } },
    ]
  } : {}

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { products: true, purchases: true }
      }
    }
  })

  return (
    <SelectionProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Suppliers</h1>
          <p className="text-zinc-400 mt-2">Manage your suppliers and purchase sources.</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar placeholder="Search suppliers..." />
          <BatchDeleteButton deleteAction={deleteSuppliers} entityName="suppliers" />
          <Link href="?action=new-supplier" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Supplier</span>
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
              <tr>
                <th className="px-6 py-5 w-12"><SelectAllCheckbox allIds={suppliers.map(s => s.id)} /></th>
                <th className="px-6 py-5 font-medium tracking-wider">Name</th>
                <th className="px-6 py-5 font-medium tracking-wider">Contact</th>
                <th className="px-6 py-5 font-medium tracking-wider">Products</th>
                <th className="px-6 py-5 font-medium tracking-wider">Purchases</th>
                <th className="px-6 py-5 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <ClickableRow 
                    key={supplier.id} 
                    href={`?action=edit-supplier&id=${supplier.id}`}
                    className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4"><RowCheckbox id={supplier.id} /></td>
                    <td className="px-6 py-4 font-medium text-white group-hover:text-brand-orange transition-colors">{supplier.name}</td>
                    <td className="px-6 py-4 text-zinc-300">{supplier.contact || '-'}</td>
                    <td className="px-6 py-4 text-zinc-300">
                      <span className="bg-white/5 border border-premium-border px-2 py-1 rounded text-xs font-mono">{supplier._count.products}</span>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      <span className="bg-white/5 border border-premium-border px-2 py-1 rounded text-xs font-mono">{supplier._count.purchases}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`?action=edit-supplier&id=${supplier.id}`} className="text-brand-slate hover:text-slate-400 font-medium">Edit</Link>
                    </td>
                  </ClickableRow>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>
        <SupplierModal suppliers={suppliers} />
      </div>
    </SelectionProvider>
  )
}
