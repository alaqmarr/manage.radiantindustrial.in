import { getObligationSummary, getObligationPayments } from "@/app/actions/obligations"
import { ObligationDashboard } from "@/components/ObligationDashboard"

export default async function KhumusPage() {
  const summary = await getObligationSummary("KHUMUS")
  const payments = await getObligationPayments("KHUMUS")

  return (
    <ObligationDashboard
      type="KHUMUS"
      title="Khumus"
      description="1/5th (20%) of realized profit generated from payments received on accepted quotations."
      totalDue={summary.totalDue}
      totalPaid={summary.totalPaid}
      outstanding={summary.outstanding}
      quotations={summary.quotations}
      payments={payments}
    />
  )
}
