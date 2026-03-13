// 機密性のため，パスワードやファイル入力などの特定のタイプのinput要素を除外するセレクタを定義する
export const FORM_INPUT_SELECTOR = [
	'input:not([type="hidden"])',
	'input:not([type="password"])',
	'input:not([type="file"])',
	'input:not([type="submit"])',
	'input:not([type="button"])',
	'input:not([type="reset"])',
	'input:not([type="image"])',
	'select',
	'textarea',
].join(', ');
