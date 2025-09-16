interface AnalysisData {
  tables?: any[];
  keyValuePairs?: Record<string, any>;
  content?: string;
  [key: string]: any;
}

const CONFIDENCE_WEIGHTS = {
  BASE_SCORE: 0.5,
  TABLE_DATA: 0.2,
  KEY_VALUE_PAIRS: 0.2,
  CONTENT_LENGTH: 0.1,
} as const;

const CONFIDENCE_THRESHOLDS = {
  MIN_CONTENT_LENGTH: 100,
} as const;

function calculateTableScore(tables?: any[]): number {
  return tables && tables.length > 0 ? CONFIDENCE_WEIGHTS.TABLE_DATA : 0;
}

function calculateKeyValueScore(keyValuePairs?: Record<string, any>): number {
  return keyValuePairs && Object.keys(keyValuePairs).length > 0 
    ? CONFIDENCE_WEIGHTS.KEY_VALUE_PAIRS 
    : 0;
}

function calculateContentScore(content?: string): number {
  return content && content.length >= CONFIDENCE_THRESHOLDS.MIN_CONTENT_LENGTH 
    ? CONFIDENCE_WEIGHTS.CONTENT_LENGTH 
    : 0;
}

export function calculateConfidenceScore(analysisData: AnalysisData): number {
  try {
    const score = CONFIDENCE_WEIGHTS.BASE_SCORE +
      calculateTableScore(analysisData.tables) +
      calculateKeyValueScore(analysisData.keyValuePairs) +
      calculateContentScore(analysisData.content);

    return Math.min(score, 1.0);
  } catch (error) {
    console.error('Error calculating confidence score:', error);
    return CONFIDENCE_WEIGHTS.BASE_SCORE;
  }
}