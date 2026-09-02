import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { formatRupee } from "@/lib/utils"
import { Plus, Eye, FileEdit } from "lucide-react"
import { POStatusBadge } from "@/components/POStatusBadge"
import { SearchBar } from "@/components/SearchBar"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deletePurchaseOrders } from "@/app/actions/batchDelete"

export const dynamic = "force-dynamic"

export default async function PurchaseOrdersPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""
  
  const where: any = {}
  if (search) {
    where.OR = [
      { id: { contains: search } },
      { poNumber: { contains: search } },
      { supplier: { name: { contains: search } } },
    ]
  }

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } }
    },
    orderBy: { updatedAt: "desc" }
  })

  return (
    <SelectionProvider>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Purchase Orders</h1>
          <div className="flex items-center gap-3">
            <SearchBar placeholder="Search POs..." />
            <BatchDeleteButton deleteAction={deletePurchaseOrders} entityName="purchase orders" />
            <Link 
              href="/purchase-orders/new" 
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 text-white font-medium rounded-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Create PO
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-lg border border-premium-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-400 uppercase bg-black/40 border-b border-premium-border">
                <tr>
                  <th className="px-6 py-4 w-12"><SelectAllCheckbox allIds={pos.map(po => po.id)} /></th>
                  <th className="px-6 py-4 font-medium">PO Number</th>
                  <th className="px-6 py-4 font-medium">Supplier</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Total Amount</th>
                  <th className="px-6 py-4 font-medium">Items</th>
                  <th className="px-6 py-4 font-medium">Updated</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-premium-border">
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  pos.map(po => (
                    <tr key={po.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4"><RowCheckbox id={po.id} /></td>
                      <td className="px-6 py-4 font-medium text-white">{po.poNumber || po.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-zinc-300 font-medium group-hover:text-brand-orange transition-colors">{po.supplier.name}</td>
                      <td className="px-6 py-4">
                        <POStatusBadge id={po.id} currentStatus={po.status} />
                      </td>
                      <td className="px-6 py-4 font-medium text-white">
                        {formatRupee(po.totalAmount + po.totalGst)}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">{po._count.items}</td>
                      <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                        {new Date(po.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <Link href={`/purchase-orders/${po.id}`} className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                          {po.status === 'DRAFT' && (
                            <Link href={`/purchase-orders/${po.id}/edit`} className="p-2 text-brand-slate hover:text-brand-orange bg-brand-slate/10 hover:bg-brand-slate/20 rounded-md transition-colors" title="Edit">
                              <FileEdit className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
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
