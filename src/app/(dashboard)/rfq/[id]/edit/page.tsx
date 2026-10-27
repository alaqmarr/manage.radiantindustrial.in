import { prisma } from "@/lib/prisma"
import { RfqForm } from "@/components/RfqForm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, FileSearch } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Edit RFQ ${id.slice(-6).toUpperCase()}`,
  }
}

export default async function EditRfqPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const { id } = await params

  const rfqRaw = await prisma.rfq.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!rfqRaw) {
    redirect("/rfq")
  }

  const rfq = {
    ...rfqRaw,
    items: rfqRaw.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        materialDescription: item.itemDescription || item.product.materialDescription,
      },
    })),
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  const products = await prisma.product.findMany({
    orderBy: { materialCode: "asc" },
    select: {
      id: true,
      materialCode: true,
      materialDescription: true,
      sellingPrice: true,
      costPrice: true,
      gstRate: true,
      unit: true,
      specification: true,
    },
  })

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <Link
          href={`/rfq/${rfq.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to RFQ #{rfq.id.slice(-6).toUpperCase()}
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Edit Vendor RFQ #{rfq.id.slice(-6).toUpperCase()}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Update vendor assignment, inquiry quantities, and item specifications.
            </p>
          </div>
        </div>
      </div>

      <RfqForm
        suppliers={suppliers}
        products={products}
        initialData={rfq}
        initialUpdatedAt={rfq.updatedAt}
      />
    </div>
  )
}
