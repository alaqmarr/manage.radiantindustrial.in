import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CocActions } from "@/components/CocActions"
import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Building2, FileText, ShieldCheck, ExternalLink } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Certificate ${id.slice(-6).toUpperCase()}`,
  }
}

export default async function CocViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const cocRaw = await prisma.certificateOfConformance.findUnique({
    where: { id },
    include: {
      client: true,
      quotation: true,
      items: {
        include: { product: true },
      },
    },
  })

  if (!cocRaw) {
    redirect("/cocs")
  }

  const coc = {
    ...cocRaw,
    items: cocRaw.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        materialDescription: (item as any).itemDescription || item.product.materialDescription,
      },
    })),
  }

  const settings =
    (await prisma.companySettings.findUnique({ where: { id: "default" } })) ||
    (await prisma.companySettings.findFirst())

  return (
    <div className="space-y-6 print:hidden">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Link
            href="/cocs"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors mt-0.5"
            title="Back to Certificates"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {coc.cocNumber || `COC-${coc.id.slice(-6).toUpperCase()}`}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider border ${
                  coc.status === "ISSUED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : coc.status === "CANCELLED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {coc.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Issued on{" "}
              {new Date(coc.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              for <strong>{coc.client.name}</strong>
            </p>
          </div>
        </div>

        <CocActions id={coc.id} currentStatus={coc.status} coc={coc} settings={settings} />
      </div>

      {/* Client & Order Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Issued To (Client)
          </h3>
          <Link
            href={`/clients/${coc.client.id}`}
            className="text-lg font-bold text-slate-900 hover:text-orange-600 transition-colors inline-flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-orange-600" />
            {coc.client.name}
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          {coc.client.address && (
            <p className="text-xs text-slate-600 mt-1.5">{coc.client.address}</p>
          )}
          {coc.client.gstNumber && (
            <p className="text-xs font-mono text-slate-500 mt-1.5">
              <strong>GSTIN:</strong> {coc.client.gstNumber}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Order & Compliance References
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Certificate No.</span>
              <span className="font-mono font-bold text-slate-900">
                {coc.cocNumber || coc.id.slice(0, 8)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Client PO Reference</span>
              <span className="font-mono font-semibold text-slate-800">
                {coc.clientPoRef || "—"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Linked Quotation</span>
              {coc.quotationId ? (
                <Link
                  href={`/quotations/${coc.quotationId}`}
                  className="inline-flex items-center gap-1 font-mono text-xs font-bold text-orange-600 hover:underline mt-0.5"
                >
                  <FileText className="w-3.5 h-3.5" /> #{coc.quotationId.slice(-6).toUpperCase()}
                </Link>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Certified Line Items</span>
              <span className="font-mono font-bold text-emerald-700">
                {coc.items.length} item{coc.items.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Certificate Statement & Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Declaration of Conformance
            </h3>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {coc.standardText ||
                settings?.cocMessage ||
                "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold w-14">#</th>
                <th className="py-3.5 px-4 font-semibold min-w-[240px]">
                  Product Details & Technical Attributes
                </th>
                <th className="py-3.5 px-4 font-semibold text-center w-28">Quantity</th>
                <th className="py-3.5 px-4 font-semibold text-center w-48">Batch / Lot No.</th>
                <th className="py-3.5 px-4 font-semibold w-56">Inspection Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coc.items.map((item, index) => {
                let parsedAttrs: any[] = []
                try {
                  parsedAttrs = (item as any).attributes
                    ? JSON.parse((item as any).attributes)
                    : []
                } catch {}

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 text-slate-400 font-mono text-xs">{index + 1}</td>
                    <td className="py-4 px-4">
                      <Link
                        href={`/products/${item.productId}/edit`}
                        className="font-mono text-xs font-bold text-orange-600 hover:underline"
                      >
                        {item.product.materialCode}
                      </Link>
                      <div className="text-slate-900 font-semibold mt-0.5">
                        {item.product.materialDescription}
                      </div>
                      {item.product.specification && (
                        <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
                          {item.product.specification}
                        </div>
                      )}
                      {parsedAttrs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {parsedAttrs.map((attr: any, i: number) =>
                            attr.key && attr.value ? (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded"
                              >
                                <span className="text-slate-500 font-medium">{attr.key}:</span>
                                <span className="text-slate-900 font-semibold">{attr.value}</span>
                              </span>
                            ) : null
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      <span className="font-bold text-slate-900">{item.quantity}</span>
                      <span className="text-slate-500 text-xs ml-1">{item.product.unit}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {item.batchNo ? (
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                          {item.batchNo}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-slate-600 text-xs">
                      {item.remarks || "Verified Conforming"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {coc.remarks && (
          <div className="pt-4 border-t border-slate-200 text-sm text-slate-600 whitespace-pre-wrap">
            <h3 className="font-bold text-slate-900 mb-1 uppercase text-xs tracking-wider">
              Additional Certificate Remarks
            </h3>
            {coc.remarks}
          </div>
        )}
      </div>
    </div>
  )
}
