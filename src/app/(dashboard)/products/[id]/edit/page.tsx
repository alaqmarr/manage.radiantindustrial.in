import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/ProductForm"
import { notFound } from "next/navigation"

export default async function EditProductPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  
  const product = await prisma.product.findUnique({
    where: { id: params.id }
  })

  if (!product) {
    notFound()
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Edit Product</h1>
        <p className="text-zinc-400 mt-2">Update inventory and material details.</p>
      </div>

      <ProductForm suppliers={suppliers} initialData={product} />
    </div>
  )
}
