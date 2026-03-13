import type { ElementLocator, FormElement } from '@/types';

const INPUT_SELECTORS = 'input, select, textarea';

/**
 * Generate a robust locator for a single element.
 * Priority: id → name+type CSS → unique CSS → XPath.
 */
export function generateLocator(
  element: Element,
  root: Element | Document = document,
): ElementLocator {
  // 1. id-based
  if (element.id) {
    const found = root.querySelectorAll(`#${CSS.escape(element.id)}`);
    if (found.length === 1) {
      return { strategy: 'id', value: element.id };
    }
  }

  // 2. name+type CSS selector
  const name = element.getAttribute('name');
  const type = element.getAttribute('type');
  if (name) {
    const tag = element.tagName.toLowerCase();
    let selector = `${tag}[name="${CSS.escape(name)}"]`;
    if (type) selector += `[type="${CSS.escape(type)}"]`;
    const found = root.querySelectorAll(selector);
    if (found.length === 1) {
      return { strategy: 'css', value: selector };
    }
  }

  // 3. Unique CSS selector using structural position
  const css = buildUniqueCssSelector(element, root);
  if (css) {
    return { strategy: 'css', value: css };
  }

  // 4. XPath fallback
  return { strategy: 'xpath', value: getXPath(element) };
}

/**
 * Resolve an element from a locator in the current document.
 */
export function resolveLocator(locator: ElementLocator): Element | null {
  switch (locator.strategy) {
    case 'id':
      return document.getElementById(locator.value);
    case 'css':
      return document.querySelector(locator.value);
    case 'xpath': {
      const result = document.evaluate(
        locator.value,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      );
      return result.singleNodeValue as Element | null;
    }
  }
}

/**
 * Build a locator map for all input elements inside a container.
 * Also assigns data-ref attributes for LLM prompt references.
 */
export function buildLocatorMap(container: Element): FormElement[] {
  const inputs = container.querySelectorAll(INPUT_SELECTORS);
  const formElements: FormElement[] = [];

  inputs.forEach((el, index) => {
    // 各入力要素に一意なdata-ref属性を付与する
    const ref = String(index + 1);
    el.setAttribute('data-ref', ref);

    const locator = generateLocator(el);
    const tagName = el.tagName.toLowerCase();
    const type = el.getAttribute('type') ?? undefined;

    const formElement: FormElement = { ref, locator, tagName, type };

    // select要素の場合，optionsを収集する
    if (tagName === 'select') {
      formElement.options = Array.from(
        (el as HTMLSelectElement).options,
      ).map((opt) => ({ value: opt.value, text: opt.textContent?.trim() ?? '' }));
    }

    // radio/checkbox要素の場合，ラベルを収集する
    if (tagName === 'input' && (type === 'radio' || type === 'checkbox')) {
      const id = el.id;
      const label = id
        ? document.querySelector(`label[for="${CSS.escape(id)}"]`)
        : el.closest('label');
      if (label) {
        formElement.options = [
          { value: (el as HTMLInputElement).value, text: label.textContent?.trim() ?? '' },
        ];
      }
    }

    formElements.push(formElement);
  });

  return formElements;
}

// ---- Internal helpers ----

function buildUniqueCssSelector(
  element: Element,
  root: Element | Document,
): string | null {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== root) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) break;

    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === current!.tagName,
    );

    let segment: string;
    if (siblings.length === 1) {
      segment = tag;
    } else {
      const idx = siblings.indexOf(current) + 1;
      segment = `${tag}:nth-of-type(${idx})`;
    }
    path.unshift(segment);
    current = parent;
  }

  const selector = path.join(' > ');
  try {
    const found = root.querySelectorAll(selector);
    if (found.length === 1) return selector;
  } catch {
    // invalid selector — fall through
  }
  return null;
}

function getXPath(element: Element): string {
  const parts: string[] = [];
  let current: Node | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const el = current as Element;
    const tag = el.tagName.toLowerCase();
    const parent = el.parentNode;

    if (parent) {
      const siblings = Array.from(parent.childNodes).filter(
        (n) => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === el.tagName,
      );
      const index = siblings.indexOf(el) + 1;
      parts.unshift(`${tag}[${index}]`);
    } else {
      parts.unshift(tag);
    }
    current = parent;
  }

  return '/' + parts.join('/');
}
