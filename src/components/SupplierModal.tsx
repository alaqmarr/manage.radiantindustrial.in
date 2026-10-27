"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createSupplier, updateSupplier } from "@/app/actions/supplier"
import { Loader2, X, Search, Truck } from "lucide-react"
import { verifyGSTAction } from "@/app/actions/gst"
import { sileo } from "sileo"

export function SupplierModal({ 
  suppliers,
  forceOpen = false,
  onForceClose,
  onSuccess
}: { 
  suppliers?: any[]
  forceOpen?: boolean
  onForceClose?: () => void
  onSuccess?: (newSupplier: any) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get("action")
  const editId = searchParams.get("id")

  const isOpen = forceOpen || action === "new-supplier" || action === "edit-supplier"
  const isEditing = !forceOpen && action === "edit-supplier"

  const [isVerifyingGST, setIsVerifyingGST] = useState(false)
  const [gstInput, setGstInput] = useState("")

  const handleVerifyGST = async () => {
    if (!gstInput.trim() || gstInput.length < 15) {
      sileo.warning({ title: "Invalid GSTIN", description: "Please enter a valid 15-character GST Number." });
      return;
    }
    setIsVerifyingGST(true);
    try {
      const res = await verifyGSTAction(gstInput.trim());
      if (res.error) {
        sileo.error({ title: "GST Verification Failed", description: res.error });
      } else if (res.data) {
        setName(res.data.name || name);
        setLocation(res.data.location || location);
        if (!res.data.location && res.data.address) {
            setLocation(res.data.address);
        }
        sileo.success({
          title: "GST Details Fetched",
          description: res.data.legalName ? `${res.data.name} (${res.data.legalName})` : res.data.name
        });
      }
    } catch (e) {
      sileo.error({ title: "Verification Error", description: "Failed to verify GSTIN." });
    } finally {
      setIsVerifyingGST(false);
    }
  }

  const supplierToEdit = isEditing ? suppliers?.find(s => s.id === editId) : null

  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [location, setLocation] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName(supplierToEdit?.name || "")
      setContact(supplierToEdit?.contact || "")
      setEmail(supplierToEdit?.email || "")
      setGstNumber(supplierToEdit?.gstNumber || "")
      setGstInput(supplierToEdit?.gstNumber || "")
      setLocation(supplierToEdit?.location || "")
    }
  }, [isOpen, supplierToEdit])

  const close = () => {
    if (onForceClose) {
      onForceClose()
    } else {
      const params = new URLSearchParams(searchParams)
      params.delete("action")
      params.delete("id")
      router.push(`?${params.toString()}`)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onForceClose, searchParams, router])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const data = { name, contact, email, gstNumber, location }
      const result = isEditing 
        ? await updateSupplier(editId!, data)
        : await createSupplier(data)
        
      if (result.error) throw new Error(result.error)
      
      sileo.success({
        title: isEditing ? "Supplier Updated" : "Supplier Added",
        description: `${name} has been saved to your vendor directory.`
      })

      if (onSuccess && result.supplier) {
        onSuccess(result.supplier)
      }
      close()
      if (!onForceClose) {
        router.refresh()
      }
    } catch (error: any) {
      sileo.error({ title: "Save Failed", description: error.message || "Could not save supplier." })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={close} />
      <div role="dialog" aria-modal="true" className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
              <Truck className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {isEditing ? "Edit Supplier" : "Add New Supplier"}
            </h2>
          </div>
          <button onClick={close} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">GST Number</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={gstNumber}
                onChange={(e) => {
                  setGstNumber(e.target.value);
                  setGstInput(e.target.value);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 uppercase font-mono" 
                placeholder="e.g. 22AAAAA0000A1Z5"
              />
              <button
                type="button"
                onClick={handleVerifyGST}
                disabled={isVerifyingGST}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isVerifyingGST ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="text-xs font-bold whitespace-nowrap">Verify</span>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Supplier Name *</label>
            <input 
              required 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" 
              placeholder="Company or Contact Name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contact Info (Phone, etc.)</label>
            <input 
              type="text" 
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" 
              placeholder="Phone, etc."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" 
              placeholder="supplier@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location / Address</label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" 
              placeholder="City, State, or full address"
            />
          </div>
          
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 shadow-xs disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
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
