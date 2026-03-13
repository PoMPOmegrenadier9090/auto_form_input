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
  const stored = await loadRaw<UserProfile>(STORAGE_KEYS.profile);
  if (!stored) return null;

  const merged = mergeProfileWithDefaults(stored);

  // Persist migrated/merged shape so subsequent loads are stable.
  if (JSON.stringify(stored) !== JSON.stringify(merged)) {
    await saveRaw(STORAGE_KEYS.profile, merged);
  }

  return merged;
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
    temperature: 0,
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
  '属性',
  '学校情報',
  '学歴',
  '希望条件',
  '資格・スキル',
  '勤務先',
  '緊急連絡先',
  'SNS・ポートフォリオ',
] as const;

export const DEFAULT_PROFILE_FIELDS: ProfileField[] = [
  // ---- 氏名 ----
  { key: 'lastName', label: '姓', value: '', dummyValue: '山田', category: '氏名', isPublic: false },
  { key: 'firstName', label: '名', value: '', dummyValue: '太郎', category: '氏名', isPublic: false },
  { key: 'lastNameKana', label: '姓（カナ）', value: '', dummyValue: 'ヤマダ', category: '氏名', isPublic: false },
  { key: 'firstNameKana', label: '名（カナ）', value: '', dummyValue: 'タロウ', category: '氏名', isPublic: false },

  // ---- 連絡先 ----
  { key: 'email', label: 'メールアドレス', value: '', dummyValue: 'taro.yamada@example.com', category: '連絡先', isPublic: false },
  { key: 'emailConfirm', label: 'メールアドレス（確認用）', value: '', dummyValue: 'taro.yamada@example.com', category: '連絡先', isPublic: false },
  { key: 'phone', label: '電話番号', value: '', dummyValue: '03-1234-5678', category: '連絡先', isPublic: false },
  { key: 'mobilePhone', label: '携帯電話番号', value: '', dummyValue: '090-1234-5678', category: '連絡先', isPublic: false },

  // ---- 住所 ----
  { key: 'zipCodeUpper', label: '郵便番号（上3桁）', value: '', dummyValue: '980', category: '住所', isPublic: false },
  { key: 'zipCodeLower', label: '郵便番号（下4桁）', value: '', dummyValue: '0811', category: '住所', isPublic: false },
  { key: 'prefecture', label: '都道府県', value: '', dummyValue: '宮城県', category: '住所', isPublic: true },
  { key: 'city', label: '市区町村', value: '', dummyValue: 'S市', category: '住所', isPublic: false },
  { key: 'town', label: '町名・丁目', value: '', dummyValue: '杜王町1-3-22', category: '住所', isPublic: false },
  { key: 'address1', label: '番地', value: '', dummyValue: '1-3-22', category: '住所', isPublic: false },
  { key: 'address2', label: '建物名・部屋番号', value: '', dummyValue: 'グリーンドルフィン101', category: '住所', isPublic: false },
  { key: 'nearestStation', label: '最寄り駅', value: '', dummyValue: '仙台駅', category: '住所', isPublic: true },

  // ---- 生年月日 ----
  { key: 'birthYear', label: '生年', value: '', dummyValue: '2002', category: '生年月日', isPublic: false },
  { key: 'birthMonth', label: '生月', value: '', dummyValue: '04', category: '生年月日', isPublic: false },
  { key: 'birthDay', label: '生日', value: '', dummyValue: '12', category: '生年月日', isPublic: false },

  // ---- 属性 ----
  { key: 'gender', label: '性別', value: '', dummyValue: '男性', category: '属性', isPublic: false },
  { key: 'nationality', label: '国籍', value: '', dummyValue: '日本', category: '属性', isPublic: false },

  // ---- 学校情報 ----
  { key: 'schoolName', label: '学校名', value: '', dummyValue: '杜王大学', category: '学校情報', isPublic: true },
  { key: 'faculty', label: '学部', value: '', dummyValue: '工学部', category: '学校情報', isPublic: true },
  { key: 'department', label: '学科', value: '', dummyValue: '情報工学科', category: '学校情報', isPublic: true },
  { key: 'major', label: '専攻', value: '', dummyValue: '人工知能', category: '学校情報', isPublic: true },
  { key: 'studentId', label: '学籍番号', value: '', dummyValue: 'A24-00123', category: '学校情報', isPublic: false },
  { key: 'graduationYear', label: '卒業予定年', value: '', dummyValue: '2027', category: '学校情報', isPublic: true },
  { key: 'graduationMonth', label: '卒業予定月', value: '', dummyValue: '03', category: '学校情報', isPublic: true },

  // ---- 学歴 ----
  { key: 'highSchoolName', label: '高校名', value: '', dummyValue: '杜王高校', category: '学歴', isPublic: true },
  { key: 'highSchoolGradYear', label: '高校卒業年', value: '', dummyValue: '2023', category: '学歴', isPublic: true },
  { key: 'universityName', label: '大学名', value: '', dummyValue: '杜王大学', category: '学歴', isPublic: true },
  { key: 'universityEnrollYear', label: '大学入学年', value: '', dummyValue: '2023', category: '学歴', isPublic: true },

  // ---- 希望条件 ----
  { key: 'desiredJobType', label: '希望職種', value: '', dummyValue: 'ソフトウェアエンジニア', category: '希望条件', isPublic: true },
  { key: 'desiredLocation', label: '希望勤務地', value: '', dummyValue: '東京都', category: '希望条件', isPublic: true },
  { key: 'availableStartDate', label: '入社可能時期', value: '', dummyValue: '2027-04-01', category: '希望条件', isPublic: true },

  // ---- 資格・スキル ----
  { key: 'toeicScore', label: 'TOEICスコア', value: '', dummyValue: '825', category: '資格・スキル', isPublic: true },
  { key: 'qualification', label: '保有資格', value: '', dummyValue: '基本情報技術者', category: '資格・スキル', isPublic: true },
  { key: 'drivingLicense', label: '運転免許', value: '', dummyValue: '普通自動車第一種運転免許', category: '資格・スキル', isPublic: true },
  { key: 'programmingLanguages', label: 'プログラミング言語', value: '', dummyValue: 'TypeScript, Python', category: '資格・スキル', isPublic: true },

  // ---- 勤務先（既卒・転職向け） ----
  { key: 'company', label: '会社名', value: '', dummyValue: '株式会社サンプル', category: '勤務先', isPublic: true },
  { key: 'workDepartment', label: '部署', value: '', dummyValue: '開発部', category: '勤務先', isPublic: true },
  { key: 'employmentType', label: '雇用形態', value: '', dummyValue: '正社員', category: '勤務先', isPublic: true },
  { key: 'yearsOfExperience', label: '実務経験年数', value: '', dummyValue: '2', category: '勤務先', isPublic: true },

  // ---- 緊急連絡先 ----
  { key: 'emergencyContactName', label: '緊急連絡先氏名', value: '', dummyValue: '山田花子', category: '緊急連絡先', isPublic: false },
  { key: 'emergencyContactRelationship', label: '続柄', value: '', dummyValue: '母', category: '緊急連絡先', isPublic: false },
  { key: 'emergencyContactPhone', label: '緊急連絡先電話番号', value: '', dummyValue: '090-9999-1234', category: '緊急連絡先', isPublic: false },

  // ---- SNS・ポートフォリオ ----
  { key: 'githubUrl', label: 'GitHub URL', value: '', dummyValue: 'https://github.com/sample-user', category: 'SNS・ポートフォリオ', isPublic: true },
  { key: 'portfolioUrl', label: 'ポートフォリオ URL', value: '', dummyValue: 'https://portfolio.example.com', category: 'SNS・ポートフォリオ', isPublic: true },
  { key: 'linkedinUrl', label: 'LinkedIn URL', value: '', dummyValue: 'https://www.linkedin.com/in/sample-user', category: 'SNS・ポートフォリオ', isPublic: true },
  { key: 'xUrl', label: 'X（旧Twitter）URL', value: '', dummyValue: 'https://x.com/sample_user', category: 'SNS・ポートフォリオ', isPublic: true },
];

