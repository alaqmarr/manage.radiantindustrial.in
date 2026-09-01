import { prisma } from "@/lib/prisma"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import { ExternalLink, Truck, Calendar } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DeliveriesPage() {
  const deliveries = await prisma.goodsReceipt.findMany({
    orderBy: { receivedDate: 'desc' },
    include: {
      po: {
        include: {
          supplier: true
        }
      },
      items: {
        include: {
          product: true
        }
      }
    }
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Truck className="w-6 h-6 text-brand-orange" />
          Goods Delivery Tracking
        </h1>
      </div>

      <div className="glass-panel border border-premium-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-premium-border/50 bg-black/40">
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">GRN Number</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Purchase Order</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Supplier</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Items Received</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border/30">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No deliveries recorded yet.
                  </td>
                </tr>
              ) : (
                deliveries.map(delivery => (
                  <tr key={delivery.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Calendar className="w-4 h-4 text-zinc-500" />
                        {new Date(delivery.receivedDate).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm text-brand-orange font-medium">
                        {delivery.grnNumber || "N/A"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <Link 
                        href={`/purchase-orders/${delivery.poId}`}
                        className="font-mono text-sm text-blue-400 hover:underline flex items-center gap-1 w-fit"
                      >
                        {delivery.po?.poNumber || delivery.poId.slice(0,8)}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-white">{delivery.po?.supplier.name}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        {delivery.items.map(item => (
                          <div key={item.id} className="text-xs text-zinc-400">
                            <span className="text-white font-medium">{item.quantityReceived} {item.product.unit}</span> × {item.product.materialDescription}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/purchase-orders/${delivery.poId}`}
                        className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                      >
                        View PO
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
