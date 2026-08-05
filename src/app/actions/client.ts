"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { generateSlug } from "@/lib/slugify"

export async function createClient(data: { name: string; contact?: string }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.name?.trim()) {
      return { error: "Client name is required" }
    }

    const id = generateSlug(data.name)

    const client = await prisma.client.create({
      data: {
        id,
        name: data.name,
        contact: data.contact,
      }
    })

    revalidatePath("/quotations/new")
    revalidatePath("/clients")
    
    return { success: true, client }
  } catch (error: any) {
    console.error("Create Client Error:", error)
    return { error: error.message || "Failed to create client" }
  }
}

export async function updateClient(id: string, data: { name: string; contact?: string }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!data.name?.trim()) {
      return { error: "Client name is required" }
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: data.name,
        contact: data.contact,
      }
    })

    revalidatePath("/quotations")
    revalidatePath("/clients")
    
    return { success: true, client }
  } catch (error: any) {
    console.error("Update Client Error:", error)
    return { error: error.message || "Failed to update client" }
  }
}