export function createDefaultProfile(): UserProfile {
  return {
    fields: [...DEFAULT_PROFILE_FIELDS],
    categories: [...DEFAULT_CATEGORIES],
  };
}

function mergeProfileWithDefaults(profile: UserProfile): UserProfile {
  // 1) Migrate known legacy keys before merge.
  const migratedFields = profile.fields.map((field) => {
    if (field.key === 'department' && field.category === '勤務先') {
      return {
        ...field,
        key: 'workDepartment',
      };
    }
    return field;
  });

  // Build index from migrated fields (first occurrence wins to avoid duplicates).
  const existingByKey = new Map<string, ProfileField>();
  for (const field of migratedFields) {
    if (!existingByKey.has(field.key)) {
      existingByKey.set(field.key, field);
    }
  }

  // 2) Ensure all default fields exist while preserving user-entered values/flags.
  const mergedDefaults = DEFAULT_PROFILE_FIELDS.map((defaultField) => {
    const existing = existingByKey.get(defaultField.key);
    if (!existing) return { ...defaultField };
    return {
      ...defaultField,
      ...existing,
      // Always preserve actual user value.
      value: existing.value ?? '',
    };
  });

  // 3) Keep custom fields not present in defaults.
  const customFields = migratedFields.filter(
    (field) => !DEFAULT_PROFILE_FIELDS.some((d) => d.key === field.key),
  );

  // 4) Categories: default order first, then custom categories from existing profile.
  const defaultCategories = [...DEFAULT_CATEGORIES];
  const customCategories = profile.categories.filter(
    (c) => !defaultCategories.includes(c as (typeof DEFAULT_CATEGORIES)[number]),
  );

  return {
    fields: [...mergedDefaults, ...customFields],
    categories: [...defaultCategories, ...customCategories],
  };
}
