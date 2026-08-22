import React from "react"

interface PaymentStatusBadgeProps {
  status: string
  dueDate?: Date | string | null
}

export function PaymentStatusBadge({ status, dueDate }: PaymentStatusBadgeProps) {
  const normalizedStatus = (status || "").toUpperCase()

  let badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20"
  let displayText = "Unpaid"

  if (normalizedStatus === "PAID") {
    badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    displayText = "Paid"
  } else if (normalizedStatus === "PARTIALLY_PAID" || normalizedStatus === "PARTIAL") {
    badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20"
    displayText = "Partial"
  } else {
    badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20"
    displayText = "Unpaid"
  }

  let isOverdue = false
  if (dueDate && normalizedStatus !== "PAID") {
    const dueTime = new Date(dueDate).getTime()
    if (!isNaN(dueTime) && dueTime < Date.now()) {
      isOverdue = true
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}>
        {displayText}
      </span>
      {isOverdue && (
        <span className="inline-flex items-center text-[10px] font-bold text-rose-500 tracking-wider uppercase px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded">
          OVERDUE
        </span>
      )}
    </div>
  )
}

export default PaymentStatusBadge
