import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getAccountMetrics, getLedgerEntries } from "@/app/actions/payment"
import { AccountsView } from "@/components/AccountsView"
import { prisma } from "@/lib/prisma"
import { Info } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

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
      paymentStatus: { not: "PAID" },
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: {
      id: true,
      prNo: true,
      status: true,
      totalAmount: true,
      totalGst: true,
      amountPaid: true,
      client: { select: { name: true } },
    },
  })

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      paymentStatus: { not: "PAID" },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: {
      id: true,
      poNumber: true,
      status: true,
      createdAt: true,
      paymentDueDate: true,
      totalAmount: true,
      totalGst: true,
      amountPaid: true,
      supplier: { select: { id: true, name: true } },
      quotation: {
        select: {
          id: true,
          prNo: true,
          client: { select: { name: true } },
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              materialCode: true,
              materialDescription: true,
              unit: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const purchases = await prisma.purchase.findMany({
    where: { paymentStatus: { not: "PAID" } },
    select: {
      id: true,
      date: true,
      totalAmount: true,
      totalGst: true,
      amountPaid: true,
      supplier: { select: { id: true, name: true } },
      quotation: {
        select: {
          id: true,
          prNo: true,
          client: { select: { name: true } },
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              materialCode: true,
              materialDescription: true,
              unit: true,
            },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  })

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, creditBalance: true },
    orderBy: { name: "asc" },
  })

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const acceptedQuotations = await prisma.quotation.findMany({
    where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: {
          supplier: { select: { id: true, name: true } },
          product: {
            include: {
              supplier: { select: { id: true, name: true } },
              productSuppliers: {
                include: { supplier: { select: { id: true, name: true } } },
                orderBy: { costPrice: "asc" },
              },
            },
          },
        },
      },
      purchaseOrders: {
        where: { status: { not: "CANCELLED" } },
        include: {
          items: true,
          supplier: { select: { id: true, name: true } },
        },
      },
      purchases: {
        include: {
          items: true,
          supplier: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 text-[11px] font-black uppercase tracking-wider">
              Step D · Finance & Cashflow
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Accounts & Financial Ledger
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Manage client receivables, supplier payables, cheque clearances, order fulfillments, and working capital loans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/clients"
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            Client Ledgers
          </Link>
          <Link
            href="/suppliers"
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            Supplier Ledgers
          </Link>
        </div>
      </div>

      {/* Layman Guide Banner */}
      <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-violet-950">
            How Accounts & Ledger Works
          </h2>
          <p className="text-xs text-violet-900 mt-0.5 leading-relaxed">
            <strong>Receivables (Money In):</strong> Automatically calculated from Accepted/Completed{" "}
            <Link href="/quotations" className="underline font-semibold">Client Quotations</Link> (including GST).{" "}
            <strong>Payables (Money Out):</strong> Automatically calculated from Issued/Delivered{" "}
            <Link href="/purchase-orders" className="underline font-semibold">Supplier POs</Link> and Direct Purchases. Use the tabs below to view the <strong>Transaction Ledger</strong>, track <strong>Order Fulfillments</strong>, or manage <strong>Loans & EMIs</strong>.
          </p>
        </div>
      </div>

      <AccountsView
        initialMetrics={metricsRes.success ? metricsRes : null}
        initialEntries={entriesRes.success ? entriesRes.entries : []}
        quotations={quotations}
        pos={pos}
        purchases={purchases}
        clients={clients}
        suppliers={suppliers}
        acceptedQuotations={acceptedQuotations}
      />
    </div>
  )
}
