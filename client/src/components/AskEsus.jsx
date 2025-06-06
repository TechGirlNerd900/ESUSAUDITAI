import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'react-query';
import toast from 'react-hot-toast';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  UserIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import { chatService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const AskEsus = ({ projectId }) => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);

  // Get chat history
  const { data: historyData } = useQuery(
    ['chat-history', projectId],
    () => chatService.getChatHistory(projectId),
    {
      onSuccess: (data) => {
        setChatHistory(data.chatHistory || []);
      }
    }
  );

  // Get suggested questions
  const { data: suggestedData } = useQuery(
    ['suggested-questions', projectId],
    () => chatService.getSuggestedQuestions(projectId)
  );

  const askEsusMutation = useMutation(
    ({ projectId, question }) => chatService.askEsus(projectId, question),
    {
      onSuccess: (data) => {
        const newMessage = {
          id: data.chatId,
          question: question,
          answer: data.answer,
          user: { firstName: 'You' },
          createdAt: new Date().toISOString()
        };
        setChatHistory(prev => [newMessage, ...prev]);
        setQuestion('');
      },
      onError: (error) => {
        toast.error(error.error || 'Failed to get response from Esus');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    askEsusMutation.mutate({ projectId, question: question.trim() });
  };

  const handleSuggestedQuestion = (suggestedQuestion) => {
    setQuestion(suggestedQuestion);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">Ask Esus</h3>
            <p className="text-sm text-gray-500">AI-powered audit assistant</p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="text-center py-8">
            <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No conversations yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Ask Esus about your audit findings, compliance issues, or financial analysis.
            </p>
          </div>
        ) : (
          chatHistory.map((chat) => (
            <div key={chat.id} className="space-y-3">
              {/* User Question */}
              <div className="chat-message user">
                <div className="flex items-start justify-end">
                  <div className="chat-bubble user max-w-xs lg:max-w-md">
                    {chat.question}
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <UserIcon className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Esus Answer */}
              <div className="chat-message assistant">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600">
                      <ComputerDesktopIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-2 chat-bubble assistant max-w-xs lg:max-w-md">
                    <div className="whitespace-pre-wrap">{chat.answer}</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {askEsusMutation.isLoading && (
          <div className="chat-message assistant">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600">
                  <ComputerDesktopIcon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="ml-2 chat-bubble assistant">
                <LoadingSpinner size="sm" />
                <span className="ml-2 text-sm">Esus is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {suggestedData?.suggestedQuestions && suggestedData.suggestedQuestions.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Suggested questions:</h4>
          <div className="flex flex-wrap gap-2">
            {suggestedData.suggestedQuestions.slice(0, 4).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedQuestion(suggestion)}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Esus about your audit findings..."
            className="flex-1 input"
            disabled={askEsusMutation.isLoading}
          />
          <button
            type="submit"
            disabled={!question.trim() || askEsusMutation.isLoading}
            className="btn-primary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AskEsus;