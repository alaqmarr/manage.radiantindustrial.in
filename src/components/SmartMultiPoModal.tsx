"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createBatchPurchaseOrdersFromQuotation } from "@/app/actions/purchaseOrder"
import { formatRupee, formatShortId } from "@/lib/utils"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import {
  X,
  Sparkles,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  FileCheck,
  FileEdit,
  ArrowRight,
  Tag,
} from "lucide-react"
import { sileo } from "sileo"

export interface SupplierOption {
  id: string
  name: string
}

interface SmartSplitRow {
  quotationItemId: string
  productId: string
  materialCode: string
  materialDescription: string
  unit: string
  gstRate: number
  comment?: string | null
  quotedQty: number
  alreadyOrderedQty: number
  remainingQty: number
  orderQty: number
  selected: boolean
  supplierId: string
  unitRateRupees: number // in Rupees for SmartNumberInput
  spSnapshotPaise: number
  cpSnapshotPaise: number
  knownVendors: {
    supplierId: string
    supplierName: string
    costPricePaise: number
  }[]
}

export function SmartMultiPoModal({
  isOpen,
  onClose,
  quotation,
  suppliers = [],
  existingPos,
}: {
  isOpen: boolean
  onClose: () => void
  quotation: any
  suppliers: SupplierOption[]
  existingPos?: any[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<SmartSplitRow[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittingMode, setSubmittingMode] = useState<"DRAFT" | "ISSUED" | null>(null)
  const [bulkSupplierId, setBulkSupplierId] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")
  const [deliveryTerms, setDeliveryTerms] = useState("")
  const [notes, setNotes] = useState("")

  // Build initial rows whenever modal opens
  useEffect(() => {
    if (!isOpen || !quotation) return

    const posList = existingPos ?? quotation.purchaseOrders ?? []
    const activePos = posList.filter((po: any) => po.status !== "CANCELLED")

    // Sum already-ordered quantities per productId
    const orderedByProduct = new Map<string, number>()
    for (const po of activePos) {
      for (const pi of po.items || []) {
        orderedByProduct.set(
          pi.productId,
          (orderedByProduct.get(pi.productId) || 0) + (Number(pi.quantity) || 0)
        )
      }
    }

    const remainingOrderedToDeduct = new Map(orderedByProduct)
    const confirmedItems = (quotation.items || []).filter(
      (item: any) => item.isConfirmed !== false
    )

    const initialRows: SmartSplitRow[] = []

    for (const item of confirmedItems) {
      const prevOrdered = remainingOrderedToDeduct.get(item.productId) || 0
      const deducted = Math.min(item.quantity, prevOrdered)
      remainingOrderedToDeduct.set(item.productId, prevOrdered - deducted)

      const remainingQty = Math.max(
        0,
        Number((item.quantity - deducted).toFixed(3))
      )
      if (remainingQty <= 0) continue

      const rawProductSuppliers: any[] = item.product?.productSuppliers || []
      const knownVendors = rawProductSuppliers
        .filter((ps) => ps && ps.supplierId)
        .map((ps) => ({
          supplierId: ps.supplierId,
          supplierName:
            ps.supplier?.name ||
            suppliers.find((s) => s.id === ps.supplierId)?.name ||
            ps.supplierId,
          costPricePaise: Number(ps.costPrice) || 0,
        }))
        .sort((a, b) => {
          if (a.costPricePaise > 0 && b.costPricePaise > 0) {
            return a.costPricePaise - b.costPricePaise
          }
          if (a.costPricePaise > 0) return -1
          if (b.costPricePaise > 0) return 1
          return 0
        })

      const lowestVendor = knownVendors.find((v) => v.costPricePaise > 0) || knownVendors[0]
      const matchingSnapshotVendor =
        item.cpSnapshot && item.cpSnapshot > 0
          ? knownVendors.find((v) => v.costPricePaise === item.cpSnapshot)
          : undefined

      // Auto-select supplier:
      // 1) Item's explicit supplierId
      // 2) Vendor matching cpSnapshot
      // 3) Lowest cost vendor from productSuppliers
      // 4) Product's default supplierId
      const autoSupplierId =
        item.supplierId ||
        matchingSnapshotVendor?.supplierId ||
        lowestVendor?.supplierId ||
        item.product?.supplierId ||
        ""

      // Default unit rate (paise -> Rupees):
      // item.cpSnapshot || lowestVendorCp || item.product.costPrice
      const defaultCpPaise =
        (item.cpSnapshot && item.cpSnapshot > 0 ? item.cpSnapshot : 0) ||
        (lowestVendor?.costPricePaise && lowestVendor.costPricePaise > 0
          ? lowestVendor.costPricePaise
          : 0) ||
        Number(item.product?.costPrice) ||
        0

      initialRows.push({
        quotationItemId: item.id,
        productId: item.productId,
        materialCode: item.product?.materialCode || "",
        materialDescription:
          item.itemDescription || item.product?.materialDescription || "",
        unit: item.itemUnit || item.product?.unit || "NUM",
        gstRate: item.gstSnapshot ?? item.product?.gstRate ?? 18,
        comment: item.comment || null,
        quotedQty: item.quantity,
        alreadyOrderedQty: deducted,
        remainingQty,
        orderQty: remainingQty,
        selected: true,
        supplierId: autoSupplierId,
        unitRateRupees: Number((defaultCpPaise / 100).toFixed(2)),
        spSnapshotPaise: Number(item.spSnapshot) || 0,
        cpSnapshotPaise: Number(item.cpSnapshot) || 0,
        knownVendors,
      })
    }

    setRows(initialRows)
    setBulkSupplierId("")
    setPaymentTerms("")
    setDeliveryTerms("")
    setNotes("")
  }, [isOpen, quotation, existingPos, suppliers])

  const supplierNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of suppliers) {
      map.set(s.id, s.name)
    }
    return map
  }, [suppliers])

  if (!isOpen) return null

  const toggleRowSelection = (quotationItemId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.quotationItemId === quotationItemId ? { ...r, selected: !r.selected } : r
      )
    )
  }

  const updateRowSupplier = (quotationItemId: string, newSupplierId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.quotationItemId !== quotationItemId) return r
        const matchedVendor = r.knownVendors.find(
          (kv) => kv.supplierId === newSupplierId
        )
        const updatedRate =
          matchedVendor && matchedVendor.costPricePaise > 0
            ? Number((matchedVendor.costPricePaise / 100).toFixed(2))
            : r.unitRateRupees
        return {
          ...r,
          supplierId: newSupplierId,
          unitRateRupees: updatedRate,
          selected: newSupplierId ? true : r.selected,
        }
      })
    )
  }

  const updateRowQty = (quotationItemId: string, newQty: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.quotationItemId !== quotationItemId) return r
        const clamped = Math.max(0, Math.min(r.remainingQty, newQty))
        return {
          ...r,
          orderQty: clamped,
          selected: clamped > 0 ? true : false,
        }
      })
    )
  }

  const updateRowRate = (quotationItemId: string, newRateRupees: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.quotationItemId === quotationItemId
          ? { ...r, unitRateRupees: Math.max(0, newRateRupees) }
          : r
      )
    )
  }

  const handleAutoSelectLowestVendors = () => {
    setRows((prev) =>
      prev.map((r) => {
        const lowest =
          r.knownVendors.find((v) => v.costPricePaise > 0) || r.knownVendors[0]
        if (!lowest) return r
        return {
          ...r,
          supplierId: lowest.supplierId,
          unitRateRupees:
            lowest.costPricePaise > 0
              ? Number((lowest.costPricePaise / 100).toFixed(2))
              : r.unitRateRupees,
        }
      })
    )
    sileo.success({
      title: "Lowest-Cost Vendors Assigned",
      description: "Automatically matched items with their lowest-cost linked supplier.",
    })
  }

  const handleApplyBulkSupplier = (onlyUnassigned: boolean) => {
    if (!bulkSupplierId) return
    setRows((prev) =>
      prev.map((r) => {
        if (onlyUnassigned && r.supplierId) return r
        const matchedVendor = r.knownVendors.find(
          (kv) => kv.supplierId === bulkSupplierId
        )
        return {
          ...r,
          supplierId: bulkSupplierId,
          unitRateRupees:
            matchedVendor && matchedVendor.costPricePaise > 0
              ? Number((matchedVendor.costPricePaise / 100).toFixed(2))
              : r.unitRateRupees,
        }
      })
    )
  }

  // Compute live preview grouped by Supplier
  const activeSelectedRows = rows.filter((r) => r.selected && r.orderQty > 0)
  const unassignedRows = activeSelectedRows.filter((r) => !r.supplierId)

  const supplierGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        supplierId: string
        supplierName: string
        items: SmartSplitRow[]
        subtotalPaise: number
        gstPaise: number
      }
    >()

    for (const r of activeSelectedRows) {
      if (!r.supplierId) continue
      const unitPaise = Math.round(r.unitRateRupees * 100)
      const lineSub = Math.round(r.orderQty * unitPaise)
      const lineGst = Math.round(lineSub * (r.gstRate / 100))

      const existing = map.get(r.supplierId)
      if (existing) {
        existing.items.push(r)
        existing.subtotalPaise += lineSub
        existing.gstPaise += lineGst
      } else {
        map.set(r.supplierId, {
          supplierId: r.supplierId,
          supplierName: supplierNameMap.get(r.supplierId) || "Selected Vendor",
          items: [r],
          subtotalPaise: lineSub,
          gstPaise: lineGst,
        })
      }
    }

    return Array.from(map.values())
  }, [activeSelectedRows, supplierNameMap])

  const totalBatchSubtotalPaise = supplierGroups.reduce(
    (s, g) => s + g.subtotalPaise,
    0
  )
  const totalBatchGstPaise = supplierGroups.reduce((s, g) => s + g.gstPaise, 0)

  const handleSubmit = async (status: "DRAFT" | "ISSUED") => {
    if (activeSelectedRows.length === 0) {
      sileo.warning({
        title: "No Items Selected",
        description: "Please select at least one item with quantity greater than 0.",
      })
      return
    }

    if (unassignedRows.length > 0) {
      sileo.warning({
        title: "Vendor Not Assigned",
        description: `Please select a supplier for all ${unassignedRows.length} selected item(s), or uncheck items you want to order later.`,
      })
      return
    }

    setIsSubmitting(true)
    setSubmittingMode(status)

    try {
      const res = await createBatchPurchaseOrdersFromQuotation({
        quotationId: quotation.id,
        status,
        paymentTerms: paymentTerms.trim() || undefined,
        deliveryTerms: deliveryTerms.trim() || undefined,
        notes: notes.trim() || undefined,
        groups: supplierGroups.map((g) => ({
          supplierId: g.supplierId,
          items: g.items.map((item) => ({
            productId: item.productId,
            itemDescription: item.materialDescription || null,
            quantity: item.orderQty,
            unitPrice: Math.round(item.unitRateRupees * 100),
            gstRate: item.gstRate,
            comment: item.comment || undefined,
          })),
        })),
      })

      if (res.error) {
        sileo.error({
          title: "Could Not Generate POs",
          description: res.error,
        })
      } else {
        const poListStr = (res.createdPoNumbers || []).join(", ")
        sileo.success({
          title: `${res.count} Purchase Order${res.count === 1 ? "" : "s"} Generated`,
          description: `Created ${status === "DRAFT" ? "Draft" : "Issued"} POs: ${poListStr}`,
        })
        onClose()
        router.refresh()
      }
    } catch (err: any) {
      sileo.error({
        title: "Error Generating POs",
        description: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
      setSubmittingMode(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs print:hidden"
      onClick={() => {
        if (!isSubmitting) onClose()
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[11px] font-black uppercase tracking-wider">
                <Layers className="w-3 h-3 text-orange-600" />
                Smart Multi-Vendor PO Split
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Split &amp; Generate Vendor POs — Quotation #{formatShortId(quotation.id)}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client: <strong className="text-slate-800">{quotation.client?.name}</strong> • Assign each line item to its best supplier and generate all Purchase Orders in one click.
            </p>
          </div>
          {!isSubmitting && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Smart Toolbar */}
        <div className="px-6 py-3 bg-orange-50/50 border-b border-orange-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
            <span>
              Vendors with the <strong>lowest recorded Cost Price</strong> are automatically pre-selected. You can override any vendor or rate below.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoSelectLowestVendors}
              className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Auto-Pick Lowest Cost Vendors
            </button>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={bulkSupplierId}
                onChange={(e) => setBulkSupplierId(e.target.value)}
                className="text-xs text-slate-700 bg-transparent border-none outline-none pr-1 max-w-[170px]"
              >
                <option value="">Bulk assign vendor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!bulkSupplierId}
                onClick={() => handleApplyBulkSupplier(true)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                title="Assign selected vendor to rows that don't have a vendor yet"
              >
                Fill Empty
              </button>
              <button
                type="button"
                disabled={!bulkSupplierId}
                onClick={() => handleApplyBulkSupplier(false)}
                className="px-2 py-0.5 bg-orange-50 hover:bg-orange-100 disabled:opacity-40 text-orange-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                title="Assign selected vendor to all rows"
              >
                Apply All
              </button>
            </div>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {rows.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900">
                All Confirmed Items Are Already Ordered
              </p>
              <p className="text-xs text-slate-500 mt-1">
                There are no remaining quantities left to order for this quotation.
              </p>
            </div>
          ) : (
            <>
              {/* Live Grouped PO Summary Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-bold text-slate-900">
                      {supplierGroups.length > 0
                        ? `${supplierGroups.length} Purchase Order${
                            supplierGroups.length === 1 ? "" : "s"
                          } will be generated: `
                        : "Select vendors below to preview Purchase Orders"}
                    </span>
                    {supplierGroups.length > 0 && (
                      <span className="text-xs text-slate-600 font-medium">
                        {supplierGroups
                          .map(
                            (g) =>
                              `${g.supplierName} (${g.items.length} item${
                                g.items.length === 1 ? "" : "s"
                              })`
                          )
                          .join(", ")}
                      </span>
                    )}
                  </div>

                  {unassignedRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      {unassignedRows.length} item(s) need a supplier
                    </span>
                  )}
                </div>

                {supplierGroups.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {supplierGroups.map((g, i) => (
                      <div
                        key={g.supplierId}
                        className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-2xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-mono text-[10px] font-bold">
                              PO #{i + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {g.supplierName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {g.items.length} line item{g.items.length === 1 ? "" : "s"} • Excl. GST:{" "}
                            <span className="font-mono font-semibold text-slate-700">
                              {formatRupee(g.subtotalPaise)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-slate-900">
                            {formatRupee(g.subtotalPaise + g.gstPaise)}
                          </div>
                          <div className="text-[10px] text-slate-400">Incl. GST</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] uppercase bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">Inc.</th>
                      <th className="py-3 px-3">Item &amp; Description</th>
                      <th className="py-3 px-3 w-64">Assign Vendor / Supplier</th>
                      <th className="py-3 px-3 text-center w-28">Rem. Qty</th>
                      <th className="py-3 px-3 text-center w-32">PO Qty</th>
                      <th className="py-3 px-3 text-right w-36">PO Unit Rate (₹)</th>
                      <th className="py-3 px-3 text-right w-32">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rows.map((row, idx) => {
                      const unitPaise = Math.round(row.unitRateRupees * 100)
                      const lineAmountPaise = row.selected
                        ? Math.round(row.orderQty * unitPaise)
                        : 0
                      const marginWarning =
                        row.spSnapshotPaise > 0 && unitPaise > row.spSnapshotPaise

                      return (
                        <tr
                          key={row.quotationItemId}
                          className={`transition-colors ${
                            !row.selected
                              ? "bg-slate-50/70 opacity-60"
                              : !row.supplierId
                              ? "bg-amber-50/20 hover:bg-amber-50/40"
                              : "bg-white hover:bg-slate-50/60"
                          }`}
                        >
                          <td className="py-3 px-3 text-center align-top pt-4">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleRowSelection(row.quotationItemId)}
                              className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 accent-orange-600 cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-3 align-top">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-slate-400">
                                #{idx + 1}
                              </span>
                              <span className="font-mono text-xs font-bold text-orange-600">
                                {row.materialCode}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                GST {row.gstRate}%
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-900 mt-0.5">
                              {row.materialDescription}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                              <span>
                                Client SP:{" "}
                                <strong className="font-mono text-slate-700">
                                  {formatRupee(row.spSnapshotPaise)}
                                </strong>
                              </span>
                              {row.cpSnapshotPaise > 0 && (
                                <span>
                                  Quote CP:{" "}
                                  <strong className="font-mono text-amber-700">
                                    {formatRupee(row.cpSnapshotPaise)}
                                  </strong>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top">
                            <select
                              disabled={!row.selected}
                              value={row.supplierId}
                              onChange={(e) =>
                                updateRowSupplier(row.quotationItemId, e.target.value)
                              }
                              className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold border outline-none transition-colors ${
                                !row.supplierId && row.selected
                                  ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-orange-500"
                                  : "border-slate-300 bg-white text-slate-900 focus:border-orange-500"
                              }`}
                            >
                              <option value="">-- Select Supplier --</option>
                              {suppliers.map((s) => {
                                const kv = row.knownVendors.find(
                                  (v) => v.supplierId === s.id
                                )
                                return (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                    {kv && kv.costPricePaise > 0
                                      ? ` (${formatRupee(kv.costPricePaise)})`
                                      : ""}
                                  </option>
                                )
                              })}
                            </select>

                            {/* Quick vendor rate pills if multiple known vendors exist */}
                            {row.knownVendors.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {row.knownVendors.slice(0, 3).map((kv, vIdx) => {
                                  const isSelected = row.supplierId === kv.supplierId
                                  return (
                                    <button
                                      key={kv.supplierId}
                                      type="button"
                                      disabled={!row.selected}
                                      onClick={() =>
                                        updateRowSupplier(
                                          row.quotationItemId,
                                          kv.supplierId
                                        )
                                      }
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all cursor-pointer ${
                                        isSelected
                                          ? "bg-orange-50 text-orange-800 border-orange-300 font-bold"
                                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                      }`}
                                      title={`Select ${kv.supplierName}`}
                                    >
                                      <Tag className="w-2.5 h-2.5 text-orange-500" />
                                      <span className="truncate max-w-[95px]">
                                        {kv.supplierName}
                                      </span>
                                      {kv.costPricePaise > 0 && (
                                        <span className="font-mono">
                                          {formatRupee(kv.costPricePaise)}
                                        </span>
                                      )}
                                      {vIdx === 0 && kv.costPricePaise > 0 && (
                                        <span className="text-[9px] uppercase bg-emerald-100 text-emerald-800 px-1 rounded font-bold">
                                          Best
                                        </span>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center align-top pt-4 font-mono text-xs text-slate-600">
                            <div>
                              {row.remainingQty} {row.unit}
                            </div>
                            {row.alreadyOrderedQty > 0 && (
                              <div className="text-[10px] text-emerald-700">
                                ({row.alreadyOrderedQty} ordered)
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            <div className="flex items-center justify-center gap-1">
                              <SmartNumberInput
                                disabled={!row.selected}
                                value={row.selected ? row.orderQty : 0}
                                maxDecimals={3}
                                onValueChange={(val) =>
                                  updateRowQty(row.quotationItemId, val)
                                }
                                className="w-20 bg-white border border-slate-300 disabled:bg-slate-100 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                              />
                              <span className="text-[10px] font-mono text-slate-400">
                                {row.unit}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top">
                            <SmartNumberInput
                              disabled={!row.selected}
                              value={row.unitRateRupees}
                              maxDecimals={2}
                              placeholder="0.00"
                              onValueChange={(val) =>
                                updateRowRate(row.quotationItemId, val)
                              }
                              className={`w-28 ml-auto bg-white border disabled:bg-slate-100 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-xs focus:outline-none ${
                                marginWarning
                                  ? "border-rose-300 text-rose-700 focus:border-rose-500"
                                  : "border-slate-300 text-slate-900 focus:border-orange-500"
                              }`}
                            />
                            {marginWarning && (
                              <div className="text-[10px] text-rose-600 text-right mt-0.5 font-medium">
                                Above Client SP!
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right align-top pt-4 font-mono text-xs font-bold text-slate-900">
                            {row.selected ? (
                              formatRupee(lineAmountPaise)
                            ) : (
                              <span className="text-slate-400">Skipped</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Optional Shared PO Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Payment Terms (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g. 30 Days Credit / 100% Advance"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Delivery Terms (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryTerms}
                    onChange={(e) => setDeliveryTerms(e.target.value)}
                    placeholder="e.g. Door Delivery / Ex-Works"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    PO Special Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Shared note for generated POs"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Vendor POs to Create
              </div>
              <div className="text-sm font-black font-mono text-slate-900">
                {supplierGroups.length} PO{supplierGroups.length === 1 ? "" : "s"} ({activeSelectedRows.length} items)
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Batch Cost (Excl. GST)
              </div>
              <div className="text-sm font-bold font-mono text-slate-700">
                {formatRupee(totalBatchSubtotalPaise)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                Total PO Outflow (Incl. GST)
              </div>
              <div className="text-base font-black font-mono text-orange-600">
                {formatRupee(totalBatchSubtotalPaise + totalBatchGstPaise)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={
                isSubmitting ||
                activeSelectedRows.length === 0 ||
                unassignedRows.length > 0
              }
              onClick={() => handleSubmit("DRAFT")}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              {isSubmitting && submittingMode === "DRAFT" ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
              ) : (
                <FileEdit className="w-4 h-4 text-slate-600" />
              )}
              <span>Generate All Vendor POs (Draft)</span>
            </button>

            <button
              type="button"
              disabled={
                isSubmitting ||
                activeSelectedRows.length === 0 ||
                unassignedRows.length > 0
              }
              onClick={() => handleSubmit("ISSUED")}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {isSubmitting && submittingMode === "ISSUED" ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FileCheck className="w-4 h-4 text-white" />
              )}
              <span className="text-white">Generate &amp; Issue All POs</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
