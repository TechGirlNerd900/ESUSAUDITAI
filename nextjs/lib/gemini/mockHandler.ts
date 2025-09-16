import { ChatMessage } from '@/types/supabase';
import { IS_DEVELOPMENT } from '../core/constants';

export function getMockResponse(messages: ChatMessage[]) {
  if (!IS_DEVELOPMENT) return null;

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return {
      answer: '[DEV MODE] No message provided.',
      citations: [],
    };
  }
  
  return {
    answer: `[DEV MODE] I received your message: "${lastMessage.content}"\n\nThis is a mock response since GEMINI_API_KEY is not configured. In production, this would be processed by the Gemini AI model.`,
    citations: [],
  };
}