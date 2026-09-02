"use client"
import { useRef, useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { importExcelAction } from "@/app/actions/import"
import { toast } from "sonner"

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
      toast.error("Error: " + result.error)
    } else {
      toast.success(`Successfully imported ${result.count} products!`)
      router.refresh()
    }
  }

  return (
    <label className={`flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-md transition-colors cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800'}`}>
      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
      <span className="font-medium text-sm">{isUploading ? 'Importing...' : 'Import Excel'}</span>
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

