import { search } from 'duck-duck-scrape'
import { CohereClient } from "cohere-ai"
import 'dotenv/config'

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY })

async function run() {
  try {
    const q = "Polycab 3 Core 1.5 Sqmm Copper Flexible Cable stockists suppliers in Ranigunj Secunderabad Hyderabad"
    const searchResults = await search(q, { safeSearch: "off" })
    const resultsContext = searchResults.results.slice(0, 5).map(r => `Title: ${r.title}\nSnippet: ${r.description}\nURL: ${r.url}`).join('\n\n')
    
    console.log("Search Context:", resultsContext)
    
    const prompt = `
    You are an expert industrial procurement assistant in Hyderabad, India. 
    The user is asking about the following industrial product:
    - **Description:** 3 Core 1.5 Sqmm Copper Flexible Cable
    - **Make/Brand:** Polycab
    
    I have searched the web for suppliers in Ranigunj/Hyderabad. Here are the search results:
    ---
    ${resultsContext}
    ---
    
    Provide a professional explanation of:
    1. A specific guide on where to source this in Ranigunj/Hyderabad based ONLY on the search results provided.
    2. Provide actual contact details, phone numbers, or website links found in the search results.
    `
    
    const response = await cohere.chat({
      model: "command-r-plus",
      message: prompt
    })
    console.log("SUCCESS:", response.text)
  } catch (e) {
    console.error("ERROR:", e)
  }
}
run()
