import React, { useState } from 'react'
import ChatRAG from './ChatRAG'

export default function ChatWidget({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* Floating Chat Button */}
      <button
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
        onClick={() => setOpen(true)}
        title="Ask Esus"
        style={{ boxShadow: '0 4px 24px 0 rgba(37,99,235,0.15)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path></svg>
      </button>
      {/* Chat Modal */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl h-[90vh] flex flex-col relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 z-10"
              onClick={() => setOpen(false)}
              title="Close Chat"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <ChatRAG projectId={projectId} user={null} />
          </div>
        </div>
      )}
    </>
  )
} 