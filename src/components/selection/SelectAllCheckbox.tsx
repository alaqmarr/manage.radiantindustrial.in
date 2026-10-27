"use client"

import React from "react"
import { useSelection } from "./SelectionContext"

export function SelectAllCheckbox({ allIds }: { allIds: string[] }) {
  const { selectedIds, toggleAll } = useSelection()

  if (allIds.length === 0) {
    return (
      <input
        type="checkbox"
        disabled
        className="w-4 h-4 rounded border-slate-300 bg-slate-100 opacity-50"
      />
    )
  }

  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = allIds.some((id) => selectedIds.has(id))

  return (
    <input
      type="checkbox"
      className="w-4 h-4 rounded border-slate-300 bg-white text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
      checked={allSelected}
      ref={(input) => {
        if (input) input.indeterminate = !allSelected && someSelected
      }}
      onChange={() => toggleAll(allIds)}
    />
  )
}
