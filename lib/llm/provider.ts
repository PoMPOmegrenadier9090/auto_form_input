import type { LLMProviderConfig } from '@/types';
import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.name) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    default:
      return new OpenAIProvider(config);
  }
}
