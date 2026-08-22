"use server"
import { prisma } from "@/lib/prisma"
import { generateSlug } from "@/lib/slugify"
import { auth } from "@/auth"

export async function createQuickProduct(data: { materialCode: string, materialDescription: string, unit: string, gstRate: number }) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    
    const id = generateSlug(`${data.materialCode} ${data.materialDescription}`, true)
    
    const product = await prisma.product.create({
      data: {
        id,
        materialCode: data.materialCode || `RAD-${Math.floor(10000000 + Math.random() * 90000000)}`,
        materialDescription: data.materialDescription,
        unit: data.unit || "NUM",
        gstRate: data.gstRate || 18,
        costPrice: 0,
        sellingPrice: 0
      }
    })
    
    return { success: true, product }
  } catch (error: any) {
    return { error: error.message || "Failed to create product" }
  }
}

export async function createProduct(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }
    let materialCode = String(formData.get("materialCode")).trim()
    if (!materialCode) {
      materialCode = `RAD-${Math.floor(10000000 + Math.random() * 90000000)}`
    }
    const materialDescription = String(formData.get("materialDescription"))
    
    // Convert inputs from rupees to paise, default to 0 if NaN/Empty
    const cpVal = parseFloat(String(formData.get("costPrice")))
    const cp = isNaN(cpVal) ? 0 : Math.round(cpVal * 100)
    
    const commCpStr = formData.get("commissionCostPrice")
    const commissionCp = commCpStr && !isNaN(parseFloat(String(commCpStr))) ? Math.round(parseFloat(String(commCpStr)) * 100) : null
    
    const spVal = parseFloat(String(formData.get("sellingPrice")))
    const sp = isNaN(spVal) ? 0 : Math.round(spVal * 100)
    
    const gstVal = parseFloat(String(formData.get("gstRate")))
    const gstRate = isNaN(gstVal) ? 18.0 : gstVal

    const supplierName = String(formData.get("supplierName") || "").trim()
    let finalSupplierId = null

    if (supplierName) {
      const allSuppliers = await prisma.supplier.findMany()
      const existing = allSuppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase())
      
      if (existing) {
        finalSupplierId = existing.id
      } else {
        const newSupplier = await prisma.supplier.create({
          data: {
            id: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
            name: supplierName
          }
        })
        finalSupplierId = newSupplier.id
      }
    }

    const imageUrl = formData.get("imageUrl") as string | null

    const id = generateSlug(`${materialCode} ${materialDescription}`, true)

    await prisma.product.create({
      data: {
        id,
        materialCode,
        materialDescription,
        imageUrl,
        make: formData.get("make") ? String(formData.get("make")) : null,
        modelNo: formData.get("modelNo") ? String(formData.get("modelNo")) : null,
        unit: formData.get("unit") ? String(formData.get("unit")) : "NUM",
        costPrice: cp,
        commissionCostPrice: commissionCp,
        sellingPrice: sp,
        gstRate,
        supplierId: finalSupplierId,
      }
    })

    return { success: true }
  } catch (error: any) {
    console.error("Product creation error:", error)
    return { error: error.message || "Failed to create product" }
  }
}

export async function updateProduct(id: string, formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }
    const materialCode = String(formData.get("materialCode"))
    const materialDescription = String(formData.get("materialDescription"))
    
    const cpVal = parseFloat(String(formData.get("costPrice")))
    const cp = isNaN(cpVal) ? 0 : Math.round(cpVal * 100)
    
    const commCpStr = formData.get("commissionCostPrice")
    const commissionCp = commCpStr && !isNaN(parseFloat(String(commCpStr))) ? Math.round(parseFloat(String(commCpStr)) * 100) : null
    
    const spVal = parseFloat(String(formData.get("sellingPrice")))
    const sp = isNaN(spVal) ? 0 : Math.round(spVal * 100)
    
    const gstVal = parseFloat(String(formData.get("gstRate")))
    const gstRate = isNaN(gstVal) ? 18.0 : gstVal

    const supplierName = String(formData.get("supplierName") || "").trim()
    let finalSupplierId = null

    if (supplierName) {
      const allSuppliers = await prisma.supplier.findMany()
      const existing = allSuppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase())
      
      if (existing) {
        finalSupplierId = existing.id
      } else {
        const newSupplier = await prisma.supplier.create({
          data: {
            id: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
            name: supplierName
          }
        })
        finalSupplierId = newSupplier.id
      }
    }
    
    const imageUrl = formData.get("imageUrl") as string | null

    const data: any = {
      materialCode,
      materialDescription,
      make: formData.get("make") ? String(formData.get("make")) : null,
      modelNo: formData.get("modelNo") ? String(formData.get("modelNo")) : null,
      unit: formData.get("unit") ? String(formData.get("unit")) : "NUM",
      costPrice: cp,
      commissionCostPrice: commissionCp,
      sellingPrice: sp,
      gstRate,
      supplierId: finalSupplierId,
    }

    if (imageUrl) {
      data.imageUrl = imageUrl
    }

    const existingProduct = await prisma.product.findUnique({ where: { id } })
    
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data
      })
      
      if (existingProduct && (existingProduct.costPrice !== cp || existingProduct.sellingPrice !== sp)) {
        await tx.priceHistory.create({
          data: {
            productId: id,
            costPrice: cp,
            sellingPrice: sp,
          }
        })
      }
    })

    return { success: true }
  } catch (error: any) {
    console.error("Product update error:", error)
    return { error: error.message || "Failed to update product" }
  }
}
