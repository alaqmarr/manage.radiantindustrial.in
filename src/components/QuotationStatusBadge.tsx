"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateQuotationStatus } from "@/app/actions/quotation"
import { Loader2, ChevronDown } from "lucide-react"
import { sileo } from "sileo"
import { QuotationOrderConfirmModal } from "./QuotationOrderConfirmModal"

export function QuotationStatusBadge({
  id,
  currentStatus,
  quotation,
}: {
  id: string
  currentStatus: string
  quotation?: {
    id: string
    prNo?: string | null
    client?: { name: string }
    items?: any[]
  }
}) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    if (newStatus === currentStatus) return

    // If changing to ACCEPTED and we have item details, open the Smart Order Confirmation modal
    if (newStatus === "ACCEPTED" && quotation?.items && quotation.items.length > 0) {
      setIsConfirmModalOpen(true)
      return
    }

    setIsUpdating(true)
    try {
      const result = await updateQuotationStatus(id, newStatus)
      if (result.error) {
        sileo.error({
          title: "Failed to Update Status",
          description: result.error,
        })
      } else {
        sileo.success({
          title: "Quotation Status Updated",
          description: `Status changed to ${newStatus}.`,
        })
        router.refresh()
      }
    } catch {
      sileo.error({
        title: "Failed to Update Status",
        description: "An unexpected error occurred.",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "COMPLETED":
        return "bg-teal-50 text-teal-700 border-teal-200"
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200"
      case "PENDING":
        return "bg-blue-50 text-blue-700 border-blue-200"
      default:
        return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  return (
    <>
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
                <option value="PENDING" className="bg-white text-slate-900">
                  PENDING
                </option>
                <option value="ACCEPTED" className="bg-white text-slate-900">
                  ACCEPTED
                </option>
                <option value="COMPLETED" className="bg-white text-slate-900">
                  COMPLETED
                </option>
                <option value="REJECTED" className="bg-white text-slate-900">
                  REJECTED
                </option>
              </select>
              <div className="absolute right-2 pointer-events-none">
                <ChevronDown className="w-3 h-3 opacity-60" />
              </div>
            </>
          )}
        </div>
      </div>

      {quotation?.items && (
        <QuotationOrderConfirmModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          quotationId={id}
          clientName={quotation.client?.name || "Client"}
          prNo={quotation.prNo}
          items={quotation.items}
        />
      )}
    </>
  )
}
