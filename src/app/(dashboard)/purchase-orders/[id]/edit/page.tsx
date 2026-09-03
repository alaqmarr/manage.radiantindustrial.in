import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm"

export const dynamic = "force-dynamic"

export default async function EditPurchaseOrderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { product: true }
      }
    }
  })

  if (!po) notFound()

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
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
      specification: true
    },
    orderBy: { materialCode: "asc" }
  })

  const quotations = await prisma.quotation.findMany({
    where: { status: { in: ['ACCEPTED', 'COMPLETED'] } },
    select: { id: true, client: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-6 md:p-8 ">
      <h1 className="text-2xl font-semibold text-white mb-8">Edit Purchase Order</h1>
      <PurchaseOrderForm suppliers={suppliers} products={products} initialData={po} quotations={quotations} />
    </div>
  )
}