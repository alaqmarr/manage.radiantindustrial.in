"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updatePurchaseOrderStatus } from "@/app/actions/purchaseOrder"
import { Loader2, ChevronDown } from "lucide-react"
import { sileo } from "sileo"

export function POStatusBadge({ id, currentStatus }: { id: string; currentStatus: string }) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    if (newStatus === currentStatus) return

    setIsUpdating(true)
    try {
      const result = await updatePurchaseOrderStatus(id, newStatus)
      if (result.error) {
        sileo.error({
          title: "Status Update Failed",
          description: result.error,
        })
      } else {
        sileo.success({
          title: "PO Status Updated",
          description: `Purchase Order status changed to ${newStatus}.`,
        })
        router.refresh()
      }
    } catch {
      sileo.error({
        title: "Status Update Failed",
        description: "Failed to update Purchase Order status.",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ISSUED":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "ACKNOWLEDGED":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "COMPLETED":
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "CANCELLED":
        return "bg-rose-50 text-rose-700 border-rose-200"
      default:
        return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <div
        className={`relative flex items-center border rounded-full overflow-hidden transition-colors ${getStatusColor(
          currentStatus
        )}`}
      >
        {isUpdating ? (
          <div className="px-3 py-1 flex items-center gap-2 text-xs font-semibold">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Updating...</span>
          </div>
        ) : (
          <>
            <select
              value={currentStatus}
              onChange={handleStatusChange}
              className="appearance-none bg-transparent outline-none pl-3 pr-7 py-1 text-xs font-semibold cursor-pointer w-full"
            >
              <option value="DRAFT" className="bg-white text-slate-900">
                DRAFT
              </option>
              <option value="ISSUED" className="bg-white text-slate-900">
                ISSUED
              </option>
              <option value="ACKNOWLEDGED" className="bg-white text-slate-900">
                ACKNOWLEDGED
              </option>
              <option value="COMPLETED" className="bg-white text-slate-900">
                COMPLETED
              </option>
              <option value="CANCELLED" className="bg-white text-slate-900">
                CANCELLED
              </option>
            </select>
            <div className="absolute right-2 pointer-events-none">
              <ChevronDown className="w-3 h-3 opacity-60" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
