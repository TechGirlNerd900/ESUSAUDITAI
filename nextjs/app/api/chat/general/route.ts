// General Chat API Endpoint - Not project-specific
// This allows users to chat with Esus AI assistant about general audit topics

import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { NextRequest, NextResponse } from 'next/server';
import { vertexAIService } from '@/lib/google/vertexAI';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  // Authenticate the user
  const auth = await authenticateApiRequest(request);
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { message, conversation_history = [] } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
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

Current user: ${auth.profile.first_name} ${auth.profile.last_name} (${auth.profile.role})`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message.trim() },
    ];

    // Call Vertex AI
    const response = await vertexAIService.generateChatResponse(messages);

    // Return the AI response
    return NextResponse.json({
      message: response.message,
      conversation_id: `general_${auth.user.id}_${Date.now()}`,
      usage: response.usage,
    });
  } catch (error) {
    console.error('General chat error:', error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}

// GET endpoint to provide chat configuration and requirements
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    available: true, // Vertex AI is always available if properly configured
    requiresApiKey: false, // Vertex AI uses service account authentication
    features: [
      'General audit assistance',
      'Compliance guidance',
      'Risk assessment help',
      'Audit procedure recommendations',
      'Document analysis and interpretation',
      'Financial statement analysis',
    ],
    user: {
      name: `${auth.profile.first_name} ${auth.profile.last_name}`,
      role: auth.profile.role,
    },
  });
}
