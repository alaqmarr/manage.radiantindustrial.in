"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatRupee } from "@/lib/utils"
import { createProduct, updateProduct } from "@/app/actions/product"
import { getPresignedUrl } from "@/app/actions/upload"
import { Loader2, ImagePlus } from "lucide-react"

export function ProductForm({ suppliers, initialData }: { suppliers: any[], initialData?: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null)

  const [costPrice, setCostPrice] = useState(initialData?.costPrice ? String(initialData.costPrice / 100) : "")
  const [commissionCostPrice, setCommissionCostPrice] = useState(initialData?.commissionCostPrice ? String(initialData.commissionCostPrice / 100) : "")
  const [sellingPrice, setSellingPrice] = useState(initialData?.sellingPrice ? String(initialData.sellingPrice / 100) : "")

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
        // Get presigned URL
        const { uploadUrl, publicUrl } = await getPresignedUrl(imageFile.name, imageFile.type)
        
        // Upload to R2 directly
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

      // Add image URL to form data
      if (imageUrl) {
        formData.append("imageUrl", imageUrl)
      }

      const result = initialData 
        ? await updateProduct(initialData.id, formData)
        : await createProduct(formData)

      if (result.error) {
        throw new Error(result.error)
      }

      router.push("/products")
      router.refresh()
    } catch (error: any) {
      console.error(error)
      alert(error.message || "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl glass-panel p-6 rounded-md">
      <div className="grid grid-cols-2 gap-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Product Image</label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-md bg-white/5 border border-premium-border flex items-center justify-center overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-8 h-8 text-zinc-600" />
              )}
            </div>
            <label className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-md cursor-pointer transition-colors border border-premium-border">
              Choose Image
              <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Material Code</label>
          <input name="materialCode" type="text" placeholder="Leave empty to auto-generate" defaultValue={initialData?.materialCode} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Material Description *</label>
          <input required name="materialDescription" type="text" defaultValue={initialData?.materialDescription} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Supplier</label>
          <input 
            list="supplier-list"
            name="supplierName" 
            defaultValue={initialData?.supplier?.name || suppliers.find((s: any) => s.id === initialData?.supplierId)?.name || ""}
            placeholder="Type supplier name..."
            className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
            autoComplete="off"
          />
          <datalist id="supplier-list">
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-3 gap-4 col-span-2">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Make</label>
            <input name="make" type="text" defaultValue={initialData?.make || ""} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Model No</label>
            <input name="modelNo" type="text" defaultValue={initialData?.modelNo || ""} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Unit</label>
            <input name="unit" type="text" defaultValue={initialData?.unit || "NUM"} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 col-span-2">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Cost Price (Rupees) *</label>
            <input required name="costPrice" type="number" step="0.01" min="0" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Commission CP (Optional)</label>
            <input name="commissionCostPrice" type="number" step="0.01" min="0" value={commissionCostPrice} onChange={e => setCommissionCostPrice(e.target.value)} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Selling Price (Rupees) *</label>
            <input required name="sellingPrice" type="number" step="0.01" min="0" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
        </div>

        {/* Real-time Profit Display */}
        {(cpNum > 0 || spNum > 0 || commCpNum > 0) && (
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-zinc-950/50 border border-premium-border rounded-md mt-2">
              <div>
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-widest mb-1">Actual Profit</div>
                <div className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatRupee(profit)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-widest mb-1">Margin</div>
                <div className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                  {profitMargin}%
                </div>
              </div>
            </div>
            
            {commCpNum > 0 && (
              <div className="flex items-center justify-between p-4 bg-brand-orange/5 border border-brand-orange/20 rounded-md mt-2">
                <div>
                  <div className="text-xs text-brand-orange/80 uppercase font-bold tracking-widest mb-1">Commission Profit</div>
                  <div className={`text-xl font-bold ${commProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatRupee(commProfit)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-brand-orange/80 uppercase font-bold tracking-widest mb-1">Margin</div>
                  <div className={`text-xl font-bold ${commProfit >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                    {commProfitMargin}%
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-premium-border">
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 disabled:opacity-50 text-white font-medium rounded-md transition-all active:scale-95"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {initialData ? 'Update Product' : 'Save Product'}
        </button>
      </div>
    </form>
  )
}

