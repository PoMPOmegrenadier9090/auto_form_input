import type {
  InputPlanStep,
  LLMAnalysisResult,
  FormElement,
  ProfileField,
} from '@/types';
import { resolveLocator } from './element-locator';
import { matchOptions, type EmbeddingEngine } from './embedding/matcher';
import {
  isAddressKey,
  normalizeAddressValue,
  normalizeTemplateValue,
} from './address-normalizer';
import { debugGroup, debugLog, debugWarn } from './debug';

/**
 * Fill form fields based on LLM mappings and user profile.
 */
export async function fillForm(
  result: LLMAnalysisResult,
  formElements: FormElement[],
  fields: ProfileField[],
  embeddingEngine?: EmbeddingEngine,
): Promise<{ filled: number; failed: string[] }> {
  debugGroup('[AutoFill] fillForm start', () => {
    debugLog('steps:', result.steps ?? []);
    debugLog('formElements:', formElements.length, 'profileFields:', fields.length);
  });

  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  const elementMap = new Map(formElements.map((fe) => [fe.ref, fe]));
  const steps = result.steps ?? [];

  let filled = 0;
  const failed: string[] = [];

  // LLMが出力したステップに基づき，フォーム要素を埋める
  for (const step of steps) {
    const formElement = elementMap.get(step.ref);
    if (!formElement) {
      failed.push(step.ref);
      continue;
    }

    const element = resolveLocator(formElement.locator);
    if (!element) {
      failed.push(step.ref);
      continue;
    }

    const { value: resolvedValue, rawValue, normalizedBy } = resolveStepValue(step, fieldMap);

    debugGroup(`[AutoFill] step ref=${step.ref} op=${step.operation}`, () => {
      debugLog('step:', step);
      debugLog('rawValue:', rawValue);
      debugLog('resolvedValue:', resolvedValue);
      debugLog('normalizedBy:', normalizedBy || '(none)');
      debugLog('target:', formElement.tagName, formElement.type ?? '');
    });

    // 特定された要素に対して，値を埋める
    try {
      await fillElement(element, formElement, resolvedValue, embeddingEngine);
      filled++;
    } catch {
      failed.push(step.ref);
    }
  }
  debugLog(`Filled ${filled} fields, failed to fill ${failed.length} fields.`);

  return { filled, failed };
}

/**
 * LLMが出力した入力ステップを解釈して，最終的な入力値を生成する関数．
 * @param step 
 * @param fieldMap 
 * @returns 
 */
function resolveStepValue(
  step: InputPlanStep,
  fieldMap: Map<string, ProfileField>,
): { value: string; rawValue: string; normalizedBy?: string } {
  // 入力値の正規化を行うためのhelper関数．
  const finalize = (
    rawValue: string,
    normalize: boolean,
    normalizer: 'template' | 'address' | undefined,
  ) => {
    if (!normalize || !normalizer) {
      return { value: rawValue, rawValue };
    }
    // templateとaddressで異なる正規化を行う
    const value = normalizer === 'address'
      ? normalizeAddressValue(rawValue)
      : normalizeTemplateValue(rawValue);
    return { value, rawValue, normalizedBy: normalizer };
  };

  // LLMが直接値を指定した場合はそれを優先する
  if ((step.operation === 'direct' || step.operation === 'select_match') && step.valueSource === 'literal') {
    const raw = step.literalValue ?? '';
    return finalize(raw, step.operation === 'template', 'template');
  }

  // プロファイル値を直接参照する場合
  if (step.operation === 'direct' || step.operation === 'select_match') {
    const field = fieldMap.get(step.key);
    if (!field) return { value: '', rawValue: '' };
    if (step.valueSource === 'publicValue' && !field.isPublic) {
      return { value: '', rawValue: '' };
    }
    const raw = field.value ?? '';
    return finalize(raw, isAddressKey(step.key), 'address');
  }

  // 複数のキーを結合する場合
  if (step.operation === 'concat') {
    const parts = step.keys.map((key) => fieldMap.get(key)?.value ?? '');
    const raw = parts.join(step.separator ?? '');
    const isAddressConcat = step.keys.some((k) => isAddressKey(k));
    return finalize(raw, isAddressConcat, isAddressConcat ? 'address' : undefined);
  }

  // テンプレートを処理する場合
  if (step.operation === 'template') {
    const raw = step.template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      return fieldMap.get(key)?.value ?? '';
    });
    const keys = Array.from(step.template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((m) => m[1]);
    const isAddressTemplate = keys.some((k) => isAddressKey(k));
    return finalize(raw, true, isAddressTemplate ? 'address' : 'template');
  }

  // 1つのプロファイル値を区切りで分割して一部を取得する場合
  if (step.operation === 'split') {
    const source = fieldMap.get(step.key)?.value ?? '';
    const parts = source.split(step.separator);
    const selected = parts[step.index] ?? '';
    const raw = step.trim === false ? selected : selected.trim();
    return finalize(raw, isAddressKey(step.key), 'address');
  }

  return { value: '', rawValue: '' };
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
    try {
      const match = await matchOptions(embeddingEngine, value, options);
      debugLog('Embedding match for select:', { value, match });
      if (match) {
        select.value = match.value;
        dispatchEvents(select);
        return;
      }
    } catch (error) {
      debugWarn('Embedding match failed for select; falling back to partial match.', error);
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

    try {
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
    } catch (error) {
      debugWarn('Embedding match failed for checkable input; falling back.', error);
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
