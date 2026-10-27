"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Loader2, X, Package } from "lucide-react"
import { createGoodsReceipt, updateGoodsReceipt } from "@/app/actions/goodsReceipt"
import { sileo } from "sileo"

interface GoodsReceiptItemProp {
  productId: string
  materialCode: string
  materialDescription: string
  orderedQty: number
  receivedQty: number
}

interface GoodsReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  poId: string
  items: GoodsReceiptItemProp[]
  editReceipt?: any
}

export function GoodsReceiptModal({
  isOpen,
  onClose,
  poId,
  items,
  editReceipt,
}: GoodsReceiptModalProps) {
  const router = useRouter()

  const [grnNumber, setGrnNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (isOpen) {
      if (editReceipt) {
        setGrnNumber(editReceipt.grnNumber || "")
        setNotes(editReceipt.notes || "")
      } else {
        setGrnNumber("")
        setNotes("")
      }
      setError(null)

      const initialQtys: Record<string, number> = {}
      for (const item of items) {
        if (editReceipt) {
          const editItem = editReceipt.items?.find((i: any) => i.productId === item.productId)
          initialQtys[item.productId] = editItem ? editItem.quantityReceived : 0
        } else {
          initialQtys[item.productId] = Math.max(0, item.orderedQty - item.receivedQty)
        }
      }
      setReceiveQuantities(initialQtys)
    }
  }, [isOpen, items, editReceipt])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  const handleQuantityChange = (productId: string, value: string, maxQty: number) => {
    const parsed = value === "" ? 0 : parseFloat(value)
    if (isNaN(parsed)) return

    const clamped = Math.max(0, Math.min(parsed, maxQty))
    setReceiveQuantities((prev) => ({
      ...prev,
      [productId]: clamped,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const itemsToSubmit = items
      .map((item) => ({
        productId: item.productId,
        quantityReceived: Number(receiveQuantities[item.productId]) || 0,
      }))
      .filter((item) => item.quantityReceived > 0)

    if (itemsToSubmit.length === 0) {
      setError("Please specify a quantity greater than 0 for at least one item to receive.")
      return
    }

    setIsSubmitting(true)

    try {
      let result
      if (editReceipt) {
        result = await updateGoodsReceipt(editReceipt.id, {
          grnNumber: grnNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          items: itemsToSubmit,
        })
      } else {
        result = await createGoodsReceipt({
          poId,
          grnNumber: grnNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          items: itemsToSubmit,
        })
      }

      if (result.error) {
        setError(result.error)
        sileo.error({ title: "GRN Save Error", description: result.error })
      } else {
        sileo.success({
          title: editReceipt ? "Goods Receipt Updated" : "Goods Receipt Recorded",
          description: `Logged receipt for ${itemsToSubmit.length} line item(s).`,
        })
        router.refresh()
        onClose()
      }
    } catch (err: any) {
      console.error("Failed to record goods receipt:", err)
      setError(err.message || "An unexpected error occurred.")
      sileo.error({
        title: "GRN Error",
        description: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white w-full max-w-2xl p-6 rounded-2xl border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {editReceipt ? "Update Goods Receipt (GRN)" : "Record Goods Receipt (GRN)"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-600 font-bold mb-1.5">
                GRN Number
              </label>
              <input
                type="text"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                placeholder="Auto-generated if left blank"
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-600 font-bold mb-1.5">
                Delivery Challan / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter DC #, vehicle info, or notes..."
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-600 font-bold mb-2">
              Items to Receive
            </label>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Material Code</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold text-center">Ordered</th>
                      <th className="px-4 py-3 font-semibold text-center">Already Received</th>
                      <th className="px-4 py-3 font-semibold text-right">Receive Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item) => {
                      const editItemQty =
                        editReceipt?.items?.find((i: any) => i.productId === item.productId)
                          ?.quantityReceived || 0
                      const maxRemaining = Math.max(
                        0,
                        item.orderedQty - item.receivedQty + editItemQty
                      )
                      const currentVal = receiveQuantities[item.productId] ?? 0
                      const isFullyDelivered = maxRemaining <= 0

                      return (
                        <tr key={item.productId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono font-bold text-xs text-slate-900 whitespace-nowrap">
                            {item.materialCode}
                          </td>
                          <td
                            className="px-4 py-3 text-slate-700 text-xs max-w-[200px] truncate"
                            title={item.materialDescription}
                          >
                            {item.materialDescription}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs text-slate-800">
                            {item.orderedQty}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">
                            {item.receivedQty - editItemQty}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isFullyDelivered && !editReceipt ? (
                              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Completed
                              </span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={maxRemaining}
                                step="any"
                                value={currentVal}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    item.productId,
                                    e.target.value,
                                    maxRemaining
                                  )
                                }
                                disabled={isSubmitting}
                                className="w-24 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-slate-900 text-right focus:outline-none focus:border-orange-600"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 bg-white rounded-lg border border-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span className="text-white">{editReceipt ? "Updating..." : "Recording..."}</span>
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 text-white" />
                  <span className="text-white">{editReceipt ? "Update GRN" : "Record GRN"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
export default GoodsReceiptModal
