'use client'

import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import LoadingSpinner from './LoadingSpinner'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isError?: boolean
}

export default function ChatWidget({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'assistant', 
      content: "Hello! I'm Esus, your AI audit assistant. I can help you with audit procedures, compliance questions, risk assessment, and more. How can I assist you today?",
      timestamp: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsApiKey, setNeedsApiKey] = useState(false)
  const chatRef = useRef(null)

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    
    setLoading(true)
    setError(null)
    
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: input.trim(),
      timestamp: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, userMsg])
    const currentInput = input
    setInput('')
    
    try {
      // Use project-specific chat if projectId is provided, otherwise use general chat
      const endpoint = projectId ? `/api/chat/${projectId}` : '/api/chat/general'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: currentInput,
          conversation_history: messages.slice(-6) // Send last 6 messages for context
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.requiresApiKey) {
          setNeedsApiKey(true)
          throw new Error('OpenAI API key required. Please configure your API key in settings.')
        }
        throw new Error(errorData.error || 'Failed to get response')
      }

      const data = await response.json()
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message.content,
        timestamp: data.message.timestamp
      }
      
      setMessages(prev => [...prev, assistantMsg])
      
    } catch (error) {
      console.error('Chat error:', error)
      setError(error.message)
      // Add error message to chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      <button
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg w-16 h-16 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 hover:scale-110"
        onClick={() => setOpen(true)}
        title="Ask Esus - AI Audit Assistant"
        style={{ boxShadow: '0 8px 32px 0 rgba(37,99,235,0.3)' }}
      >
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      </button>

      {/* Chat Modal */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Esus AI Assistant</h3>
                  <p className="text-sm text-gray-500">
                    {projectId ? 'Project-specific chat' : 'General audit assistance'}
                  </p>
                </div>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setOpen(false)}
                title="Close Chat"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* API Key Notice */}
            {needsApiKey && (
              <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">OpenAI API Key Required</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      To use the AI chat feature, please configure your OpenAI API key in the application settings.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={clsx(
                    'max-w-[80%] rounded-2xl px-4 py-2',
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : msg.isError
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-gray-100 text-gray-900'
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={clsx(
                      'text-xs mt-1',
                      msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    )}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2">
                    <LoadingSpinner size="sm" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about audit procedures, compliance, or anything else..."
                  className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              {error && (
                <p className="text-red-600 text-sm mt-2">{error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}