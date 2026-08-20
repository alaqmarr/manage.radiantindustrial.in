import { prisma } from "@/lib/prisma"
import { RfqForm } from "@/components/RfqForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "New Rfq"
}
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function NewRfqPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  })

  const products = await prisma.product.findMany({
    orderBy: { materialCode: 'asc' },
    select: {
      id: true,
      materialCode: true,
      materialDescription: true,
      sellingPrice: true, costPrice: true,
      gstRate: true,
      unit: true,
      specification: true
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Create Rfq</h1>
        <p className="text-zinc-400 mt-2">Build a new rfq for a supplier.</p>
      </div>

      <RfqForm suppliers={suppliers} products={products} />
    </div>
  )
}
