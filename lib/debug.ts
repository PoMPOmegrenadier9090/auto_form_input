export const DEBUG_AUTOFILL_LOGS = false;

export function debugGroup(label: string, callback: () => void): void {
  if (!DEBUG_AUTOFILL_LOGS) return;
  console.groupCollapsed(label);
  try {
    callback();
  } finally {
    console.groupEnd();
  }
}

export function debugLog(...args: unknown[]): void {
  if (!DEBUG_AUTOFILL_LOGS) return;
  console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (!DEBUG_AUTOFILL_LOGS) return;
  console.warn(...args);
}

export function debugTable(data: unknown): void {
  if (!DEBUG_AUTOFILL_LOGS) return;
  console.table(data);
}
