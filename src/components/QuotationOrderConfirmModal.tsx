"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { confirmQuotationOrder } from "@/app/actions/quotation"
import { formatRupee, formatShortId } from "@/lib/utils"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import {
  X,
  Check,
  Loader2,
  CheckCircle2,
  XCircle,
  Split,
  Sparkles,
  RotateCcw,
} from "lucide-react"
import { sileo } from "sileo"

export interface ConfirmModalQuotationItem {
  id: string
  quantity: number
  quotedQuantity?: number | null
  isConfirmed?: boolean
  spSnapshot: number
  cpSnapshot?: number | null
  gstSnapshot?: number
  additionalCost?: number | null
  product: {
    id: string
    materialCode: string
    materialDescription: string
    unit: string
    gstRate: number
  }
}

export function QuotationOrderConfirmModal({
  isOpen,
  onClose,
  quotationId,
  clientName,
  prNo,
  items,
  onConfirmed,
}: {
  isOpen: boolean
  onClose: () => void
  quotationId: string
  clientName: string
  prNo?: string | null
  items: ConfirmModalQuotationItem[]
  onConfirmed?: () => void
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [splitUnconfirmed, setSplitUnconfirmed] = useState(false)

  const [rows, setRows] = useState<
    {
      itemId: string
      isConfirmed: boolean
      confirmedQuantity: number
      originalQuantity: number
    }[]
  >([])

  useEffect(() => {
    if (isOpen) {
      setRows(
        items.map((item) => {
          const origQty = item.quotedQuantity ?? item.quantity
          return {
            itemId: item.id,
            isConfirmed: item.isConfirmed !== false,
            confirmedQuantity: item.quantity,
            originalQuantity: origQty,
          }
        })
      )
      setSplitUnconfirmed(false)
    }
  }, [isOpen, items])

  if (!isOpen) return null

  const toggleRow = (itemId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, isConfirmed: !r.isConfirmed } : r))
    )
  }

  const updateRowQty = (itemId: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.itemId === itemId
          ? {
              ...r,
              confirmedQuantity: qty,
              isConfirmed: qty > 0 ? true : r.isConfirmed,
            }
          : r
      )
    )
  }

  const handleSelectAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, isConfirmed: true })))
  }

  const handleClearAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, isConfirmed: false })))
  }

  const handleResetQuantities = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        isConfirmed: true,
        confirmedQuantity: r.originalQuantity,
      }))
    )
  }

  const confirmedRows = rows.filter((r) => r.isConfirmed && r.confirmedQuantity > 0)
  const isPartialOrder =
    confirmedRows.length < items.length ||
    rows.some((r) => r.isConfirmed && r.confirmedQuantity < r.originalQuantity)

  // Compute live financial totals
  let originalSubtotal = 0
  let confirmedSubtotal = 0
  let confirmedGst = 0
  let confirmedCost = 0

  for (const item of items) {
    const r = rows.find((x) => x.itemId === item.id)
    const origQty = r ? r.originalQuantity : item.quotedQuantity ?? item.quantity
    originalSubtotal += Math.round(origQty * item.spSnapshot)

    if (r && r.isConfirmed && r.confirmedQuantity > 0) {
      const lineSub = Math.round(r.confirmedQuantity * item.spSnapshot)
      const gstRate = item.gstSnapshot ?? item.product.gstRate
      const lineGst = Math.round(lineSub * (gstRate / 100))
      confirmedSubtotal += lineSub
      confirmedGst += lineGst
      confirmedCost +=
        Math.round((item.cpSnapshot || 0) * r.confirmedQuantity) +
        (item.additionalCost || 0)
    }
  }

  const confirmedProfit = confirmedSubtotal - confirmedCost

  const handleSubmit = async () => {
    if (confirmedRows.length === 0) {
      sileo.warning({
        title: "No Confirmed Items",
        description: "Please select at least 1 item that the client has ordered.",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await confirmQuotationOrder({
        quotationId,
        items: rows.map((r) => ({
          itemId: r.itemId,
          isConfirmed: r.isConfirmed,
          confirmedQuantity: r.confirmedQuantity,
        })),
        splitUnconfirmedToNewQuote: isPartialOrder && splitUnconfirmed,
      })

      if (res.error) {
        sileo.error({
          title: "Confirmation Failed",
          description: res.error,
        })
      } else {
        sileo.success({
          title: isPartialOrder
            ? `Partial Order Confirmed (${res.confirmedCount}/${res.totalCount} items)`
            : "Full Order Confirmed",
          description: res.splitQuotationId
            ? `Order accepted and remaining items moved to new Quotation #${formatShortId(
                res.splitQuotationId
              )}.`
            : `Quotation #${formatShortId(
                quotationId
              )} updated to ACCEPTED with ${res.confirmedCount} confirmed item(s).`,
        })
        onConfirmed?.()
        onClose()
        router.refresh()
      }
    } catch (e: any) {
      sileo.error({
        title: "Error",
        description: e.message || "Failed to confirm quotation order.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                Smart Order Confirmation
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Confirm Client Order — #{formatShortId(quotationId)}
                {prNo ? ` (PR: ${prNo})` : ""}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client: <strong className="text-slate-800">{clientName}</strong> • Select which items and quantities the client actually ordered.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-emerald-50/50 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-950">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Partial Order Support:</strong> Uncheck items the client did not order (e.g. 5 out of 10 items), or reduce confirmed quantities. Billing &amp; Supplier POs will automatically adjust!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Select All ({items.length})
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleResetQuantities}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
              title="Reset all quantities back to originally quoted quantities"
            >
              <RotateCcw className="w-3 h-3" /> Reset Qtys
            </button>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-32">Order Status</th>
                  <th className="py-3 px-4">Product &amp; Material Code</th>
                  <th className="py-3 px-4 text-center w-28">Quoted Qty</th>
                  <th className="py-3 px-4 text-center w-36">Confirmed Qty</th>
                  <th className="py-3 px-4 text-right w-32">Selling Rate</th>
                  <th className="py-3 px-4 text-right w-36">Confirmed Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, idx) => {
                  const row = rows.find((r) => r.itemId === item.id)
                  const isConfirmed = row ? row.isConfirmed : true
                  const confirmedQty = row ? row.confirmedQuantity : item.quantity
                  const origQty = row
                    ? row.originalQuantity
                    : item.quotedQuantity ?? item.quantity
                  const lineAmount = isConfirmed
                    ? Math.round(confirmedQty * item.spSnapshot)
                    : 0

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isConfirmed
                          ? "bg-white hover:bg-emerald-50/20"
                          : "bg-slate-50/80 opacity-65"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleRow(item.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            isConfirmed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {isConfirmed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Ordered
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              Dropped
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-xs font-bold text-orange-600">
                            {item.product.materialCode}
                          </span>
                        </div>
                        <div
                          className={`text-xs font-semibold mt-0.5 ${
                            isConfirmed
                              ? "text-slate-900"
                              : "text-slate-500 line-through"
                          }`}
                        >
                          {item.product.materialDescription}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs text-slate-500">
                        {origQty} {item.product.unit}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <SmartNumberInput
                            disabled={!isConfirmed}
                            value={isConfirmed ? confirmedQty : 0}
                            maxDecimals={3}
                            onValueChange={(num) => updateRowQty(item.id, num)}
                            className="w-20 bg-white border border-slate-300 disabled:bg-slate-100 rounded-lg px-2 py-1 text-center font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                          />
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.product.unit}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-700">
                        {formatRupee(item.spSnapshot)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-bold">
                        {isConfirmed ? (
                          <span className="text-slate-900">{formatRupee(lineAmount)}</span>
                        ) : (
                          <span className="text-slate-400">₹0.00 (Excluded)</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Optional Split Unconfirmed Items Card */}
          {isPartialOrder && (
            <label className="mt-4 flex items-start gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50/60 cursor-pointer hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={splitUnconfirmed}
                onChange={(e) => setSplitUnconfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
              />
              <div className="flex-1 text-xs">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <Split className="w-3.5 h-3.5 text-blue-600" />
                  Move unconfirmed items / balance quantities into a new Follow-Up Quotation
                </div>
                <p className="text-blue-800 mt-0.5">
                  Check this if the client might order the remaining{" "}
                  <strong>{items.length - confirmedRows.length}</strong> item(s) later. Leave unchecked if the remaining items were dropped — they will stay visible in this quotation marked as{" "}
                  <strong>Not Ordered</strong> and will be excluded from billing and PO generation.
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Footer with Live Financial Comparison */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Confirmed Items
              </div>
              <div className="text-sm font-black font-mono text-slate-900">
                {confirmedRows.length} / {items.length} items
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Original Quote (Excl. GST)
              </div>
              <div className="text-sm font-bold font-mono text-slate-500">
                {formatRupee(originalSubtotal)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Confirmed Value (Incl. GST)
              </div>
              <div className="text-base font-black font-mono text-emerald-700">
                {formatRupee(confirmedSubtotal + confirmedGst)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Est. Confirmed Profit
              </div>
              <div className="text-sm font-bold font-mono text-emerald-600">
                {formatRupee(confirmedProfit)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || confirmedRows.length === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Check className="w-4 h-4 text-white" />
              )}
              <span className="text-white">
                {isPartialOrder
                  ? `Confirm Partial Order (${confirmedRows.length}/${items.length})`
                  : `Confirm Full Order (${items.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
