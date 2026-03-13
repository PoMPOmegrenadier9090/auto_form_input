import type { UserProfile, AppSettings, ProfileField } from '@/types';

const STORAGE_KEYS = {
  profile: 'user_profile',
  settings: 'app_settings',
} as const;

// ---- Generic storage helpers ----

async function saveRaw<T>(key: string, value: T): Promise<void> {
  await browser.storage.local.set({ [key]: JSON.stringify(value) });
}

async function loadRaw<T>(key: string): Promise<T | null> {
  const result = await browser.storage.local.get(key);
  const raw = result[key];
  if (raw == null) return null;
  return JSON.parse(raw) as T;
}

// ---- Public API ----

export async function saveProfile(profile: UserProfile): Promise<void> {
  await saveRaw(STORAGE_KEYS.profile, profile);
}

export async function loadProfile(): Promise<UserProfile | null> {
  return loadRaw<UserProfile>(STORAGE_KEYS.profile);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  // Settings are not considered sensitive — always plain
  await saveRaw(STORAGE_KEYS.settings, settings);
}

export async function loadSettings(): Promise<AppSettings | null> {
  return loadRaw<AppSettings>(STORAGE_KEYS.settings);
}

export const DEFAULT_SETTINGS: AppSettings = {
  llmProvider: {
    name: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
  },
};

export function createDefaultSettings(): AppSettings {
  return {
    llmProvider: { ...DEFAULT_SETTINGS.llmProvider },
  };
}

// ---- Default profile template ----

export const DEFAULT_CATEGORIES = [
  '氏名',
  '住所',
  '連絡先',
  '生年月日',
  '勤務先',
] as const;

export const DEFAULT_PROFILE_FIELDS: ProfileField[] = [
  { key: 'lastName', label: '姓', value: '', category: '氏名', isPublic: false },
  { key: 'firstName', label: '名', value: '', category: '氏名', isPublic: false },
  { key: 'lastNameKana', label: '姓（カナ）', value: '', category: '氏名', isPublic: false },
  { key: 'firstNameKana', label: '名（カナ）', value: '', category: '氏名', isPublic: false },
  { key: 'email', label: 'メールアドレス', value: '', category: '連絡先', isPublic: false },
  { key: 'phone', label: '電話番号', value: '', category: '連絡先', isPublic: false },
  { key: 'zipCodeUpper', label: '郵便番号（上3桁）', value: '', category: '住所', isPublic: false },
  { key: 'zipCodeLower', label: '郵便番号（下4桁）', value: '', category: '住所', isPublic: false },
  { key: 'prefecture', label: '都道府県', value: '', category: '住所', isPublic: true },
  { key: 'city', label: '市区町村', value: '', category: '住所', isPublic: false },
  { key: 'address1', label: '番地', value: '', category: '住所', isPublic: false },
  { key: 'address2', label: '建物名・部屋番号', value: '', category: '住所', isPublic: false },
  { key: 'birthYear', label: '生年', value: '', category: '生年月日', isPublic: false },
  { key: 'birthMonth', label: '生月', value: '', category: '生年月日', isPublic: false },
  { key: 'birthDay', label: '生日', value: '', category: '生年月日', isPublic: false },
  { key: 'company', label: '会社名', value: '', category: '勤務先', isPublic: true },
  { key: 'department', label: '部署', value: '', category: '勤務先', isPublic: true },
];

export function createDefaultProfile(): UserProfile {
  return {
    fields: [...DEFAULT_PROFILE_FIELDS],
    categories: [...DEFAULT_CATEGORIES],
  };
}
