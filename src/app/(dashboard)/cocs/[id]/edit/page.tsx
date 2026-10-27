import { prisma } from "@/lib/prisma"
import { CocForm } from "@/components/CocForm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

export default async function EditCocPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params

  const coc = await prisma.certificateOfConformance.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { product: true },
      },
    },
  })

  if (!coc) notFound()

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
  })

  const products = await prisma.product.findMany({
    orderBy: { materialDescription: "asc" },
  })

  const quotations = await prisma.quotation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: { product: true },
      },
    },
  })

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
  })

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <Link
          href={`/cocs/${coc.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Certificate #{coc.cocNumber}
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Edit Certificate #{coc.cocNumber}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Update conformance certificate metadata, batch numbers, and custom test attributes.
            </p>
          </div>
        </div>
      </div>

      <CocForm
        clients={clients}
        products={products}
        quotations={quotations}
        initialData={coc}
        defaultCocMessage={
          settings?.cocMessage ||
          "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."
        }
      />
    </div>
  )
}
