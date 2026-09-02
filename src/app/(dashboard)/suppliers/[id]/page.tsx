import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, Building2 } from "lucide-react"

export default async function SupplierLedgerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  
  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: 'desc' },
        include: { payments: true }
      },
      purchases: {
        orderBy: { date: 'desc' }
      }
    }
  })

  if (!supplier) notFound()

  const validPOs = supplier.purchaseOrders.filter(po => po.status !== 'DRAFT' && po.status !== 'CANCELLED')
  
  const poBilled = validPOs.reduce((sum, po) => sum + po.totalAmount + po.totalGst, 0)
  const poPaid = validPOs.reduce((sum, po) => sum + po.amountPaid, 0)
  
  const purchaseBilled = supplier.purchases.reduce((sum, p) => sum + p.totalAmount + p.totalGst, 0)
  const purchasePaid = supplier.purchases.reduce((sum, p) => sum + p.amountPaid, 0)

  const totalBilled = poBilled + purchaseBilled
  const totalPaid = poPaid + purchasePaid
  const outstanding = totalBilled - totalPaid

  const ledgerEntries = [
    ...supplier.purchaseOrders.map(po => ({
      id: po.id,
      date: new Date(po.createdAt),
      type: 'PO',
      number: po.poNumber || po.id.slice(-6).toUpperCase(),
      status: po.status,
      billed: (po.status !== 'DRAFT' && po.status !== 'CANCELLED') ? (po.totalAmount + po.totalGst) : 0,
      paid: po.amountPaid,
      link: `/purchase-orders/${po.id}`
    })),
    ...supplier.purchases.map(p => ({
      id: p.id,
      date: new Date(p.date),
      type: 'Purchase',
      number: p.id.slice(-6).toUpperCase(),
      status: 'RECEIVED',
      billed: p.totalAmount + p.totalGst,
      paid: p.amountPaid,
      link: `/purchases/${p.id}`
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/suppliers" className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="p-3 bg-brand-orange/10 rounded-md">
          <Building2 className="w-6 h-6 text-brand-orange" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-heading">{supplier.name}</h1>
          <p className="text-zinc-400 mt-1 text-sm">Supplier Ledger & Financial History</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Billed</p>
          <p className="text-2xl font-bold text-white">{formatRupee(totalBilled)}</p>
        </div>
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-emerald-400">{formatRupee(totalPaid)}</p>
        </div>
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-rose-400">{formatRupee(outstanding)}</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-lg border border-premium-border mt-8">
        <h2 className="text-lg font-bold text-white mb-6">Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-white/5 text-zinc-400 border-y border-premium-border">
              <tr>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Number</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Billed</th>
                <th className="py-3 px-4 font-medium text-right">Paid</th>
                <th className="py-3 px-4 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-premium-border">
              {ledgerEntries.map(entry => {
                const balance = entry.billed - entry.paid
                
                return (
                  <tr key={entry.id} className="hover:bg-white/5">
                    <td className="py-3 px-4 text-zinc-300">{entry.date.toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
                        entry.type === 'PO' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={entry.link} className="text-brand-slate hover:underline font-mono text-xs">
                        {entry.number}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
                        ['ISSUED', 'RECEIVED'].includes(entry.status) ? 'bg-emerald-500/10 text-emerald-500' :
                        'bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-white font-medium">{formatRupee(entry.billed)}</td>
                    <td className="py-3 px-4 text-right text-emerald-400">{formatRupee(entry.paid)}</td>
                    <td className="py-3 px-4 text-right text-rose-400">{formatRupee(balance)}</td>
                  </tr>
                )
              })}
              {ledgerEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">No transactions found for this supplier.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
