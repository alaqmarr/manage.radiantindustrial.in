import { prisma } from "@/lib/prisma"
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function NewPurchaseOrderPage(props: {
  searchParams: Promise<{ rfqId?: string; quotationId?: string }>
}) {
  const { rfqId, quotationId } = await props.searchParams
  let initialRfq = null
  if (rfqId) {
    const rfqRaw = await prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { items: { include: { product: true } } },
    })
    if (rfqRaw) {
      initialRfq = {
        ...rfqRaw,
        items: rfqRaw.items.map((item) => ({
          ...item,
          product: {
            ...item.product,
            materialDescription: item.itemDescription || item.product.materialDescription,
          },
        })),
      }
    }
  }

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const products = await prisma.product.findMany({
    select: {
      id: true,
      materialCode: true,
      materialDescription: true,
      sellingPrice: true,
      costPrice: true,
      gstRate: true,
      unit: true,
      specification: true,
    },
    orderBy: { materialCode: "asc" },
  })

  const quotationsRaw = await prisma.quotation.findMany({
    where: { status: { in: ["PENDING", "ACCEPTED", "COMPLETED"] } },
    select: {
      id: true,
      prNo: true,
      status: true,
      client: { select: { name: true } },
      items: {
        include: { product: true },
      },
      purchaseOrders: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          status: true,
          supplier: { select: { name: true } },
          items: { select: { productId: true, quantity: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const quotations = quotationsRaw.map((q) => ({
    ...q,
    items: q.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        materialDescription: item.itemDescription || item.product.materialDescription,
        specification: item.itemSpecification ?? item.product.specification,
        unit: item.itemUnit || item.product.unit,
      },
    })),
  }))

  const rfqs = await prisma.rfq.findMany({
    select: {
      id: true,
      createdAt: true,
      supplier: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/purchase-orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Purchase Orders
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Create Purchase Order (PO)
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Issue a vendor purchase order, link to a client quotation or RFQ, and track fulfillment.
        </p>
      </div>

      <PurchaseOrderForm
        suppliers={suppliers}
        products={products}
        quotations={quotations}
        rfqs={rfqs}
        initialRfq={initialRfq}
        initialQuotationId={quotationId}
      />
    </div>
  )
}
