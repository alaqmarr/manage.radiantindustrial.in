"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSelection } from "./SelectionContext"
import { Trash2, Loader2 } from "lucide-react"

export function BatchDeleteButton({ 
  deleteAction, 
  entityName = "items" 
}: { 
  deleteAction: (ids: string[]) => Promise<{ success: boolean; error?: string }>,
  entityName?: string
}) {
  const router = useRouter()
  const { selectedIds, clearSelection } = useSelection()
  const [isDeleting, setIsDeleting] = useState(false)

  if (selectedIds.size === 0) return null

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected ${entityName}?`)) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteAction(Array.from(selectedIds))
      if (result.success) {
        clearSelection()
        router.refresh()
      } else {
        alert(result.error || "Failed to delete selected items")
      }
    } catch (e: any) {
      alert("An error occurred during deletion.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-md transition-colors text-sm font-medium border border-rose-500/20 shadow-sm disabled:opacity-50"
    >
      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      Delete Selected ({selectedIds.size})
    </button>
  )
}

