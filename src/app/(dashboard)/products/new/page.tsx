import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/ProductForm"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function NewProductPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products" className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Add Product</h1>
          <p className="text-zinc-400 mt-1">Create a new product manually.</p>
        </div>
      </div>

      <ProductForm suppliers={suppliers} />
    </div>
  )
}
