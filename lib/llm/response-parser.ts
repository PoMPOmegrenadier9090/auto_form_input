import type {
  InputPlanStep,
  LLMAnalysisResult,
  ValueSource,
} from '@/types';
import { debugGroup, debugLog } from '@/lib/debug';

/**
 * Parse and validate the LLM JSON response.
 */
export function parseResponse(raw: string): LLMAnalysisResult {
  debugGroup('[AutoFill][LLM] raw response', () => {
    debugLog(raw);
  });

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
  const steps = validateSteps(obj.steps);
  const unmapped = validateUnmapped(obj.unmapped);

  if (steps.length === 0) {
    throw new Error('LLM response does not contain valid "steps"');
  }

  const result = { steps, unmapped };
  debugGroup('[AutoFill][LLM] parsed response', () => {
    debugLog(result);
  });
  return result;
}

function validateUnmapped(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

function validateSteps(raw: unknown): InputPlanStep[] {
  if (!Array.isArray(raw)) return [];

  const steps: InputPlanStep[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const step = item as Record<string, unknown>;

    if (typeof step.ref !== 'string' || typeof step.operation !== 'string') continue;

    const base = {
      ref: step.ref,
      confidence: typeof step.confidence === 'number' ? step.confidence : 1,
      missingKeys: Array.isArray(step.missingKeys)
        ? step.missingKeys.filter((k): k is string => typeof k === 'string')
        : undefined,
    };

    if (step.operation === 'direct' || step.operation === 'select_match') {
      if (typeof step.key !== 'string') continue;
      steps.push({
        ...base,
        operation: step.operation,
        key: step.key,
        valueSource: isValueSource(step.valueSource) ? step.valueSource : 'privatePlaceholder',
        literalValue: typeof step.literalValue === 'string' ? step.literalValue : undefined,
      });
      continue;
    }

    if (step.operation === 'concat') {
      if (!Array.isArray(step.keys)) continue;
      const keys = step.keys.filter((k): k is string => typeof k === 'string');
      if (keys.length === 0) continue;
      steps.push({
        ...base,
        operation: 'concat',
        keys,
        separator: typeof step.separator === 'string' ? step.separator : '',
      });
      continue;
    }

    if (step.operation === 'template') {
      if (typeof step.template !== 'string') continue;
      steps.push({
        ...base,
        operation: 'template',
        template: step.template,
      });
      continue;
    }

    if (step.operation === 'split') {
      if (typeof step.key !== 'string') continue;
      if (typeof step.separator !== 'string') continue;
      if (typeof step.index !== 'number' || !Number.isInteger(step.index) || step.index < 0) continue;
      steps.push({
        ...base,
        operation: 'split',
        key: step.key,
        separator: step.separator,
        index: step.index,
        trim: typeof step.trim === 'boolean' ? step.trim : true,
      });
    }
  }

  return steps;
}

function isValueSource(value: unknown): value is ValueSource {
  return (
    value === 'privatePlaceholder' ||
    value === 'publicValue' ||
    value === 'literal'
  );
}
