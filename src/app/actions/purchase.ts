"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function createPurchase(payload: {
  supplierId: string
  quotationId?: string
  items: { productId: string, quantity: number, cpSnapshot: number }[]
}) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Generate an ID for the purchase
    const id = `pur-${Date.now()}`

    // Calculate totals
    let totalAmount = 0
    let totalGst = 0

    // Fetch product details to get GST rates
    const productIds = payload.items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    })
    
    const productMap = products.reduce((acc, p) => {
      acc[p.id] = p
      return acc
    }, {} as Record<string, any>)

    // If tagging a quotation, ensure we aren't double-purchasing items
    if (payload.quotationId) {
      const existingPurchases = await prisma.purchase.findMany({
        where: { quotationId: payload.quotationId },
        include: { items: true }
      })
      const alreadyPurchasedProductIds = new Set(
        existingPurchases.flatMap(p => p.items.map(i => i.productId))
      )
      
      for (const item of payload.items) {
        if (alreadyPurchasedProductIds.has(item.productId)) {
          throw new Error(`Item ${productMap[item.productId]?.materialCode || item.productId} purchase is already recorded for this quotation. Delete the existing purchase to add a new one.`)
        }
      }
    }

    const itemsToCreate = payload.items.map(item => {
      const product = productMap[item.productId]
      const amount = item.cpSnapshot * item.quantity
      const gst = Math.round(amount * (product.gstRate / 100))
      
      totalAmount += amount
      totalGst += gst

      return {
        id: `pi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: item.productId,
        quantity: item.quantity,
        cpSnapshot: item.cpSnapshot
      }
    })

    const purchase = await prisma.purchase.create({
      data: {
        id,
        supplierId: payload.supplierId,
        quotationId: payload.quotationId || null,
        totalAmount,
        totalGst,
        items: {
          create: itemsToCreate
        }
      }
    })

    // Also upsert ProductSupplier entries to maintain up-to-date vendor prices
    for (const item of payload.items) {
      await prisma.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: item.productId,
            supplierId: payload.supplierId
          }
        },
        update: {
          costPrice: item.cpSnapshot
        },
        create: {
          productId: item.productId,
          supplierId: payload.supplierId,
          costPrice: item.cpSnapshot
        }
      })
    }

    // Update QuotationItem cpSnapshot if tagged to a quotation
    if (payload.quotationId) {
      for (const item of payload.items) {
        await prisma.quotationItem.updateMany({
          where: { quotationId: payload.quotationId, productId: item.productId },
          data: { cpSnapshot: item.cpSnapshot, supplierId: payload.supplierId }
        })
      }
    }

    return { success: true, id: purchase.id }
  } catch (error: any) {
    console.error("Error creating purchase:", error)
    return { success: false, error: error.message || "Failed to create purchase" }
  }
}

export async function updatePurchase(id: string, payload: {
  supplierId: string
  quotationId?: string
  items: { productId: string, quantity: number, cpSnapshot: number }[]
}) {
  const session = await auth()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    // Calculate totals
    let totalAmount = 0
    let totalGst = 0

    // Fetch product details to get GST rates
    const productIds = payload.items.map(i => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    })
    
    const productMap = products.reduce((acc, p) => {
      acc[p.id] = p
      return acc
    }, {} as Record<string, any>)

    if (payload.quotationId) {
      const existingPurchases = await prisma.purchase.findMany({
        where: { quotationId: payload.quotationId, id: { not: id } },
        include: { items: true }
      })
      const alreadyPurchasedProductIds = new Set(
        existingPurchases.flatMap(p => p.items.map(i => i.productId))
      )
      
      for (const item of payload.items) {
        if (alreadyPurchasedProductIds.has(item.productId)) {
          throw new Error(`Item ${productMap[item.productId]?.materialCode || item.productId} purchase is already recorded for this quotation. Delete the existing purchase to add a new one.`)
        }
      }
    }

    const itemsToCreate = payload.items.map(item => {
      const product = productMap[item.productId]
      const amount = item.cpSnapshot * item.quantity
      const gst = Math.round(amount * (product.gstRate / 100))
      
      totalAmount += amount
      totalGst += gst

      return {
        id: `pi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: item.productId,
        quantity: item.quantity,
        cpSnapshot: item.cpSnapshot
      }
    })

    // Delete existing items
    const purchase = await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: id }
      })

      return await tx.purchase.update({
        where: { id },
        data: {
          supplierId: payload.supplierId,
          quotationId: payload.quotationId || null,
          totalAmount,
          totalGst,
          items: {
            create: itemsToCreate
          }
        }
      })
    })

    // Also upsert ProductSupplier entries
    for (const item of payload.items) {
      await prisma.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: item.productId,
            supplierId: payload.supplierId
          }
        },
        update: {
          costPrice: item.cpSnapshot
        },
        create: {
          productId: item.productId,
          supplierId: payload.supplierId,
          costPrice: item.cpSnapshot
        }
      })
    }

    // Update QuotationItem cpSnapshot if tagged to a quotation
    if (payload.quotationId) {
      for (const item of payload.items) {
        await prisma.quotationItem.updateMany({
          where: { quotationId: payload.quotationId, productId: item.productId },
          data: { cpSnapshot: item.cpSnapshot, supplierId: payload.supplierId }
        })
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error updating purchase:", error)
    return { success: false, error: error.message || "Failed to update purchase" }
  }
}
