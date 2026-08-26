import { getObligationSummary, getObligationPayments } from "@/app/actions/obligations"
import { ObligationDashboard } from "@/components/ObligationDashboard"

export default async function ZakaatPage() {
  const summary = await getObligationSummary("ZAKAAT")
  const payments = await getObligationPayments("ZAKAAT")

  return (
    <ObligationDashboard
      type="ZAKAAT"
      title="Zakaat"
      description="1/40th (2.5%) of realized profit generated from payments received on accepted quotations."
      totalDue={summary.totalDue}
      totalExpectedDue={summary.totalExpectedDue}
      totalPaid={summary.totalPaid}
      outstanding={summary.outstanding}
      quotations={summary.quotations}
      payments={payments}
    />
  )
}
