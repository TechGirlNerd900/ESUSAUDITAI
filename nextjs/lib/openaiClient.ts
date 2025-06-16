import { OpenAI } from 'openai'
import { ChatMessage } from '@/types/supabase'

if (!process.env.AZURE_OPENAI_API_KEY) {
  throw new Error('AZURE_OPENAI_API_KEY is required')
}

if (!process.env.AZURE_OPENAI_ENDPOINT) {
  throw new Error('AZURE_OPENAI_ENDPOINT is required')
}

export const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': '2024-02-15-preview' },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY,
  },
})

export async function analyzeDocument(text: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert auditor analyzing documents. Provide analysis in JSON format with summary, findings, and recommendations.',
      },
      {
        role: 'user',
        content: text,
      },
    ],
  })

  return {
    summary: completion.choices[0]?.message?.content || '',
    findings: [],
    recommendations: [],
  }
}

export async function generateChatResponse(
  chatHistory: ChatMessage[],
  projectContext: any
) {
  const messages = chatHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are an AI assistant helping with audit document analysis.',
      },
      ...messages,
    ],
  })

  return completion.choices[0]?.message?.content || ''
}