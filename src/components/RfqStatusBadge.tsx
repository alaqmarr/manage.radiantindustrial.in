"use client"

import { useState } from "react"
import { updateRfqStatus } from "@/app/actions/rfq"
import { Loader2, ChevronDown } from "lucide-react"

export function RfqStatusBadge({ id, currentStatus }: { id: string, currentStatus: string }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    if (newStatus === currentStatus) return

    setIsUpdating(true)
    try {
      const result = await updateRfqStatus(id, newStatus)
      if (result.error) {
        alert(result.error)
      }
    } catch (e) {
      alert("Failed to update status")
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'REJECTED': return 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      case 'PENDING': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
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
              <option value="PENDING" className="bg-zinc-900 text-white">PENDING</option>
              <option value="ACCEPTED" className="bg-zinc-900 text-white">ACCEPTED</option>
              <option value="REJECTED" className="bg-zinc-900 text-white">REJECTED</option>
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
