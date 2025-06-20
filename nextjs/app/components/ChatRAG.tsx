'use client'

import React, { useState, useRef } from 'react'
import clsx from 'clsx'

export default function ChatRAG({ projectId, user }) {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: "Hello! I'm Esus, your AI audit assistant. How can I help you with your documents today?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceModal, setSourceModal] = useState<{ text: string, doc: string } | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  const sendMessage = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    const userMsg = { role: 'user', content: input }
    setMessages(msgs => [...msgs, userMsg])
    setInput('')
    try {
      const res = await fetch(`/api/chat/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const aiMsg = { role: 'assistant', content: data.message.content, citations: data.citations }
      setMessages(msgs => [...msgs, aiMsg])
      setTimeout(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
      }, 100)
    } catch (e: any) {
      setError(e.message || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage()
  }

  return (
    <div className="w-full max-w-2xl h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path></svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Ask Esus</h1>
            <p className="text-sm text-gray-500 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Online
            </p>
          </div>
        </div>
      </header>
      {/* Chat Messages */}
      <main ref={chatRef} className="flex-1 p-6 overflow-y-auto space-y-6 bg-blue-50/30">
        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : '')}>
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path></svg>
              </div>
            )}
            <div className={clsx('relative p-4 rounded-xl max-w-md', msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-50 text-gray-900 rounded-tl-none')}>
              <div className="message-content text-sm whitespace-pre-wrap">{msg.content}</div>
              {/* Citations for AI answers */}
              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.citations.map((c: any, idx: number) => (
                    <button
                      key={idx}
                      className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition"
                      onClick={() => setSourceModal({ text: c.textContent, doc: c.sourceDocument })}
                      title={`View source: ${c.sourceDocument}`}
                    >
                      Source {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <img src="https://placehold.co/32x32/E2E8F0/1E293B?text=U" alt="User Avatar" className="w-8 h-8 rounded-full flex-shrink-0" />
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-blue-600 text-sm mt-2"><span className="loader"></span> Esus is thinking...</div>
        )}
        {error && <div className="text-red-500 text-xs mt-2">{error}</div>}
      </main>
      {/* Input Area */}
      <footer className="p-4 border-t border-gray-200 bg-white">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask a follow-up question..."
            className="w-full bg-gray-100 text-gray-900 placeholder:text-gray-400 rounded-lg py-3 pl-4 pr-12 border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400 transition-shadow"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-gray-400 hover:text-blue-600 transition-colors"
            onClick={sendMessage}
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">EsusAI can make mistakes. Consider checking important information.</p>
      </footer>
      {/* Source Snippet Modal */}
      {sourceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setSourceModal(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-lg font-semibold mb-2">Source Snippet</h3>
            <div className="mb-2 text-xs text-gray-500">{sourceModal.doc}</div>
            <pre className="bg-gray-50 p-2 rounded text-xs text-gray-700 max-h-48 overflow-auto mb-4 whitespace-pre-wrap">{sourceModal.text}</pre>
          </div>
        </div>
      )}
      <style jsx>{`
        .loader {
          width: 18px;
          height: 18px;
          border: 2px solid #2563eb;
          border-bottom-color: transparent;
          border-radius: 50%;
          display: inline-block;
          box-sizing: border-box;
          animation: rotation 1s linear infinite;
        }
        @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
} 