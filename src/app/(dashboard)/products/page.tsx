import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"
import Link from "next/link"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteProducts } from "@/app/actions/batchDelete"
import { ExcelImportButton } from "@/components/ExcelImportButton"
import { SearchBar } from "@/components/SearchBar"
import { ClickableRow } from "@/components/ClickableRow"

function formatRupee(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(paise / 100)
}

export default async function ProductsPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search ? {
    OR: [
      { materialCode: { contains: search } },
      { materialDescription: { contains: search } },
      { make: { contains: search } },
      { modelNo: { contains: search } },
    ]
  } : {}

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  })

  return (
    <SelectionProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Products</h1>
          <p className="text-zinc-400 mt-2">Manage your inventory and materials.</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar placeholder="Search products..." />
          <BatchDeleteButton deleteAction={deleteProducts} entityName="products" />
          <ExcelImportButton />
          <Link href="/products/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Product</span>
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-premium-surface/50 border-b border-premium-border">
              <tr>
                <th className="px-6 py-5 w-12"><SelectAllCheckbox allIds={products.map(p => p.id)} /></th>
                <th className="px-6 py-5 font-medium tracking-wider">Material Code</th>
                <th className="px-6 py-5 font-medium tracking-wider">Description</th>
                <th className="px-6 py-5 font-medium tracking-wider">Make/Model</th>
                <th className="px-6 py-5 font-medium tracking-wider">UOM</th>
                <th className="px-6 py-5 font-medium tracking-wider">Cost Price</th>
                <th className="px-6 py-5 font-medium tracking-wider">Selling Price</th>
                <th className="px-6 py-5 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">
                    No products found. Add one or import from Excel.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <ClickableRow 
                    key={product.id} 
                    href={`/products/${product.id}/edit`}
                    className="hover:bg-white/5 even:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4"><RowCheckbox id={product.id} /></td>
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.materialCode} className="w-8 h-8 rounded object-cover bg-premium-surface" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/5 border border-premium-border flex items-center justify-center text-xs text-zinc-500">No Img</div>
                      )}
                      <span className="font-mono text-xs">{product.materialCode}</span>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      <div className="truncate max-w-xs font-medium group-hover:text-brand-orange transition-colors">{product.materialDescription}</div>
                      <div className="text-xs text-zinc-500">{product.specification}</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      {product.make} {product.modelNo ? `/ ${product.modelNo}` : ''}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 text-xs font-mono">{product.unit}</td>
                    <td className="px-6 py-4 font-medium text-zinc-300">{formatRupee(product.costPrice)}</td>
                    <td className="px-6 py-4 font-medium text-white">{formatRupee(product.sellingPrice)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/products/${product.id}/edit`} className="text-brand-slate hover:text-slate-400 font-medium">Edit</Link>
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
