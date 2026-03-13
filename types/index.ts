// ============================================================
// User Profile
// ============================================================

export interface ProfileField {
  key: string;
  label: string;
  value: string;
  /** Optional dummy/sample value used only for LLM format understanding */
  dummyValue?: string;
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

export type ValueSource = 'privatePlaceholder' | 'publicValue' | 'literal';

export type InputOperationType = 'direct' | 'concat' | 'template' | 'select_match' | 'split';

interface BaseInputPlanStep {
  ref: string;
  operation: InputOperationType;
  confidence?: number;
  missingKeys?: string[];
}

export interface DirectInputPlanStep extends BaseInputPlanStep {
  operation: 'direct';
  key: string;
  valueSource?: ValueSource;
  literalValue?: string;
}

export interface ConcatInputPlanStep extends BaseInputPlanStep {
  operation: 'concat';
  keys: string[];
  separator?: string;
}

export interface TemplateInputPlanStep extends BaseInputPlanStep {
  operation: 'template';
  template: string;
}

export interface SelectMatchInputPlanStep extends BaseInputPlanStep {
  operation: 'select_match';
  key: string;
  valueSource?: ValueSource;
  literalValue?: string;
}

export interface SplitInputPlanStep extends BaseInputPlanStep {
  operation: 'split';
  key: string;
  separator: string;
  index: number;
  trim?: boolean;
}

export type InputPlanStep =
  | DirectInputPlanStep
  | ConcatInputPlanStep
  | TemplateInputPlanStep
  | SelectMatchInputPlanStep
  | SplitInputPlanStep;

export interface ConfidenceBuckets {
  low: number;
  medium: number;
  high: number;
}

export interface LLMAnalysisResult {
  steps: InputPlanStep[];
  unmapped: string[];
}

export interface LLMProviderConfig {
  name: 'openai' | 'gemini' | string;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature?: number;
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
  | { type: 'START_DETECT' }
  | { type: 'DETECT_RESULT'; containers: ContainerInfo[] }
  | { type: 'ADD_CONTAINER' }
  | { type: 'EDIT_CONTAINER'; index: number }
  | { type: 'REMOVE_CONTAINER'; index: number }
  | { type: 'CONFIRM_AND_FILL' }
  | { type: 'CANCEL_SELECTION' }
  | { type: 'SELECTION_STATE'; state: SelectionState }
  | { type: 'SELECT_CONTAINER' }
  | { type: 'GET_SETTINGS' };

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
  confidenceBuckets?: ConfidenceBuckets;
  htmlCharCount?: number;
  htmlWordCount?: number;
  estimatedTokenCount?: number;
  tokenWarning?: boolean;
}

// ============================================================
// Settings
// ============================================================

export interface AppSettings {
  llmProvider: LLMProviderConfig;
}
