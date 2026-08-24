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
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(settings?.signatureUrl || null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSignatureFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setSignaturePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      let imageUrl = null
      let uploadedSignatureUrl = null

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

      if (signatureFile) {
        const { uploadUrl, publicUrl } = await getPresignedUrl("signature_" + signatureFile.name, signatureFile.type)
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: signatureFile,
          headers: { "Content-Type": signatureFile.type },
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload signature to Cloudflare R2")
        }
        uploadedSignatureUrl = publicUrl
      }

      if (imageUrl) {
        formData.append("logoUrl", imageUrl)
      }
      if (uploadedSignatureUrl) {
        formData.append("signatureUrl", uploadedSignatureUrl)
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Company Logo</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Digital Signature Stamp</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-48 h-24 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden p-2">
                {signaturePreview ? (
                  <img src={signaturePreview} alt="Signature Preview" className="w-full h-full object-contain" />
                ) : (
                  <ImagePlus className="w-8 h-8 text-zinc-700" />
                )}
              </div>
              <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-md cursor-pointer transition-colors">
                Choose Signature
                <input type="file" className="hidden" accept="image/*" onChange={handleSignatureChange} />
              </label>
            </div>
            <p className="text-xs text-zinc-500 mt-2">Used as the authorized signatory on PDFs.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Company Name *</label>
            <input required defaultValue={settings?.companyName} name="companyName" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Company Address</label>
            <textarea defaultValue={settings?.address || ""} name="address" rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Billing Address</label>
            <textarea defaultValue={settings?.billingAddress || ""} name="billingAddress" rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Shipping Address</label>
            <textarea defaultValue={settings?.shippingAddress || ""} name="shippingAddress" rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
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
            <label className="block text-sm font-medium text-zinc-400 mb-1">Company GST Number</label>
            <input defaultValue={settings?.gstNumber || ""} name="gstNumber" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate uppercase" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Default Quotation Message</label>
            <textarea defaultValue={settings?.quotationMessage || "Here is your quotation for the RFQ as requested."} name="quotationMessage" rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Default RFQ Message</label>
            <textarea defaultValue={settings?.rfqMessage || "Please find attached our Request for Quotation. Kindly share your best prices at the earliest."} name="rfqMessage" rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Default Certificate of Conformance Text</label>
            <textarea defaultValue={settings?.cocMessage || "We hereby certify that the materials supplied against this order conform strictly to your company standards and have been procured from genuine sources."} name="cocMessage" rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Bottom Details (Terms / Signatures)</label>
            <textarea defaultValue={settings?.bottomDetails || ""} name="bottomDetails" rows={3} placeholder="Terms and conditions, validity, etc." className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
          </div>
        </div>
        
        {/* Email / SMTP Integration */}
        <div className="pt-6 border-t border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">Email Sending Settings (SMTP)</h3>
          <p className="text-sm text-zinc-400 mb-4">Provide your Gmail credentials to send emails directly from the app. Use a generated <strong>App Password</strong>, not your regular login password.</p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">SMTP Email Address</label>
              <input defaultValue={settings?.smtpEmail || ""} name="smtpEmail" type="email" placeholder="e.g. sales@yourcompany.com" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">SMTP App Password</label>
              <input defaultValue={settings?.smtpPassword || ""} name="smtpPassword" type="password" placeholder="16-character App Password" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
          </div>
        </div>

        
        {/* API Integrations */}
        <div className="pt-6 border-t border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">API Integrations</h3>
          <p className="text-sm text-zinc-400 mb-4">Configure third-party APIs for automation.</p>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1">Appyflow GST API Key (key_secret)</label>
              <input defaultValue={settings?.gstApiKey || ""} name="gstApiKey" type="password" placeholder="e.g. Me1aB2haQFbZTaZ5THcrCTkZ0F13" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
              <p className="text-xs text-zinc-500 mt-1">Used for automatically fetching client and supplier details via GSTIN.</p>
            </div>
          </div>
        </div>

        {/* Banking Details */}
        <div className="pt-6 border-t border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-4">Banking Details</h3>
          <p className="text-sm text-zinc-400 mb-4">These details can be used in your email templates (e.g. when requesting payment).</p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Bank Name</label>
              <input defaultValue={settings?.bankName || ""} name="bankName" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Account Name</label>
              <input defaultValue={settings?.accountName || ""} name="accountName" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Account Number</label>
              <input defaultValue={settings?.accountNumber || ""} name="accountNumber" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">IFSC Code</label>
              <input defaultValue={settings?.ifscCode || ""} name="ifscCode" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">SWIFT Code</label>
              <input defaultValue={settings?.swiftCode || ""} name="swiftCode" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Branch / Address</label>
              <input defaultValue={settings?.bankAddress || ""} name="bankAddress" type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" />
            </div>
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

