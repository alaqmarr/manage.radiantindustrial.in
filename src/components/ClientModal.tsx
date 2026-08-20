"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient, updateClient } from "@/app/actions/client"
import { Loader2, X, Search } from "lucide-react"
import { verifyGSTAction } from "@/app/actions/gst"

export function ClientModal({ clients }: { clients: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get("action")
  const editId = searchParams.get("id")

  const isOpen = action === "new-client" || action === "edit-client"
  const isEditing = action === "edit-client"

  const [isVerifyingGST, setIsVerifyingGST] = useState(false)
  const [gstInput, setGstInput] = useState("")

  const handleVerifyGST = async () => {
    if (!gstInput.trim() || gstInput.length < 15) {
      alert("Please enter a valid 15-character GST Number.");
      return;
    }
    setIsVerifyingGST(true);
    try {
      const res = await verifyGSTAction(gstInput.trim());
      if (res.error) {
        alert(res.error);
      } else if (res.data) {
        setName(res.data.name || name);
        setAddress(res.data.address || address);
        setLocation(res.data.location || location);
        alert("Details fetched successfully! \n" + (res.data.legalName ? "(" + res.data.legalName + ")" : ""));
      }
    } catch (e) {
      alert("Failed to verify GST.");
    } finally {
      setIsVerifyingGST(false);
    }
  }

  const clientToEdit = isEditing ? clients.find(c => c.id === editId) : null

  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [location, setLocation] = useState("")
  const [address, setAddress] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(clientToEdit?.name || "")
      setContact(clientToEdit?.contact || "")
      setEmail(clientToEdit?.email || "")
      setGstNumber(clientToEdit?.gstNumber || "")
      setGstInput(clientToEdit?.gstNumber || "")
      setLocation(clientToEdit?.location || "")
      setAddress(clientToEdit?.address || "")
    }
  }, [isOpen, clientToEdit])

  if (!isOpen) return null

  const close = () => {
    const params = new URLSearchParams(searchParams)
    params.delete("action")
    params.delete("id")
    router.push(`?${params.toString()}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const data = { name, contact, email, gstNumber, location, address }
      const result = isEditing 
        ? await updateClient(editId!, data)
        : await createClient(data)
        
      if (result.error) throw new Error(result.error)
      
      close()
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-zinc-900 border border-premium-border rounded-md shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-premium-border bg-white/[0.02]">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? "Edit Client" : "Add New Client"}
          </h2>
          <button onClick={close} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">GST Number</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={gstNumber}
                onChange={(e) => {
                  setGstNumber(e.target.value);
                  setGstInput(e.target.value);
                }}
                className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate uppercase" 
                placeholder="22AAAAA0000A1Z5"
              />
              <button
                type="button"
                onClick={handleVerifyGST}
                disabled={isVerifyingGST}
                className="flex items-center gap-1 px-3 py-2 bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 disabled:opacity-50 rounded-md transition-colors"
              >
                {isVerifyingGST ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="text-xs font-semibold whitespace-nowrap">Verify</span>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Client Name *</label>
            <input 
              required 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="Company or Contact Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="Email address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Phone / Contact</label>
            <input 
              type="text" 
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="Phone number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Location / City</label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="e.g. Mumbai, MH"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Full Address</label>
            <textarea 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full bg-zinc-950 border border-premium-border rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="Full address details"
            />
          </div>
          
          <div className="flex justify-end pt-4 border-t border-zinc-800">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 disabled:opacity-50 text-white font-medium rounded-md transition-all active:scale-95"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? "Update Client" : "Save Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
