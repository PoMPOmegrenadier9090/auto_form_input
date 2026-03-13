import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: {
    binaries: {
      chrome: '/Applications/Arc.app/Contents/MacOS/Arc',
    },
  },
  manifest: {
    name: 'AI Auto Form Filler',
    description: 'Secure AI-powered auto form filler',
    permissions: ['storage', 'activeTab', 'scripting', 'offscreen'],
    host_permissions: [
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://huggingface.co/*',
      'https://cdn-lfs.huggingface.co/*',
    ],
  },
});
