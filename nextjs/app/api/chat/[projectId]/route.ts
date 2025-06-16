import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openaiClient'

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { message } = await request.json()
    const projectId = params.projectId

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Check project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, description, created_by, assigned_to')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const hasAccess = 
      project.created_by === user.id || 
      project.assigned_to?.includes(user.id)

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get project context (documents and analysis)
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        id,
        name,
        original_name,
        analysis_results (
          extracted_data,
          ai_summary,
          red_flags,
          highlights
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'analyzed')

    // Get recent chat history for context
    const { data: chatHistory } = await supabase
      .from('chat_history')
      .select('question, answer')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Build context for AI
    const contextInfo = {
      project: {
        name: project.name,
        description: project.description
      },
      documents: documents?.map(doc => ({
        name: doc.original_name,
        analysis: doc.analysis_results?.[0]
      })) || [],
      recentChat: chatHistory || []
    }

    // Create AI prompt with context
    const systemPrompt = `
You are Esus, an AI audit assistant helping with the audit project "${project.name}". 
You have access to analyzed documents and project context. Provide helpful, accurate, and professional responses.

Project Context:
${JSON.stringify(contextInfo, null, 2)}

Guidelines:
- Be helpful and professional
- Reference specific documents when relevant
- If you don't have enough information, say so
- Focus on audit-related insights and recommendations
`

    const userPrompt = message

    // Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'

    // Save chat history
    const { data: chatRecord, error: chatError } = await supabase
      .from('chat_history')
      .insert([
        {
          project_id: projectId,
          user_id: user.id,
          question: message,
          answer: aiResponse,
          context_documents: documents?.map(d => d.id) || []
        }
      ])
      .select()
      .single()

    if (chatError) {
      console.error('Error saving chat history:', chatError)
      // Don't fail the request if chat history save fails
    }

    return NextResponse.json({
      answer: aiResponse,
      chatId: chatRecord?.id,
      contextDocuments: documents?.length || 0
    })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const projectId = params.projectId

    // Get chat history
    const { data: chatHistory, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ chatHistory })

  } catch (error) {
    console.error('Get chat history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}