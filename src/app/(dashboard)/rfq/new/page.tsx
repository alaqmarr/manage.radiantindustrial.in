import { prisma } from "@/lib/prisma"
import { RfqForm } from "@/components/RfqForm"
import { Metadata } from "next"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileSearch } from "lucide-react"

export const metadata: Metadata = {
  title: "New Vendor RFQ",
}

export default async function NewRfqPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; quotationId?: string }>
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const { supplierId, quotationId } = await searchParams

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

  let initialData: any = undefined
  if (quotationId) {
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        items: {
          include: { product: true },
        },
      },
    })
    if (quotation) {
      initialData = {
        supplierId: supplierId || "",
        isPublic: !supplierId,
        items: quotation.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          comment: item.comment || undefined,
        })),
      }
    }
  } else if (supplierId) {
    initialData = {
      supplierId,
      isPublic: false,
      items: [],
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <Link
          href="/rfq"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Vendor RFQs
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Create Request for Quotation (RFQ)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Request cost pricing from a specific supplier or create a public bidding link for multiple vendors.
            </p>
          </div>
        </div>
      </div>

      <RfqForm suppliers={suppliers} products={products} initialData={initialData} />
    </div>
  )
}
