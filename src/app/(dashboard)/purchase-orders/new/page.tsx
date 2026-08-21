import { prisma } from "@/lib/prisma"
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm"

export const dynamic = "force-dynamic"

export default async function NewPurchaseOrderPage() {
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-8">Create Purchase Order</h1>
      <PurchaseOrderForm suppliers={suppliers} products={products} />
    </div>
  )
}