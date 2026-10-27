"use client"

import React, { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Sparkles,
  History,
  Pencil,
  Check,
  X,
  Loader2,
  Building2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  AlertTriangle,
  Plus,
} from "lucide-react"
import { formatRupee } from "@/lib/utils"
import { RowCheckbox } from "@/components/selection/RowCheckbox"
import { SmartNumberInput } from "@/components/ui/SmartNumberInput"
import { quickUpdateProductPrices, tagVendorToProductCp } from "@/app/actions/product"
import { sileo } from "sileo"

interface ProductSupplierItem {
  id: string
  costPrice: number
  supplier: {
    id: string
    name: string
  }
}

interface PriceHistoryItem {
  id: string
  costPrice: number
  sellingPrice: number
  changedAt: string | Date
  note?: string | null
}

export interface ProductRowData {
  id: string
  imageUrl?: string | null
  materialCode: string
  materialDescription: string
  specification?: string | null
  make?: string | null
  modelNo?: string | null
  unit: string
  costPrice: number
  sellingPrice: number
  _count: {
    priceHistory: number
    quotationItems: number
  }
  productSuppliers?: ProductSupplierItem[]
  priceHistory?: PriceHistoryItem[]
}

export function ProductInlineRow({ product }: { product: ProductRowData }) {
  const router = useRouter()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Local optimistic state in paise
  const [currentCpPaise, setCurrentCpPaise] = useState(product.costPrice)
  const [currentSpPaise, setCurrentSpPaise] = useState(product.sellingPrice)
  const [revCount, setRevCount] = useState(product._count.priceHistory)
  const [localHistory, setLocalHistory] = useState<PriceHistoryItem[]>(product.priceHistory || [])
  const [localSuppliers, setLocalSuppliers] = useState<ProductSupplierItem[]>(
    product.productSuppliers || []
  )

  // Edit inputs in Rupees
  const [cpInput, setCpInput] = useState<string>(
    product.costPrice > 0 ? String(product.costPrice / 100) : ""
  )
  const [spInput, setSpInput] = useState<string>(
    product.sellingPrice > 0 ? String(product.sellingPrice / 100) : ""
  )

  // Popovers state
  const [showVendorPopover, setShowVendorPopover] = useState(false)
  const [showHistoryPopover, setShowHistoryPopover] = useState(false)

  // Interactive Vendor Tagging Toast state
  const [showVendorTagToast, setShowVendorTagToast] = useState(false)
  const [toastCpPaise, setToastCpPaise] = useState<number>(product.costPrice)
  const [vendorNameInput, setVendorNameInput] = useState("")
  const [isTaggingVendor, setIsTaggingVendor] = useState(false)

  const vendorPopoverRef = useRef<HTMLDivElement>(null)
  const historyPopoverRef = useRef<HTMLDivElement>(null)
  const vendorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCurrentCpPaise(product.costPrice)
    setCurrentSpPaise(product.sellingPrice)
    setRevCount(product._count.priceHistory)
    setLocalHistory(product.priceHistory || [])
    setLocalSuppliers(product.productSuppliers || [])
  }, [
    product.costPrice,
    product.sellingPrice,
    product._count.priceHistory,
    product.priceHistory,
    product.productSuppliers,
  ])

  useEffect(() => {
    if (showVendorTagToast) {
      setTimeout(() => vendorInputRef.current?.focus(), 50)
    }
  }, [showVendorTagToast])

  // Close popovers on outside click
  useEffect(() => {
    if (!showVendorPopover && !showHistoryPopover) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showVendorPopover &&
        vendorPopoverRef.current &&
        !vendorPopoverRef.current.contains(e.target as Node)
      ) {
        setShowVendorPopover(false)
      }
      if (
        showHistoryPopover &&
        historyPopoverRef.current &&
        !historyPopoverRef.current.contains(e.target as Node)
      ) {
        setShowHistoryPopover(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showVendorPopover, showHistoryPopover])

  const openVendorTagPrompt = (cpPaiseToTag: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setToastCpPaise(cpPaiseToTag)
    setVendorNameInput("")
    setShowVendorTagToast(true)
  }

  const handleSaveVendorTag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = vendorNameInput.trim()
    if (!trimmed) {
      sileo.warning({
        title: "Vendor Name Required",
        description: "Please type the supplier/vendor name for this Cost Price.",
      })
      return
    }

    setIsTaggingVendor(true)
    const res = await tagVendorToProductCp({
      productId: product.id,
      vendorName: trimmed,
      costPriceInPaise: toastCpPaise,
    })
    setIsTaggingVendor(false)

    if (res.error) {
      sileo.error({
        title: "Failed to Tag Vendor",
        description: res.error,
      })
      return
    }

    if (res.success && res.supplier) {
      const updatedList = [
        ...localSuppliers.filter((s) => s.supplier.id !== res.supplier!.id),
        {
          id: res.productSupplierId || `ps-${Date.now()}`,
          costPrice: res.costPrice,
          supplier: res.supplier,
        },
      ].sort((a, b) => a.costPrice - b.costPrice)

      setLocalSuppliers(updatedList)
      setShowVendorTagToast(false)
      setVendorNameInput("")

      sileo.success({
        title: "Vendor Tagged to Cost Price",
        description: `Linked ${res.supplier.name} at ${formatRupee(res.costPrice)} for ${product.materialCode}.`,
      })
      router.refresh()
    }
  }

  const startEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setCpInput(currentCpPaise > 0 ? String(currentCpPaise / 100) : "")
    setSpInput(currentSpPaise > 0 ? String(currentSpPaise / 100) : "")
    setIsEditing(true)
  }

  const cancelEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setCpInput(currentCpPaise > 0 ? String(currentCpPaise / 100) : "")
    setSpInput(currentSpPaise > 0 ? String(currentSpPaise / 100) : "")
    setIsEditing(false)
  }

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const cpRupees = parseFloat(cpInput) || 0
    const spRupees = parseFloat(spInput) || 0

    if (cpRupees < 0 || spRupees < 0) {
      sileo.warning({
        title: "Invalid Price",
        description: "Cost and selling prices cannot be negative.",
      })
      return
    }

    setIsSaving(true)
    const res = await quickUpdateProductPrices(product.id, {
      costPriceInRupees: cpRupees,
      sellingPriceInRupees: spRupees,
      note: "Quick Inline Catalog Update",
    })
    setIsSaving(false)

    if (res.error) {
      sileo.error({
        title: "Failed to Update Prices",
        description: res.error,
      })
      return
    }

    if (res.success) {
      const nextCp = res.costPrice ?? Math.round(cpRupees * 100)
      const nextSp = res.sellingPrice ?? Math.round(spRupees * 100)
      const changed = nextCp !== currentCpPaise || nextSp !== currentSpPaise

      setCurrentCpPaise(nextCp)
      setCurrentSpPaise(nextSp)
      if (changed) {
        setRevCount((c) => c + 1)
        setLocalHistory((prev) => [
          {
            id: `temp-${Date.now()}`,
            costPrice: nextCp,
            sellingPrice: nextSp,
            changedAt: new Date().toISOString(),
            note: "Quick Inline Catalog Update",
          },
          ...prev.slice(0, 4),
        ])
      }
      setIsEditing(false)

      sileo.success({
        title: "Catalog Rates Updated",
        description: `${product.materialCode}: CP ${formatRupee(nextCp)} · SP ${formatRupee(nextSp)}`,
      })

      // If CP > 0 and no vendor is tagged for this product (or no vendor matches this new CP), prompt to tag vendor!
      const hasMatchingVendor = localSuppliers.some((s) => s.costPrice === nextCp)
      if (nextCp > 0 && (localSuppliers.length === 0 || !hasMatchingVendor)) {
        openVendorTagPrompt(nextCp)
      }

      router.refresh()
    }
  }

  // Calculated margins for display or live preview
  const activeCpPaise = isEditing ? Math.round((parseFloat(cpInput) || 0) * 100) : currentCpPaise
  const activeSpPaise = isEditing ? Math.round((parseFloat(spInput) || 0) * 100) : currentSpPaise
  const margin = activeSpPaise - activeCpPaise
  const marginPct =
    activeSpPaise > 0 ? ((margin / activeSpPaise) * 100).toFixed(1) : null

  // Vendor rates sorted by lowest costPrice
  const lowestVendor = localSuppliers.length > 0 ? localSuppliers[0] : null
  const isUntaggedCp = currentCpPaise > 0 && localSuppliers.length === 0

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (isEditing || showVendorTagToast) return
    const target = e.target as HTMLElement
    if (
      target.closest('input[type="checkbox"]') ||
      target.closest("input") ||
      target.closest("button") ||
      target.closest("a") ||
      target.closest("[data-popover]")
    ) {
      return
    }
    if (isUntaggedCp) {
      openVendorTagPrompt(currentCpPaise)
      return
    }
    router.push(`/products/${product.id}/edit`)
  }

  return (
    <tr
      onClick={handleRowClick}
      className={`transition-colors group ${
        isEditing
          ? "bg-orange-50/50 hover:bg-orange-50/70"
          : "hover:bg-slate-50/90 cursor-pointer"
      }`}
    >
      {/* Checkbox */}
      <td className="px-4 py-3.5 align-top">
        <RowCheckbox id={product.id} />
      </td>

      {/* Material Code + Image */}
      <td className="px-4 py-3.5 font-medium text-slate-900 align-top">
        <div className="flex items-center gap-2.5">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.materialCode}
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 bg-slate-50 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-400 shrink-0">
              IMG
            </div>
          )}
          <span className="font-mono text-xs font-semibold text-slate-800">
            {product.materialCode}
          </span>
        </div>
      </td>

      {/* Description & Spec */}
      <td className="px-4 py-3.5 text-slate-800 align-top">
        <div className="flex items-start gap-1.5">
          <div className="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
            {product.materialDescription}
          </div>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(
              `${product.make || ""} ${product.materialDescription} stockists suppliers in Ranigunj Secunderabad Hyderabad`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-orange-600 hover:bg-orange-50 rounded-md transition-colors shrink-0"
            title="Find Suppliers on Google"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </a>
        </div>
        {product.specification && (
          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {product.specification}
          </div>
        )}
      </td>

      {/* Make / Model */}
      <td className="px-4 py-3.5 text-slate-600 text-xs align-top">
        {product.make || "—"}{" "}
        {product.modelNo ? <span className="text-slate-400">/ {product.modelNo}</span> : ""}
      </td>

      {/* UOM */}
      <td className="px-4 py-3.5 text-slate-600 text-xs font-mono align-top">{product.unit}</td>

      {/* Cost Price (CP) + Vendor Rate Badge / Untagged CP Pill */}
      <td className="px-4 py-3.5 text-right align-top" onClick={(e) => isEditing && e.stopPropagation()}>
        {isEditing ? (
          <div className="flex flex-col items-end gap-1 min-w-[130px]">
            <div className="relative w-32">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono z-10 pointer-events-none">
                ₹
              </span>
              <SmartNumberInput
                value={cpInput}
                onValueChange={(val, raw) => setCpInput(raw === "" ? "" : String(val))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSave()
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    cancelEditing()
                  }
                }}
                placeholder="0.00"
                className="w-full bg-white border border-orange-300 rounded-lg pl-6 pr-2 py-1 text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Math e.g. 450+50</span>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={startEditing}
              title="Click to inline edit Cost & Selling Price"
              className="inline-flex items-center gap-1 font-mono font-medium text-slate-700 hover:text-orange-600 hover:bg-orange-50/80 px-1.5 py-0.5 -mr-1.5 rounded-md transition-colors cursor-pointer group/cp"
            >
              <span>{formatRupee(currentCpPaise)}</span>
              <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/cp:opacity-100 group-hover:opacity-60 transition-opacity" />
            </button>

            {/* Untagged CP Warning Pill */}
            {isUntaggedCp && (
              <button
                type="button"
                onClick={(e) => openVendorTagPrompt(currentCpPaise, e)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-semibold transition-colors cursor-pointer"
                title="No vendor is tagged to this Cost Price — click to tag vendor"
              >
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                <span>⚠ Untagged CP · + Tag Vendor</span>
              </button>
            )}

            {/* Vendor Rate Badge & Popover */}
            {lowestVendor && (
              <div className="relative" ref={vendorPopoverRef} data-popover="vendor">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowVendorPopover((v) => !v)
                    setShowHistoryPopover(false)
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50/90 hover:bg-blue-100/80 text-blue-700 border border-blue-200/80 text-[10px] font-medium transition-colors cursor-pointer max-w-[190px]"
                  title="Click to view all linked vendor rates"
                >
                  <Building2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                  <span className="truncate">
                    {localSuppliers.length === 1
                      ? `Lowest: ${formatRupee(lowestVendor.costPrice)} (${lowestVendor.supplier.name})`
                      : `${localSuppliers.length} Vendors · Lowest ${formatRupee(lowestVendor.costPrice)}`}
                  </span>
                  <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-70" />
                </button>

                {showVendorPopover && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-40 p-3 text-left space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Vendor Cost Rates ({localSuppliers.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowVendorPopover(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {localSuppliers.map((ps, idx) => (
                        <div
                          key={ps.id}
                          className={`flex items-center justify-between gap-2 p-1.5 rounded-lg border text-xs ${
                            idx === 0
                              ? "bg-emerald-50/60 border-emerald-200"
                              : "bg-slate-50/70 border-slate-200/70"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate">
                              {ps.supplier.name}
                            </div>
                            {idx === 0 && (
                              <span className="text-[10px] font-bold text-emerald-700 uppercase">
                                Lowest Rate
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono font-bold text-slate-900">
                              {formatRupee(ps.costPrice)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCpInput(String(ps.costPrice / 100))
                                setSpInput(
                                  currentSpPaise > 0 ? String(currentSpPaise / 100) : ""
                                )
                                setShowVendorPopover(false)
                                setIsEditing(true)
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-white hover:bg-orange-50 text-orange-600 border border-slate-200 hover:border-orange-300 rounded cursor-pointer transition-colors"
                              title="Use this vendor rate as Cost Price"
                            >
                              Use
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {currentCpPaise > 0 && (
                      <div className="pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            setShowVendorPopover(false)
                            openVendorTagPrompt(currentCpPaise, e)
                          }}
                          className="w-full inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-slate-50 hover:bg-orange-50 text-[11px] font-semibold text-slate-600 hover:text-orange-700 border border-slate-200 hover:border-orange-200 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Tag Vendor for {formatRupee(currentCpPaise)}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Floating Top-Center Interactive Vendor Tagging Toast Card */}
        {showVendorTagToast && (
          <div
            data-popover="vendor-toast"
            onClick={(e) => e.stopPropagation()}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] w-[92vw] max-w-md bg-white rounded-2xl border-2 border-orange-300 shadow-2xl p-4 text-left animate-in fade-in slide-in-from-top-3 duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                      Tag Vendor to CP
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {product.materialCode}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                    Which vendor quoted {formatRupee(toastCpPaise)}?
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {product.materialDescription} — tag supplier name so there&apos;s no confusion later.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVendorTagToast(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendorTag} className="mt-3 flex items-center gap-2">
              <input
                ref={vendorInputRef}
                type="text"
                value={vendorNameInput}
                onChange={(e) => setVendorNameInput(e.target.value)}
                placeholder="Enter supplier / vendor name (e.g. Polycab Stockist)..."
                className="flex-1 bg-slate-50 focus:bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setShowVendorTagToast(false)
                  }
                }}
              />
              <button
                type="submit"
                disabled={isTaggingVendor}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {isTaggingVendor ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
                <span className="text-white">Save Vendor</span>
              </button>
            </form>
          </div>
        )}
      </td>

      {/* Selling Price (SP) + Live Margin */}
      <td className="px-4 py-3.5 text-right align-top" onClick={(e) => isEditing && e.stopPropagation()}>
        {isEditing ? (
          <div className="flex flex-col items-end gap-1 min-w-[145px]">
            <div className="relative w-32">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 text-xs font-mono z-10 pointer-events-none">
                ₹
              </span>
              <SmartNumberInput
                value={spInput}
                onValueChange={(val, raw) => setSpInput(raw === "" ? "" : String(val))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSave()
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    cancelEditing()
                  }
                }}
                placeholder="0.00"
                className="w-full bg-white border border-emerald-400 rounded-lg pl-6 pr-2 py-1 text-xs font-mono font-bold text-emerald-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            {/* Quick Markup Chips + Live Margin Preview */}
            <div className="flex items-center justify-end gap-1 flex-wrap">
              {(parseFloat(cpInput) || 0) > 0 &&
                [10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const baseCp = parseFloat(cpInput) || 0
                      setSpInput((baseCp * (1 + pct / 100)).toFixed(2))
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded text-slate-600 hover:border-orange-300 hover:text-orange-700 cursor-pointer"
                  >
                    +{pct}%
                  </button>
                ))}
              {marginPct && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    margin >= 0
                      ? "bg-emerald-100/80 text-emerald-800"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {margin >= 0 ? `+${marginPct}%` : `${marginPct}%`}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <button
              type="button"
              onClick={startEditing}
              title="Click to inline edit Selling Price"
              className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/80 px-1.5 py-0.5 -mr-1.5 rounded-md transition-colors cursor-pointer group/sp"
            >
              <span>{formatRupee(currentSpPaise)}</span>
              <Pencil className="w-3 h-3 text-emerald-400 opacity-0 group-hover/sp:opacity-100 group-hover:opacity-60 transition-opacity" />
            </button>
            {marginPct && (
              <div
                className={`text-[11px] font-mono ${
                  margin >= 0 ? "text-slate-400" : "text-rose-500 font-semibold"
                }`}
              >
                {margin >= 0 ? `+${marginPct}%` : `${marginPct}%`} margin
              </div>
            )}
          </div>
        )}
      </td>

      {/* History Badge + Quick Price History Popover */}
      <td className="px-4 py-3.5 text-center align-top">
        <div className="relative inline-block" ref={historyPopoverRef} data-popover="history">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowHistoryPopover((v) => !v)
              setShowVendorPopover(false)
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-800 border border-slate-200 hover:border-orange-200 transition-colors cursor-pointer"
            title="Click to view recent price revisions"
          >
            <History className="w-3 h-3 text-orange-600" />
            <span>
              {revCount} rev • {product._count.quotationItems} quotes
            </span>
          </button>

          {showHistoryPopover && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1.5 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-40 p-3.5 text-left space-y-2.5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-orange-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Recent Price Snapshots
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryPopover(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {localHistory.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No price revisions recorded yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                  {localHistory.map((h, i) => {
                    const prev = i < localHistory.length - 1 ? localHistory[i + 1] : null
                    const spUp = prev ? h.sellingPrice > prev.sellingPrice : false
                    const spDown = prev ? h.sellingPrice < prev.sellingPrice : false
                    const snapMargin = h.sellingPrice - h.costPrice
                    const snapMarginPct =
                      h.sellingPrice > 0
                        ? ((snapMargin / h.sellingPrice) * 100).toFixed(1)
                        : null

                    return (
                      <div
                        key={h.id}
                        className="p-2 rounded-lg bg-slate-50/90 border border-slate-200/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>
                            {new Date(h.changedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          {snapMarginPct && (
                            <span
                              className={`font-mono font-semibold ${
                                snapMargin >= 0 ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              {snapMargin >= 0 ? `+${snapMarginPct}%` : `${snapMarginPct}%`} margin
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-slate-600">
                            CP: <strong className="text-slate-800">{formatRupee(h.costPrice)}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            SP: {formatRupee(h.sellingPrice)}
                            {spUp && <TrendingUp className="w-3 h-3 text-emerald-600" />}
                            {spDown && <TrendingDown className="w-3 h-3 text-rose-500" />}
                          </span>
                        </div>
                        {h.note && (
                          <div className="text-[10px] text-slate-400 italic truncate">
                            {h.note}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Quoted {product._count.quotationItems} time(s)
                </span>
                <Link
                  href={`/products/${product.id}/edit`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                >
                  Full History Chart <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right align-top" onClick={(e) => e.stopPropagation()}>
        {isEditing ? (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Save CP & SP (Enter)"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Check className="w-3.5 h-3.5 text-white" />
              )}
              <span className="text-white">Save</span>
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
              title="Cancel (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-orange-700 px-2 py-1.5 rounded-md hover:bg-orange-50 border border-transparent hover:border-orange-200 transition-colors cursor-pointer"
              title="Inline Edit Cost & Selling Price"
            >
              <Pencil className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden xl:inline">Inline Rates</span>
            </button>
            <Link
              href={`/products/${product.id}/edit`}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 px-2.5 py-1.5 rounded-md hover:bg-orange-50 transition-colors"
            >
              Edit & History
            </Link>
          </div>
        )}
      </td>
    </tr>
  )
}
