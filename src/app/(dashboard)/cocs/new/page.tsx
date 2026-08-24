import { prisma } from "@/lib/prisma"
import { CocForm } from "@/components/CocForm"

export default async function NewCocPage() {
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
        <h1 className="text-3xl font-bold tracking-tight text-white">Create Certificate of Conformance</h1>
        <p className="text-zinc-400 mt-2">Issue a new conformance certificate for a client.</p>
      </div>

      <CocForm 
        clients={clients} 
        products={products} 
        defaultCocMessage={settings?.cocMessage || "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."}
      />
    </div>
  )
}
