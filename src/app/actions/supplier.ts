"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { generateSlug } from "@/lib/slugify"

export async function searchSuppliers(query: string) {
  try {
    const session = await auth()
    if (!session?.user) return { data: [] }

    const suppliers = await prisma.supplier.findMany({
      where: {
        name: { contains: query }
      },
      take: 10
    })

    return { data: suppliers }
  } catch (error) {
    console.error("Search suppliers error:", error)
    return { data: [] }
  }
}

export async function getProductSuppliers(productId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const productSuppliers = await prisma.productSupplier.findMany({
      where: { productId },
      include: {
        supplier: true
      },
      orderBy: { costPrice: "asc" }
    })

    return { data: productSuppliers }
  } catch (error: any) {
    console.error("Get product suppliers error:", error)
    return { error: error.message || "Failed to fetch suppliers" }
  }
}

export async function addProductSupplier(
  productId: string, 
  supplierName: string, 
  costPrice: number
) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    if (!supplierName.trim()) {
      return { error: "Supplier name is required" }
    }

    // Check if supplier exists or create
    let supplierId = generateSlug(supplierName, true)
    
    let supplier = await prisma.supplier.findFirst({
      where: { name: { equals: supplierName } }
    })

    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          id: supplierId,
          name: supplierName
        }
      })
    } else {
      supplierId = supplier.id
    }

    // Now upsert the ProductSupplier
    const productSupplier = await prisma.productSupplier.upsert({
      where: {
        productId_supplierId: {
          productId,
          supplierId
        }
      },
      update: {
        costPrice: Math.round(costPrice * 100)
      },
      create: {
        productId,
        supplierId,
        costPrice: Math.round(costPrice * 100)
      },
      include: {
        supplier: true
      }
    })

    return { success: true, data: productSupplier }
  } catch (error: any) {
    console.error("Add product supplier error:", error)
    return { error: error.message || "Failed to add supplier" }
  }
}

export async function updateProductSupplierPrice(
  productId: string, 
  supplierId: string, 
  costPrice: number
) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const productSupplier = await prisma.productSupplier.update({
      where: {
        productId_supplierId: {
          productId,
          supplierId
        }
      },
      data: {
        costPrice: Math.round(costPrice * 100)
      },
      include: {
        supplier: true
      }
    })

    return { success: true, data: productSupplier }
  } catch (error: any) {
    console.error("Update product supplier price error:", error)
    return { error: error.message || "Failed to update supplier price" }
  }
}

import { revalidatePath } from "next/cache"

export async function createSupplier(data: { name: string; contact?: string }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.name?.trim()) {
      return { error: "Supplier name is required" }
    }

    const id = generateSlug(data.name, true)

    const supplier = await prisma.supplier.create({
      data: {
        id,
        name: data.name,
        contact: data.contact,
      }
    })

    revalidatePath("/suppliers")
    return { success: true, supplier }
  } catch (error: any) {
    console.error("Create Supplier Error:", error)
    return { error: error.message || "Failed to create supplier" }
  }
}

export async function updateSupplier(id: string, data: { name: string; contact?: string }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.name?.trim()) {
      return { error: "Supplier name is required" }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        contact: data.contact,
      }
    })

    revalidatePath("/suppliers")
    return { success: true, supplier }
  } catch (error: any) {
    console.error("Update Supplier Error:", error)
    return { error: error.message || "Failed to update supplier" }
  }
}
