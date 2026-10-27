"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import { TrendingUp, TrendingDown, History, BookmarkCheck, Loader2, FileText } from "lucide-react"
import { saveProductSellingPrice } from "@/app/actions/product"
import { sileo } from "sileo"

export function PriceHistoryChart({
  productId,
  currentCostPrice,
  currentSellingPrice,
  history,
  quotedHistory = [],
}: {
  productId?: string
  currentCostPrice?: number
  currentSellingPrice?: number
  history: any[]
  quotedHistory?: any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"catalog" | "quoted">("catalog")
  const [newSp, setNewSp] = useState<string>(
    currentSellingPrice ? String(currentSellingPrice / 100) : ""
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleQuickSaveSp = async () => {
    if (!productId) return
    const val = parseFloat(newSp)
    if (isNaN(val) || val < 0) {
      sileo.warning({
        title: "Invalid Selling Price",
        description: "Please enter a valid selling price in Rupees.",
      })
      return
    }
    setIsSaving(true)
    const res = await saveProductSellingPrice(productId, Math.round(val * 100), currentCostPrice)
    setIsSaving(false)
    if (res.success) {
      sileo.success({
        title: "Selling Price Saved",
        description: `Catalog selling price updated to ${formatRupee(Math.round(val * 100))} and recorded in Price History.`,
      })
      router.refresh()
    } else {
      sileo.error({
        title: "Failed to Save Price",
        description: res.error || "Could not update selling price.",
      })
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-orange-600" />
          <h2 className="text-base font-bold text-slate-900">Selling & Cost Price History</h2>
        </div>
      </div>

      {/* Quick Save Selling Price Box */}
      {productId && (
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Quick Update Catalog Selling Price
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newSp}
                onChange={(e) => setNewSp(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
            <button
              type="button"
              onClick={handleQuickSaveSp}
              disabled={isSaving}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <BookmarkCheck className="w-3.5 h-3.5 text-white" />
              )}
              <span className="text-white">Save SP</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            tab === "catalog"
              ? "bg-white text-slate-900 shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Catalog Revisions ({history?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab("quoted")}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            tab === "quoted"
              ? "bg-white text-slate-900 shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Client Quotes ({quotedHistory?.length || 0})
        </button>
      </div>

      {/* History List */}
      {tab === "catalog" ? (
        !history || history.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No catalog price revisions logged yet. Saving a new Cost or Selling Price automatically records a revision here.
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
            {history.map((h, i) => {
              const previous = i < history.length - 1 ? history[i + 1] : null
              const cpDiff = previous ? h.costPrice - previous.costPrice : 0
              const spDiff = previous ? h.sellingPrice - previous.sellingPrice : 0
              const margin = h.sellingPrice - h.costPrice
              const marginPct =
                h.sellingPrice > 0 ? ((margin / h.sellingPrice) * 100).toFixed(1) : "0.0"

              return (
                <div
                  key={h.id}
                  className="bg-slate-50/80 border border-slate-200 p-3.5 rounded-xl space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-medium">{new Date(h.changedAt).toLocaleString()}</span>
                    {h.sellingPrice > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          margin >= 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        Margin: {marginPct}%
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/70">
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-slate-400 mb-0.5">
                        Cost Price (CP)
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {previous && previous.costPrice !== h.costPrice && (
                          <span className="text-xs line-through text-slate-400 font-mono">
                            {formatRupee(previous.costPrice)}
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-800 font-mono">
                          {formatRupee(h.costPrice)}
                        </span>
                        {cpDiff > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                        ) : cpDiff < 0 ? (
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase text-slate-400 mb-0.5">
                        Selling Price (SP)
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {previous && previous.sellingPrice !== h.sellingPrice && (
                          <span className="text-xs line-through text-slate-400 font-mono">
                            {formatRupee(previous.sellingPrice)}
                          </span>
                        )}
                        <span className="text-sm font-bold text-emerald-700 font-mono">
                          {formatRupee(h.sellingPrice)}
                        </span>
                        {spDiff > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : spDiff < 0 ? (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : !quotedHistory || quotedHistory.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          This product has not been quoted to any client yet.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
          {quotedHistory.map((item: any) => (
            <div
              key={item.id}
              className="bg-slate-50/80 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  <span className="truncate">{item.quotation?.client?.name || "Client"}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Quote #{item.quotation?.prNo || item.quotation?.id?.slice(-6).toUpperCase()} •{" "}
                  {new Date(item.quotation?.createdAt).toLocaleDateString()} • Qty: {item.qty}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-bold text-emerald-700">
                  {formatRupee(item.spSnapshot)}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  CP: {formatRupee(item.cpSnapshot)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
