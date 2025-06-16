import { createClient } from '@/utils/supabase/server'
import { ChatMessage } from '@/types/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { generateChatResponse } from '@/lib/openaiClient'

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify project access
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.projectId)
      .single()

    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get message from request
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Store user message
    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert({
        project_id: params.projectId,
        user_id: user.id,
        content: message,
        role: 'user'
      })

    if (chatError) throw chatError

    // Get chat history
    const { data: chatHistory } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: true })
      .limit(50)

    // Generate AI response
    const aiResponse = await generateChatResponse(chatHistory as ChatMessage[], project)

    // Store AI response
    const { data: aiMessage, error: aiError } = await supabase
      .from('chat_messages')
      .insert({
        project_id: params.projectId,
        content: aiResponse,
        role: 'assistant'
      })
      .select()
      .single()

    if (aiError) throw aiError

    return NextResponse.json({ message: aiMessage })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify project access
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.projectId)
      .single()

    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get chat history
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ messages })

  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    )
  }
}