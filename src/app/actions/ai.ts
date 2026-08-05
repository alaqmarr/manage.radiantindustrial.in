"use server"

import { auth } from "@/auth"
import { CohereClient } from "cohere-ai"

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

    if (!process.env.COHERE_API_KEY) {
      return { error: "COHERE_API_KEY is not configured on the server." }
    }

    const cohere = new CohereClient({
      token: process.env.COHERE_API_KEY
    })

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
4. Provide known contact details, phone numbers, or website links of real providers, stockists, and suppliers in this region that handle this brand.
5. Provide a realistic image URL of this exact product (or highly similar industrial equivalents). Format them as Markdown images, e.g., \`![Image Description](actual_image_url)\`.

Important Requirements:
- Format your response beautifully and professionally in Markdown.
- Ensure the supplier contacts and links are as accurate as possible based on your training data.
    `

    const response = await cohere.chat({
      model: "command-r-plus",
      message: prompt
    })

    return { success: true, text: response.text }
  } catch (error: any) {
    console.error("Cohere Error:", error)
    return { error: error.message || "Failed to generate AI response." }
  }
}
