"use server"

import { auth } from "@/auth"
import { GoogleGenAI } from "@google/genai"

export async function askGeminiProductDetails(product: {
  description: string
  make: string
  model: string
  specification: string
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      return { error: "Unauthorized" }
    }

    if (!process.env.GEMINI_API_KEY) {
      return { error: "GEMINI_API_KEY is not configured on the server." }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const prompt = `
You are an expert industrial procurement assistant in Hyderabad, India. 
The user is asking about the following industrial product:
- **Description:** ${product.description}
- **Make/Brand:** ${product.make || 'Not specified'}
- **Model:** ${product.model || 'Not specified'}
- **Specifications:** ${product.specification || 'Not specified'}

Provide a highly professional, detailed explanation of:
1. What this product is used for in industrial/commercial applications.
2. Key specifications or quality metrics to look out for.
3. A specific guide on where to source this in Ranigunj, Secunderabad, and the broader Hyderabad market. 
4. Provide **actual contact details, phone numbers, or website links** of real providers, stockists, and suppliers in this region. Use Google Search to find this live information.
5. Provide actual image URLs of this exact product (or highly similar industrial equivalents) found via Google Search. Format them as Markdown images, e.g., \`![Image Description](actual_image_url)\`. Do NOT use placeholders.

Important Requirements:
- Format your response beautifully and professionally in Markdown.
- Ensure the supplier contacts and links are as accurate as possible based on live search data.
    `

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    })

    return { success: true, text: response.text }
  } catch (error: any) {
    console.error("Gemini Error:", error)
    return { error: error.message || "Failed to generate AI response." }
  }
}
