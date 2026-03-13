import type { LLMAnalysisResult, LLMMapping } from '@/types';

/**
 * Parse and validate the LLM JSON response.
 */
export function parseResponse(raw: string): LLMAnalysisResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('LLM response is not an object');
  }

  const obj = parsed as Record<string, unknown>;
  const mappings = validateMappings(obj.mappings);
  const unmapped = validateUnmapped(obj.unmapped);

  return { mappings, unmapped };
}

function validateMappings(raw: unknown): LLMMapping[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
    .filter((item) => typeof item.ref === 'string' && typeof item.key === 'string')
    .map((item) => ({
      ref: item.ref as string,
      key: item.key as string,
      confidence: typeof item.confidence === 'number' ? item.confidence : 1.0,
    }));
}

function validateUnmapped(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}
