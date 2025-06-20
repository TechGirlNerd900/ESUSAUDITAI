// General Chat API Endpoint - Not project-specific
// This allows users to chat with Esus AI assistant about general audit topics

import { authenticateApiRequest } from '@/lib/apiAuth'
import { NextRequest, NextResponse } from 'next/server'

// This should be replaced with the user's actual OpenAI API key
// Add this to environment variables: OPENAI_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

export async function POST(request: NextRequest) {
  // Authenticate the user
  const auth = await authenticateApiRequest(request)
  if (!auth.success) {
    return auth.response
  }

  try {
    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OpenAI API key not configured. Please provide your API key.',
        requiresApiKey: true
      }, { status: 400 })
    }

    const body = await request.json()
    const { message, conversation_history = [] } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Build conversation with system prompt
    const systemPrompt = `You are Esus, an expert AI audit assistant specializing in financial auditing, compliance, and risk assessment. You help auditors with:

- Document analysis and interpretation
- Risk identification and assessment  
- Compliance requirements (especially Nigerian standards like FRS, CAMA 2020)
- Audit procedures and methodologies
- Financial statement analysis
- Internal controls evaluation
- Fraud detection techniques

Provide helpful, accurate, and professional responses. When discussing specific regulations or standards, be precise. If you're unsure about something, say so rather than guessing.

Current user: ${auth.profile.first_name} ${auth.profile.last_name} (${auth.profile.role})`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message.trim() }
    ]

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      
      if (response.status === 401) {
        return NextResponse.json({
          error: 'Invalid OpenAI API key. Please check your configuration.',
          requiresApiKey: true
        }, { status: 400 })
      }
      
      return NextResponse.json(
        { error: 'Failed to generate AI response' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const aiMessage = data.choices[0]?.message?.content

    if (!aiMessage) {
      return NextResponse.json(
        { error: 'No response generated' },
        { status: 500 }
      )
    }

    // Return the AI response
    return NextResponse.json({
      message: {
        role: 'assistant',
        content: aiMessage,
        timestamp: new Date().toISOString()
      },
      conversation_id: `general_${auth.user.id}_${Date.now()}`,
      usage: data.usage
    })

  } catch (error) {
    console.error('General chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

// GET endpoint to provide chat configuration and requirements
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.success) {
    return auth.response
  }

  return NextResponse.json({
    available: !!OPENAI_API_KEY,
    requiresApiKey: !OPENAI_API_KEY,
    features: [
      'General audit assistance',
      'Compliance guidance',
      'Risk assessment help',
      'Audit procedure recommendations'
    ],
    user: {
      name: `${auth.profile.first_name} ${auth.profile.last_name}`,
      role: auth.profile.role
    }
  })
}