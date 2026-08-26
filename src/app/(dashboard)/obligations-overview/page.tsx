import { getObligationSummary } from "@/app/actions/obligations"
import { ObligationsOverviewDashboard } from "@/components/ObligationsOverviewDashboard"

export default async function ObligationsOverviewPage() {
  const khumusSummary = await getObligationSummary("KHUMUS")
  const zakaatSummary = await getObligationSummary("ZAKAAT")

  return (
    <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      <ObligationsOverviewDashboard 
        khumusSummary={khumusSummary}
        zakaatSummary={zakaatSummary}
      />
    </div>
  )
}
