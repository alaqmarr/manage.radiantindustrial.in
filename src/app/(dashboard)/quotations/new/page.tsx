import { prisma } from "@/lib/prisma"
import { QuotationForm } from "@/components/QuotationForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "New Quotation"
}
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const resolvedSearchParams = await searchParams
  const duplicateFrom = typeof resolvedSearchParams.duplicateFrom === 'string' ? resolvedSearchParams.duplicateFrom : undefined

  let initialData = undefined

  if (duplicateFrom) {
    const originalQuotation = await prisma.quotation.findUnique({
      where: { id: duplicateFrom },
      include: {
        items: {
          include: { product: true }
        }
      }
    })

    if (originalQuotation) {
      initialData = {
        clientId: originalQuotation.clientId,
        prNo: originalQuotation.prNo,
        rfqNo: originalQuotation.rfqNo,
        items: originalQuotation.items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          itemsNo: item.itemsNo,
          cpSnapshot: item.cpSnapshot,
          commissionCpSnapshot: item.commissionCpSnapshot,
          spSnapshot: item.spSnapshot,
          supplierId: item.supplierId,
          comment: item.comment,
          leadTime: item.leadTime,
          additionalCost: item.additionalCost
        }))
      }
    }
  }

  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  })

  const products = await prisma.product.findMany({
    orderBy: { materialCode: 'asc' },
    select: {
      id: true,
      materialCode: true,
      materialDescription: true,
      sellingPrice: true,
      gstRate: true,
      unit: true,
      specification: true,
      commissionCostPrice: true
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {duplicateFrom ? "Duplicate Quotation" : "Create Quotation"}
        </h1>
        <p className="text-zinc-400 mt-2">
          {duplicateFrom ? "Review and edit the duplicated quotation details." : "Build a new quotation for a client."}
        </p>
      </div>

      <QuotationForm clients={clients} products={products} initialData={initialData} />
    </div>
  )
}
