"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updatePurchaseOrderStatus } from "@/app/actions/purchaseOrder"
import { Loader2, ChevronDown } from "lucide-react"

export function POStatusBadge({ id, currentStatus }: { id: string, currentStatus: string }) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    if (newStatus === currentStatus) return

    setIsUpdating(true)
    try {
      const result = await updatePurchaseOrderStatus(id, newStatus)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    } catch (e) {
      alert("Failed to update status")
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ISSUED': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'ACKNOWLEDGED': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'CANCELLED': return 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    }
  }

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <div className={`relative flex items-center border rounded-full overflow-hidden transition-colors ${getStatusColor(currentStatus)}`}>
        {isUpdating ? (
          <div className="px-3 py-1 flex items-center gap-2 text-xs font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Updating...</span>
          </div>
        ) : (
          <>
            <select
              value={currentStatus}
              onChange={handleStatusChange}
              className="appearance-none bg-transparent outline-none pl-3 pr-8 py-1 text-xs font-medium cursor-pointer w-full"
            >
              <option value="DRAFT" className="bg-zinc-900 text-white">DRAFT</option>
              <option value="ISSUED" className="bg-zinc-900 text-white">ISSUED</option>
              <option value="ACKNOWLEDGED" className="bg-zinc-900 text-white">ACKNOWLEDGED</option>
              <option value="COMPLETED" className="bg-zinc-900 text-white">COMPLETED</option>
              <option value="CANCELLED" className="bg-zinc-900 text-white">CANCELLED</option>
            </select>
            <div className="absolute right-2 pointer-events-none">
              <ChevronDown className="w-3 h-3 opacity-50" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
