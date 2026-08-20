"use server"

import { prisma } from "@/lib/prisma"

export async function verifyGSTAction(gstNo: string) {
  try {
    // Fetch the API key from settings
    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" }
    })

    if (!settings || !settings.gstApiKey) {
      return { error: "GST API Key is not configured in Settings. Please add it first." }
    }

    // Call Appyflow API
    const response = await fetch('https://appyflow.in/api/verifyGST', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gstNo,
        key_secret: settings.gstApiKey
      }),
      // Don't cache GST validation as it's real-time
      cache: 'no-store'
    })

    if (!response.ok) {
      return { error: `Failed to fetch GST details: ${response.statusText}` }
    }

    const data = await response.json()

    if (data.error) {
      return { error: data.message || "Invalid GST Number or API Error." }
    }

    if (!data.taxpayerInfo) {
      return { error: "No taxpayer info found for this GST number." }
    }

    // Format the response for our forms
    const info = data.taxpayerInfo
    const name = info.tradeNam || info.lgnm
    
    // Construct address
    const adr = info.pradr?.addr
    let address = ""
    let location = ""
    
    if (adr) {
      const parts = [adr.bno, adr.bnm, adr.st, adr.loc, adr.city, adr.dst, adr.stcd, adr.pncd]
      address = parts.filter(Boolean).join(", ")
      location = [adr.dst || adr.city, adr.stcd].filter(Boolean).join(", ")
    }

    return { 
      success: true, 
      data: {
        name,
        address,
        location,
        legalName: info.lgnm,
        status: info.sts
      }
    }

  } catch (error: any) {
    console.error("GST Verification Error:", error)
    return { error: error.message || "An unexpected error occurred during GST verification." }
  }
}
