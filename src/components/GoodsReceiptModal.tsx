"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, X, Package } from "lucide-react"
import { createGoodsReceipt, updateGoodsReceipt } from "@/app/actions/goodsReceipt"

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
  editReceipt
}: GoodsReceiptModalProps) {
  const router = useRouter()

  const [grnNumber, setGrnNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset and pre-fill form when modal opens or items change
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
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleQuantityChange = (productId: string, value: string, maxQty: number) => {
    const parsed = value === "" ? 0 : parseFloat(value)
    if (isNaN(parsed)) return

    const clamped = Math.max(0, Math.min(parsed, maxQty))
    setReceiveQuantities((prev) => ({
      ...prev,
      [productId]: clamped
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const itemsToSubmit = items
      .map((item) => ({
        productId: item.productId,
        quantityReceived: Number(receiveQuantities[item.productId]) || 0
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
          items: itemsToSubmit
        })
      } else {
        result = await createGoodsReceipt({
          poId,
          grnNumber: grnNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          items: itemsToSubmit
        })
      }

      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
        onClose()
      }
    } catch (err: any) {
      console.error("Failed to record goods receipt:", err)
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" className="glass-panel w-full max-w-2xl p-6 rounded-md border border-premium-border max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-premium-border pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {editReceipt ? "Update Goods Receipt" : "Record Goods Receipt"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1.5">
                GRN Number
              </label>
              <input
                type="text"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                placeholder="Auto-generated if blank"
                disabled={isSubmitting}
                className="w-full bg-zinc-900/80 border border-premium-border rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-orange transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-1.5">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter notes, delivery challan #, etc."
                disabled={isSubmitting}
                rows={1}
                className="w-full bg-zinc-900/80 border border-premium-border rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-orange transition-colors resize-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-400 font-medium mb-2">
              Items to Receive
            </label>
            <div className="border border-premium-border rounded-md overflow-hidden bg-black/20">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-400 uppercase bg-black/40 border-b border-premium-border">
                    <tr>
                      <th className="px-4 py-3 font-medium">Material Code</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium text-center">Ordered</th>
                      <th className="px-4 py-3 font-medium text-center">Already Received</th>
                      <th className="px-4 py-3 font-medium text-right">Receive Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-premium-border">
                    {items.map((item) => {
                      const editItemQty = editReceipt?.items?.find((i: any) => i.productId === item.productId)?.quantityReceived || 0
                      const maxRemaining = Math.max(0, item.orderedQty - item.receivedQty + editItemQty)
                      const currentVal = receiveQuantities[item.productId] ?? 0
                      const isFullyDelivered = maxRemaining <= 0

                      return (
                        <tr key={item.productId} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                            {item.materialCode}
                          </td>
                          <td className="px-4 py-3 text-zinc-300 text-xs max-w-[200px] truncate" title={item.materialDescription}>
                            {item.materialDescription}
                          </td>
                          <td className="px-4 py-3 text-center text-white">
                            {item.orderedQty}
                          </td>
                          <td className="px-4 py-3 text-center text-zinc-400">
                            {item.receivedQty - editItemQty}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isFullyDelivered && !editReceipt ? (
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
                                  handleQuantityChange(item.productId, e.target.value, maxRemaining)
                                }
                                disabled={isSubmitting}
                                className="w-24 bg-zinc-900 border border-premium-border rounded px-2.5 py-1 text-sm text-white text-right focus:outline-none focus:border-brand-orange transition-colors disabled:opacity-50"
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-premium-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-premium-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-black bg-brand-orange hover:bg-brand-orange-dark rounded-md transition-colors disabled:opacity-50 active:scale-95 shadow-md shadow-brand-orange/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{editReceipt ? "Updating..." : "Recording..."}</span>
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  <span>{editReceipt ? "Update GRN" : "Record GRN"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default GoodsReceiptModal
