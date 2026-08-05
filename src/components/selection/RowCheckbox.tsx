"use client"

import React from "react"
import { useSelection } from "./SelectionContext"

export function RowCheckbox({ id }: { id: string }) {
  const { selectedIds, toggleId } = useSelection()
  const isSelected = selectedIds.has(id)

  return (
    <input 
      type="checkbox" 
      className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-brand-orange focus:ring-brand-slate focus:ring-offset-zinc-900 cursor-pointer"
      checked={isSelected}
      onChange={() => toggleId(id)}
      onClick={e => e.stopPropagation()} // Prevent row click if any
    />
  )
}
