"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"

type RfqItemData = {
  product: {
    id: string
    materialCode: string
    materialDescription: string
    unit: string
    gstRate: number
  }
  quantity: number
    comment?: string
}

export async function getRfqUpdatedAt(id: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const r = await prisma.rfq.findUnique({
      where: { id },
      select: { updatedAt: true }
    })
    
    if (!r) return { error: "Not found" }
    
    return { success: true, updatedAt: r.updatedAt }
  } catch (e: any) {
    return { error: "Failed to check status" }
  }
}

export async function createRfq(data: {
  supplierId?: string
  isPublic?: boolean
  status: string // DRAFT or ISSUED
  items: RfqItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (data.items.length === 0) {
      return { error: "RFQ must have at least one item" }
    }

    if (!data.isPublic && !data.supplierId) {
      return { error: "Must select a supplier if not public" }
    }

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

    const count = await prisma.rfq.count()
    const id = generateSlug(`RFQ-${Date.now()}-${count + 1}`)

    const crypto = require('crypto')
    const publicToken = data.isPublic ? crypto.randomBytes(16).toString('hex') : null

    const rfq = await prisma.rfq.create({
      data: {
        id,
        supplierId: data.isPublic ? null : data.supplierId,
        isPublic: data.isPublic || false,
        publicToken,
        status: data.status,
        
        items: {
          create: data.items.map((item, index) => ({
            id: generateSlug(`RFQI-${id}-${index}`),
            productId: item.product.id,
            quantity: item.quantity,
            
            comment: item.comment || null
          }))
        }
      }
    })

    revalidatePath("/rfq")
    return { success: true, id: rfq.id, publicToken }
  } catch (error: any) {
    console.error("Create RFQ Error:", error)
    return { error: error.message || "Failed to create RFQ" }
  }
}

export async function upsertDraftRfq(data: {
  id?: string
  supplierId?: string
  isPublic?: boolean
  status?: string
  expectedUpdatedAt?: Date
  items: RfqItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.isPublic && !data.supplierId) {
      return { error: "Must select a supplier if not public" }
    }

    if (data.id && data.expectedUpdatedAt) {
      const current = await prisma.rfq.findUnique({
        where: { id: data.id },
        select: { updatedAt: true }
      })
      
      if (current && current.updatedAt.getTime() > new Date(data.expectedUpdatedAt).getTime()) {
        return { error: "CONFLICT: Someone else has updated this RFQ since you opened it. Please refresh the page to see the latest changes." }
      }
    }

    let rfqId = data.id
    const finalStatus = data.status || "DRAFT"

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

    const crypto = require('crypto')
    
    if (!rfqId) {
      const count = await prisma.rfq.count()
      rfqId = generateSlug(`RFQ-${Date.now()}-${count + 1}`)
      
      const publicToken = data.isPublic ? crypto.randomBytes(16).toString('hex') : null

      await prisma.rfq.create({
        data: {
          id: rfqId,
          supplierId: data.isPublic ? null : data.supplierId,
          isPublic: data.isPublic || false,
          publicToken,
          status: finalStatus,
          
          items: {
            create: data.items.map((item, index) => ({
              id: generateSlug(`RFQI-${rfqId}-${index}`),
              productId: item.product.id,
              quantity: item.quantity,
              
              comment: item.comment || null
            }))
          }
        }
      })
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.rfqItem.deleteMany({
          where: { rfqId: rfqId }
        })
        
        // Note: we don't clear or change the public token here if they toggle it, 
        // to keep it simple, but we should generate one if they toggle to public and it doesn't have one
        const currentRfq = await tx.rfq.findUnique({ where: { id: rfqId }})
        let newToken = currentRfq?.publicToken
        if (data.isPublic && !newToken) {
          newToken = crypto.randomBytes(16).toString('hex')
        }

        await tx.rfq.update({
          where: { id: rfqId },
          data: {
            supplierId: data.isPublic ? null : data.supplierId,
            isPublic: data.isPublic || false,
            publicToken: newToken,
            status: finalStatus,
            
            items: {
              create: data.items.map((item, index) => ({
                id: generateSlug(`RFQI-${rfqId}-${index}`),
                productId: item.product.id,
                quantity: item.quantity,
                
                comment: item.comment || null
              }))
            }
          }
        })
      })
    }

    revalidatePath("/rfq")
    revalidatePath(`/rfq/${rfqId}`)
    return { success: true, id: rfqId }
  } catch (error: any) {
    console.error("Upsert Draft RFQ Error:", error)
    return { error: error.message || "Failed to save draft" }
  }
}

export async function deleteRfq(id: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.rfq.delete({
      where: { id }
    })

    revalidatePath("/rfq")
    return { success: true }
  } catch (error: any) {
    console.error("Delete RFQ Error:", error)
    return { error: error.message || "Failed to delete RFQ" }
  }
}

