import { ChatMessage } from '@/types/supabase';
import { GeminiServices } from './gemini/geminiServices';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

interface SearchResultItem {
  textContent: string;
  sourceDocument: string;
}

export async function generateChatResponse(
  chatHistory: ChatMessage[],
  projectContext: any,
  query?: string,
  projectId?: string
) {
  // If query and projectId are provided, use RAG pipeline
  let contextChunks: SearchResultItem[] = [];
  if (query && projectId) {
    // For server-side usage, we need to pass a cookieStore
    // This is a simplified example - in practice, you'd get this from the request
    const mockCookieStore = {
      getAll: () => [],
      setAll: () => {},
    };
    const gemini = new GeminiServices(mockCookieStore);
    contextChunks = await gemini.search(query, projectId);
  }
  // Build guarded prompt if contextChunks exist
  let systemPrompt = 'You are an AI assistant helping with audit document analysis.';
  if (contextChunks.length > 0) {
    const context = contextChunks
      .map((c) => `Source: ${c.sourceDocument}, Content: ${c.textContent}`)
      .join('\n---\n');
    systemPrompt = `You are a precise audit assistant. Answer the user's query based ONLY on the provided context below.
Do not make assumptions or use any external knowledge.
If the provided context does not contain the information needed to answer the query, you MUST respond with:
"I cannot answer this question based on the provided documents."

CONTEXT:
${context}

USER QUERY:
${query}

ANSWER:`;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const chat = model.startChat({
    history: chatHistory.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: 1000,
    },
  });

  const result = await chat.sendMessage(query || chatHistory[chatHistory.length - 1].content);
  const response = await result.response;
  const text = response.text();

  return {
    answer: text,
    citations: contextChunks,
  };
}
