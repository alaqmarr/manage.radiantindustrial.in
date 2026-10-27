import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatRupee, numberToWordsRupees, formatShortId } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, FileEdit, FileText, FileSpreadsheet } from "lucide-react"
import { POActions } from "@/components/POActions"
import { POStatusBadge } from "@/components/POStatusBadge"
import { PaymentSection } from "@/components/PaymentSection"
import { DeliverySection } from "@/components/DeliverySection"

export const dynamic = "force-dynamic"

export default async function PurchaseOrderViewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const poRaw = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      quotation: {
        select: {
          id: true,
          prNo: true,
          client: { select: { name: true } },
        },
      },
      rfq: {
        select: { id: true },
      },
      items: {
        include: { product: true },
      },
      deliveries: {
        include: { items: true },
        orderBy: { receivedDate: "desc" },
      },
      payments: {
        orderBy: { date: "desc" },
      },
    },
  })

  if (!poRaw) notFound()

  const po = {
    ...poRaw,
    items: poRaw.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        materialDescription: item.itemDescription || item.product.materialDescription,
      },
    })),
  }

  const settings = await prisma.companySettings.findFirst()

  return (
    <div className="space-y-6 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <Link
            href="/purchase-orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Purchase Orders
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              Purchase Order #{po.poNumber || formatShortId(po.id)}
            </h1>
            <POStatusBadge id={po.id} currentStatus={po.status} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vendor:{" "}
            <Link
              href={`/suppliers/${po.supplierId}`}
              className="font-bold text-slate-800 hover:text-orange-600 underline decoration-slate-300 underline-offset-2"
            >
              {po.supplier.name}
            </Link>{" "}
            • Issued {new Date(po.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/purchase-orders/${po.id}/edit`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium text-sm shadow-2xs transition-all"
          >
            <FileEdit className="w-4 h-4 text-slate-500" />
            <span>Edit PO</span>
          </Link>
          <POActions po={po} settings={settings || {}} />
        </div>
      </div>

      {/* Supplier & Commercial Terms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
            Vendor / Supplier Details
          </h3>
          <p className="text-lg font-bold text-slate-900">{po.supplier.name}</p>
          {po.supplier.location && (
            <p className="text-slate-600 text-sm mt-1">{po.supplier.location}</p>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
            {po.supplier.contact && (
              <div>
                <strong>Contact:</strong> {po.supplier.contact}
              </div>
            )}
            {po.supplier.email && (
              <div>
                <strong>Email:</strong> {po.supplier.email}
              </div>
            )}
            {po.supplier.gstNumber && (
              <div>
                <strong>GSTIN:</strong>{" "}
                <span className="font-mono font-semibold text-slate-800">
                  {po.supplier.gstNumber}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
            Order Terms & Linked References
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Terms:</span>
              <span className="font-semibold text-slate-900">
                {po.paymentTerms || "As per agreement"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Delivery Terms:</span>
              <span className="font-semibold text-slate-900">
                {po.deliveryTerms || "Ex-Works / Door Delivery"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Expected Delivery Date:</span>
              <span className="font-semibold text-slate-900">
                {po.expectedDeliveryDate
                  ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                  : "Immediate"}
              </span>
            </div>

            {po.quotation && (
              <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                <span className="text-slate-500">Fulfilling Quotation:</span>
                <Link
                  href={`/quotations/${po.quotation.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-md transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Quote #{formatShortId(po.quotation.id)} (
                  {po.quotation.client.name})
                </Link>
              </div>
            )}

            {po.rfqId && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-slate-500">Linked Vendor RFQ:</span>
                <Link
                  href={`/rfq/${po.rfqId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  RFQ #{formatShortId(po.rfqId)}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold w-14">S.No</th>
                <th className="px-5 py-3.5 font-semibold">Material Code & Description</th>
                <th className="px-5 py-3.5 font-semibold text-center">Qty & UOM</th>
                <th className="px-5 py-3.5 font-semibold text-right">Unit Rate</th>
                <th className="px-5 py-3.5 font-semibold text-center">GST %</th>
                <th className="px-5 py-3.5 font-semibold text-right">Line Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {po.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/products/${item.productId}/edit`}
                      className="font-mono text-xs font-bold text-slate-900 hover:text-orange-600 underline decoration-slate-300 underline-offset-2"
                      title="View Product & Price History"
                    >
                      {item.product.materialCode}
                    </Link>
                    <div className="text-sm font-medium text-slate-800 mt-0.5">
                      {item.product.materialDescription}
                    </div>
                    {item.product.specification && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.product.specification}
                      </div>
                    )}
                    {item.comment && (
                      <div className="text-xs text-orange-700 mt-1 italic">Note: {item.comment}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center font-mono font-semibold text-slate-900">
                    {item.quantity}{" "}
                    <span className="text-xs text-slate-500 font-normal">{item.product.unit}</span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-slate-800">
                    {formatRupee(item.unitPrice)}
                  </td>
                  <td className="px-5 py-4 text-center font-mono text-xs text-slate-600">
                    {item.gstRate}%
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-slate-900">
                    {formatRupee(Math.round(item.quantity * item.unitPrice))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={5} className="px-5 py-3 text-right text-slate-600 font-medium">
                  Subtotal (Excl. GST)
                </td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900">
                  {formatRupee(po.totalAmount)}
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="px-5 py-3 text-right text-slate-600 font-medium">
                  Total GST
                </td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900">
                  {formatRupee(po.totalGst)}
                </td>
              </tr>
              <tr className="border-t border-slate-200 bg-orange-50/50">
                <td colSpan={5} className="px-5 py-3.5 text-right text-slate-900 font-bold">
                  Grand Total (Incl. GST)
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-black text-orange-600 text-lg">
                  {formatRupee(po.totalAmount + po.totalGst)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-5 py-3 bg-white border-t border-slate-200 text-xs text-slate-600">
          Amount in Words:{" "}
          <strong className="text-slate-900">
            {numberToWordsRupees(po.totalAmount + po.totalGst)}
          </strong>
        </div>
      </div>

      {po.notes && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs print:hidden">
          <h3 className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
            Special Instructions / Notes
          </h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}

      {po.status !== "DRAFT" && po.status !== "CANCELLED" && (
        <div className="space-y-6 print:hidden">
          <DeliverySection poId={po.id} items={po.items} deliveries={po.deliveries} />

          <PaymentSection
            type="po"
            entityId={po.id}
            totalAmount={po.totalAmount}
            totalGst={po.totalGst}
            amountPaid={po.amountPaid}
            paymentStatus={po.paymentStatus}
            paymentDueDate={po.paymentDueDate}
            payments={po.payments}
          />
        </div>
      )}
    </div>
  )
}
