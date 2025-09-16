import { IS_DEVELOPMENT } from '../core/constants';

export function getMockAnalysisResponse(documentId: string) {
  if (!IS_DEVELOPMENT) return null;

  return {
    status: 'completed',
    analysis: {
      documentId,
      content: '[DEV MODE] This is a mock document analysis response. Configure GEMINI_API_KEY for production use.',
      metadata: {
        timestamp: new Date().toISOString(),
        mode: 'development',
      }
    }
  };
}