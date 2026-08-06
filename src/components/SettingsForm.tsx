"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { getPresignedUrl } from "@/app/actions/upload"
import { saveCompanySettings } from "@/app/actions/settings"
import { Loader2, ImagePlus } from "lucide-react"

export function SettingsForm({ settings }: { settings: any }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(settings?.logoUrl || null)

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
          headers: { "Content-Type": imageFile.type },
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload logo to Cloudflare R2")
        }
        imageUrl = publicUrl
      }

      if (imageUrl) {
        formData.append("logoUrl", imageUrl)
      }

      const result = await saveCompanySettings(formData)
      if (result.error) {
        throw new Error(result.error)
      }

      alert("Settings saved successfully!")
      router.refresh()
    } catch (error: any) {
      console.error(error)
      alert(error.message || "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl bg-zinc-900 border border-zinc-800 p-6 rounded-md">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Company Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-48 h-24 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden p-2">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <ImagePlus className="w-8 h-8 text-zinc-700" />
              )}
            </div>
            <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-md cursor-pointer transition-colors">
              Choose Logo
              <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Company Name *</label>
            <input required defaultValue={settings?.companyName} name="companyName" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Address</label>
            <textarea defaultValue={settings?.address || ""} name="address" rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
            <input defaultValue={settings?.email || ""} name="email" type="email" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Phone</label>
            <input defaultValue={settings?.phone || ""} name="phone" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Default Quotation Message</label>
            <textarea defaultValue={settings?.quotationMessage || "Here is your quotation for the RFQ as requested."} name="quotationMessage" rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Bottom Details (Terms / Signatures)</label>
            <textarea defaultValue={settings?.bottomDetails || ""} name="bottomDetails" rows={3} placeholder="Terms and conditions, validity, etc." className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-800">
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Settings
        </button>
      </div>
    </form>
  )
}

