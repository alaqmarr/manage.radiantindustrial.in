import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/ProductForm"
import { ArrowLeft, Package } from "lucide-react"
import Link from "next/link"

export default async function NewProductPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
        <Link
          href="/products"
          className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Add New Product
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Create a new catalog item with material code, GST rate, and baseline selling/vendor rates.
            </p>
          </div>
        </div>
      </div>

      <ProductForm suppliers={suppliers} />
    </div>
  )
}
