"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createProduct, updateProduct } from "@/app/actions/product"
import { getPresignedUrl } from "@/app/actions/upload"
import { Loader2, ImagePlus } from "lucide-react"

export function ProductForm({ suppliers, initialData }: { suppliers: any[], initialData?: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null)

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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl glass-panel p-6 rounded-2xl">
      <div className="grid grid-cols-2 gap-6">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Product Image</label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-lg bg-white/5 border border-premium-border flex items-center justify-center overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-8 h-8 text-zinc-600" />
              )}
            </div>
            <label className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors border border-premium-border">
              Choose Image
              <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Material Code</label>
          <input name="materialCode" type="text" placeholder="Leave empty to auto-generate" defaultValue={initialData?.materialCode} className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Material Description *</label>
          <input required name="materialDescription" type="text" defaultValue={initialData?.materialDescription} className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Supplier</label>
          <select name="supplierId" defaultValue={initialData?.supplierId || ""} className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate">
            <option value="">No Supplier (Direct)</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4 col-span-2">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Make</label>
            <input name="make" type="text" defaultValue={initialData?.make || ""} className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Model No</label>
            <input name="modelNo" type="text" defaultValue={initialData?.modelNo || ""} className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Unit</label>
            <input name="unit" type="text" defaultValue={initialData?.unit || "NUM"} className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 col-span-2">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Cost Price (Rupees) *</label>
            <input required name="costPrice" type="number" step="0.01" min="0" defaultValue={initialData?.costPrice ? initialData.costPrice / 100 : undefined} className="w-full max-w-md bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-premium-border">
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 disabled:opacity-50 text-white font-medium rounded-lg transition-all active:scale-95"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {initialData ? 'Update Product' : 'Save Product'}
        </button>
      </div>
    </form>
  )
}
