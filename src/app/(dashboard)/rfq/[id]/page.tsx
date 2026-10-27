import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { RfqActions } from "@/components/RfqActions"
import { RfqStatusBadge } from "@/components/RfqStatusBadge"
import { Metadata } from "next"
import { VendorResponsesTable } from "@/components/VendorResponsesTable"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Globe,
  Mail,
  Phone,
  MapPin,
  Plus,
  ExternalLink,
} from "lucide-react"
import { formatRupee } from "@/lib/utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return {
    title: `RFQ #${id.slice(-6).toUpperCase()}`,
  }
}

export default async function RfqViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const rfqRaw = await prisma.rfq.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
      responses: {
        include: { items: true },
      },
      purchaseOrders: {
        include: { supplier: true },
        orderBy: { createdAt: "desc" },
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

  const settings =
    (await prisma.companySettings.findUnique({ where: { id: "default" } })) ||
    (await prisma.companySettings.findFirst())

  return (
    <div className="space-y-6 print:hidden">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Link
            href="/rfq"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors mt-0.5"
            title="Back to RFQs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                RFQ #{rfq.id.slice(-6).toUpperCase()}
              </h1>
              <RfqStatusBadge id={rfq.id} currentStatus={rfq.status} />
              {rfq.isPublic && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Globe className="w-3 h-3" /> Public Multi-Vendor RFQ
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Created on{" "}
              {new Date(rfq.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              · Full ID: <span className="font-mono text-slate-700">{rfq.id}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {rfq.supplierId && (
            <Link
              href={`/purchase-orders/new?rfqId=${rfq.id}&supplierId=${rfq.supplierId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Convert to Purchase Order
            </Link>
          )}
          <RfqActions rfq={rfq} settings={settings} />
        </div>
      </div>

      {/* Supplier Details + Linked Purchase Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Target Vendor / Supplier
          </h3>
          {rfq.supplier ? (
            <div>
              <Link
                href={`/suppliers/${rfq.supplier.id}`}
                className="text-lg font-bold text-slate-900 hover:text-orange-600 transition-colors inline-flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-orange-600" />
                {rfq.supplier.name}
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                {rfq.supplier.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{rfq.supplier.location}</span>
                  </div>
                )}
                {rfq.supplier.contact && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{rfq.supplier.contact}</span>
                  </div>
                )}
                {rfq.supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{rfq.supplier.email}</span>
                  </div>
                )}
                {rfq.supplier.gstNumber && (
                  <div className="font-mono text-xs pt-1">
                    <strong>GSTIN:</strong> {rfq.supplier.gstNumber}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
                <Globe className="w-4 h-4" /> Public Multi-Vendor Portal Enabled
              </div>
              <p className="text-xs text-slate-500">
                Any supplier with the public share link below can submit their unit prices and lead times.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Linked Purchase Orders ({rfq.purchaseOrders.length})
            </h3>
            <Link
              href={`/purchase-orders/new?rfqId=${rfq.id}${rfq.supplierId ? `&supplierId=${rfq.supplierId}` : ""}`}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700"
            >
              + New PO for this RFQ
            </Link>
          </div>
          {rfq.purchaseOrders.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              No Purchase Orders have been raised against this RFQ yet.
            </p>
          ) : (
            <div className="space-y-2">
              {rfq.purchaseOrders.map((po) => (
                <Link
                  key={po.id}
                  href={`/purchase-orders/${po.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {po.poNumber || `#${po.id.slice(-6).toUpperCase()}`}
                      </div>
                      <div className="text-[11px] text-slate-500">{po.supplier.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {formatRupee(po.totalAmount + po.totalGst)}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700">{po.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Requested Line Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Requested Line Items ({rfq.items.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Items included in this Request for Quotation
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold w-14">#</th>
                <th className="py-3.5 px-4 font-semibold w-36">Material Code</th>
                <th className="py-3.5 px-4 font-semibold">Description & Specification</th>
                <th className="py-3.5 px-4 font-semibold text-center w-24">UOM</th>
                <th className="py-3.5 px-4 font-semibold text-right w-28">Requested Qty</th>
                <th className="py-3.5 px-4 font-semibold text-right w-36">Catalog Ref CP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rfq.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                  <td className="py-3.5 px-4">
                    <Link
                      href={`/products/${item.productId}/edit`}
                      className="font-mono text-xs font-bold text-orange-600 hover:underline"
                    >
                      {item.product.materialCode}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">
                      {item.product.materialDescription}
                    </div>
                    {item.product.specification && (
                      <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">
                        {item.product.specification}
                      </div>
                    )}
                    {item.comment && (
                      <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded inline-block mt-1">
                        Note: {item.comment}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center text-xs font-mono text-slate-600">
                    {item.product.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {item.quantity}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500">
                    {item.product.costPrice > 0 ? formatRupee(item.product.costPrice) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Render Vendor Responses for Public RFQs */}
        {rfq.isPublic && (
          <div className="p-6 border-t border-slate-200">
            <VendorResponsesTable rfq={rfq} />
          </div>
        )}
      </div>
    </div>
  )
}
