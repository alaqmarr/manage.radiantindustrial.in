"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function saveCompanySettings(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    const companyName = String(formData.get("companyName"))
    const address = formData.get("address") ? String(formData.get("address")) : null
    const email = formData.get("email") ? String(formData.get("email")) : null
    const phone = formData.get("phone") ? String(formData.get("phone")) : null
    const quotationMessage = formData.get("quotationMessage") ? String(formData.get("quotationMessage")) : null
    const bottomDetails = formData.get("bottomDetails") ? String(formData.get("bottomDetails")) : null
    const imageUrl = formData.get("logoUrl") as string | null

    await prisma.companySettings.upsert({
      where: { id: "default" },
      update: {
        companyName,
        address,
        email,
        phone,
        quotationMessage,
        bottomDetails,
        ...(imageUrl ? { logoUrl: imageUrl } : {}), // Update logo only if a new one is provided
      },
      create: {
        id: "default",
        companyName,
        address,
        email,
        phone,
        quotationMessage,
        bottomDetails,
        logoUrl: imageUrl,
      },
    })

    revalidatePath("/settings")
    revalidatePath("/quotations")
    return { success: true }
  } catch (error: any) {
    console.error("Settings error:", error)
    return { error: error.message || "Failed to save settings" }
  }
}
