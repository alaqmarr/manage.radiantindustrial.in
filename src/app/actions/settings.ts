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
    const billingAddress = formData.get("billingAddress") ? String(formData.get("billingAddress")) : null
    const shippingAddress = formData.get("shippingAddress") ? String(formData.get("shippingAddress")) : null
    const email = formData.get("email") ? String(formData.get("email")) : null
    const phone = formData.get("phone") ? String(formData.get("phone")) : null
    const quotationMessage = formData.get("quotationMessage") ? String(formData.get("quotationMessage")) : null
    const rfqMessage = formData.get("rfqMessage") ? String(formData.get("rfqMessage")) : null
    const cocMessage = formData.get("cocMessage") ? String(formData.get("cocMessage")) : null
    const bottomDetails = formData.get("bottomDetails") ? String(formData.get("bottomDetails")) : null
    const smtpEmail = formData.get("smtpEmail") ? String(formData.get("smtpEmail")) : null
    const smtpPassword = formData.get("smtpPassword") ? String(formData.get("smtpPassword")) : null
    
    const bankName = formData.get("bankName") ? String(formData.get("bankName")) : null
    const accountName = formData.get("accountName") ? String(formData.get("accountName")) : null
    const accountNumber = formData.get("accountNumber") ? String(formData.get("accountNumber")) : null
    const ifscCode = formData.get("ifscCode") ? String(formData.get("ifscCode")) : null
    const swiftCode = formData.get("swiftCode") ? String(formData.get("swiftCode")) : null
    const bankAddress = formData.get("bankAddress") ? String(formData.get("bankAddress")) : null
    
    const gstNumber = formData.get("gstNumber") ? String(formData.get("gstNumber")) : null;
    const gstApiKey = formData.get("gstApiKey") ? String(formData.get("gstApiKey")) : null;
    const imageUrl = formData.get("logoUrl") as string | null
    const signatureUrl = formData.get("signatureUrl") as string | null

    const updateData = {
        companyName, address, billingAddress, shippingAddress, email, phone, quotationMessage, rfqMessage, cocMessage, bottomDetails,
        smtpEmail, smtpPassword, bankName, accountName, accountNumber, ifscCode, swiftCode, bankAddress,
        gstNumber, gstApiKey, ...(imageUrl ? { logoUrl: imageUrl } : {}), ...(signatureUrl ? { signatureUrl } : {})
    }

    const createData = {
        id: "default", companyName, address, billingAddress, shippingAddress, email, phone, quotationMessage, rfqMessage, cocMessage, bottomDetails,
        smtpEmail, smtpPassword, bankName, accountName, accountNumber, ifscCode, swiftCode, bankAddress,
        logoUrl: imageUrl, signatureUrl, gstNumber, gstApiKey,
    }

    await prisma.companySettings.upsert({
      where: { id: "default" },
      update: updateData,
      create: createData,
    })

    revalidatePath("/settings")
    revalidatePath("/quotations")
    return { success: true }
  } catch (error: any) {
    console.error("Settings error:", error)
    return { error: error.message || "Failed to save settings" }
  }
}