export async function updateRfqStatus(id: string, newStatus: string) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    await prisma.rfq.update({
      where: { id },
      data: { status: newStatus }
    })

    revalidatePath("/rfq")
    return { success: true }
  } catch (error: any) {
    console.error("Update RFQ Status Error:", error)
    return { error: error.message || "Failed to update RFQ status" }
  }
}

export async function submitRfqResponse(token: string, data: {
  vendorName: string
  vendorEmail?: string
  vendorPhone?: string
  items: { rfqItemId: string, unitPrice: number, leadTime?: string, remarks?: string }[]
}) {
  try {
    const rfq = await prisma.rfq.findUnique({
      where: { publicToken: token },
      include: { items: true }
    })

    if (!rfq) return { error: "Invalid RFQ token" }
    if (rfq.status === "COMPLETED") return { error: "This RFQ has already been closed" }

    // Try to match supplier by name
    const matchingSupplier = await prisma.supplier.findFirst({
      where: { name: { equals: data.vendorName } }
    })

    const response = await prisma.rfqVendorResponse.create({
      data: {
        rfqId: rfq.id,
        supplierId: matchingSupplier ? matchingSupplier.id : null,
        vendorName: data.vendorName,
        vendorEmail: data.vendorEmail,
        vendorPhone: data.vendorPhone,
        items: {
          create: data.items.map(item => ({
            rfqItemId: item.rfqItemId,
            unitPrice: item.unitPrice,
            leadTime: item.leadTime,
            remarks: item.remarks
          }))
        }
      }
    })

    // If we matched a supplier, update ProductSupplier history
    if (matchingSupplier) {
      for (const item of data.items) {
        const rfqItem = rfq.items.find(i => i.id === item.rfqItemId)
        if (rfqItem) {
          await prisma.productSupplier.upsert({
            where: {
              productId_supplierId: {
                productId: rfqItem.productId,
                supplierId: matchingSupplier.id
              }
            },
            update: { costPrice: item.unitPrice },
            create: {
              productId: rfqItem.productId,
              supplierId: matchingSupplier.id,
              costPrice: item.unitPrice
            }
          })
        }
      }
    }

    revalidatePath(`/rfq/${rfq.id}`)
    return { success: true }
  } catch (error: any) {
    console.error("Submit RFQ Response Error:", error)
    return { error: error.message || "Failed to submit response" }
  }
}

export async function convertRfqResponseToPo(responseId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const response = await prisma.rfqVendorResponse.findUnique({
      where: { id: responseId },
      include: {
        rfq: { include: { items: { include: { product: true } } } },
        supplier: true,
        items: true
      }
    })

    if (!response) return { error: "Response not found" }
    if (!response.supplier) {
      return { error: "Cannot convert to PO: Vendor is not a registered supplier. Please create a supplier with the exact name '" + response.vendorName + "' first." }
    }

    const count = await prisma.purchaseOrder.count()
    const poNumber = `PO-` + new Date().getFullYear() + `-` + String(count + 1).padStart(3, '0')
    const poId = generateSlug(poNumber)

    // Calculate totals
    let totalAmount = 0
    let totalGst = 0

    const poItemsData = response.items.map((responseItem, idx) => {
      const rfqItem = response.rfq.items.find(i => i.id === responseItem.rfqItemId)
      if (!rfqItem) throw new Error("Mismatched item")
      
      const amount = responseItem.unitPrice * rfqItem.quantity
      const gst = amount * (rfqItem.product.gstRate / 100)
      
      totalAmount += amount
      totalGst += gst

      return {
        id: generateSlug(`POI-${poId}-${idx}`),
        productId: rfqItem.productId,
        quantity: rfqItem.quantity,
        unitPrice: responseItem.unitPrice,
        gstRate: rfqItem.product.gstRate,
        comment: responseItem.remarks || undefined
      }
    })

    const po = await prisma.purchaseOrder.create({
      data: {
        id: poId,
        poNumber,
        supplierId: response.supplier.id,
        rfqId: response.rfqId,
        status: "DRAFT",
        totalAmount: Math.round(totalAmount),
        totalGst: Math.round(totalGst),
        items: {
          create: poItemsData
        }
      }
    })

    // Mark RFQ as completed
    await prisma.rfq.update({
      where: { id: response.rfqId },
      data: { status: "COMPLETED" }
    })

    revalidatePath("/purchase-orders")
    revalidatePath(`/rfq/${response.rfqId}`)
    return { success: true, id: po.id }
  } catch (error: any) {
    console.error("Convert RFQ to PO Error:", error)
    return { error: error.message || "Failed to convert RFQ to PO" }
  }
}

