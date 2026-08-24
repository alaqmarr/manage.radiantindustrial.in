import { prisma } from "@/lib/prisma"
import { CocForm } from "@/components/CocForm"
import { notFound } from "next/navigation"

export default async function EditCocPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  
  const coc = await prisma.certificateOfConformance.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { product: true }
      }
    }
  })

  if (!coc) notFound()

  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' }
  })
  
  const products = await prisma.product.findMany({
    orderBy: { materialDescription: 'asc' }
  })
  
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Edit Certificate</h1>
        <p className="text-zinc-400 mt-2">Update conformance certificate details.</p>
      </div>

      <CocForm 
        clients={clients} 
        products={products} 
        initialData={coc}
        defaultCocMessage={settings?.cocMessage || "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."}
      />
    </div>
  )
}
