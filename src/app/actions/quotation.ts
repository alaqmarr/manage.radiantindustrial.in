"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"

type QuotationItemData = {
  product: {
    id: string
    materialCode: string
    materialDescription: string
    unit: string
    gstRate: number
  }
  quantity: number
  spSnapshot: number // paise
  cpSnapshot?: number // paise
  commissionCpSnapshot?: number // paise
  supplierId?: string
  comment?: string
  leadTime?: string
  additionalCost?: number // paise
}

export async function getQuotationUpdatedAt(id: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const q = await prisma.quotation.findUnique({
      where: { id },
      select: { updatedAt: true }
    })
    
    if (!q) return { error: "Not found" }
    
    return { success: true, updatedAt: q.updatedAt }
  } catch (e: any) {
    return { error: "Failed to check status" }
  }
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
      const amount = Math.round(item.quantity * item.spSnapshot)
      const gst = Math.round(amount * (item.product.gstRate / 100))
      
      totalAmount += amount
      totalGst += gst
    }

    // Generate a unique ID
    // Upsert all products
    for (const item of data.items) {
      const p = await prisma.product.upsert({
        where: { materialCode: item.product.materialCode },
        update: {
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.product.gstRate
        },
        create: {
          id: generateSlug(`${item.product.materialCode} ${item.product.materialDescription}`, true),
          materialCode: item.product.materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.product.gstRate,
          costPrice: 0,
          sellingPrice: 0
        }
      })
      item.product.id = p.id
    }

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
            productId: item.product.id,
            quantity: item.quantity,
            spSnapshot: item.spSnapshot,
            cpSnapshot: item.cpSnapshot || null,
            commissionCpSnapshot: item.commissionCpSnapshot || null,
            gstSnapshot: item.product.gstRate,
            supplierId: item.supplierId || null,
            comment: item.comment || null,
            leadTime: item.leadTime || null,
            additionalCost: item.additionalCost || 0
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
  expectedUpdatedAt?: Date
  items: QuotationItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (data.id && data.expectedUpdatedAt) {
      const current = await prisma.quotation.findUnique({
        where: { id: data.id },
        select: { updatedAt: true }
      })
      
      if (current && current.updatedAt.getTime() > new Date(data.expectedUpdatedAt).getTime()) {
        return { error: "CONFLICT: Someone else has updated this quotation since you opened it. Please refresh the page to see the latest changes." }
      }
    }

    let totalAmount = 0
    let totalGst = 0
    
    for (const item of data.items) {
      const amount = Math.round(item.quantity * item.spSnapshot)
      const gst = Math.round(amount * (item.product.gstRate / 100))
      
      totalAmount += amount
      totalGst += gst
    }

    let quotationId = data.id
    const finalStatus = data.status || "DRAFT"

    // Upsert all products
    for (const item of data.items) {
      const p = await prisma.product.upsert({
        where: { materialCode: item.product.materialCode },
        update: {
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.product.gstRate
        },
        create: {
          id: generateSlug(`${item.product.materialCode} ${item.product.materialDescription}`, true),
          materialCode: item.product.materialCode,
          materialDescription: item.product.materialDescription,
          unit: item.product.unit,
          gstRate: item.product.gstRate,
          costPrice: 0,
          sellingPrice: 0
        }
      })
      item.product.id = p.id
    }

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
              productId: item.product.id,
              quantity: item.quantity,
              spSnapshot: item.spSnapshot,
              cpSnapshot: item.cpSnapshot || null,
              commissionCpSnapshot: item.commissionCpSnapshot || null,
              gstSnapshot: item.product.gstRate,
              supplierId: item.supplierId || null,
              comment: item.comment || null,
              leadTime: item.leadTime || null,
              additionalCost: item.additionalCost || 0
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
              productId: item.product.id,
              quantity: item.quantity,
              spSnapshot: item.spSnapshot,
              cpSnapshot: item.cpSnapshot || null,
              commissionCpSnapshot: item.commissionCpSnapshot || null,
              gstSnapshot: item.product.gstRate,
              supplierId: item.supplierId || null,
              comment: item.comment || null,
              leadTime: item.leadTime || null,
              additionalCost: item.additionalCost || 0
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

export async function updateQuotationStatus(id: string, newStatus: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.quotation.update({
      where: { id },
      data: { status: newStatus }
    })

    revalidatePath("/quotations")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Update Quotation Status Error:", error)
    return { error: error.message || "Failed to update quotation status" }
  }
}

export async function getQuotationsForImport() {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const quotations = await prisma.quotation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        client: { select: { name: true } },
        prNo: true,
        items: {
          select: {
            id: true,
            quantity: true,
            comment: true,
            product: {
              select: {
                id: true,
                materialCode: true,
                materialDescription: true,
                sellingPrice: true,
                costPrice: true,
                gstRate: true,
                unit: true,
                specification: true
              }
            }
          }
        }
      }
    })
    return { success: true, quotations }
  } catch (e: any) {
    return { error: "Failed to fetch quotations" }
  }
}
