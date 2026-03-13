## AI Auto Form Filler

AI Auto Form Filler is a browser extension that analyzes selected form areas with an LLM and fills inputs using a structured operation plan. Among many AI form filler solutions, this extension **prioritizes the balance between functionality and security!**

## Core Features
- **Operation-based Secure Filling**: If you make a value "private", the LLMs will never see your actual personal information. Instead, the LLMs will generate filling operations using or combining the value aliases

- **Security vs. Functionality Dial is on your hands**: You can choose to make values private (LLMs only see aliases) or public (LLMs see actual values and flexibly fills form) on a per-field basis in the profile editor. This allows you to decide the right balance of security and functionality for each field.

- **Prompt Optimization**: This extension extracts only relevant form HTML and metadata to build concise prompts, improving LLMs understanding and response quality.

- **Fuzzy Matching**: If the `select` operation cannot find an exact match for a value, the extension will automatically try a fuzzy match to find the best candidate incorporating a small text embedding model, improving success on multiple forms.

## Security & Privacy Defaults

- Private information is never sent to the LLMs.
- Prompt payload excludes prefilled form values and selection state (`value`, `checked`, `selected`, textarea text).
- Non-fillable/high-risk fields are excluded from analysis/fill targets (`hidden`, `password`, `file`, `submit`, `button`, `reset`, `image`).
- Gemini API uses header auth (`x-goog-api-key`) instead of query-string key transport.
- Debug logs are disabled by default and can be enabled centrally via [lib/debug.ts](lib/debug.ts).

## Development Setup

1. Install dependencies

```bash
npm install
```

2. Start development

```bash
npx wxt
```

3. Build production package

```bash
npx wxt build
```

## Documentation

- Architecture and design: [docs/architecture.md](docs/architecture.md)
- Legacy planning notes: [docs/plan.md](docs/plan.md)

## Main Entry Points

- Content script flow: [entrypoints/content.ts](entrypoints/content.ts)
- Background LLM orchestration: [entrypoints/background.ts](entrypoints/background.ts)
- Options UI: [entrypoints/options/App.tsx](entrypoints/options/App.tsx)
- Popup UI: [entrypoints/popup/App.tsx](entrypoints/popup/App.tsx)

## Notes For Future Development

- Keep `steps` as the only LLM output contract.
- Add new operations through type -> prompt -> parser -> executor in that order.
- Use [lib/debug.ts](lib/debug.ts) for all debug logging so logs remain centrally controllable.