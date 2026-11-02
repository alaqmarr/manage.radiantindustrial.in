import { getObligationSummary } from "@/app/actions/obligations"
import { ObligationsOverviewDashboard } from "@/components/ObligationsOverviewDashboard"

export default async function ObligationsOverviewPage() {
  const khumusSummary = await getObligationSummary("KHUMUS")
  const zakaatSummary = await getObligationSummary("ZAKAAT")

  return (
    <div className="w-full">
      <ObligationsOverviewDashboard 
        khumusSummary={khumusSummary}
        zakaatSummary={zakaatSummary}
      />
    </div>
  )
}
