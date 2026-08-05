"use client"

import React, { createContext, useContext, useState } from "react"

type SelectionContextType = {
  selectedIds: Set<string>
  toggleId: (id: string) => void
  toggleAll: (ids: string[]) => void
  clearSelection: () => void
}

const SelectionContext = createContext<SelectionContextType | null>(null)

export function useSelection() {
  const context = useContext(SelectionContext)
  if (!context) throw new Error("useSelection must be used within SelectionProvider")
  return context
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (ids: string[]) => {
    setSelectedIds(prev => {
      // If all are selected, clear them. Otherwise, select all.
      const allSelected = ids.every(id => prev.has(id))
      if (allSelected) {
        return new Set([...prev].filter(id => !ids.includes(id)))
      } else {
        const next = new Set(prev)
        ids.forEach(id => next.add(id))
        return next
      }
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  return (
    <SelectionContext.Provider value={{ selectedIds, toggleId, toggleAll, clearSelection }}>
      {children}
    </SelectionContext.Provider>
  )
}
