"use server"
import { prisma } from "@/lib/prisma"
import * as xlsx from "xlsx"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"
import { auth } from "@/auth"

export async function importExcelAction(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const file = formData.get("file") as File
    if (!file) {
      return { error: "No file provided" }
    }

    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Parse to JSON using the headers as keys, raw: false to prevent date/fraction parsing issues
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: "", raw: false }) as any[]

    if (!data || data.length === 0) {
      return { error: "No data found in the Excel file" }
    }

    let importedCount = 0

    // Typical headers based on user image:
    // SR NO, PR NO, Items No, Material Code, Material Descriptions, QTY, Unit, SPECIFICATION, Make, Model NO, Photo
    for (const row of data) {
      let materialCode = row["Material Code"] ? String(row["Material Code"]) : null
      const materialDescription = row["Material Descriptions"] ? String(row["Material Descriptions"]) : null
      
      if (!materialDescription) {
        continue // skip rows without description
      }

      if (!materialCode) {
        materialCode = `RAD-${Math.floor(10000000 + Math.random() * 90000000)}`
      }

      const slugId = generateSlug(`${materialCode} ${materialDescription}`, true)

      await prisma.product.upsert({
        where: { materialCode },
        update: {},
        create: {
          id: slugId,
          materialCode,
          materialDescription,
          specification: row["SPECIFICATION"] ? String(row["SPECIFICATION"]) : null,
          make: row["Make"] ? String(row["Make"]) : null,
          modelNo: row["Model NO"] ? String(row["Model NO"]) : null,
          unit: row["Unit"] ? String(row["Unit"]) : "NUM",
          costPrice: 0,
          sellingPrice: 0,
          gstRate: 18.0,
        }
      })
      importedCount++
    }

    revalidatePath("/products")
    return { success: true, count: importedCount }

  } catch (error: any) {
    console.error("Excel import error:", error)
    return { error: error.message || "Failed to import Excel" }
  }
}

export async function parseQuotationExcelAction(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const file = formData.get("file") as File
    if (!file) {
      return { error: "No file provided" }
    }

    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: "", raw: false }) as any[]
    if (!data || data.length === 0) {
      return { error: "No data found in the Excel file" }
    }

    const parsedItems: any[] = []

    for (const row of data) {
      let materialCode = row["Material Code"] ? String(row["Material Code"]) : null
      const materialDescription = row["Material Descriptions"] ? String(row["Material Descriptions"]) : null
      const qtyStr = row["QTY"] ? String(row["QTY"]) : "1"
      let quantity = parseInt(qtyStr, 10)
      if (isNaN(quantity) || quantity <= 0) quantity = 1

      if (!materialDescription) {
        continue 
      }

      if (!materialCode) {
        materialCode = `RAD-${Math.floor(10000000 + Math.random() * 90000000)}`
      }

      const slugId = `TEMP-${Math.floor(Math.random() * 100000000)}`

      parsedItems.push({
        product: {
          id: slugId,
          materialCode: materialCode,
          materialDescription: materialDescription,
          sellingPrice: 0,
          gstRate: 18.0,
          unit: row["Unit"] ? String(row["Unit"]) : "NUM"
        },
        quantity,
        itemsNo: row["Items No"] ? String(row["Items No"]) : undefined,
        prNo: row["PR NO"] ? String(row["PR NO"]) : undefined
      })
    }

    revalidatePath("/products")
    return { success: true, parsedItems }

  } catch (error: any) {
    console.error("Parse Quotation Excel error:", error)
    return { error: error.message || "Failed to parse Excel" }
  }
}
