const ADDRESS_KEYS = new Set([
  'zipCodeUpper',
  'zipCodeLower',
  'prefecture',
  'city',
  'town',
  'address1',
  'address2',
  'nearestStation',
]);

export function isAddressKey(key: string): boolean {
  return ADDRESS_KEYS.has(key);
}

export function normalizeTemplateValue(value: string): string {
  let normalized = value.normalize('NFKC');
  normalized = normalized.replace(/\u3000/g, ' ');
  normalized = normalized.replace(/[‐‑‒–—―ー]+/g, '-');
  normalized = normalized.replace(/\s*-\s*/g, '-');
  normalized = normalized.replace(/\s{2,}/g, ' ');
  return normalized.trim();
}

export function normalizeAddressValue(value: string): string {
  let normalized = normalizeTemplateValue(value);

  // Japanese addresses are usually written without spaces.
  if (/[ぁ-んァ-ヶ一-龠]/.test(normalized)) {
    normalized = normalized.replace(/\s+/g, '');
  }

  // Collapse duplicated separators after merges.
  normalized = normalized.replace(/-+/g, '-');
  normalized = normalized.replace(/,+/g, ',');
  normalized = normalized.replace(/^[-,]+|[-,]+$/g, '');

  return normalized;
}
