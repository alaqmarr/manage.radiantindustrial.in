"use client"

import { AlertTriangle } from "lucide-react"

export interface MarginItem {
  spSnapshot: number
  cpSnapshot: number
  quantity: number
  additionalCost?: number
}

export interface MarginIndicatorProps {
  items: MarginItem[]
  threshold?: number
  className?: string
}

export function MarginIndicator({
  items = [],
  threshold = 10,
  className = "",
}: MarginIndicatorProps) {
  const totalRevenue = items.reduce(
    (acc, item) => acc + (Number(item.spSnapshot) || 0) * (Number(item.quantity) || 0),
    0
  )

  const totalCost = items.reduce(
    (acc, item) =>
      acc +
      (Number(item.cpSnapshot) || 0) * (Number(item.quantity) || 0) +
      (Number(item.additionalCost) || 0),
    0
  )

  const profit = totalRevenue - totalCost
  const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

  let colorClasses = "bg-rose-500/10 text-rose-400 border-rose-500/20"
  if (marginPct >= 20) {
    colorClasses = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
  } else if (marginPct >= threshold) {
    colorClasses = "bg-amber-500/10 text-amber-400 border-amber-500/20"
  }

  const isBelowThreshold = marginPct < threshold

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${colorClasses} ${className}`}
    >
      {isBelowThreshold && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
      <span>
        Margin: {marginPct.toFixed(1)}% (₹{(profit / 100).toLocaleString("en-IN")})
      </span>
    </div>
  )
}

export default MarginIndicator
