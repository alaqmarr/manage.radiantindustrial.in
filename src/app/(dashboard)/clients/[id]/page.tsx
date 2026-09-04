import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, Building2, TrendingUp, CheckCircle2, Clock } from "lucide-react"

export default async function ClientLedgerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      quotations: {
        orderBy: { createdAt: 'desc' },
        include: { payments: true }
      }
    }
  })

  if (!client) notFound()

  // Calculate totals
  const allQuotations = client.quotations
  const acceptedQuotations = allQuotations.filter(q => q.status === 'ACCEPTED' || q.status === 'COMPLETED')
  
  const totalInvoiced = acceptedQuotations.reduce((sum, q) => sum + q.totalAmount + q.totalGst, 0)
  const totalPaid = acceptedQuotations.reduce((sum, q) => sum + q.amountPaid, 0)
  const outstanding = totalInvoiced - totalPaid

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clients" className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="p-3 bg-brand-orange/10 rounded-md">
          <Building2 className="w-6 h-6 text-brand-orange" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-heading">{client.name}</h1>
          <p className="text-zinc-400 mt-1 text-sm">Client Ledger & Financial History</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Invoiced (Accepted)</p>
          <p className="text-2xl font-bold text-white">{formatRupee(totalInvoiced)}</p>
        </div>
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Received</p>
          <p className="text-2xl font-bold text-emerald-400">{formatRupee(totalPaid)}</p>
        </div>
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-rose-400">{formatRupee(outstanding)}</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-lg border border-premium-border mt-8">
        <h2 className="text-lg font-bold text-white mb-6">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-y border-premium-border">
              <tr>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Quotation Ref</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Invoiced</th>
                <th className="py-3 px-4 font-medium text-right">Paid</th>
                <th className="py-3 px-4 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {allQuotations.map(q => {
                const invoiced = (q.status === 'ACCEPTED' || q.status === 'COMPLETED') ? (q.totalAmount + q.totalGst) : 0
                const balance = invoiced - q.amountPaid
                
                return (
                  <tr key={q.id} className="hover:bg-white/5">
                    <td className="py-3 px-4 text-zinc-300">{new Date(q.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <Link href={`/quotations/${q.id}`} className="text-brand-slate hover:underline font-mono text-xs">
                        {q.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
                        q.status === 'COMPLETED' ? 'bg-purple-500/10 text-purple-400' :
                        q.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-500' :
                        q.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-white font-medium">{formatRupee(invoiced)}</td>
                    <td className="py-3 px-4 text-right text-emerald-400">{formatRupee(q.amountPaid)}</td>
                    <td className="py-3 px-4 text-right text-rose-400">{formatRupee(balance)}</td>
                  </tr>
                )
              })}
              {allQuotations.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">No transactions found for this client.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
