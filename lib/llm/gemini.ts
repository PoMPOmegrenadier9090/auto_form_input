import type { LLMProviderConfig, LLMAnalysisResult } from '@/types';
import type { LLMProvider } from './types';
import { parseResponse } from './response-parser';

export class GeminiProvider implements LLMProvider {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  async analyze(
    prompt: string,
    systemPrompt: string,
  ): Promise<LLMAnalysisResult> {
    const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const model = this.config.model || 'gemini-2.0-flash';
    const endpoint = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: this.config.temperature ?? 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const content = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim();

    if (!content) {
      throw new Error('Empty response from Gemini');
    }

    return parseResponse(content);
  }
}
