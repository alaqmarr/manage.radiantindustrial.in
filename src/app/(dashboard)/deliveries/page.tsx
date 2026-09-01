import { prisma } from "@/lib/prisma"
import { Truck, ExternalLink } from "lucide-react"
import Link from "next/link"
import { DeliverySection } from "@/components/DeliverySection"

export const dynamic = "force-dynamic"

export default async function DeliveriesPage() {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        notIn: ["DRAFT", "CANCELLED"]
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: true,
      items: {
        include: {
          product: true
        }
      },
      deliveries: {
        include: {
          items: true
        },
        orderBy: { receivedDate: 'desc' }
      }
    }
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Truck className="w-6 h-6 text-brand-orange" />
          Active Goods Delivery Tracking
        </h1>
      </div>

      {pos.length === 0 ? (
        <div className="glass-panel border border-premium-border p-12 text-center text-zinc-500 rounded-lg">
          No active purchase orders to track.
        </div>
      ) : (
        <div className="space-y-8">
          {pos.map(po => {
            // Check if fully delivered to conditionally dim or hide if we wanted to
            const itemProgress = po.items.map(item => {
              const orderedQty = item.quantity
              let receivedQty = 0
              po.deliveries.forEach(grn => {
                const match = grn.items.find((gi: any) => gi.productId === item.productId)
                if (match) {
                  receivedQty += match.quantityReceived
                }
              })
              return { orderedQty, receivedQty }
            })
            const totalOrdered = itemProgress.reduce((sum, i) => sum + i.orderedQty, 0)
            const totalReceived = itemProgress.reduce((sum, i) => sum + i.receivedQty, 0)
            const isFullyDelivered = totalOrdered > 0 && totalReceived >= totalOrdered

            return (
              <div key={po.id} className={`glass-panel border border-premium-border rounded-lg overflow-hidden ${isFullyDelivered ? 'opacity-70' : ''}`}>
                <div className="bg-black/40 px-8 py-4 border-b border-premium-border flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-400 mb-1">Supplier: {po.supplier.name}</div>
                    <Link 
                      href={`/purchase-orders/${po.id}`}
                      className="text-lg font-bold text-brand-orange hover:underline flex items-center gap-2 w-fit"
                    >
                      {po.poNumber || po.id.slice(0, 8)}
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                      isFullyDelivered 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {isFullyDelivered ? 'Fully Delivered' : 'Delivery Pending'}
                    </span>
                  </div>
                </div>
                
                {/* We wrap DeliverySection in a div to override its default mt-6 margin and inner padding if necessary, but DeliverySection has its own glass-panel styling. We can just render it. */}
                <div className="-mt-6">
                  <DeliverySection 
                    poId={po.id}
                    items={po.items}
                    deliveries={po.deliveries}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
