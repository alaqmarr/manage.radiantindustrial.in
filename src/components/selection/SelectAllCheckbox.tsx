"use client"

import React from "react"
import { useSelection } from "./SelectionContext"

export function SelectAllCheckbox({ allIds }: { allIds: string[] }) {
  const { selectedIds, toggleAll } = useSelection()
  
  if (allIds.length === 0) {
    return <input type="checkbox" disabled className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 opacity-50" />
  }

  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
  const someSelected = allIds.some(id => selectedIds.has(id))
  
  return (
    <input 
      type="checkbox" 
      className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-brand-orange focus:ring-brand-slate focus:ring-offset-zinc-900 cursor-pointer"
      checked={allSelected}
      ref={input => {
        if (input) input.indeterminate = !allSelected && someSelected
      }}
      onChange={() => toggleAll(allIds)}
    />
  )
}
