import type { LLMAnalysisResult } from '@/types';

export interface LLMProvider {
  analyze(prompt: string, systemPrompt: string): Promise<LLMAnalysisResult>;
}
