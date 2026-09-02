"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function deleteProducts(ids: string[]) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Unauthorized" }

  try {
    await prisma.product.deleteMany({ where: { id: { in: ids } } })
    revalidatePath("/products")
    return { success: true }
  } catch (e: any) {
    if (e.code === 'P2003') {
      return { success: false, error: "Cannot delete products that are used in existing quotations or purchases." }
    }
    return { success: false, error: e.message }
  }
}

export async function deleteQuotations(ids: string[]) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Unauthorized" }

  try {
    // Due to relations, we delete quotation items first, but Prisma 7 with cascade deletes might handle it.
    // However, Prisma schema for QuotationItem usually has onDelete: Cascade. 
    // Let's assume Prisma handles it or we'll just delete Quotation
    await prisma.quotation.deleteMany({ where: { id: { in: ids } } })
    revalidatePath("/quotations")
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function deleteClients(ids: string[]) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Unauthorized" }

  try {
    await prisma.client.deleteMany({ where: { id: { in: ids } } })
    revalidatePath("/clients")
    return { success: true }
  } catch (e: any) {
    if (e.code === 'P2003') {
      return { success: false, error: "Cannot delete clients that have existing quotations." }
    }
    return { success: false, error: e.message }
  }
}

export async function deleteSuppliers(ids: string[]) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Unauthorized" }

  try {
    await prisma.supplier.deleteMany({ where: { id: { in: ids } } })
    revalidatePath("/suppliers")
    return { success: true }
  } catch (e: any) {
    if (e.code === 'P2003') {
      return { success: false, error: "Cannot delete suppliers that have existing purchases or product links." }
    }
    return { success: false, error: e.message }
  }
}

export async function deletePurchases(ids: string[]) {
  const session = await auth()
  if (!session?.user) return { success: false, error: "Unauthorized" }

  try {
    await prisma.purchase.deleteMany({ where: { id: { in: ids } } })
    revalidatePath("/purchases")
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function deleteRfqs(ids: string[]) {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Unauthorized' }

  try {
    await prisma.rfq.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/rfq')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function deletePurchaseOrders(ids: string[]) {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Unauthorized' }

  try {
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: ids } } })
    revalidatePath('/purchase-orders')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
