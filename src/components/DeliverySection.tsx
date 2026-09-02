"use client"
import { useState } from "react"
import { GoodsReceiptModal } from "./GoodsReceiptModal"
import { formatRupee } from "@/lib/utils"
import { Package, Truck, Edit2 } from "lucide-react"

export function DeliverySection({ 
  poId, 
  items,
  deliveries 
}: { 
  poId: string
  items: any[]
  deliveries: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<any>(null)

  // Calculate delivery progress
  const itemProgress = items.map(item => {
    const orderedQty = item.quantity
    let receivedQty = 0
    deliveries.forEach(grn => {
      const match = grn.items.find((gi: any) => gi.productId === item.productId)
      if (match) {
        receivedQty += match.quantityReceived
      }
    })
    return {
      productId: item.productId,
      materialCode: item.product.materialCode,
      materialDescription: item.product.materialDescription,
      orderedQty,
      receivedQty,
      pendingQty: Math.max(0, orderedQty - receivedQty)
    }
  })

  const totalOrdered = itemProgress.reduce((sum, i) => sum + i.orderedQty, 0)
  const totalReceived = itemProgress.reduce((sum, i) => sum + i.receivedQty, 0)
  const isFullyDelivered = totalOrdered > 0 && totalReceived >= totalOrdered
  const allDelivered = itemProgress.every(i => i.receivedQty >= i.orderedQty)

  return (
    <div className="glass-panel p-8 rounded-lg mt-6 print:hidden">
      <div className="flex items-center justify-between mb-6 border-b border-premium-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Delivery Tracking (GRN)</h2>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm">Overall Progress:</span>
            <div className="w-48 h-2.5 bg-zinc-800 rounded-full overflow-hidden ml-2">
              <div 
                className={`h-full ${isFullyDelivered ? 'bg-emerald-500' : 'bg-brand-orange'}`} 
                style={{ width: `${Math.min(100, totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0)}%` }} 
              />
            </div>
            <span className="text-xs text-zinc-300 ml-2">{totalReceived} / {totalOrdered} items</span>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingReceipt(null)
            setIsModalOpen(true)
          }}
          disabled={allDelivered}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
        >
          <Package className="w-4 h-4" /> Record Receipt
        </button>
      </div>

      <div className="space-y-4 mb-8">
        <h3 className="text-sm font-medium text-white">Item Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {itemProgress.map(item => (
            <div key={item.productId} className="bg-white/5 border border-premium-border p-4 rounded-md flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-zinc-400 mb-1">{item.materialCode}</div>
                <div className="text-sm font-medium text-white truncate max-w-[200px]">{item.materialDescription}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 mb-1">
                  Received: <span className={item.receivedQty >= item.orderedQty ? "text-emerald-400 font-bold" : "text-white"}>{item.receivedQty}</span> / {item.orderedQty}
                </div>
                {item.pendingQty > 0 ? (
                  <div className="text-[10px] text-amber-500">{item.pendingQty} pending</div>
                ) : (
                  <div className="text-[10px] text-emerald-500 flex items-center justify-end gap-1"><Truck className="w-3 h-3"/> Complete</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {deliveries.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-white mb-4">Receipt History</h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-y border-premium-border">
              <tr>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">GRN Number</th>
                <th className="py-3 px-4 font-medium">Notes</th>
                <th className="py-3 px-4 font-medium text-right">Items Received</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {deliveries.map(grn => {
                const totalItemsInGrn = grn.items.reduce((sum: number, gi: any) => sum + gi.quantityReceived, 0)
                return (
                  <tr key={grn.id} className="hover:bg-white/5">
                    <td className="py-3 px-4 text-zinc-300">{new Date(grn.receivedDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-zinc-300 font-mono text-xs">{grn.grnNumber}</td>
                    <td className="py-3 px-4 text-zinc-400">{grn.notes || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium text-white">{totalItemsInGrn}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingReceipt(grn)
                          setIsModalOpen(true)
                        }}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Edit GRN"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-8 text-zinc-500 bg-white/5 rounded-md border border-premium-border/50">
          No goods received yet.
        </div>
      )}

      {isModalOpen && (
        <GoodsReceiptModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setEditingReceipt(null)
          }}
          poId={poId}
          items={itemProgress}
          editReceipt={editingReceipt}
        />
      )}
    </div>
  )
}
