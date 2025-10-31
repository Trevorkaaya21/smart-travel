// services/api/src/ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.GOOGLE_API_KEY
if (!API_KEY) {
  console.warn('[AI] GOOGLE_API_KEY not set — /v1/ai routes will return 501')
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

export async function aiSuggestText(prompt: string, system?: string) {
  if (!genAI) {
    const err: any = new Error('AI unavailable')
    err.code = 'no_key'
    throw err
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',          // fast & $-friendly
    systemInstruction: system || 'You are a concise travel assistant. Keep answers short and practical.',
  })

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return text.trim()
}