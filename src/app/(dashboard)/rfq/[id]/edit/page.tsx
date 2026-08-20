import { prisma } from "@/lib/prisma"
import { RfqForm } from "@/components/RfqForm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Edit Rfq ${id}`
  }
}

export default async function EditRfqPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const { id } = await params

  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
          
        }
      }
    }
  })

  if (!rfq) {
    redirect("/rfq")
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
        <h1 className="text-3xl font-bold tracking-tight text-white">Edit Rfq</h1>
        <p className="text-zinc-400 mt-2">Update an existing rfq.</p>
      </div>

      <RfqForm suppliers={suppliers} products={products} initialData={rfq} initialUpdatedAt={rfq.updatedAt} />
    </div>
  )
}
