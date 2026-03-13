import { FORM_INPUT_SELECTOR } from './selectors';

/**
 * Container Detector — automatically find the best form container on a page.
 *
 * Strategy:
 * 1. Find all <form> elements, prioritise those in viewport with most inputs
 * 2. If no <form>, find all input elements and compute their LCA (Lowest Common Ancestor)
 * 3. Score candidates by input count, visibility, and nesting depth
 */

const INPUT_SELECTOR = FORM_INPUT_SELECTOR;

export interface ContainerCandidate {
  element: Element;
  score: number;
  inputCount: number;
}

/**
 * Detect the best container for form auto-fill.
 * Returns candidates sorted by score (highest first).
 * Strategies:
 * 1. \<form\> elements
 * 2. 最小共通祖先(LCA) of all visible inputs
 */
export function detectContainers(): ContainerCandidate[] {
  const candidates: ContainerCandidate[] = [];

  // Strategy 1: <form> elements
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const inputs = form.querySelectorAll(INPUT_SELECTOR);
    // input要素がないformは除外
    if (inputs.length === 0) continue;
    candidates.push({
      element: form,
      score: scoreContainer(form, inputs.length),
      inputCount: inputs.length,
    });
  }

  // Strategy 2: LCA of all visible inputs (when no forms found, or as additional candidate)
  const allInputs = document.querySelectorAll(INPUT_SELECTOR);
  if (allInputs.length > 0) {
    const lca = findLCA(Array.from(allInputs));
    if (lca && !candidates.some((c) => c.element === lca)) {
      const inputsInLca = lca.querySelectorAll(INPUT_SELECTOR);
      candidates.push({
        element: lca,
        score: scoreContainer(lca, inputsInLca.length),
        inputCount: inputsInLca.length,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Expand a container by moving to its parent element (for "範囲を広げる" feature).
 */
export function expandContainer(current: Element): Element {
  return current.parentElement ?? current;
}

// ---- Scoring ----

function scoreContainer(container: Element, inputCount: number): number {
  let score = inputCount * 10;

  // Bonus for being in viewport
  if (isInViewport(container)) {
    score += 20;
  }

  // Bonus for being a <form>
  if (container.tagName.toLowerCase() === 'form') {
    score += 15;
  }

  // Penalty for excessive nesting depth (too high up in DOM = too broad)
  const depth = getDepth(container);
  if (depth < 3) {
    score -= 10; // too close to body — probably too broad
  }

  return score;
}

function isInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

function getDepth(el: Element): number {
  let depth = 0;
  let current: Element | null = el;
  while (current) {
    depth++;
    current = current.parentElement;
  }
  return depth;
}

/**
 * ページ内の複数の要素の共通祖先を見つける。共通祖先がない場合はdocument.bodyを返す。
 * @param elements 
 * @returns 
 */
function findLCA(elements: Element[]): Element | null {
  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0].parentElement;

  // ページ上のinput要素の共通祖先を発見する．
  // 共通祖先がない場合，document.bodyを返す．
  let lca: Element | null = elements[0];
  for (let i = 1; i < elements.length; i++) {
    lca = getLCA(lca, elements[i]);
    if (!lca) return document.body;
  }
  return lca;
}

/**
 * aとbの共通祖先を探索する．
 * @param a 
 * @param b 
 * @returns 
 */
function getLCA(a: Element | null, b: Element | null): Element | null {
  if (!a || !b) return null;
  const ancestorsA = new Set<Element>();
  let current: Element | null = a;
  while (current) {
    ancestorsA.add(current);
    current = current.parentElement;
  }
  // bの祖先をたどりながら、aの祖先と最初に一致するものを探す
  current = b;
  while (current) {
    if (ancestorsA.has(current)) return current;
    current = current.parentElement;
  }
  return null;
}
