import { prisma } from "@/lib/prisma"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import { ExternalLink, FileText, CheckCircle2, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function QuotationDuesPage() {
  const duesRaw = await prisma.quotation.findMany({
    where: {
      status: {
        in: ["ACCEPTED", "COMPLETED"],
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      client: true,
    },
  })

  // Calculate totals and filter out fully paid
  const dues = duesRaw.filter((q) => q.totalAmount + q.totalGst - q.amountPaid > 0)

  const totalReceivable = dues.reduce((sum, q) => sum + (q.totalAmount + q.totalGst), 0)
  const totalCollected = dues.reduce((sum, q) => sum + q.amountPaid, 0)
  const totalOutstanding = totalReceivable - totalCollected

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Quotation Dues & Receivables Aging
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Track unpaid and partially paid accepted client quotations with 1-click WhatsApp reminders.
            </p>
          </div>
        </div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
        >
          <span className="text-white">Open Accounts & Cashflow</span>
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            Total Billed Value (Active Dues)
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {formatRupee(totalReceivable)}
          </div>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-200 p-5 rounded-xl shadow-xs">
          <div className="text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">
            Total Collected So Far
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {formatRupee(totalCollected)}
          </div>
        </div>
        <div className="bg-rose-50/60 border border-rose-200 p-5 rounded-xl shadow-xs">
          <div className="text-rose-700 text-xs font-bold uppercase tracking-wider mb-1">
            Total Outstanding Receivable
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700">
            {formatRupee(totalOutstanding)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">Quotation ID</th>
                <th className="py-3.5 px-5">Client</th>
                <th className="py-3.5 px-5 text-right">Age (Days)</th>
                <th className="py-3.5 px-5 text-right">Total Amount</th>
                <th className="py-3.5 px-5 text-right">Paid</th>
                <th className="py-3.5 px-5 text-right">Balance Due</th>
                <th className="py-3.5 px-5 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Reminder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {dues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500" />
                      <p className="font-semibold text-slate-700">All accepted quotations are paid!</p>
                      <p className="text-xs text-slate-400 mt-0.5">No outstanding client dues found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                dues.map((quote) => {
                  const grandTotal = quote.totalAmount + quote.totalGst
                  const balance = grandTotal - quote.amountPaid
                  const daysSinceInvoiced = Math.floor(
                    (new Date().getTime() - new Date(quote.createdAt).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )

                  let ageBadge = "bg-emerald-50 text-emerald-700 border-emerald-200"
                  if (daysSinceInvoiced > 45) {
                    ageBadge = "bg-rose-50 text-rose-700 border-rose-200"
                  } else if (daysSinceInvoiced > 21) {
                    ageBadge = "bg-amber-50 text-amber-700 border-amber-200"
                  }

                  const whatsappMessage = encodeURIComponent(
                    `Hello ${quote.client.name}, this is a gentle reminder regarding Quotation #${
                      quote.prNo || quote.id.slice(-6).toUpperCase()
                    }. An amount of ${formatRupee(
                      balance
                    )} is currently outstanding. We kindly request you to process the payment at your earliest convenience. Thank you!`
                  )

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <Link
                          href={`/quotations/${quote.id}`}
                          className="font-mono text-xs font-bold text-orange-600 hover:underline flex items-center gap-1 w-fit"
                        >
                          #{quote.prNo || quote.id.slice(-6).toUpperCase()}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-5">
                        <Link
                          href={`/clients/${quote.clientId}`}
                          className="font-semibold text-slate-900 hover:text-orange-600"
                        >
                          {quote.client.name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ageBadge}`}
                        >
                          {daysSinceInvoiced}d
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-slate-700">
                        {formatRupee(grandTotal)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-emerald-700">
                        {formatRupee(quote.amountPaid)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-rose-700">
                        {formatRupee(balance)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            quote.paymentStatus === "PARTIALLY_PAID"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {quote.paymentStatus === "PARTIALLY_PAID" ? "Partial" : "Unpaid"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <a
                          href={`https://wa.me/?text=${whatsappMessage}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          WhatsApp
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
