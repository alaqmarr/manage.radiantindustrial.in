import { prisma } from "@/lib/prisma"
import { QuotationForm } from "@/components/QuotationForm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Metadata } from "next"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Edit Quotation ${id}`
  }
}

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const { id } = await params

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
          supplier: true
        }
      }
    }
  })

  if (!quotation) {
    redirect("/quotations")
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
      unit: true,
      specification: true
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Edit Quotation</h1>
        <p className="text-zinc-400 mt-2">Update an existing quotation.</p>
      </div>

      <QuotationForm clients={clients} products={products} initialData={quotation} initialUpdatedAt={quotation.updatedAt} />
    </div>
  )
}
