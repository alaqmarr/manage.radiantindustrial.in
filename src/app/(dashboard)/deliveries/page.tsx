import { prisma } from "@/lib/prisma"
import { Truck, ExternalLink } from "lucide-react"
import Link from "next/link"
import { DeliverySection } from "@/components/DeliverySection"

export const dynamic = "force-dynamic"

export default async function DeliveriesPage() {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        notIn: ["DRAFT", "CANCELLED"],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
        },
      },
      deliveries: {
        include: {
          items: true,
        },
        orderBy: { receivedDate: "desc" },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Active Goods Delivery Tracking (GRN)
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Track incoming vendor shipments and record Goods Receipt Notes against active Purchase Orders.
          </p>
        </div>
      </div>

      {pos.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 text-center text-slate-500 rounded-2xl shadow-xs">
          No active purchase orders to track.
        </div>
      ) : (
        <div className="space-y-6">
          {pos.map((po) => {
            const itemProgress = po.items.map((item) => {
              const orderedQty = item.quantity
              let receivedQty = 0
              po.deliveries.forEach((grn) => {
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
              <div
                key={po.id}
                className={`bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden ${
                  isFullyDelivered ? "opacity-85" : ""
                }`}
              >
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-0.5">
                      Supplier:{" "}
                      <Link
                        href={`/suppliers/${po.supplierId}`}
                        className="text-slate-800 hover:text-blue-600 underline decoration-slate-300"
                      >
                        {po.supplier.name}
                      </Link>
                    </div>
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="text-base font-bold font-mono text-blue-600 hover:underline flex items-center gap-1.5 w-fit"
                    >
                      #{po.poNumber || po.id.slice(-6).toUpperCase()}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        isFullyDelivered
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {isFullyDelivered ? "Fully Delivered" : "Delivery Pending"}
                    </span>
                  </div>
                </div>

                <div className="-mt-6">
                  <DeliverySection poId={po.id} items={po.items} deliveries={po.deliveries} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
