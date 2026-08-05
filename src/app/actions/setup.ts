"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

export async function setupAction(formData: FormData) {
  try {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN" }
    })

    if (adminCount > 0) {
      return { error: "System already setup." }
    }

    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password || !name) {
      return { error: "Missing fields" }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "ADMIN"
      }
    })

    revalidatePath("/setup")
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "Failed to create setup user" }
  }
}
