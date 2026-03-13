import type { ProfileField } from '@/types';

const SYSTEM_PROMPT = `You are a form analysis expert. Your task is to analyze HTML form elements and produce an input execution plan for each field.

Rules:
- Each input element has a data-ref attribute (e.g. data-ref="1" or data-ref="c2-3"). Treat ref as an opaque string token.
- You will receive available keys separated into public keys (with values) and private keys (without values), and dummy values that represent the format of the actual values.
- You must output "steps". Each step has:
  - ref: input reference id
  - operation: one of direct | concat | template | select_match | split
  - confidence: number between 0 and 1
- For private keys, never generate literal secret values. Use key references via direct/concat/template.
- For public keys, you may use either key references or literal values derived from provided public values.
- If the provided value formats do not match the form fields, you can generate literal values, or for private keys, use split/concat to rearrange or combine them as needed.
- IMPORTANT: For address-like combined text fields (e.g. labels/placeholders containing "住所", "現住所", "所在地", "Address", "Street"), you MUST use template or concat.
- Do NOT use direct for combined address fields unless the field clearly represents only one part (e.g. prefecture-only, city-only, zip-only).
- For Japanese address text fields, prefer template with this order when available: prefecture -> city -> town -> address1 -> address2.
- If unsure, still provide the best step with lower confidence instead of dropping it. Try to fill as many fields as possible, even with low confidence.
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
    .map((f) => `  ${f.key}: "${(f.dummyValue ?? '').trim() || '(sample not provided)'}"`)
    .join('\n');

  const allKeys = fields.map((f) => f.key).join(', ');

  const has = (key: string) => fields.some((f) => f.key === key);
  const addressTemplateKeys = ['prefecture', 'city', 'town', 'address1', 'address2']
    .filter((k) => has(k));
  const addressTemplate = addressTemplateKeys.length > 0
    ? addressTemplateKeys.map((k) => `{${k}}`).join('')
    : '{prefecture}{city}{address1}{address2}';

  const userPrompt = `## Available Profile Keys

### Public keys (with values):
${publicKeys || '  (none)'}

### Private keys (format samples only, NOT real values):
${privateKeys || '  (none)'}

### All keys:
${allKeys || '(none)'}

## Operation Handbook (Strict)

- Use \`direct\`: single-part fields only (name, email, phone, prefecture-only select, city-only input).
- Use \`template\` or \`concat\`: combined fields requiring multiple parts.
- Use \`split\`: when one profile key needs to be split into multiple form fields (e.g. zip upper/lower, phone segments).
- \`split\` parameters:
  - key: source profile key
  - separator: split delimiter (e.g. "-", " ")
  - index: zero-based part index
  - trim: optional boolean
- Address-like combined fields MUST be \`template\` or \`concat\`.
- If using \`template\`, unknown placeholders should be omitted by returning only known keys.

Recommended address template for this profile:
\`\`\`
${addressTemplate}
\`\`\`

### Address examples

1) Combined address input (single text field labeled "住所"):
\`\`\`json
{
  "ref": "c1-5",
  "operation": "template",
  "template": "${addressTemplate}",
  "confidence": 0.92
}
\`\`\`

2) Prefecture dropdown only:
\`\`\`json
{
  "ref": "c1-2",
  "operation": "select_match",
  "key": "prefecture",
  "valueSource": "publicValue",
  "confidence": 0.95
}
\`\`\`

3) Split zip code example (source key: zipCode with "980-0811"):
\`\`\`json
{
  "ref": "c1-7",
  "operation": "split",
  "key": "zipCode",
  "separator": "-",
  "index": 0,
  "trim": true,
  "confidence": 0.9
}
\`\`\`

## Form HTML

\`\`\`html
${sanitizedHtml}
\`\`\`

---

## Expected Output Format

\`\`\`json
{
  "steps": [
    {
      "ref": "c1-1",
      "operation": "direct",
      "key": "lastName",
      "valueSource": "privatePlaceholder",
      "confidence": 0.98
    },
    {
      "ref": "c1-2",
      "operation": "template",
      "template": "{prefecture}{city}{address1}{address2}",
      "confidence": 0.87
    },
    {
      "ref": "c1-3",
      "operation": "select_match",
      "key": "prefecture",
      "valueSource": "publicValue",
      "confidence": 0.91
    }
  ],
  "unmapped": ["5"]
}
\`\`\`

Address guidance:
- For combined address fields, use template or concat (required).
- If some address parts are missing, use empty strings for missing placeholders.

Analyze the form HTML above and produce steps for each input element (identified by data-ref).`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}
