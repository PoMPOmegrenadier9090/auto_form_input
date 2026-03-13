// ============================================================
// User Profile
// ============================================================

export interface ProfileField {
  key: string;
  label: string;
  value: string;
  category: string;
  /** If true, the value is sent to LLM along with the key name */
  isPublic: boolean;
}

export interface UserProfile {
  fields: ProfileField[];
  categories: string[];
}

// ============================================================
// DOM / Element Locator
// ============================================================

export type LocatorStrategy = 'id' | 'css' | 'xpath';

export interface ElementLocator {
  strategy: LocatorStrategy;
  value: string;
}

export interface FormElement {
  ref: string;
  locator: ElementLocator;
  tagName: string;
  type?: string;
  /** select options or radio choices for embedding matching */
  options?: { value: string; text: string }[];
}

// ============================================================
// LLM
// ============================================================

export interface LLMMapping {
  ref: string;
  key: string;
  confidence: number;
}

export interface LLMAnalysisResult {
  mappings: LLMMapping[];
  unmapped: string[];
}

export interface LLMProviderConfig {
  name: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

// ============================================================
// Embedding
// ============================================================

export interface EmbeddingMatch {
  value: string;
  text: string;
  score: number;
}

// ============================================================
// Messaging (Content Script ↔ Background ↔ Popup)
// ============================================================

export type Message =
  | { type: 'ANALYZE_FORM'; html: string; fields: ProfileField[]; formElements: FormElement[] }
  | { type: 'MAPPING_RESULT'; result: LLMAnalysisResult }
  | { type: 'FILL_FORM'; mappings: LLMMapping[]; formElements: FormElement[] }
  | { type: 'START_AUTOFILL' }
  | { type: 'START_DETECT' }
  | { type: 'DETECT_RESULT'; containers: ContainerInfo[] }
  | { type: 'ADD_CONTAINER' }
  | { type: 'EDIT_CONTAINER'; index: number }
  | { type: 'REMOVE_CONTAINER'; index: number }
  | { type: 'CONFIRM_AND_FILL' }
  | { type: 'CANCEL_SELECTION' }
  | { type: 'SELECTION_STATE'; state: SelectionState }
  | { type: 'SELECT_CONTAINER' }
  | { type: 'GET_SETTINGS' }
  | { type: 'MATCH_OPTIONS'; profileValue: string; options: { value: string; text: string }[] }
  | { type: 'MATCH_OPTIONS_RESULT'; match: EmbeddingMatch | null };

export interface ContainerInfo {
  index: number;
  inputCount: number;
  tagName: string;
  /** Short text preview of the container */
  preview: string;
}

export type SelectionPhase = 'detecting' | 'selecting' | 'adding' | 'editing' | 'analyzing' | 'filling' | 'done' | 'error';

export interface SelectionState {
  phase: SelectionPhase;
  containers: ContainerInfo[];
  message: string;
  filledCount?: number;
  totalCount?: number;
}

// ============================================================
// Settings
// ============================================================

export interface AppSettings {
  llmProvider: LLMProviderConfig;
}
