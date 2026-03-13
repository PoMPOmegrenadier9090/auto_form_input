import type { LLMProviderConfig } from '@/types';
import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai';

export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.name) {
    case 'openai':
      return new OpenAIProvider(config);
    default:
      return new OpenAIProvider(config);
  }
}
