import type { ProfileField } from '@/types';

const SYSTEM_PROMPT = `You are a form analysis expert. Your task is to analyze HTML form elements and map each input field to the most appropriate user profile key.

Rules:
- Each input element has a data-ref attribute (e.g. data-ref="1").
- You will receive a list of available profile keys.
- For each input element, determine which profile key best matches based on surrounding context (labels, placeholders, field names, structure).
- Return a JSON object with "mappings" (array of {ref, key}) and "unmapped" (array of ref strings for fields you cannot confidently map).
- Only use keys from the provided list.
- Be precise: do not guess if the context is ambiguous.
- Respond ONLY with valid JSON.`;

/**
 * Build the user prompt containing available keys and sanitized HTML.
 */
export function buildPrompt(
  sanitizedHtml: string,
  fields: ProfileField[],
): { systemPrompt: string; userPrompt: string } {
  const publicKeys = fields
    .filter((f) => f.isPublic && f.value)
    .map((f) => `  ${f.key}: "${f.value}"`)
    .join('\n');

  const privateKeys = fields
    .filter((f) => !f.isPublic)
    .map((f) => `  ${f.key}`)
    .join('\n');

  const userPrompt = `## Available Profile Keys

### Public keys (with values):
${publicKeys || '  (none)'}

### Private keys (key names only):
${privateKeys || '  (none)'}

## Form HTML

\`\`\`html
${sanitizedHtml}
\`\`\`

---

## Expected Output Format

\`\`\`json
{
  "mappings": [
    { "ref": "1", "key": "lastName" },
    { "ref": "2", "key": "firstName" }
  ],
  "unmapped": ["5"]
}
\`\`\`

Analyze the form HTML above and map each input element (identified by data-ref) to the most appropriate profile key.`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}
