'use client';

import React, { useState, useRef } from 'react';
import clsx from 'clsx';
import Image from 'next/image';

interface ChatRAGProps {
  projectId: string;
  user: {
    id: string;
    email: string;
  };
}

export default function ChatRAG({ projectId, user }: ChatRAGProps) {
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm Esus, your AI audit assistant. I can help you analyze documents, find patterns, identify potential audit issues, and answer questions about your financial data. What would you like to explore?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceModal, setSourceModal] = useState<{ text: string; doc: string } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setLoading(true);
    setError(null);
    
    const userMsg = { role: 'user', content: userMessage };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput('');
    
    try {
      const res = await fetch(`/api/chat/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      
      const data = await res.json();
      
      const aiMsg = { 
        role: 'assistant', 
        content: data.message?.answer || data.message?.content || 'I received your message but couldn\'t generate a proper response.', 
        citations: data.citations || []
      };
      
      setMessages((msgs) => [...msgs, aiMsg]);
      
      // Smooth scroll to bottom
      setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.scrollTo({
            top: chatRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    } catch (e: any) {
      console.error('Chat error:', e);
      setError(e.message || 'Failed to send message. Please try again.');
      
      // Add error message to chat
      const errorMsg = {
        role: 'assistant',
        content: 'I\'m sorry, I encountered an error processing your request. Please try again or rephrase your question.',
        isError: true
      };
      setMessages((msgs) => [...msgs, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="w-full max-w-2xl h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="m12 14 4-4"></path>
              <path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
            </svg>
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
          <div
            key={i}
            className={clsx('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : '')}
          >
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="m12 14 4-4"></path>
                  <path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
                </svg>
              </div>
            )}
            <div
              className={clsx(
                'relative p-4 rounded-xl max-w-md',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-gray-50 text-gray-900 rounded-tl-none'
              )}
            >
              <div className={`message-content text-sm whitespace-pre-wrap ${
                msg.isError ? 'text-red-600 italic' : ''
              }`}>
                {msg.content}
              </div>
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
              <Image
                src="https://placehold.co/32x32/E2E8F0/1E293B?text=U"
                alt="User Avatar"
                width={32}
                height={32}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="bg-gray-50 rounded-xl rounded-tl-none p-4 max-w-md">
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <span className="loader"></span> Esus is analyzing your question...
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl rounded-tl-none p-4 max-w-md">
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          </div>
        )}
      </main>
      {/* Input Area */}
      <footer className="p-4 border-t border-gray-200 bg-white">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask about financial statements, audit procedures, compliance..."
            className="w-full bg-gray-100 text-gray-900 placeholder:text-gray-400 rounded-lg py-3 pl-4 pr-12 border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400 transition-shadow disabled:opacity-50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            maxLength={500}
          />
          <button
            className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-gray-400 hover:text-blue-600 transition-colors"
            onClick={sendMessage}
            disabled={loading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z"></path>
              <path d="M22 2 11 13"></path>
            </svg>
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">
          EsusAI can make mistakes. Consider checking important information.
        </p>
      </footer>
      {/* Source Snippet Modal */}
      {sourceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setSourceModal(null)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h3 className="text-lg font-semibold mb-2">Source Snippet</h3>
            <div className="mb-2 text-xs text-gray-500">{sourceModal.doc}</div>
            <pre className="bg-gray-50 p-2 rounded text-xs text-gray-700 max-h-48 overflow-auto mb-4 whitespace-pre-wrap">
              {sourceModal.text}
            </pre>
          </div>
        </div>
      )}
      <style>{`
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
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
