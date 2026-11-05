import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { VendorQuoteForm } from "@/components/VendorQuoteForm"
import { Metadata } from "next"
import {
  Building2,
  Calendar,
  FileSpreadsheet,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react"
import { formatShortId } from "@/lib/utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const rfq = await prisma.rfq.findUnique({
    where: { publicToken: token },
    select: { id: true },
  })
  return {
    title: rfq
      ? `RFQ #${formatShortId(rfq.id)} — Submit Vendor Quotation`
      : "Request for Quotation | Radiant Industrial",
    description: "Official online vendor quotation portal for Radiant Industrial Company.",
  }
}

export const dynamic = "force-dynamic"

export default async function VendorQuotePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const rfqRaw = await prisma.rfq.findUnique({
    where: { publicToken: token },
    include: {
      items: {
        include: { product: true },
      },
    },
  })

  if (!rfqRaw || !rfqRaw.isPublic) {
    notFound()
  }

  const rfq = {
    ...rfqRaw,
    items: rfqRaw.items.map((item) => ({
      ...item,
      effectiveDescription: item.itemDescription || item.product.materialDescription,
    })),
  }

  const settings =
    (await prisma.companySettings.findUnique({ where: { id: "default" } })) ||
    (await prisma.companySettings.findFirst())

  const companyName = settings?.companyName || "Radiant Industrial Company"
  const shortRef = formatShortId(rfq.id)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Corporate Accent Strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 print:hidden" />

      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 shadow-2xs">
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-10 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src={settings?.logoUrl || "/logo-long.png"}
              alt={companyName}
              className="h-10 sm:h-12 w-auto object-contain shrink-0"
            />
            <div className="border-l border-slate-200 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 uppercase tracking-wider">
                  <Globe className="w-3 h-3" /> Official Vendor Bidding Portal
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> No Login Required
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                Request for Quotation —{" "}
                <span className="font-mono text-orange-600">#{shortRef}</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Issued Date</div>
                <div className="font-semibold text-slate-800">
                  {new Date(rfq.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
            <div className="h-7 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-orange-600" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Inquiry Scope</div>
                <div className="font-semibold text-slate-800">
                  {rfq.items.length} Line Item{rfq.items.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-none px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-6">
        {/* Buyer Organization Info Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-orange-600" /> Buyer / Issuing Organization
            </div>
            <h2 className="text-base font-bold text-slate-900">{companyName}</h2>
            {(settings?.shippingAddress || settings?.address) && (
              <p className="text-xs text-slate-600 flex items-start gap-1.5 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{settings?.shippingAddress || settings?.address}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-slate-600">
              {settings?.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {settings.email}
                </span>
              )}
              {settings?.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {settings.phone}
                </span>
              )}
              {settings?.gstNumber && (
                <span className="font-mono text-xs text-slate-700">
                  <strong>GSTIN:</strong> {settings.gstNumber}
                </span>
              )}
            </div>
          </div>

          <div className="bg-orange-50/60 border border-orange-200/80 rounded-xl p-4 flex flex-col justify-center">
            <div className="text-xs font-bold text-orange-900 mb-1">Quotation Instructions</div>
            <p className="text-xs text-orange-800 leading-relaxed">
              Enter your best <strong>Unit Rate (Excl. GST)</strong> in ₹ and estimated{" "}
              <strong>Lead Time</strong> for the items you can supply. Partial quotes are accepted
              if you only stock selected items.
            </p>
          </div>
        </div>

        {/* Status Check or Interactive Quote Form */}
        {rfq.status === "COMPLETED" ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-600">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Bidding Closed for RFQ #{shortRef}
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              This Request for Quotation has already been finalized and awarded. Thank you for your
              interest in partnering with {companyName}.
            </p>
            {(settings?.email || settings?.phone) && (
              <p className="text-xs text-slate-500 pt-2">
                For urgent inquiries, contact us at{" "}
                <span className="font-semibold text-slate-700">
                  {[settings?.email, settings?.phone].filter(Boolean).join(" · ")}
                </span>
              </p>
            )}
          </div>
        ) : (
          <VendorQuoteForm rfq={rfq} token={token} companyName={companyName} />
        )}
      </main>

      <footer className="py-5 border-t border-slate-200 bg-white text-center text-xs text-slate-400 print:hidden">
        Powered by {companyName} Procurement Portal · Secure Vendor Submission
      </footer>
    </div>
  )
}
