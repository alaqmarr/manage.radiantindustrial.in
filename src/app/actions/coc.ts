"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = 'COC-'
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

export async function createCoc(data: any) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const id = generateId()

    await prisma.certificateOfConformance.create({
      data: {
        id,
        cocNumber: data.cocNumber || id,
        clientId: data.clientId,
        quotationId: data.quotationId || null,
        clientPoRef: data.clientPoRef || null,
        date: data.date ? new Date(data.date) : new Date(),
        standardText: data.standardText || null,
        remarks: data.remarks || null,
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            batchNo: item.batchNo || null,
            remarks: item.remarks || null,
            attributes: item.attributes || null
          }))
        }
      }
    })

    revalidatePath("/cocs")
    return { success: true, id }
  } catch (error: any) {
    console.error("COC Creation Error:", error)
    return { error: error.message || "Failed to create COC" }
  }
}

export async function updateCoc(id: string, data: any) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    await prisma.$transaction(async (tx) => {
      // Update COC main details
      await tx.certificateOfConformance.update({
        where: { id },
        data: {
          cocNumber: data.cocNumber || id,
          clientId: data.clientId,
          quotationId: data.quotationId || null,
          clientPoRef: data.clientPoRef || null,
          date: data.date ? new Date(data.date) : new Date(),
          standardText: data.standardText || null,
          remarks: data.remarks || null,
        }
      })

      // Delete existing items
      await tx.cocItem.deleteMany({
        where: { cocId: id }
      })

      // Create new items
      if (data.items && data.items.length > 0) {
        await tx.cocItem.createMany({
          data: data.items.map((item: any) => ({
            cocId: id,
            productId: item.productId,
            quantity: Number(item.quantity),
            batchNo: item.batchNo || null,
            remarks: item.remarks || null,
            attributes: item.attributes || null
          }))
        })
      }
    })

    revalidatePath("/cocs")
    revalidatePath(`/cocs/${id}`)
    return { success: true }
  } catch (error: any) {
    console.error("COC Update Error:", error)
    return { error: error.message || "Failed to update COC" }
  }
}

export async function deleteCocs(ids: string[]) {
  try {
    const session = await auth()
    if (!session?.user) return { success: false, error: "Unauthorized" }

    await prisma.certificateOfConformance.deleteMany({
      where: { id: { in: ids } }
    })

    revalidatePath("/cocs")
    return { success: true }
  } catch (error: any) {
    console.error("COC Delete Error:", error)
    return { success: false, error: error.message || "Failed to delete COCs" }
  }
}

export async function updateCocStatus(id: string, status: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    await prisma.certificateOfConformance.update({
      where: { id },
      data: { status }
    })

    revalidatePath("/cocs")
    revalidatePath(`/cocs/${id}`)
    return { success: true }
  } catch (error: any) {
    return { error: "Failed to update status" }
  }
}
