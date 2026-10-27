"use client"
import { useState, useEffect } from "react"
import { Loader2, X, Plus, Check, Edit2, History, BookmarkCheck, Building2, TrendingUp, Award } from "lucide-react"
import { formatRupee, formatShortId } from "@/lib/utils"
import { getProductSuppliers, addProductSupplier, updateProductSupplierPrice } from "@/app/actions/supplier"
import { getProductPricingHistory, saveProductSellingPrice } from "@/app/actions/product"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { sileo } from "sileo"

type ProductSupplier = {
  id: string
  productId: string
  supplierId: string
  costPrice: number
  supplier: { id: string; name: string }
}

function findLowestSupplier(list: ProductSupplier[]): ProductSupplier | null {
  if (!list || list.length === 0) return null
  const positive = list.filter((s) => s.costPrice > 0).sort((a, b) => a.costPrice - b.costPrice)
  return positive.length > 0 ? positive[0] : list[0]
}

export function VendorPriceDialog({
  productId,
  productName,
  currentCp,
  currentSp,
  onSave,
  onClose,
}: {
  productId: string
  productName: string
  currentCp?: number
  currentSp?: number
  onSave: (cp: number, sp: number, supplierId: string, supplierName?: string) => void
  onClose: () => void
}) {
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([])
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [quotedHistory, setQuotedHistory] = useState<any[]>([])
  const [catalogSp, setCatalogSp] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [historyTab, setHistoryTab] = useState<"quoted" | "catalog">("quoted")

  // Selection state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [selectedCp, setSelectedCp] = useState<number | "">("")
  const [spInput, setSpInput] = useState<number | "">(currentSp ? currentSp / 100 : "")
  const [saveToCatalog, setSaveToCatalog] = useState<boolean>(true)
  const [isSavingSpOnly, setIsSavingSpOnly] = useState<boolean>(false)

  // New Supplier State
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierCp, setNewSupplierCp] = useState<number | "">("")
  const [isSavingNew, setIsSavingNew] = useState(false)

  // Edit Supplier State
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [editSupplierCp, setEditSupplierCp] = useState<number | "">("")
  const [isUpdatingCp, setIsUpdatingCp] = useState(false)

  const lowestSupplier = findLowestSupplier(suppliers)

  const applySpAndAutoSelectLowestVendor = (newSpRupees: number | "", currentSuppliers = suppliers) => {
    setSpInput(newSpRupees)
    if (newSpRupees !== "" && Number(newSpRupees) > 0) {
      const lowest = findLowestSupplier(currentSuppliers)
      if (lowest) {
        setSelectedSupplierId(lowest.supplierId)
        setSelectedCp(lowest.costPrice)
      }
    }
  }

  useEffect(() => {
    async function fetchData() {
      const [supRes, histRes] = await Promise.all([
        getProductSuppliers(productId),
        getProductPricingHistory(productId),
      ])

      let fetchedSuppliers: ProductSupplier[] = []
      if (supRes.data) {
        fetchedSuppliers = [...supRes.data].sort((a, b) => a.costPrice - b.costPrice)
        setSuppliers(fetchedSuppliers)
        const lowest = findLowestSupplier(fetchedSuppliers)
        if (lowest) {
          // Always default to lowest vendor price when opening or applying SP
          setSelectedSupplierId(lowest.supplierId)
          setSelectedCp(lowest.costPrice)
        } else if (currentCp) {
          setSelectedCp(currentCp)
        }
      }

      if (histRes.data) {
        setPriceHistory(histRes.data.priceHistory || [])
        setQuotedHistory(histRes.data.quotedHistory || [])
        if (histRes.data.product?.sellingPrice) {
          setCatalogSp(histRes.data.product.sellingPrice)
          if (!currentSp || currentSp === 0) {
            setSpInput(histRes.data.product.sellingPrice / 100)
          }
        }
        if (
          (!histRes.data.quotedHistory || histRes.data.quotedHistory.length === 0) &&
          histRes.data.priceHistory?.length > 0
        ) {
          setHistoryTab("catalog")
        }
      }

      setIsLoading(false)
    }
    fetchData()
  }, [productId, currentCp, currentSp])

  const handleAddNewSupplier = async () => {
    if (!newSupplierName.trim() || !newSupplierCp) return
    setIsSavingNew(true)
    const res = await addProductSupplier(productId, newSupplierName, Number(newSupplierCp))
    if (res.success && res.data) {
      const added = res.data as ProductSupplier
      const nextSuppliers = [...suppliers, added].sort((a, b) => a.costPrice - b.costPrice)
      setSuppliers(nextSuppliers)
      const lowest = findLowestSupplier(nextSuppliers)
      if (lowest) {
        setSelectedSupplierId(lowest.supplierId)
        setSelectedCp(lowest.costPrice)
      } else {
        setSelectedSupplierId(added.supplierId)
        setSelectedCp(added.costPrice)
      }
      setIsAddingNew(false)
      setNewSupplierName("")
      setNewSupplierCp("")
      sileo.success({
        title: "Vendor Cost Price Added",
        description: `${added.supplier.name} added at ${formatRupee(added.costPrice)}.`,
      })
    } else {
      sileo.error({
        title: "Failed to Add Vendor",
        description: res.error || "Could not save vendor cost price.",
      })
    }
    setIsSavingNew(false)
  }

  const handleUpdateSupplierCp = async (supplierId: string) => {
    if (!editSupplierCp) return
    setIsUpdatingCp(true)
    const res = await updateProductSupplierPrice(productId, supplierId, Number(editSupplierCp))
    if (res.success && res.data) {
      const updatedCp = (res.data as ProductSupplier).costPrice
      const nextSuppliers = suppliers
        .map((s) => (s.supplierId === supplierId ? { ...s, costPrice: updatedCp } : s))
        .sort((a, b) => a.costPrice - b.costPrice)
      setSuppliers(nextSuppliers)
      const lowest = findLowestSupplier(nextSuppliers)
      if (lowest) {
        setSelectedSupplierId(lowest.supplierId)
        setSelectedCp(lowest.costPrice)
      }
      setEditingSupplierId(null)
      setEditSupplierCp("")
      sileo.success({
        title: "Vendor Cost Updated",
        description: `Vendor cost price updated to ${formatRupee(updatedCp)}.`,
      })
    } else {
      sileo.error({
        title: "Update Failed",
        description: res.error || "Failed to update supplier cost price.",
      })
    }
    setIsUpdatingCp(false)
  }

  const handleSaveSpToCatalogOnly = async () => {
    if (!spInput || Number(spInput) <= 0) {
      sileo.warning({
        title: "Enter Selling Price",
        description: "Please enter a valid Selling Price (SP) before saving to history.",
      })
      return
    }
    setIsSavingSpOnly(true)
    const spPaise = Math.round(Number(spInput) * 100)
    const lowest = findLowestSupplier(suppliers)
    const cpPaise = lowest ? lowest.costPrice : selectedCp ? Number(selectedCp) : undefined
    if (lowest) {
      setSelectedSupplierId(lowest.supplierId)
      setSelectedCp(lowest.costPrice)
    }
    const res = await saveProductSellingPrice(productId, spPaise, cpPaise)
    if (res.success) {
      setCatalogSp(spPaise)
      const histRes = await getProductPricingHistory(productId)
      if (histRes.data) {
        setPriceHistory(histRes.data.priceHistory || [])
      }
      sileo.success({
        title: "Selling Price Saved to History",
        description: `${formatRupee(spPaise)} has been saved to ${productName} catalog and price history.`,
      })
    } else {
      sileo.error({
        title: "Failed to Save Selling Price",
        description: res.error || "Could not record selling price in history.",
      })
    }
    setIsSavingSpOnly(false)
  }

  const handleConfirm = async () => {
    if (!spInput || Number(spInput) <= 0) {
      sileo.warning({
        title: "Selling Price Required",
        description: "Please enter a Selling Price (SP) for this item.",
      })
      return
    }

    // Automatically ensure lowest vendor CP is selected if none was explicitly chosen or when applying SP
    const lowest = findLowestSupplier(suppliers)
    const chosenSupplier =
      suppliers.find((s) => s.supplierId === selectedSupplierId) || lowest || null

    const finalCpPaise = chosenSupplier
      ? chosenSupplier.costPrice
      : selectedCp
      ? Number(selectedCp)
      : 0
    const finalSupplierId = chosenSupplier ? chosenSupplier.supplierId : selectedSupplierId
    const finalSupplierName = chosenSupplier?.supplier?.name
    const finalSpPaise = Math.round(Number(spInput) * 100)

    if (saveToCatalog) {
      await saveProductSellingPrice(
        productId,
        finalSpPaise,
        finalCpPaise > 0 ? finalCpPaise : undefined
      )
    }

    sileo.success({
      title: "Item Pricing Applied",
      description: `${
        finalSupplierName ? `Vendor: ${finalSupplierName} • ` : ""
      }CP ${formatRupee(finalCpPaise)} → SP ${formatRupee(finalSpPaise)}`,
    })

    onSave(finalCpPaise, finalSpPaise, finalSupplierId, finalSupplierName)
  }

  const spPaisePreview = spInput ? Math.round(Number(spInput) * 100) : 0
  const cpPaisePreview = selectedCp ? Number(selectedCp) : 0
  const marginPaise = spPaisePreview - cpPaisePreview
  const marginPct = spPaisePreview > 0 ? ((marginPaise / spPaisePreview) * 100).toFixed(1) : "0.0"

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">Vendor Cost & Selling Price Manager</h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Vendor Cost Prices (CP) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    1. Vendor Cost Price (CP)
                  </label>
                  {!isAddingNew && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNew(true)}
                      className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Vendor Rate
                    </button>
                  )}
                </div>

                {lowestSupplier && suppliers.length > 1 && (
                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center justify-between text-[11px] text-emerald-800">
                    <span className="flex items-center gap-1 font-semibold">
                      <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Lowest Vendor: <strong>{lowestSupplier.supplier.name}</strong> (
                      {formatRupee(lowestSupplier.costPrice)})
                    </span>
                    {selectedSupplierId !== lowestSupplier.supplierId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierId(lowestSupplier.supplierId)
                          setSelectedCp(lowestSupplier.costPrice)
                        }}
                        className="text-[10px] font-bold underline text-emerald-700 cursor-pointer"
                      >
                        Use Lowest
                      </button>
                    )}
                  </div>
                )}

                {isAddingNew ? (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Supplier / Vendor Name"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                    />
                    <div className="flex gap-2 items-center">
                      <span className="text-slate-500 text-sm font-medium">₹</span>
                      <SmartNumberInput
                        placeholder="Cost Price (e.g. 450+50)"
                        value={newSupplierCp}
                        onValueChange={(val, rawStr) =>
                          setNewSupplierCp(rawStr === "" ? "" : val)
                        }
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsAddingNew(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewSupplier}
                        disabled={isSavingNew || !newSupplierName || !newSupplierCp}
                        className="px-3 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingNew && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span className="text-white">Save Vendor</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                    {suppliers.length === 0 ? (
                      <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center">
                        No vendor rates linked yet. Click <strong>Add Vendor Rate</strong> above to add one.
                      </div>
                    ) : (
                      suppliers.map((s: ProductSupplier) => {
                        const isSelected = selectedSupplierId === s.supplierId
                        const isLowest = lowestSupplier?.supplierId === s.supplierId
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedSupplierId(s.supplierId)
                              setSelectedCp(s.costPrice)
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "bg-orange-50/80 border-orange-400 text-slate-900 shadow-2xs"
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "border-orange-600 bg-orange-600 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="font-semibold text-xs truncate">{s.supplier.name}</span>
                              {isLowest && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider shrink-0">
                                  Lowest CP
                                </span>
                              )}
                            </div>

                            {editingSupplierId === s.supplierId ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <span className="text-slate-400 text-xs">₹</span>
                                <SmartNumberInput
                                  autoFocus
                                  value={editSupplierCp}
                                  onValueChange={(val, rawStr) =>
                                    setEditSupplierCp(rawStr === "" ? "" : val)
                                  }
                                  className="bg-white border border-orange-500 rounded px-2 py-1 text-xs font-mono text-slate-900 w-24 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSupplierCp(s.supplierId)}
                                  disabled={isUpdatingCp || !editSupplierCp}
                                  className="p-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors disabled:opacity-50"
                                >
                                  {isUpdatingCp ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                                  ) : (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSupplierId(null)
                                    setEditSupplierCp("")
                                  }}
                                  className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-xs font-bold text-slate-800">
                                  {formatRupee(s.costPrice)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingSupplierId(s.supplierId)
                                    setEditSupplierCp(s.costPrice / 100)
                                  }}
                                  className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                                  title="Edit Vendor Price"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Selling Price (SP) & Save to Catalog */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    2. Client Selling Price (SP)
                  </label>
                  {catalogSp > 0 && (
                    <button
                      type="button"
                      onClick={() => applySpAndAutoSelectLowestVendor(catalogSp / 100)}
                      className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                    >
                      Catalog SP: {formatRupee(catalogSp)}
                    </button>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-lg font-semibold">₹</span>
                      <SmartNumberInput
                        placeholder="Enter SP or math (e.g. 500+15%)"
                        value={spInput}
                        onValueChange={(val, rawStr) =>
                          applySpAndAutoSelectLowestVendor(rawStr === "" ? "" : val)
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-base font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                      />
                    </div>
                  </div>

                  {/* Quick Margin Preset Chips */}
                  {cpPaisePreview > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 mr-1">Markup presets:</span>
                      {[10, 15, 20, 25, 30].map((pct) => {
                        const baseCp = lowestSupplier ? lowestSupplier.costPrice : cpPaisePreview
                        const targetSp = Math.round((baseCp / 100) * (1 + pct / 100) * 100) / 100
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => applySpAndAutoSelectLowestVendor(targetSp)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-700 hover:bg-orange-50 transition-colors cursor-pointer"
                          >
                            +{pct}%
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Profit & Margin Summary */}
                  {spPaisePreview > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500 font-medium">Estimated Unit Profit:</span>
                      <span
                        className={`font-mono font-bold ${
                          marginPaise >= 0 ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {formatRupee(marginPaise)} ({marginPct}%)
                      </span>
                    </div>
                  )}

                  {/* Save Selling Price Option */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveToCatalog}
                        onChange={(e) => setSaveToCatalog(e.target.checked)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span>Save SP to Product Catalog & History</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveSpToCatalogOnly}
                      disabled={isSavingSpOnly || !spInput}
                      className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md flex items-center gap-1 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isSavingSpOnly ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <BookmarkCheck className="w-3.5 h-3.5" />
                      )}
                      Save SP Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Selling Price History Section */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <History className="w-3.5 h-3.5 text-orange-600" />
                  <span>Selling Price History (Click any row to apply SP + Lowest Vendor CP)</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setHistoryTab("quoted")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      historyTab === "quoted"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Past Client Quotes ({quotedHistory.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("catalog")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      historyTab === "catalog"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Catalog History ({priceHistory.length})
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white custom-scrollbar">
                {historyTab === "quoted" ? (
                  quotedHistory.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No past client quotations recorded for this product yet.
                    </div>
                  ) : (
                    quotedHistory.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => applySpAndAutoSelectLowestVendor(q.spSnapshot / 100)}
                        className="px-4 py-2.5 hover:bg-orange-50/60 flex items-center justify-between cursor-pointer transition-colors text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">
                            {q.quotation?.client?.name || "Client"}
                            <span className="ml-2 font-mono text-[11px] text-slate-500">
                              #{q.quotation?.prNo || formatShortId(q.quotation?.id)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {new Date(q.quotation?.createdAt).toLocaleDateString()} • Qty: {q.qty}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-mono font-bold text-emerald-700">
                              SP: {formatRupee(q.spSnapshot)}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              CP: {formatRupee(q.cpSnapshot)}
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded bg-orange-50 text-orange-700 border border-orange-200 font-semibold text-[11px]">
                            Use SP
                          </span>
                        </div>
                      </div>
                    ))
                  )
                ) : priceHistory.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No catalog price changes recorded yet.
                  </div>
                ) : (
                  priceHistory.map((h) => (
                    <div
                      key={h.id}
                      onClick={() =>
                        h.sellingPrice > 0 && applySpAndAutoSelectLowestVendor(h.sellingPrice / 100)
                      }
                      className="px-4 py-2.5 hover:bg-orange-50/60 flex items-center justify-between cursor-pointer transition-colors text-xs"
                    >
                      <div className="text-slate-600 font-medium">
                        {new Date(h.changedAt).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-500">CP: {formatRupee(h.costPrice)}</span>
                        <span className="font-mono font-bold text-emerald-700">
                          SP: {formatRupee(h.sellingPrice)}
                        </span>
                        {h.sellingPrice > 0 && (
                          <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-semibold text-[11px]">
                            Use SP
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs transition-all cursor-pointer"
          >
            <span className="text-white">Apply Pricing to Quotation</span>
          </button>
        </div>
      </div>
    </div>
  )
}
