import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6LEJGliip3m074PQI_x3YEj8ygvAuxf5budITYe0gfYsw" })

const prompt = `
You are an expert industrial procurement assistant in Hyderabad, India. 
The user is asking about the following industrial product:
- **Description:** 3 Core 1.5 Sqmm Copper Flexible Cable
- **Make/Brand:** Polycab
- **Model:** Not specified
- **Specifications:** FRLS, 1100V grade

Provide a highly professional, detailed explanation of:
1. What this product is used for in industrial/commercial applications.
2. Key specifications or quality metrics to look out for.
3. A specific guide on where to source this in Ranigunj, Secunderabad, and the broader Hyderabad market. 
4. Provide actual contact details, phone numbers, or website links of real providers, stockists, and suppliers in this region. Use Google Search to find this live information.
5. Provide actual image URLs of this exact product (or highly similar industrial equivalents) found via Google Search. Format them as Markdown images, e.g., \`![Image Description](actual_image_url)\`. Do NOT use placeholders.
`

async function run() {
  try {
    console.log("Testing gemini-3.5-flash...")
    let response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    })
    console.log("gemini-3.5-flash SUCCESS!")
    // console.log(response.text)
  } catch (e) {
    console.error("gemini-3.5-flash ERROR:", e.message)
    
    try {
      console.log("\nFalling back to testing gemini-1.5-pro...")
      let response2 = await ai.models.generateContent({
        model: 'gemini-1.5-pro',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      })
      console.log("gemini-1.5-pro SUCCESS!")
      console.log(response2.text)
    } catch (e2) {
      console.error("gemini-1.5-pro ERROR:", e2.message)
    }
  }
}
run()
