"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"

type QuotationItemData = {
  productId: string
  quantity: number
  spSnapshot: number // paise
  cpSnapshot?: number // paise
  gstSnapshot: number
  supplierId?: string
}

export async function createQuotation(data: {
  clientId: string
  prNo?: string
  rfqNo?: string
  status: string // DRAFT or PENDING
  items: QuotationItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (data.items.length === 0) {
      return { error: "Quotation must have at least one item" }
    }

    // Calculate totals
    let totalAmount = 0
    let totalGst = 0
    
    for (const item of data.items) {
      const amount = item.quantity * item.spSnapshot
      const gst = Math.round(amount * (item.gstSnapshot / 100))
      
      totalAmount += amount
      totalGst += gst
    }

    // Generate a unique ID
    const count = await prisma.quotation.count()
    const id = generateSlug(`QT-${Date.now()}-${count + 1}`)

    const quotation = await prisma.quotation.create({
      data: {
        id,
        clientId: data.clientId,
        prNo: data.prNo || null,
        rfqNo: data.rfqNo || null,
        status: data.status,
        totalAmount,
        totalGst,
        items: {
          create: data.items.map((item, index) => ({
            id: generateSlug(`QTI-${id}-${index}`),
            productId: item.productId,
            quantity: item.quantity,
            spSnapshot: item.spSnapshot,
            cpSnapshot: item.cpSnapshot || null,
            gstSnapshot: item.gstSnapshot,
            supplierId: item.supplierId || null
          }))
        }
      }
    })

    revalidatePath("/quotations")
    return { success: true, id: quotation.id }
  } catch (error: any) {
    console.error("Create Quotation Error:", error)
    return { error: error.message || "Failed to create quotation" }
  }
}

export async function upsertDraftQuotation(data: {
  id?: string
  clientId: string
  prNo?: string
  rfqNo?: string
  status?: string
  items: QuotationItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    let totalAmount = 0
    let totalGst = 0
    
    for (const item of data.items) {
      const amount = item.quantity * item.spSnapshot
      const gst = Math.round(amount * (item.gstSnapshot / 100))
      
      totalAmount += amount
      totalGst += gst
    }

    let quotationId = data.id
    const finalStatus = data.status || "DRAFT"

    if (!quotationId) {
      // Create new draft
      const count = await prisma.quotation.count()
      quotationId = generateSlug(`QT-${Date.now()}-${count + 1}`)

      await prisma.quotation.create({
        data: {
          id: quotationId,
          clientId: data.clientId,
          prNo: data.prNo || null,
          rfqNo: data.rfqNo || null,
          status: finalStatus,
          totalAmount,
          totalGst,
          items: {
            create: data.items.map((item, index) => ({
              id: generateSlug(`QTI-${quotationId}-${index}`),
              productId: item.productId,
              quantity: item.quantity,
              spSnapshot: item.spSnapshot,
              cpSnapshot: item.cpSnapshot || null,
              gstSnapshot: item.gstSnapshot,
              supplierId: item.supplierId || null
            }))
          }
        }
      })
    } else {
      // Update existing draft
      // First, delete all existing items
      await prisma.quotationItem.deleteMany({
        where: { quotationId: quotationId }
      })

      // Then update quotation and recreate items
      await prisma.quotation.update({
        where: { id: quotationId },
        data: {
          clientId: data.clientId,
          prNo: data.prNo || null,
          rfqNo: data.rfqNo || null,
          status: finalStatus,
          totalAmount,
          totalGst,
          items: {
            create: data.items.map((item, index) => ({
              id: generateSlug(`QTI-${quotationId}-${index}`),
              productId: item.productId,
              quantity: item.quantity,
              spSnapshot: item.spSnapshot,
              cpSnapshot: item.cpSnapshot || null,
              gstSnapshot: item.gstSnapshot,
              supplierId: item.supplierId || null
            }))
          }
        }
      })
    }

    revalidatePath("/quotations")
    return { success: true, id: quotationId }
  } catch (error: any) {
    console.error("Upsert Draft Quotation Error:", error)
    return { error: error.message || "Failed to save draft" }
  }
}

export async function deleteQuotation(id: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.quotation.delete({
      where: { id }
    })

    revalidatePath("/quotations")
    return { success: true }
  } catch (error: any) {
    console.error("Delete Quotation Error:", error)
    return { error: error.message || "Failed to delete quotation" }
  }
}
