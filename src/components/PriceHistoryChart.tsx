"use client"
import { formatRupee } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

export function PriceHistoryChart({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null

  // Assuming history is ordered by changedAt desc
  return (
    <div className="glass-panel p-6 rounded-lg border border-premium-border">
      <h2 className="text-lg font-bold text-white mb-4">Price History</h2>
      <div className="space-y-4">
        {history.map((h, i) => {
          const previous = i < history.length - 1 ? history[i + 1] : null
          
          const cpDiff = previous ? h.costPrice - previous.costPrice : 0
          const spDiff = previous ? h.sellingPrice - previous.sellingPrice : 0

          return (
            <div key={h.id} className="bg-white/5 border border-premium-border p-4 rounded-md">
              <div className="text-xs text-zinc-500 mb-2">{new Date(h.changedAt).toLocaleString()}</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-400 mb-1">Cost Price</div>
                  <div className="flex items-center gap-2">
                    {previous && previous.costPrice !== h.costPrice && (
                      <span className="text-sm line-through text-zinc-500">{formatRupee(previous.costPrice)}</span>
                    )}
                    <span className="text-sm font-medium text-amber-500">{formatRupee(h.costPrice)}</span>
                    {cpDiff > 0 ? (
                      <TrendingUp className="w-3 h-3 text-rose-500" />
                    ) : cpDiff < 0 ? (
                      <TrendingDown className="w-3 h-3 text-emerald-500" />
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400 mb-1">Selling Price</div>
                  <div className="flex items-center gap-2">
                    {previous && previous.sellingPrice !== h.sellingPrice && (
                      <span className="text-sm line-through text-zinc-500">{formatRupee(previous.sellingPrice)}</span>
                    )}
                    <span className="text-sm font-medium text-emerald-500">{formatRupee(h.sellingPrice)}</span>
                    {spDiff > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                    ) : spDiff < 0 ? (
                      <TrendingDown className="w-3 h-3 text-rose-500" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
