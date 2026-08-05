import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProductInsightsClient } from "@/components/ProductInsightsClient"

export default async function ProductInsightsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const product = await prisma.product.findUnique({
    where: { id: params.id }
  })

  if (!product) {
    notFound()
  }

  return (
    <ProductInsightsClient product={{
      id: product.id,
      description: product.materialDescription,
      make: product.make || '',
      model: product.modelNo || '',
      specification: product.specification || ''
    }} />
  )
}
