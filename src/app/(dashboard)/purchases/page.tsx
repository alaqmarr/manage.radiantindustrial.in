import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"
import Link from "next/link"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deletePurchases } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { PurchaseModal } from "@/components/PurchaseModal"
import { ClickableRow } from "@/components/ClickableRow"

function formatRupee(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(paise / 100)
}

export default async function PurchasesPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search ? {
    OR: [
      { id: { contains: search } },
      { supplier: { name: { contains: search } } },
    ]
  } : {}

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      supplier: true,
      items: {
        include: {
          product: true
        }
      }
    }
  })

  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } })
  const products = await prisma.product.findMany({ select: { id: true, materialCode: true, materialDescription: true, costPrice: true } })

  return (
    <SelectionProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Purchases</h1>
          <p className="text-zinc-400 mt-2">Manage your purchases and stock intake.</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar placeholder="Search purchases..." />
          <BatchDeleteButton deleteAction={deletePurchases} entityName="purchases" />
          <Link 
            href="?action=new-purchase"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-lg transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Record Purchase</span>
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
              <tr>
                <th className="px-6 py-5 w-12"><SelectAllCheckbox allIds={purchases.map(p => p.id)} /></th>
                <th className="px-6 py-5 font-medium tracking-wider">ID</th>
                <th className="px-6 py-5 font-medium tracking-wider">Supplier</th>
                <th className="px-6 py-5 font-medium tracking-wider">Date</th>
                <th className="px-6 py-5 font-medium tracking-wider">Total Amount</th>
                <th className="px-6 py-5 font-medium tracking-wider">Total GST</th>
                <th className="px-6 py-5 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                    No purchases recorded.
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => (
                  <ClickableRow 
                    key={purchase.id} 
                    href={`?action=edit-purchase&id=${purchase.id}`}
                    className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4"><RowCheckbox id={purchase.id} /></td>
                    <td className="px-6 py-4 font-medium text-white font-mono text-xs">{purchase.id.slice(-6).toUpperCase()}</td>
                    <td className="px-6 py-4 text-zinc-300 font-medium group-hover:text-brand-orange transition-colors">{purchase.supplier.name}</td>
                    <td className="px-6 py-4 text-zinc-300">{new Date(purchase.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium text-white">{formatRupee(purchase.totalAmount)}</td>
                    <td className="px-6 py-4 text-zinc-300">{formatRupee(purchase.totalGst)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`?action=edit-purchase&id=${purchase.id}`} className="text-brand-slate hover:text-slate-400 font-medium">Edit</Link>
                    </td>
                  </ClickableRow>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>
        <PurchaseModal suppliers={suppliers} products={products} purchases={purchases} />
      </div>
    </SelectionProvider>
  )
}
