import { createClient } from '@/utils/supabase/server'
import { ChatMessage } from '@/types/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { generateChatResponse } from '@/lib/openaiClient'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Await params since they're now a Promise in newer Next.js versions
    const { projectId } = await params
    
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Project fetch error:', projectError)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get message from request
    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { message } = requestBody

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Store user message
    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert({
        project_id: projectId,
        user_id: user.id,
        content: message.trim(),
        role: 'user'
      })

    if (chatError) {
      console.error('Chat message insert error:', chatError)
      throw new Error('Failed to store user message: ' + chatError.message)
    }

    // Get chat history
    const { data: chatHistory, error: historyError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (historyError) {
      console.error('Chat history fetch error:', historyError)
      throw new Error('Failed to fetch chat history: ' + historyError.message)
    }

    // Generate AI response
    let aiResponse: string
    try {
      aiResponse = await generateChatResponse(chatHistory as ChatMessage[], project)
    } catch (aiError) {
      console.error('AI response generation error:', aiError)
      aiResponse = "I'm sorry, I'm having trouble generating a response right now. Please try again."
    }

    // Store AI response
    const { data: aiMessage, error: aiError } = await supabase
      .from('chat_messages')
      .insert({
        project_id: projectId,
        content: aiResponse,
        role: 'assistant'
      })
      .select()
      .single()

    if (aiError) {
      console.error('AI message insert error:', aiError)
      throw new Error('Failed to store AI response: ' + aiError.message)
    }

    return NextResponse.json({ message: aiMessage })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Await params since they're now a Promise in newer Next.js versions
    const { projectId } = await params
    
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Project fetch error:', projectError)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get chat history
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Messages fetch error:', messagesError)
      throw new Error('Failed to fetch messages: ' + messagesError.message)
    }

    return NextResponse.json({ messages: messages || [] })

  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch chat history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}