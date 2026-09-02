import { prisma } from "@/lib/prisma"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import { ExternalLink, FileText, AlertCircle, Calendar } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function QuotationDuesPage() {
  const dues = await prisma.quotation.findMany({
    where: {
      status: {
        in: ['ACCEPTED', 'COMPLETED']
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      client: true
    }
  })

  // Calculate totals
  const totalReceivable = dues.reduce((sum, q) => sum + (q.totalAmount + q.totalGst), 0)
  const totalCollected = dues.reduce((sum, q) => sum + q.amountPaid, 0)
  const totalOutstanding = totalReceivable - totalCollected

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-orange" />
          Quotation Dues
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel border border-premium-border p-6 rounded-lg">
          <div className="text-zinc-400 text-sm font-medium mb-1">Total Receivable (Accepted / Fulfilled)</div>
          <div className="text-2xl font-bold text-white">{formatRupee(totalReceivable)}</div>
        </div>
        <div className="glass-panel border border-premium-border p-6 rounded-lg">
          <div className="text-zinc-400 text-sm font-medium mb-1">Total Collected</div>
          <div className="text-2xl font-bold text-emerald-400">{formatRupee(totalCollected)}</div>
        </div>
        <div className="glass-panel border border-rose-500/30 p-6 rounded-lg bg-rose-500/5">
          <div className="text-rose-400/80 text-sm font-medium mb-1">Total Outstanding</div>
          <div className="text-2xl font-bold text-rose-500">{formatRupee(totalOutstanding)}</div>
        </div>
      </div>

      <div className="glass-panel border border-premium-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-premium-border/50 bg-black/40">
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Quotation ID</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Client</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Total Amount</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Paid</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Balance Due</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-center">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border/30">
              {dues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      <p>No dues found for accepted or fulfilled quotations.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                dues.map(quote => {
                  const grandTotal = quote.totalAmount + quote.totalGst
                  const balance = grandTotal - quote.amountPaid

                  return (
                    <tr key={quote.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <Link 
                          href={`/quotations/${quote.id}`}
                          className="font-mono text-sm text-blue-400 hover:underline flex items-center gap-1 w-fit"
                        >
                          {quote.id.slice(0,10)}...
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm font-medium text-white">{quote.client.name}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-medium text-zinc-300">{formatRupee(grandTotal)}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-medium text-emerald-400">{formatRupee(quote.amountPaid)}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`text-sm font-bold ${balance > 0 ? 'text-rose-500' : 'text-zinc-500'}`}>{formatRupee(balance)}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          quote.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          quote.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}>
                          {quote.paymentStatus === 'PAID' ? 'Paid' : quote.paymentStatus === 'PARTIALLY_PAID' ? 'Partial' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/quotations/${quote.id}`}
                          className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                        >
                          {quote.paymentStatus === 'PAID' ? 'View Quote' : 'Receive Payment'}
                        </Link>
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
