"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import { createProduct, updateProduct } from "@/app/actions/product"
import { getPresignedUrl } from "@/app/actions/upload"
import { Loader2, ImagePlus, CheckCircle2 } from "lucide-react"
import { SmartNumberInput } from "./ui/SmartNumberInput"
import { sileo } from "sileo"

export function ProductForm({ suppliers, initialData }: { suppliers: any[]; initialData?: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null)

  const [costPrice, setCostPrice] = useState(
    initialData?.costPrice ? String(initialData.costPrice / 100) : ""
  )
  const [commissionCostPrice, setCommissionCostPrice] = useState(
    initialData?.commissionCostPrice ? String(initialData.commissionCostPrice / 100) : ""
  )
  const [sellingPrice, setSellingPrice] = useState(
    initialData?.sellingPrice ? String(initialData.sellingPrice / 100) : ""
  )

  const cpNum = parseFloat(costPrice) || 0
  const commCpNum = parseFloat(commissionCostPrice) || 0
  const spNum = parseFloat(sellingPrice) || 0

  const profit = spNum - cpNum
  const profitMargin = spNum > 0 ? ((profit / spNum) * 100).toFixed(1) : "0.0"

  const commProfit = spNum - commCpNum
  const commProfitMargin = spNum > 0 && commCpNum > 0 ? ((commProfit / spNum) * 100).toFixed(1) : "0.0"

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      let imageUrl = null

      if (imageFile) {
        const { uploadUrl, publicUrl } = await getPresignedUrl(imageFile.name, imageFile.type)

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: imageFile,
          headers: {
            "Content-Type": imageFile.type,
          },
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image to Cloudflare R2")
        }

        imageUrl = publicUrl
      }

      if (imageUrl) {
        formData.append("imageUrl", imageUrl)
      }

      const result = initialData
        ? await updateProduct(initialData.id, formData)
        : await createProduct(formData)

      if (result.error) {
        throw new Error(result.error)
      }

      sileo.success({
        title: initialData ? "Product Updated" : "Product Created",
        description: `Catalog details, cost price (₹${cpNum.toFixed(2)}), and selling price (₹${spNum.toFixed(2)}) have been saved to history.`,
      })

      router.push("/products")
      router.refresh()
    } catch (error: any) {
      console.error(error)
      sileo.error({
        title: "Failed to Save Product",
        description: error.message || "An unexpected error occurred while saving the product.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Product Image
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-7 h-7 text-slate-400" />
              )}
            </div>
            <label className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-slate-300 shadow-2xs">
              Upload Image
              <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Material Code
          </label>
          <input
            name="materialCode"
            type="text"
            placeholder="Auto-generated if left blank"
            defaultValue={initialData?.materialCode}
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Material Description *
          </label>
          <input
            required
            name="materialDescription"
            type="text"
            defaultValue={initialData?.materialDescription}
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Technical Specification
          </label>
          <textarea
            name="specification"
            defaultValue={initialData?.specification || ""}
            rows={3}
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Primary Supplier / Vendor
          </label>
          <input
            list="supplier-list"
            name="supplierName"
            defaultValue={
              initialData?.supplier?.name ||
              suppliers.find((s: any) => s.id === initialData?.supplierId)?.name ||
              ""
            }
            placeholder="Type or select supplier name..."
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            autoComplete="off"
          />
          <datalist id="supplier-list">
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:col-span-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Make / Brand
            </label>
            <input
              name="make"
              type="text"
              defaultValue={initialData?.make || ""}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Model No
            </label>
            <input
              name="modelNo"
              type="text"
              defaultValue={initialData?.modelNo || ""}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Unit (UOM)
            </label>
            <input
              name="unit"
              type="text"
              defaultValue={initialData?.unit || "NUM"}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              GST Rate %
            </label>
            <input
              name="gstRate"
              type="number"
              step="any"
              defaultValue={initialData?.gstRate || 18}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
            />
          </div>
        </div>

        {/* Pricing Section */}
        <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Pricing & Catalog Selling Price (Automatically Logged to Price History)
            </div>
            {cpNum > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Quick SP Markup:</span>
                {[10, 15, 20, 25].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setSellingPrice((cpNum * (1 + pct / 100)).toFixed(2))}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-white border border-slate-200 rounded text-slate-600 hover:border-orange-300 hover:text-orange-700 cursor-pointer"
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cost Price (₹) *
              </label>
              <SmartNumberInput
                required
                name="costPrice"
                value={costPrice}
                onValueChange={(val, rawStr) =>
                  setCostPrice(rawStr === "" ? "" : String(val))
                }
                placeholder="0.00 (or e.g. 450+50)"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Commission CP (₹ Optional)
              </label>
              <SmartNumberInput
                name="commissionCostPrice"
                value={commissionCostPrice}
                onValueChange={(val, rawStr) =>
                  setCommissionCostPrice(rawStr === "" ? "" : String(val))
                }
                placeholder="0.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-700 mb-1">
                Standard Selling Price (₹) *
              </label>
              <SmartNumberInput
                required
                name="sellingPrice"
                value={sellingPrice}
                onValueChange={(val, rawStr) =>
                  setSellingPrice(rawStr === "" ? "" : String(val))
                }
                placeholder="0.00 (or e.g. 500+15%)"
                className="w-full bg-white border border-emerald-300 rounded-lg px-3.5 py-2 text-sm font-mono font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {(cpNum > 0 || spNum > 0 || commCpNum > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <div>
                  <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                    Standard Profit / Unit
                  </div>
                  <div
                    className={`text-base font-bold font-mono ${
                      profit >= 0 ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {formatRupee(profit * 100)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                    Gross Margin
                  </div>
                  <div
                    className={`text-base font-bold font-mono ${
                      profit >= 0 ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {profitMargin}%
                  </div>
                </div>
              </div>

              {commCpNum > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50/60 border border-orange-200 rounded-lg">
                  <div>
                    <div className="text-[11px] text-orange-700 uppercase font-bold tracking-wider">
                      Commission Profit
                    </div>
                    <div
                      className={`text-base font-bold font-mono ${
                        commProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {formatRupee(commProfit * 100)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-orange-700 uppercase font-bold tracking-wider">
                      Margin
                    </div>
                    <div
                      className={`text-base font-bold font-mono ${
                        commProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {commProfitMargin}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-white" />
          )}
          <span className="text-white">
            {initialData ? "Save Product & Record Price History" : "Create Product"}
          </span>
        </button>
      </div>
    </form>
  )
}
