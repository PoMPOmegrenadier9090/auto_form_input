/**
 * DOM Extractor — sanitize and minimize a container's HTML for LLM consumption.
 *
 * - Removes irrelevant elements (script, style, svg, img, …)
 * - Strips non-semantic attributes (class, style, data-*, event handlers)
 * - Preserves semantic attributes (name, id, type, placeholder, aria-*, for)
 * - Assigns data-ref to input elements (via element-locator)
 * - Compresses whitespace
 */

const REMOVE_TAGS = new Set([
  'script', 'style', 'svg', 'img', 'video', 'audio',
  'canvas', 'noscript', 'iframe', 'object', 'embed',
  'link', 'meta', 'br', 'hr',
]);

const KEEP_ATTRIBUTES = new Set([
  'type', 'name', 'id', 'placeholder',
  'aria-label', 'aria-describedby', 'aria-labelledby',
  'required', 'for',
  'data-ref', // our injected ref
  'multiple',
  'min', 'max', 'pattern',
]);

const INPUT_TAGS = new Set(['input', 'select', 'textarea']);

/**
 * Extract a sanitized HTML string from a container element.
 * Call this AFTER `buildLocatorMap` so that data-ref is already set.
 */
export function extractSanitizedHtml(container: Element): string {
  const clone = container.cloneNode(true) as Element;
  sanitizeNode(clone);
  // Compress whitespace
  return clone.innerHTML
    .replace(/\s+/g, ' ')
    .replace(/> </g, '>\n<')
    .trim();
}

function sanitizeNode(node: Node): void {
  const toRemove: Node[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      toRemove.push(child);
      continue;
    }

    if (child.nodeType === Node.TEXT_NODE) {
      // Keep text nodes but trim extreme whitespace
      const text = child.textContent?.trim();
      if (!text) {
        toRemove.push(child);
      } else {
        child.textContent = text;
      }
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      toRemove.push(child);
      continue;
    }

    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (REMOVE_TAGS.has(tag)) {
      toRemove.push(el);
      continue;
    }

    // Strip non-semantic attributes
    stripAttributes(el);

    // Never send prefilled textarea content to LLM.
    if (tag === 'textarea') {
      el.textContent = '';
    }

    // Recurse
    sanitizeNode(el);

    // Remove empty non-input containers
    if (
      !INPUT_TAGS.has(tag) &&
      !el.innerHTML.trim() &&
      !el.textContent?.trim()
    ) {
      toRemove.push(el);
    }
  }

  for (const n of toRemove) {
    n.parentNode?.removeChild(n);
  }
}

function stripAttributes(el: Element): void {
  const attrsToRemove: string[] = [];

  for (const attr of Array.from(el.attributes)) {
    if (KEEP_ATTRIBUTES.has(attr.name)) continue;
    // Keep aria-* attributes
    if (attr.name.startsWith('aria-')) continue;
    attrsToRemove.push(attr.name);
  }

  for (const name of attrsToRemove) {
    el.removeAttribute(name);
  }
}
