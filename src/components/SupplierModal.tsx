"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createSupplier, updateSupplier } from "@/app/actions/supplier"
import { Loader2, X } from "lucide-react"

export function SupplierModal({ suppliers }: { suppliers: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get("action")
  const editId = searchParams.get("id")

  const isOpen = action === "new-supplier" || action === "edit-supplier"
  const isEditing = action === "edit-supplier"

  const supplierToEdit = isEditing ? suppliers.find(s => s.id === editId) : null

  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(supplierToEdit?.name || "")
      setContact(supplierToEdit?.contact || "")
    }
  }, [isOpen, supplierToEdit])

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
      const data = { name, contact }
      const result = isEditing 
        ? await updateSupplier(editId!, data)
        : await createSupplier(data)
        
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
      <div className="relative bg-zinc-900 border border-premium-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-premium-border bg-white/[0.02]">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? "Edit Supplier" : "Add New Supplier"}
          </h2>
          <button onClick={close} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Supplier Name *</label>
            <input 
              required 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="Company or Contact Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Contact Info</label>
            <input 
              type="text" 
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full bg-zinc-950 border border-premium-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-slate" 
              placeholder="Email, Phone, etc."
            />
          </div>
          
          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-brand-orange to-brand-orange-dark hover:from-brand-orange-dark hover:to-brand-orange shadow-lg shadow-brand-orange/20 disabled:opacity-50 text-white font-medium rounded-lg transition-all active:scale-95"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? "Update Supplier" : "Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
