import os

po_view = '''import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"
import { POActions } from "@/components/POActions"

export const dynamic = "force-dynamic"

export default async function PurchaseOrderViewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      items: {
        include: { product: true }
      }
    }
  })

  if (!po) notFound()
  
  const settings = await prisma.companySettings.findFirst()

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/purchase-orders" className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-white">
            PO: {po.poNumber || po.id}
          </h1>
          <span className={px-2.5 py-1 rounded-full text-xs font-medium border }>
            {po.status}
          </span>
        </div>
        
        <div className="flex gap-3">
          <POActions po={po} settings={settings || {}} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Supplier Details</h3>
          <p className="text-lg font-medium text-white">{po.supplier.name}</p>
          {po.supplier.contact && <p className="text-zinc-300 mt-1">{po.supplier.contact}</p>}
          {po.supplier.email && <p className="text-zinc-300 mt-1">{po.supplier.email}</p>}
          {po.supplier.gstNumber && <p className="text-zinc-400 mt-2 text-sm">GST: {po.supplier.gstNumber}</p>}
        </div>

        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Terms & Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Payment Terms:</span>
              <span className="text-white">{po.paymentTerms || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Delivery Terms:</span>
              <span className="text-white">{po.deliveryTerms || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Expected Delivery:</span>
              <span className="text-white">
                {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-lg border border-premium-border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-400 uppercase bg-black/40 border-b border-premium-border">
            <tr>
              <th className="px-6 py-4 font-medium">Item</th>
              <th className="px-6 py-4 font-medium">Quantity</th>
              <th className="px-6 py-4 font-medium">Price</th>
              <th className="px-6 py-4 font-medium">GST Rate</th>
              <th className="px-6 py-4 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-premium-border">
            {po.items.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02]">
                <td className="px-6 py-4">
                  <div className="font-medium text-white">{item.product.materialCode}</div>
                  <div className="text-xs text-zinc-400">{item.product.materialDescription}</div>
                  {item.comment && <div className="text-xs text-brand-slate mt-1">{item.comment}</div>}
                </td>
                <td className="px-6 py-4 text-white">
                  {item.quantity} <span className="text-xs text-zinc-500">{item.product.unit}</span>
                </td>
                <td className="px-6 py-4 text-white">{formatRupee(item.unitPrice)}</td>
                <td className="px-6 py-4 text-white">{item.gstRate}%</td>
                <td className="px-6 py-4 text-right font-medium text-white">
                  {formatRupee(item.quantity * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-black/20 border-t border-premium-border">
            <tr>
              <td colSpan={4} className="px-6 py-4 text-right text-zinc-400">Subtotal</td>
              <td className="px-6 py-4 text-right text-white font-medium">{formatRupee(po.totalAmount)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-6 py-4 text-right text-zinc-400">Total GST</td>
              <td className="px-6 py-4 text-right text-white font-medium">{formatRupee(po.totalGst)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-6 py-4 text-right text-white font-bold">Grand Total</td>
              <td className="px-6 py-4 text-right text-brand-orange font-bold text-lg">{formatRupee(po.totalAmount + po.totalGst)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {po.notes && (
        <div className="glass-panel p-6 rounded-lg border border-premium-border">
          <h3 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wider">Notes</h3>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}
    </div>
  )
}'''
os.makedirs('src/app/(dashboard)/purchase-orders/[id]', exist_ok=True)
with open('src/app/(dashboard)/purchase-orders/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(po_view)

po_edit = '''import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PurchaseOrderForm } from "@/components/PurchaseOrderForm"

export const dynamic = "force-dynamic"

export default async function EditPurchaseOrderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { product: true }
      }
    }
  })

  if (!po) notFound()

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  })

  const products = await prisma.product.findMany({
    select: {
      id: true,
      materialCode: true,
      materialDescription: true,
      sellingPrice: true,
      costPrice: true,
      gstRate: true,
      unit: true,
      specification: true
    },
    orderBy: { materialCode: "asc" }
  })

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-8">Edit Purchase Order</h1>
      <PurchaseOrderForm suppliers={suppliers} products={products} initialData={po} />
    </div>
  )
}'''
os.makedirs('src/app/(dashboard)/purchase-orders/[id]/edit', exist_ok=True)
with open('src/app/(dashboard)/purchase-orders/[id]/edit/page.tsx', 'w', encoding='utf-8') as f:
    f.write(po_edit)

