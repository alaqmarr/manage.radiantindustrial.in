import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/ProductForm"
import { PriceHistoryChart } from "@/components/PriceHistoryChart"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function EditProductPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      priceHistory: {
        orderBy: { changedAt: "desc" },
      },
      quotationItems: {
        orderBy: { quotation: { createdAt: "desc" } },
        take: 25,
        include: {
          quotation: {
            select: {
              id: true,
              prNo: true,
              createdAt: true,
              status: true,
              client: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!product) {
    notFound()
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Product Catalog
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Edit Product & Pricing History
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Update specifications, vendor cost prices, selling prices, and review historical rates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <ProductForm suppliers={suppliers} initialData={product} />
        </div>
        <div className="lg:col-span-1">
          <PriceHistoryChart
            productId={product.id}
            currentCostPrice={product.costPrice}
            currentSellingPrice={product.sellingPrice}
            history={product.priceHistory}
            quotedHistory={product.quotationItems}
          />
        </div>
      </div>
    </div>
  )
}
