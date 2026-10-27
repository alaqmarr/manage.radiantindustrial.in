"use client"

import React from "react"
import { useSelection } from "./SelectionContext"

export function RowCheckbox({ id }: { id: string }) {
  const { selectedIds, toggleId } = useSelection()
  const isSelected = selectedIds.has(id)

  return (
    <input
      type="checkbox"
      className="w-4 h-4 rounded border-slate-300 bg-white text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
      checked={isSelected}
      onChange={() => toggleId(id)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
