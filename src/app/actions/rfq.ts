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
  supplierId: string
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

    const rfq = await prisma.rfq.create({
      data: {
        id,
        supplierId: data.supplierId,
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
    return { success: true, id: rfq.id }
  } catch (error: any) {
    console.error("Create RFQ Error:", error)
    return { error: error.message || "Failed to create RFQ" }
  }
}

export async function upsertDraftRfq(data: {
  id?: string
  supplierId: string
  status?: string
  expectedUpdatedAt?: Date
  items: RfqItemData[]
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
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

    if (!rfqId) {
      const count = await prisma.rfq.count()
      rfqId = generateSlug(`RFQ-${Date.now()}-${count + 1}`)

      await prisma.rfq.create({
        data: {
          id: rfqId,
          supplierId: data.supplierId,
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

        await tx.rfq.update({
          where: { id: rfqId },
          data: {
            supplierId: data.supplierId,
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
    return { success: true, id: rfqId }
  } catch (error: any) {
    console.error("Upsert Draft RFQ Error:", error)
    return { error: error.message || "Failed to save RFQ draft" }
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
