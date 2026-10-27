import { prisma } from "@/lib/prisma"
import { QuotationForm } from "@/components/QuotationForm"
import { Metadata } from "next"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "New Quotation",
}

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
  const duplicateFrom =
    typeof resolvedSearchParams.duplicateFrom === "string"
      ? resolvedSearchParams.duplicateFrom
      : undefined

  let initialData = undefined

  if (duplicateFrom) {
    const originalQuotation = await prisma.quotation.findUnique({
      where: { id: duplicateFrom },
      include: {
        items: {
          include: {
            product: {
              include: {
                productSuppliers: {
                  include: { supplier: { select: { id: true, name: true } } },
                  orderBy: { costPrice: "asc" },
                },
              },
            },
          },
        },
      },
    })

    if (originalQuotation) {
      initialData = {
        clientId: originalQuotation.clientId,
        prNo: originalQuotation.prNo,
        rfqNo: originalQuotation.rfqNo,
        items: originalQuotation.items.map((item) => ({
          product: {
            ...item.product,
            materialDescription: item.itemDescription || item.product.materialDescription,
            specification: item.itemSpecification ?? item.product.specification,
            unit: item.itemUnit || item.product.unit,
          },
          quantity: item.quantity,
          itemsNo: item.itemsNo,
          cpSnapshot: item.cpSnapshot,
          commissionCpSnapshot: item.commissionCpSnapshot,
          spSnapshot: item.spSnapshot,
          supplierId: item.supplierId,
          comment: item.comment,
          leadTime: item.leadTime,
          additionalCost: item.additionalCost,
        })),
      }
    }
  }

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  const products = await prisma.product.findMany({
    orderBy: { materialCode: "asc" },
    select: {
      id: true,
      materialCode: true,
      materialDescription: true,
      costPrice: true,
      sellingPrice: true,
      gstRate: true,
      unit: true,
      specification: true,
      commissionCostPrice: true,
      supplierId: true,
      productSuppliers: {
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { costPrice: "asc" },
      },
      quotationItems: {
        take: 15,
        orderBy: { quotation: { createdAt: "desc" } },
        select: {
          id: true,
          spSnapshot: true,
          cpSnapshot: true,
          quantity: true,
          quotation: {
            select: {
              id: true,
              clientId: true,
              createdAt: true,
              client: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotations
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {duplicateFrom ? "Duplicate Quotation" : "Create New Quotation"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {duplicateFrom
            ? "Review and edit the duplicated quotation details."
            : "Configure client details, line items, vendor cost prices, and selling prices."}
        </p>
      </div>

      <QuotationForm clients={clients} products={products} initialData={initialData} />
    </div>
  )
}
