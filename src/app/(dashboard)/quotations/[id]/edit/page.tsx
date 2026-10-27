import { prisma } from "@/lib/prisma"
import { QuotationForm } from "@/components/QuotationForm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { formatShortId } from "@/lib/utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Edit Quotation ${formatShortId(id)}`,
  }
}

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const { id } = await params

  const quotation = await prisma.quotation.findUnique({
    where: { id },
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
          supplier: true,
        },
      },
    },
  })

  if (!quotation) {
    redirect("/quotations")
  }

  quotation.items = quotation.items.map((item) => ({
    ...item,
    product: {
      ...item.product,
      materialDescription: item.itemDescription || item.product.materialDescription,
      specification: item.itemSpecification ?? item.product.specification,
      unit: item.itemUnit || item.product.unit,
    },
  }))

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
          href={`/quotations/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotation #{formatShortId(id)}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Edit Quotation #{quotation.prNo || formatShortId(id)}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Update line items, vendor cost prices, and selling prices.
        </p>
      </div>

      <QuotationForm
        clients={clients}
        products={products}
        initialData={quotation}
        initialUpdatedAt={quotation.updatedAt}
      />
    </div>
  )
}
