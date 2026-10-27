import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import { Plus, Info, ArrowRight } from "lucide-react"
import Link from "next/link"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteProducts } from "@/app/actions/batchDelete"
import { ExcelImportButton } from "@/components/ExcelImportButton"
import { SearchBar } from "@/components/SearchBar"
import { ProductInlineRow } from "@/components/ProductInlineRow"

export const metadata: Metadata = {
  title: "Product Catalog",
}

export default async function ProductsPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search
    ? {
        OR: [
          { materialCode: { contains: search } },
          { materialDescription: { contains: search } },
          { make: { contains: search } },
          { modelNo: { contains: search } },
        ],
      }
    : {}

  const products = await prisma.product.findMany({
    where,
    include: {
      _count: {
        select: {
          priceHistory: true,
          quotationItems: true,
        },
      },
      productSuppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { costPrice: "asc" },
      },
      priceHistory: {
        orderBy: { changedAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const totalProducts = products.length
  const fullyPriced = products.filter((p) => p.costPrice > 0 && p.sellingPrice > 0).length
  const totalRevisions = products.reduce((s, p) => s + p._count.priceHistory, 0)
  const totalQuoteUsages = products.reduce((s, p) => s + p._count.quotationItems, 0)

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[11px] font-black uppercase tracking-wider">
                Step A · Master Data
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Catalog</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Manage master materials, vendor cost prices (CP), standard selling prices (SP), and historical price revisions.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <SearchBar placeholder="Search code, description, make..." />
            <BatchDeleteButton deleteAction={deleteProducts} entityName="products" />
            <ExcelImportButton />
            <Link
              href="/products/new"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
              <span className="text-white">Add Product</span>
            </Link>
          </div>
        </div>

        {/* Layman Workflow Guide Banner */}
        <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-orange-950">
                How Master Products & Price History Work
              </h2>
              <p className="text-xs text-orange-900 mt-0.5 leading-relaxed">
                Every material has two key rates: <strong>Cost Price (CP)</strong> (what you pay the supplier) and{" "}
                <strong>Selling Price (SP)</strong> (what you quote the client). Whenever you update either price here or inside a{" "}
                <Link href="/quotations" className="underline font-semibold">Quotation</Link>, the system automatically logs a timestamped snapshot in the item&apos;s{" "}
                <strong>Price History Chart</strong>.
              </p>
            </div>
          </div>
          <Link
            href="/rfq"
            className="text-xs font-bold text-orange-700 hover:text-orange-900 whitespace-nowrap flex items-center gap-1 self-end md:self-center"
          >
            Request Vendor Rates (RFQ) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Total Catalog Items
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{totalProducts}</p>
            <p className="text-xs text-slate-400 mt-1">Master SKUs & materials</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Fully Priced (CP & SP)
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">
              {fullyPriced} / {totalProducts}
            </p>
            <p className="text-xs text-slate-400 mt-1">Ready for instant quotation</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Recorded Price Revisions
            </p>
            <p className="text-xl font-bold text-orange-600 mt-1 font-mono">{totalRevisions}</p>
            <p className="text-xs text-slate-400 mt-1">Historical CP & SP snapshots</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Quotation Line Usages
            </p>
            <p className="text-xl font-bold text-blue-700 mt-1 font-mono">{totalQuoteUsages}</p>
            <p className="text-xs text-slate-400 mt-1">Times quoted to clients</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <SelectAllCheckbox allIds={products.map((p) => p.id)} />
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Material Code</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Description & Spec</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Make / Model</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">UOM</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Cost Price (CP)</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Selling Price (SP)</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-center">History</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                      No products found. Add one manually or import via Excel.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <ProductInlineRow key={product.id} product={product} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SelectionProvider>
  )
}
