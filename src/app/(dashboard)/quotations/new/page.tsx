import { prisma } from "@/lib/prisma"
import { QuotationForm } from "@/components/QuotationForm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function NewQuotationPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
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
      unit: true
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Create Quotation</h1>
        <p className="text-zinc-400 mt-2">Build a new quotation for a client.</p>
      </div>

      <QuotationForm clients={clients} products={products} />
    </div>
  )
}
