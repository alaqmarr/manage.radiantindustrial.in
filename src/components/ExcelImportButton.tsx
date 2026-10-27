"use client"
import { useRef, useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { importExcelAction } from "@/app/actions/import"
import { sileo } from "sileo"

export function ExcelImportButton() {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    
    const formData = new FormData()
    formData.append("file", file)
    
    const result = await importExcelAction(formData)
    
    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (result.error) {
      sileo.error({ title: "Excel Import Failed", description: result.error })
    } else {
      sileo.success({
        title: "Products Imported",
        description: `Successfully imported ${result.count} products into the catalog.`
      })
      router.refresh()
    }
  }

  return (
    <label className={`flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:text-slate-900'}`}>
      {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-orange-600" /> : <FileUp className="w-4 h-4 text-slate-500" />}
      <span className="font-semibold text-sm">{isUploading ? 'Importing...' : 'Import Excel'}</span>
      <input 
        ref={fileInputRef}
        type="file" 
        className="hidden" 
        accept=".xlsx, .xls, .csv" 
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </label>
  )
}
