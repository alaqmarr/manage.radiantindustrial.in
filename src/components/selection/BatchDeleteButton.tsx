"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSelection } from "./SelectionContext"
import { Trash2, Loader2 } from "lucide-react"
import { sileo } from "sileo"

export function BatchDeleteButton({
  deleteAction,
  entityName = "items",
}: {
  deleteAction: (ids: string[]) => Promise<{ success: boolean; error?: string }>
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
      const count = selectedIds.size
      const result = await deleteAction(Array.from(selectedIds))
      if (result.success) {
        clearSelection()
        sileo.success({
          title: "Items Deleted",
          description: `Successfully deleted ${count} ${entityName}.`,
        })
        router.refresh()
      } else {
        sileo.error({
          title: "Deletion Failed",
          description: result.error || "Failed to delete selected items.",
        })
      }
    } catch {
      sileo.error({
        title: "Deletion Failed",
        description: "An unexpected error occurred during deletion.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg transition-colors text-xs font-semibold border border-rose-200 shadow-2xs disabled:opacity-50 cursor-pointer"
    >
      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      Delete Selected ({selectedIds.size})
    </button>
  )
}
