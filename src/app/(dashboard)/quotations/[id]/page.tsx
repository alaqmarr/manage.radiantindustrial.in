import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { QuotationActions } from "@/components/QuotationActions"
import { QuotationStatusBadge } from "@/components/QuotationStatusBadge"
import { PaymentSection } from "@/components/PaymentSection"
import { Metadata } from "next"
import { formatRupee, numberToWordsRupees, formatShortId } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, ClipboardList, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck, FileSearch, XCircle } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Quotation #${formatShortId(id)}`,
  }
}

export default async function QuotationViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: {
          product: {
            include: {
              productSuppliers: {
                include: {
                  supplier: { select: { id: true, name: true } },
                },
                orderBy: { costPrice: "asc" },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { date: "desc" },
      },
      purchaseOrders: {
        include: {
          supplier: true,
          items: true,
        },
        orderBy: { createdAt: "desc" },
      },
      cocs: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!quotation) {
    redirect("/quotations")
  }

  // Hydrate line-item specific description, specification, and unit overrides
  quotation.items = quotation.items.map((item) => ({
    ...item,
    product: {
      ...item.product,
      materialDescription: item.itemDescription || item.product.materialDescription,
      specification: item.itemSpecification ?? item.product.specification,
      unit: item.itemUnit || item.product.unit,
    },
  }))

  const [settings, suppliers] = await Promise.all([
    prisma.companySettings.findUnique({
      where: { id: "default" },
    }),
    prisma.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const isDraft = quotation.status === "DRAFT"

  // Calculate PO fulfillment per quotation product across non-cancelled POs
  const activePos = quotation.purchaseOrders.filter((po) => po.status !== "CANCELLED")
  const orderedQtyByProduct = new Map<string, number>()
  for (const po of activePos) {
    for (const poItem of po.items) {
      orderedQtyByProduct.set(
        poItem.productId,
        (orderedQtyByProduct.get(poItem.productId) || 0) + poItem.quantity
      )
    }
  }

  const confirmedItems = quotation.items.filter((item) => item.isConfirmed !== false)
  const requiredQtyByProduct = new Map<string, number>()
  for (const item of confirmedItems) {
    requiredQtyByProduct.set(
      item.productId,
      (requiredQtyByProduct.get(item.productId) || 0) + item.quantity
    )
  }

  const droppedCount = quotation.items.length - confirmedItems.length
  const hasReducedQty = confirmedItems.some(
    (item) => item.quotedQuantity != null && item.quantity < item.quotedQuantity
  )
  const isPartiallyConfirmed = droppedCount > 0 || hasReducedQty

  const isFullyOrdered =
    confirmedItems.length > 0 &&
    Array.from(requiredQtyByProduct.entries()).every(
      ([prodId, reqQty]) => (orderedQtyByProduct.get(prodId) || 0) >= reqQty
    )

  return (
    <div className="space-y-6 pb-28">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <Link
            href="/quotations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotations
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              Quotation #{formatShortId(quotation.id)}
            </h1>
            {quotation.prNo && (
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono font-semibold">
                PR: {quotation.prNo}
              </span>
            )}
            <QuotationStatusBadge
              id={quotation.id}
              currentStatus={quotation.status}
              quotation={quotation}
            />
            {isPartiallyConfirmed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Partial Order ({confirmedItems.length}/{quotation.items.length} items ordered)
              </span>
            )}
            {isFullyOrdered && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> PO Fully Issued
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Client:{" "}
            <Link
              href={`/clients/${quotation.clientId}`}
              className="font-bold text-slate-800 hover:text-orange-600 underline decoration-slate-300 underline-offset-2"
            >
              {quotation.client.name}
            </Link>{" "}
            • Created on {new Date(quotation.createdAt).toLocaleDateString()}
          </p>
        </div>

        <QuotationActions
          quotation={quotation}
          settings={settings}
          suppliers={suppliers}
          existingPosCount={activePos.length}
          isFullyOrdered={isFullyOrdered}
        />
      </div>

      {/* Linked Purchase Orders & Certificates of Conformance (COC) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:hidden">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-orange-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Linked Purchase Orders ({quotation.purchaseOrders.length})
              </h2>
            </div>
            {!isFullyOrdered ? (
              <Link
                href={`/purchase-orders/new?quotationId=${quotation.id}`}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                + Generate PO for Remaining Items
              </Link>
            ) : (
              <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All quotation items ordered (Duplicate POs blocked)
              </span>
            )}
          </div>

          {quotation.purchaseOrders.length === 0 ? (
            <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-lg border border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span>No Purchase Orders have been generated against this quotation yet.</span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/rfq/new?quotationId=${quotation.id}`}
                  className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-md font-semibold text-xs transition-colors flex items-center gap-1"
                >
                  <FileSearch className="w-3.5 h-3.5" /> Send Vendor RFQ
                </Link>
                <Link
                  href={`/purchase-orders/new?quotationId=${quotation.id}`}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md font-semibold text-xs transition-colors"
                >
                  <span className="text-white">Create PO</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quotation.purchaseOrders.map((po) => (
                <Link
                  key={po.id}
                  href={`/purchase-orders/${po.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 transition-all group"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 group-hover:text-orange-700">
                      <span className="font-mono">
                        #{po.poNumber || formatShortId(po.id)}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </div>
                    <div className="text-xs text-slate-600 font-medium truncate mt-0.5">
                      {po.supplier.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(po.createdAt).toLocaleDateString()} • {po.items.length} item(s)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {formatRupee(po.totalAmount + po.totalGst)}
                    </div>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        po.status === "CANCELLED"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : po.status === "DELIVERED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {po.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Linked Certificates of Conformance (COC) Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Quality Certificates ({quotation.cocs.length})
                </h2>
              </div>
              <Link
                href={`/cocs/new?quotationId=${quotation.id}&clientId=${quotation.clientId}`}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                + Issue COC
              </Link>
            </div>

            {quotation.cocs.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-lg border border-dashed border-slate-200 flex items-center justify-between gap-2">
                <span>No COC issued for this quotation yet.</span>
                <Link
                  href={`/cocs/new?quotationId=${quotation.id}&clientId=${quotation.clientId}`}
                  className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-semibold text-xs transition-colors shrink-0"
                >
                  <span className="text-white">Issue COC</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {quotation.cocs.map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/cocs/${c.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 transition-all group"
                  >
                    <div>
                      <div className="text-xs font-mono font-bold text-slate-900 group-hover:text-teal-700 flex items-center gap-1">
                        {c.cocNumber}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(c.date).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-50 text-teal-700 border border-teal-200">
                      CERTIFIED
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Quotation Document Preview Card */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs print:hidden">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8 border-b border-slate-200 pb-6">
          <div>
            <img
              src={settings?.logoUrl || "/logo-long.png"}
              alt="Radiant Industrial Co."
              className="h-12 object-contain mb-4"
            />
            <div className="text-slate-600 text-sm space-y-1">
              <p>
                <strong className="text-slate-900">Client:</strong> {quotation.client.name}
              </p>
              {quotation.prNo && (
                <p>
                  <strong className="text-slate-900">PR No:</strong> {quotation.prNo}
                </p>
              )}
              {quotation.rfqNo && (
                <p>
                  <strong className="text-slate-900">RFQ No:</strong> {quotation.rfqNo}
                </p>
              )}
            </div>
          </div>
          <div className="sm:text-right text-slate-600 text-sm space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p>
              <strong className="text-slate-900">Date:</strong>{" "}
              {new Date(quotation.createdAt).toLocaleDateString()}
            </p>
            <p>
              <strong className="text-slate-900">Quotation ID:</strong>{" "}
              <span className="font-mono font-bold text-slate-900">{formatShortId(quotation.id)}</span>
            </p>
          </div>
        </div>

        {/* Intro Message */}
        {settings?.quotationMessage && (
          <div
            className="text-slate-600 text-sm mb-6 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: settings.quotationMessage }}
          />
        )}

        {/* Line Items Table */}
        <div className="mb-8 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold w-28">Code</th>
                <th className="py-3 px-4 font-semibold min-w-[260px]">Description</th>
                <th className="py-3 px-4 font-semibold text-center w-20">UOM</th>
                <th className="py-3 px-4 font-semibold text-center w-24">Qty</th>
                <th className="py-3 px-4 font-semibold text-center w-24">PO Ordered</th>
                <th className="py-3 px-4 font-semibold text-right w-32">Selling Rate</th>
                <th className="py-3 px-4 font-semibold text-right w-32">Line Amount</th>
                <th className="py-3 px-4 font-semibold text-right w-28 text-amber-700">Vendor CP</th>
                <th className="py-3 px-4 font-semibold text-right w-28 text-emerald-700">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {quotation.items.map((item) => {
                const orderedQty = orderedQtyByProduct.get(item.productId) || 0
                const isDropped = item.isConfirmed === false
                const wasReduced =
                  !isDropped &&
                  item.quotedQuantity != null &&
                  item.quantity < item.quotedQuantity
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isDropped
                        ? "bg-slate-50/90 opacity-60"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="py-3.5 px-4 text-slate-900 font-mono text-xs font-semibold">
                      <Link
                        href={`/products/${item.productId}/edit`}
                        className="hover:text-orange-600 underline decoration-slate-300 underline-offset-2"
                        title="View Product & Price History"
                      >
                        {item.product.materialCode}
                      </Link>
                      {isDropped && (
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-sans font-bold uppercase">
                          <XCircle className="w-2.5 h-2.5" /> Not Ordered
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div
                        className={`font-medium ${
                          isDropped ? "text-slate-500 line-through" : "text-slate-900"
                        }`}
                      >
                        {item.product.materialDescription}
                      </div>
                      {item.product.specification && (
                        <div className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap">
                          {item.product.specification}
                        </div>
                      )}
                      {item.comment && (
                        <div className="text-xs text-orange-700 mt-1 italic whitespace-pre-wrap">
                          Note: {item.comment}
                        </div>
                      )}
                      {item.leadTime && (
                        <div className="text-xs text-blue-700 mt-0.5 font-medium">
                          Lead Time: {item.leadTime}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600 text-xs font-mono">
                      {item.product.unit}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-900">
                      <div>{item.quantity}</div>
                      {wasReduced && (
                        <div className="text-[10px] text-amber-700 font-normal">
                          (Quoted: {item.quotedQuantity})
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs">
                      {isDropped ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-400">
                          Dropped
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold ${
                            orderedQty >= item.quantity
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : orderedQty > 0
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {orderedQty} / {item.quantity}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-800">
                      {formatRupee(item.spSnapshot)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {isDropped ? (
                        <span className="text-slate-400 line-through">
                          {formatRupee(Math.round(item.spSnapshot * item.quantity))}
                        </span>
                      ) : (
                        formatRupee(Math.round(item.spSnapshot * item.quantity))
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-amber-700">
                      {isDropped
                        ? "—"
                        : formatRupee(Math.round((item.cpSnapshot || 0) * item.quantity))}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700">
                      {isDropped
                        ? "—"
                        : formatRupee(
                            Math.round((item.spSnapshot - (item.cpSnapshot || 0)) * item.quantity) -
                              (item.additionalCost || 0)
                          )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 text-xs bg-slate-50">
              <tr>
                <td colSpan={9} className="py-3 px-4">
                  {(() => {
                    const total = quotation.items.length
                    const pending = quotation.items.filter(
                      (i) => !i.cpSnapshot || i.cpSnapshot === 0
                    ).length
                    const quoted = total - pending
                    return (
                      <div className="flex gap-6 text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          Total Line Items: <strong className="text-slate-900">{total}</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Fully Priced: <strong className="text-emerald-700">{quoted}</strong>
                        </span>
                        {pending > 0 && (
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Pending Cost Price: <strong className="text-amber-700">{pending}</strong>
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Terms & Amount in Words */}
        {settings?.bottomDetails && (
          <div
            className="pt-6 border-t border-slate-200 text-xs text-slate-600 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: settings.bottomDetails }}
          />
        )}

        <div className="pt-4 text-sm font-medium text-slate-600">
          Amount in words:{" "}
          <span className="text-slate-900 font-semibold">
            {numberToWordsRupees(quotation.totalAmount + quotation.totalGst)}
          </span>
        </div>
      </div>

      {!isDraft && (
        <div className="print:hidden">
          <PaymentSection
            type="quotation"
            entityId={quotation.id}
            totalAmount={quotation.totalAmount}
            totalGst={quotation.totalGst}
            amountPaid={quotation.amountPaid}
            paymentStatus={quotation.paymentStatus}
            paymentDueDate={quotation.paymentDueDate}
            payments={quotation.payments}
          />
        </div>
      )}

      {/* Sticky Financial Summary Bar */}
      <div className="fixed bottom-0 left-0 md:left-64 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 md:px-8 flex flex-wrap items-center justify-between gap-6 shadow-lg print:hidden">
        {(() => {
          const totalAmount = quotation.totalAmount
          const totalGst = quotation.totalGst
          const totalPCost = confirmedItems.reduce(
            (sum, item) => sum + Math.round((item.cpSnapshot || 0) * item.quantity),
            0
          )
          const totalAddnlCost = confirmedItems.reduce(
            (sum, item) => sum + (item.additionalCost || 0),
            0
          )
          const totalProfit = totalAmount - totalPCost - totalAddnlCost
          const marginPercent = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0

          return (
            <>
              <div className="flex flex-wrap items-center gap-8">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Subtotal (Excl. GST)
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {formatRupee(totalAmount)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Total Vendor Cost
                  </div>
                  <div className="text-base font-bold font-mono text-amber-700">
                    {formatRupee(totalPCost)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Net Estimated Profit
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold font-mono text-emerald-700">
                      {formatRupee(totalProfit)}
                    </span>
                    {totalProfit > 0 && (
                      <span className="text-xs text-emerald-600 font-semibold">
                        ({marginPercent.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-orange-600 uppercase font-bold tracking-wider">
                  Grand Total (Incl. GST)
                </div>
                <div className="text-2xl font-black font-mono text-orange-600">
                  {formatRupee(totalAmount + totalGst)}
                </div>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
