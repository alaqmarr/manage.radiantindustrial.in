import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import {
  Plus,
  Truck,
  Package,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ClipboardList,
} from "lucide-react"
import { SelectionProvider } from "@/components/selection/SelectionContext"
import { SelectAllCheckbox } from "@/components/selection/SelectAllCheckbox"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { BatchDeleteButton } from "@/components/selection/BatchDeleteButton"
import { deleteSuppliers } from "@/app/actions/batchDelete"
import { SearchBar } from "@/components/SearchBar"
import { SupplierModal } from "@/components/SupplierModal"
import { ClickableRow } from "@/components/ClickableRow"
import { formatRupee } from "@/lib/utils"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Suppliers Directory & Payables",
}

export default async function SuppliersPage(props: {
  searchParams: Promise<{ search?: string }>
}) {
  const searchParams = await props.searchParams
  const search = searchParams.search || ""

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { contact: { contains: search } },
          { gstNumber: { contains: search } },
          { location: { contains: search } },
        ],
      }
    : {}

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      purchaseOrders: {
        where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
        select: { totalAmount: true, totalGst: true, amountPaid: true },
      },
      purchases: {
        select: { totalAmount: true, totalGst: true, amountPaid: true },
      },
      _count: {
        select: {
          products: true,
          productSuppliers: true,
          purchases: true,
          purchaseOrders: true,
          rfqs: true,
        },
      },
    },
  })

  let totalBilledAll = 0
  let totalPaidAll = 0
  let totalPayableAll = 0
  let totalLinkedCatalogItems = 0

  const enrichedSuppliers = suppliers.map((s) => {
    const poBilled = s.purchaseOrders.reduce(
      (sum, po) => sum + (po.totalAmount || 0) + (po.totalGst || 0),
      0
    )
    const poPaid = s.purchaseOrders.reduce((sum, po) => sum + (po.amountPaid || 0), 0)

    const purBilled = s.purchases.reduce(
      (sum, p) => sum + (p.totalAmount || 0) + (p.totalGst || 0),
      0
    )
    const purPaid = s.purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0)

    const billed = poBilled + purBilled
    const paid = poPaid + purPaid
    const payable = Math.max(0, billed - paid)
    const catalogCount = Math.max(s._count.productSuppliers, s._count.products)

    totalBilledAll += billed
    totalPaidAll += paid
    totalPayableAll += payable
    totalLinkedCatalogItems += catalogCount

    return {
      ...s,
      billed,
      paid,
      payable,
      catalogCount,
    }
  })

  return (
    <SelectionProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Suppliers & Vendor Directory
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Manage vendor contacts, GST numbers, supplied catalog items, and payable balances.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar placeholder="Search supplier, GSTIN, city..." />
            <BatchDeleteButton deleteAction={deleteSuppliers} entityName="suppliers" />
            <Link
              href="?action=new-supplier"
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 shadow-xs text-white font-semibold rounded-lg transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </Link>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Suppliers
              </span>
              <Truck className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1.5">
              {suppliers.length}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalLinkedCatalogItems} vendor price mappings
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Total Billed (Incl. GST)
              </span>
              <ShoppingCart className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono mt-1.5">
              {formatRupee(totalBilledAll)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Issued POs + Direct Purchases</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Total Paid to Vendors
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 font-mono mt-1.5">
              {formatRupee(totalPaidAll)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Disbursed supplier payments</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                Payables Due
              </span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-600 font-mono mt-1.5">
              {formatRupee(totalPayableAll)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Outstanding owed to suppliers</p>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <SelectAllCheckbox allIds={enrichedSuppliers.map((s) => s.id)} />
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">
                    Supplier & GSTIN
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider">Contact Info</th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-center">
                    Catalog Items
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-center">
                    Orders (PO / Pur)
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                    Total Billed
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                    Payable Due
                  </th>
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrichedSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No suppliers found. Click <strong>Add Supplier</strong> to register a vendor.
                    </td>
                  </tr>
                ) : (
                  enrichedSuppliers.map((supplier) => (
                    <ClickableRow
                      key={supplier.id}
                      href={`/suppliers/${supplier.id}`}
                      className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <RowCheckbox id={supplier.id} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                          {supplier.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {supplier.gstNumber && (
                            <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                              GST: {supplier.gstNumber}
                            </span>
                          )}
                          {supplier.location && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 text-slate-400" /> {supplier.location}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 text-xs text-slate-600">
                          {supplier.contact && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" /> {supplier.contact}
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400" /> {supplier.email}
                            </div>
                          )}
                          {!supplier.contact && !supplier.email && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-mono font-semibold text-slate-700">
                          <Package className="w-3 h-3 text-slate-400" /> {supplier.catalogCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                          {supplier._count.purchaseOrders} PO · {supplier._count.purchases} Pur
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        <div className="font-bold text-slate-900">
                          {formatRupee(supplier.billed)}
                        </div>
                        {supplier.paid > 0 && (
                          <div className="text-[11px] text-emerald-600">
                            Paid: {formatRupee(supplier.paid)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {supplier.payable > 0 ? (
                          <span className="inline-block font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                            {formatRupee(supplier.payable)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Settled</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <Link
                          href={`/purchase-orders/new?supplierId=${supplier.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <ClipboardList className="w-3 h-3" /> + PO
                        </Link>
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Ledger
                        </Link>
                        <Link
                          href={`?action=edit-supplier&id=${supplier.id}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          Edit
                        </Link>
                      </td>
                    </ClickableRow>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <SupplierModal suppliers={suppliers} />
      </div>
    </SelectionProvider>
  )
}
