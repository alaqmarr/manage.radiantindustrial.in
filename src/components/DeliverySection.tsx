"use client"
import { useState } from "react"
import { GoodsReceiptModal } from "./GoodsReceiptModal"
import { Package, Truck, Edit2 } from "lucide-react"

export function DeliverySection({
  poId,
  items,
  deliveries,
}: {
  poId: string
  items: any[]
  deliveries: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<any>(null)

  // Calculate delivery progress
  const itemProgress = items.map((item) => {
    const orderedQty = item.quantity
    let receivedQty = 0
    deliveries.forEach((grn) => {
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
      pendingQty: Math.max(0, orderedQty - receivedQty),
    }
  })

  const totalOrdered = itemProgress.reduce((sum, i) => sum + i.orderedQty, 0)
  const totalReceived = itemProgress.reduce((sum, i) => sum + i.receivedQty, 0)
  const isFullyDelivered = totalOrdered > 0 && totalReceived >= totalOrdered
  const allDelivered = itemProgress.every((i) => i.receivedQty >= i.orderedQty)

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs mt-6 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-600" />
            <h2 className="text-base font-bold text-slate-900">
              Goods Receipt & Delivery Tracking (GRN)
            </h2>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-500 text-xs font-medium">Overall Receipt Progress:</span>
            <div className="w-44 h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${isFullyDelivered ? "bg-emerald-500" : "bg-orange-500"}`}
                style={{
                  width: `${Math.min(
                    100,
                    totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0
                  )}%`,
                }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-slate-700">
              {totalReceived} / {totalOrdered} units
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingReceipt(null)
            setIsModalOpen(true)
          }}
          disabled={allDelivered}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <Package className="w-4 h-4 text-white" />
          <span className="text-white">Record Goods Receipt (GRN)</span>
        </button>
      </div>

      <div className="space-y-3 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Line Item Delivery Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {itemProgress.map((item) => (
            <div
              key={item.productId}
              className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between"
            >
              <div className="min-w-0 pr-3">
                <div className="text-xs font-mono font-bold text-slate-800">
                  {item.materialCode}
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5">
                  {item.materialDescription}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-600 font-mono">
                  Received:{" "}
                  <strong
                    className={
                      item.receivedQty >= item.orderedQty
                        ? "text-emerald-700"
                        : "text-slate-900"
                    }
                  >
                    {item.receivedQty}
                  </strong>{" "}
                  / {item.orderedQty}
                </div>
                {item.pendingQty > 0 ? (
                  <div className="text-[11px] font-semibold text-amber-600 mt-0.5">
                    {item.pendingQty} pending
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-emerald-700 flex items-center justify-end gap-1 mt-0.5">
                    <Truck className="w-3 h-3" /> Complete
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {deliveries.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">GRN Number</th>
                <th className="py-3 px-4 font-semibold">Challan / Notes</th>
                <th className="py-3 px-4 font-semibold text-right">Units Received</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {deliveries.map((grn) => {
                const totalItemsInGrn = grn.items.reduce(
                  (sum: number, gi: any) => sum + gi.quantityReceived,
                  0
                )
                return (
                  <tr key={grn.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 text-slate-700 text-xs">
                      {new Date(grn.receivedDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-mono font-bold text-xs">
                      {grn.grnNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{grn.notes || "—"}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {totalItemsInGrn}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReceipt(grn)
                          setIsModalOpen(true)
                        }}
                        className="text-slate-400 hover:text-slate-800 p-1 rounded transition-colors cursor-pointer"
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
        <div className="text-center p-6 text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No goods receipt notes (GRNs) recorded yet.
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
