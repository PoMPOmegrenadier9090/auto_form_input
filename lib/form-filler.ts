import type { LLMMapping, FormElement, ProfileField, EmbeddingMatch } from '@/types';
import { resolveLocator } from './element-locator';
import { matchOptions, type EmbeddingEngine } from './embedding/matcher';

/**
 * Fill form fields based on LLM mappings and user profile.
 */
export async function fillForm(
  mappings: LLMMapping[],
  formElements: FormElement[],
  fields: ProfileField[],
  embeddingEngine?: EmbeddingEngine,
): Promise<{ filled: number; failed: string[] }> {
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  const elementMap = new Map(formElements.map((fe) => [fe.ref, fe]));

  let filled = 0;
  const failed: string[] = [];

  // LLMが出力したマッピングに基づき，フォーム要素を埋める
  for (const mapping of mappings) {
    const field = fieldMap.get(mapping.key);
    const formElement = elementMap.get(mapping.ref);

    if (!field || !formElement) {
      failed.push(mapping.ref);
      continue;
    }

    const element = resolveLocator(formElement.locator);
    if (!element) {
      failed.push(mapping.ref);
      continue;
    }

    // 特定された要素に対して，値を埋める
    try {
      await fillElement(element, formElement, field.value, embeddingEngine);
      filled++;
    } catch {
      failed.push(mapping.ref);
    }
  }
  console.log(`Filled ${filled} fields, failed to fill ${failed.length} fields.`);

  return { filled, failed };
}

async function fillElement(
  element: Element,
  formElement: FormElement,
  value: string,
  embeddingEngine?: EmbeddingEngine,
): Promise<void> {
  const tag = formElement.tagName;
  const type = formElement.type?.toLowerCase();

  if (tag === 'select') {
    await fillSelect(element as HTMLSelectElement, value, formElement.options, embeddingEngine);
  } else if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
    await fillCheckable(element as HTMLInputElement, value, formElement.options, embeddingEngine);
  } else if (tag === 'input' && type === 'date') {
    setInputValue(element as HTMLInputElement, value);
  } else {
    // text, email, tel, url, textarea, number, etc.
    setInputValue(element as HTMLInputElement | HTMLTextAreaElement, value);
  }
}

// ---- Element type handlers ----

async function fillSelect(
  select: HTMLSelectElement,
  value: string,
  options?: { value: string; text: string }[],
  embeddingEngine?: EmbeddingEngine,
): Promise<void> {
  // 1. Try direct match first
  const directOption = Array.from(select.options).find(
    (o) =>
      o.value === value ||
      o.textContent?.trim() === value,
  );

  if (directOption) {
    select.value = directOption.value;
    dispatchEvents(select);
    return;
  }

  // 2. Try embedding matching
  if (embeddingEngine && options && options.length > 0) {
    const match = await matchOptions(embeddingEngine, value, options);
    console.log('Embedding match for select:', { value, match });
    if (match) {
      select.value = match.value;
      dispatchEvents(select);
      return;
    }
  }

  // 3. Partial match fallback
  const partialOption = Array.from(select.options).find(
    (o) =>
      o.textContent?.trim().includes(value) ||
      value.includes(o.textContent?.trim() ?? ''),
  );
  if (partialOption) {
    select.value = partialOption.value;
    dispatchEvents(select);
  }
}

async function fillCheckable(
  input: HTMLInputElement,
  value: string,
  options?: { value: string; text: string }[],
  embeddingEngine?: EmbeddingEngine,
): Promise<void> {
  // For radio/checkbox, find the matching input in the same name group
  // 例：性別フィールドなら，「男性」と「女性」が同じ"sex"というname属性を持つ複数のinput要素として存在することが多い
  const name = input.getAttribute('name');
  if (!name) {
    input.checked = true;
    dispatchEvents(input);
    return;
  }
  // グループを取得する
  const group = document.querySelectorAll(
    `input[name="${CSS.escape(name)}"]`,
  ) as NodeListOf<HTMLInputElement>;

  // 1. Try direct value match
  for (const el of group) {
    if (el.value === value) {
      el.checked = true;
      dispatchEvents(el);
      return;
    }
  }

  // 2. Try embedding matching on labels
  if (embeddingEngine && options && options.length > 0) {
    const allOptions = Array.from(group).map((el) => {
      const id = el.id;
      const label = id
        ? document.querySelector(`label[for="${CSS.escape(id)}"]`)
        : el.closest('label');
      return {
        value: el.value,
        text: label?.textContent?.trim() ?? el.value,
        element: el,
      };
    });

    const match = await matchOptions(
      embeddingEngine,
      value,
      allOptions.map((o) => ({ value: o.value, text: o.text })),
    );

    if (match) {
      const target = allOptions.find((o) => o.value === match.value);
      if (target) {
        target.element.checked = true;
        dispatchEvents(target.element);
        return;
      }
    }
  }
}

/**
 * Input要素やtextarea要素に値をセットする関数．
 * ReactやVueなどのフレームワークで制御されているコンポーネントにも対応するため，ネイティブのsetterを呼び出す．
 * @param element 
 * @param value 
 */
function setInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  // Use native setter to work with React/Vue controlled components
  // フレームワークネイティブのsetterを呼び出す
  const nativeSetter = Object.getOwnPropertyDescriptor(
    element.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    'value',
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    element.value = value;
  }

  dispatchEvents(element);
}

/**
 * JSによるDOM操作時に，入力イベントを自然に発火させるための関数．
 * input/change/blurを順に発火させる．
 * @param element 
 */
function dispatchEvents(element: Element): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}
