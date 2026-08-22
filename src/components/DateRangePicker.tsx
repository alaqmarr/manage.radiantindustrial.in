"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarDays } from "lucide-react"

export type Preset =
  | "Today"
  | "7 Days"
  | "30 Days"
  | "This Month"
  | "This Quarter"
  | "This Year"
  | "All Time"

export function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getToday(): { from: string; to: string } {
  const now = new Date()
  return {
    from: formatDate(now),
    to: formatDate(now),
  }
}

export function getLast7Days(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  from.setDate(now.getDate() - 7)
  return {
    from: formatDate(from),
    to: formatDate(now),
  }
}

export function getLast30Days(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  from.setDate(now.getDate() - 30)
  return {
    from: formatDate(from),
    to: formatDate(now),
  }
}

export function getThisMonth(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    from: formatDate(from),
    to: formatDate(now),
  }
}

export function getThisQuarter(): { from: string; to: string } {
  const now = new Date()
  const quarterMonth = Math.floor(now.getMonth() / 3) * 3
  const from = new Date(now.getFullYear(), quarterMonth, 1)
  return {
    from: formatDate(from),
    to: formatDate(now),
  }
}

export function getThisYear(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), 0, 1)
  return {
    from: formatDate(from),
    to: formatDate(now),
  }
}

interface PresetItem {
  label: Preset
  getRange?: () => { from: string; to: string }
}

const PRESET_ITEMS: PresetItem[] = [
  { label: "Today", getRange: getToday },
  { label: "7 Days", getRange: getLast7Days },
  { label: "30 Days", getRange: getLast30Days },
  { label: "This Month", getRange: getThisMonth },
  { label: "This Quarter", getRange: getThisQuarter },
  { label: "This Year", getRange: getThisYear },
  { label: "All Time" },
]

export interface DateRangePickerProps {
  className?: string
}

export function DateRangePicker({ className = "" }: DateRangePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const fromParam = searchParams.get("from") || ""
  const toParam = searchParams.get("to") || ""

  const [customFrom, setCustomFrom] = useState(fromParam)
  const [customTo, setCustomTo] = useState(toParam)

  useEffect(() => {
    setCustomFrom(fromParam)
    setCustomTo(toParam)
  }, [fromParam, toParam])

  const getActivePreset = (): Preset | "Custom" => {
    if (!fromParam && !toParam) {
      return "All Time"
    }
    for (const preset of PRESET_ITEMS) {
      if (preset.getRange) {
        const range = preset.getRange()
        if (range.from === fromParam && range.to === toParam) {
          return preset.label
        }
      }
    }
    return "Custom"
  }

  const activePreset = getActivePreset()

  const updateQueryParams = (from?: string, to?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (from && to) {
      params.set("from", from)
      params.set("to", to)
    } else {
      params.delete("from")
      params.delete("to")
    }
    if (params.has("page")) {
      params.set("page", "1")
    }
    const queryString = params.toString()
    router.push(queryString ? `?${queryString}` : window.location.pathname)
  }

  const handlePresetClick = (preset: Preset) => {
    if (preset === "All Time") {
      setCustomFrom("")
      setCustomTo("")
      updateQueryParams()
    } else {
      const item = PRESET_ITEMS.find((p) => p.label === preset)
      if (item?.getRange) {
        const range = item.getRange()
        setCustomFrom(range.from)
        setCustomTo(range.to)
        updateQueryParams(range.from, range.to)
      }
    }
  }

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!customFrom || !customTo) return
    updateQueryParams(customFrom, customTo)
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {PRESET_ITEMS.map((preset) => {
        const isActive = activePreset === preset.label
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetClick(preset.label)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              isActive
                ? "bg-white/10 border-white/20 text-white"
                : "border-premium-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            {preset.label}
          </button>
        )
      })}

      <form onSubmit={handleApplyCustom} className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-premium-surface/50 border border-premium-border rounded-full px-3 py-1 text-xs text-zinc-300">
          <CalendarDays className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-transparent text-xs text-zinc-300 focus:outline-none [color-scheme:dark]"
            aria-label="From Date"
          />
          <span className="text-zinc-500">-</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-transparent text-xs text-zinc-300 focus:outline-none [color-scheme:dark]"
            aria-label="To Date"
          />
        </div>
        <button
          type="submit"
          disabled={!customFrom || !customTo}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            activePreset === "Custom"
              ? "bg-white/10 border-white/20 text-white"
              : "border-premium-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          Apply
        </button>
      </form>
    </div>
  )
}

export default DateRangePicker
