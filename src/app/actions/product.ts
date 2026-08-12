"use server"
import { prisma } from "@/lib/prisma"
import { generateSlug } from "@/lib/slugify"
import { auth } from "@/auth"

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
    
    // Convert inputs from rupees to paise
    const cp = Math.round(parseFloat(String(formData.get("costPrice"))) * 100)
    const sp = Math.round(parseFloat(String(formData.get("sellingPrice"))) * 100) || 0

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

    // Generate slug ID based on material code and description
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
        sellingPrice: sp,
        gstRate: 18.0,
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
    
    const cp = Math.round(parseFloat(String(formData.get("costPrice"))) * 100)
    const sp = Math.round(parseFloat(String(formData.get("sellingPrice"))) * 100) || 0

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
      sellingPrice: sp,
      supplierId: finalSupplierId,
    }

    if (imageUrl) {
      data.imageUrl = imageUrl
    }

    await prisma.product.update({
      where: { id },
      data
    })

    return { success: true }
  } catch (error: any) {
    console.error("Product update error:", error)
    return { error: error.message || "Failed to update product" }
  }
}
