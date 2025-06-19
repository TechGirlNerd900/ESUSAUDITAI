import { OpenAI } from 'openai'
import { ChatMessage } from '@/types/supabase'
import { AzureServices } from './azureServices.js'

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
  projectContext: any,
  query?: string,
  projectId?: string
) {
  // If query and projectId are provided, use RAG pipeline
  let contextChunks = []
  if (query && projectId) {
    const azure = new AzureServices()
    contextChunks = await azure.searchCognitive(query, projectId)
  }
  // Build guarded prompt if contextChunks exist
  let systemPrompt = 'You are an AI assistant helping with audit document analysis.'
  if (contextChunks.length > 0) {
    const context = contextChunks.map(c => `Source: ${c.sourceDocument}, Content: ${c.textContent}`).join('\n---\n')
    systemPrompt = `You are a precise audit assistant. Answer the user's query based ONLY on the provided context below.\nDo not make assumptions or use any external knowledge.\nIf the provided context does not contain the information needed to answer the query, you MUST respond with:\n\"I cannot answer this question based on the provided documents.\"\n\nCONTEXT:\n${context}\n\nUSER QUERY:\n${query}\n\nANSWER:`
  }
  const messages = chatHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
    ],
  })
  return {
    answer: completion.choices[0]?.message?.content || '',
    citations: contextChunks
  }
}