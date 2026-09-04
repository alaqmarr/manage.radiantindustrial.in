import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAccountMetrics, getLedgerEntries } from "@/app/actions/payment"
import { AccountsView } from "@/components/AccountsView"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const metricsRes = await getAccountMetrics()
  const entriesRes = await getLedgerEntries()

  // Fetch pending POs and Quotations for dropdowns
  const quotations = await prisma.quotation.findMany({
    where: { 
      paymentStatus: { not: 'PAID' },
      status: { notIn: ['CANCELLED', 'REJECTED'] }
    },
    select: { id: true, prNo: true, totalAmount: true, totalGst: true, amountPaid: true, client: { select: { name: true } } }
  })
  
  const pos = await prisma.purchaseOrder.findMany({
    where: { 
      paymentStatus: { not: 'PAID' },
      status: { notIn: ['CANCELLED', 'DRAFT'] }
    },
    select: { id: true, poNumber: true, totalAmount: true, totalGst: true, amountPaid: true, supplier: { select: { name: true } } }
  })

  const purchases = await prisma.purchase.findMany({
    where: { paymentStatus: { not: 'PAID' } },
    select: { id: true, totalAmount: true, totalGst: true, amountPaid: true, supplier: { select: { name: true } } }
  })

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, creditBalance: true },
    orderBy: { name: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl py-4 -mx-8 px-8 border-b border-premium-border/50">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Accounts & Ledger</h1>
          <p className="text-zinc-400 text-sm">Manage transactions, cheques, and balances.</p>
        </div>
      </div>

      <AccountsView 
        initialMetrics={metricsRes.success ? metricsRes : null} 
        initialEntries={entriesRes.success ? entriesRes.entries : []} 
        quotations={quotations}
        pos={pos}
        purchases={purchases}
        clients={clients}
      />
    </div>
  )
}
