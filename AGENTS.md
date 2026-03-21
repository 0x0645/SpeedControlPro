# AGENTS.md

Guidance for coding agents working in `/Users/mustafagomaa/videospeed`.

## Project Overview

- Browser extension for controlling HTML5 video/audio playback speed.
- Manifest V3 Chrome extension built into `dist/`.
- Source is plain JavaScript ES modules, but most runtime modules attach themselves to the global `window.VSC` namespace.
- UI surfaces include injected controller UI, popup UI, and options page.
- Tests use custom runners instead of Jest/Vitest/Mocha.

## Repository-Specific Instructions

- There is no existing `AGENTS.md` in this repo; this file is the canonical agent guide.
- No Cursor rules were found in `.cursor/rules/` or `.cursorrules`.
- No Copilot instructions were found in `.github/copilot-instructions.md`.
- There are project-specific design briefs in `CLAUDE.md` and `.impeccable.md`; follow them for UI work.

## Design Context From `CLAUDE.md`

- Brand personality: polished, quiet, confident.
- Visual style: minimal, neutral, restrained, premium, not flashy.
- Avoid generic Chrome-extension styling, loud gradients, glassmorphism, and AI-looking neon UI.
- Prioritize clarity, dense-but-uncluttered layouts, and fast scanning.
- Prefer a monochrome base with one purposeful accent color.

## Additional Taste Notes From `.impeccable.md`

- Users are often mid-task; the extension should stay out of the way until needed and become immediately legible when shown.
- Extra visual references: Arc settings for calm confidence, Linear for dense-but-clean information layout, and Apple system preferences for invisible consistency.
- Emotional goal: users should feel in control without feeling like they are operating a complex tool.
- Keep the design invisible-until-needed, clarity-first, and consistent across popup, overlay, and options surfaces.
- Avoid decorative motion, redundant labels, and any styling that feels like showing off instead of helping.

## Key Directories

- `src/entries/` - esbuild entry points for content/inject bundles.
- `src/core/` - settings, storage, state, action, and controller logic.
- `src/content/` - content/injection bridge logic.
- `src/observers/` - media and mutation observers.
- `src/site-handlers/` - site-specific behavior and placement rules.
- `src/ui/` - popup, options page, controller custom element, and UI helpers.
- `src/utils/` - constants, DOM utilities, logger, blacklist, event manager.
- `tests/unit/`, `tests/integration/`, `tests/e2e/` - custom test suites.
- `scripts/build.mjs` - build pipeline.
- `dist/` - generated extension output; do not hand-edit.

## Build, Lint, and Test Commands

- Preferred package manager: `pnpm`
- Install dependencies: `pnpm install` (or `npm install` if needed)
- Full build: `pnpm build`
- Watch build: `pnpm dev`
- Lint source and tests: `pnpm lint`
- Auto-fix lint issues: `pnpm lint:fix`
- Format source and tests: `pnpm format`
- Type-check TypeScript contract files: `pnpm typecheck`
- Full default test flow: `pnpm test`
- Unit tests only: `pnpm test:unit`
- Integration tests only: `pnpm test:integration`
- E2E tests: `pnpm test:e2e`
- Manual browser test page note: `pnpm test:browser`
- Serve local files if needed: `pnpm serve`
- Build and zip extension: `pnpm zip`

## Running A Single Test

The repo does not expose a first-class npm script for a single unit/integration test file, but each test file exports a runner object with a `.run()` method. Use Node's module mode and import the file directly.

- Single unit/integration test file:
  `node --input-type=module -e "const m = await import('./tests/unit/core/settings.test.js'); const runner = Object.values(m).find(v => v && typeof v.run === 'function'); const result = await runner.run(); process.exit(result.failed ? 1 : 0);"`
- Replace the import path with any file under `tests/unit/` or `tests/integration/`.
- Example single integration test:
  `node --input-type=module -e "const m = await import('./tests/integration/module-integration.test.js'); const runner = Object.values(m).find(v => v && typeof v.run === 'function'); const result = await runner.run(); process.exit(result.failed ? 1 : 0);"`
- Single E2E suite is supported by the runner directly:
  `node tests/e2e/run-e2e.js basic`
- Other supported E2E selectors: `youtube`, `settings`, `display`.

## Build Notes

- Build script empties `dist/` before copying and bundling.
- Popup and options CSS are compiled with Tailwind CLI during the build.
- esbuild outputs IIFE bundles, not ESM bundles, to preserve current side-effect-driven initialization.
- Entry points are:
  - `src/entries/content-entry.ts`
  - `src/entries/inject-entry.ts`
  - `src/background.ts`
  - `src/ui/popup/popup.ts`
  - `src/ui/options/options.ts`
- Static assets copied into `dist/` include `manifest.json`, assets, styles, UI HTML/CSS, and docs.

## Architecture And Module Patterns

- Many modules are side-effect modules: importing them populates `window.VSC` rather than exporting named values.
- Import order matters for core runtime modules; tests mirror this in `tests/helpers/module-loader.js`.
- Prefer extending existing `window.VSC.*` objects/classes over introducing a parallel architecture.
- Keep popup code and options-page code separate from injected-page/runtime logic.
- Site-specific tweaks belong in `src/site-handlers/`, not in generic controller code when avoidable.
- Shared constants belong in `src/utils/constants.ts`.

## Code Style Guidelines

- Use plain JavaScript; there is no TypeScript in this repository.
- Prefer ES modules with explicit relative imports in UI/test/build files.
- In side-effect runtime modules, continue the established `window.VSC = window.VSC || {};` pattern.
- Use 2-space indentation.
- Use semicolons.
- Use single quotes except when escaping would be worse.
- Keep line length around Prettier's `printWidth: 100`.
- Prefer trailing commas where Prettier would add them (`trailingComma: 'es5'`).
- Prefer `const`; use `let` only when reassignment is required.
- Avoid `var` in new code.
- Use `===` / `!==` instead of loose equality.
- Always use braces for control blocks.

## Imports

- Keep imports at top-level.
- Group imports roughly by dependency layer: utilities first, then core, then UI/features.
- Preserve dependency ordering when modules rely on side effects.
- Do not convert side-effect imports into named imports unless the underlying module is refactored everywhere.
- In tests, prefer helper loaders like `loadCoreModules()` when they match the test scope.

## Naming Conventions

- Classes: `PascalCase` (for example `VideoController`, `StorageManager`).
- Functions and methods: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for static values and lookup tables.
- Global namespace members live under `window.VSC.*` with `PascalCase` for classes and `camelCase` for instances/singletons.
- Test runner exports typically end with `TestRunner`.
- `src/ui/options/options.ts` still contains legacy names such as `save_options`; when editing it, prefer local consistency over large naming-only rewrites.

## Types And Data Handling

- Validate and normalize persisted settings aggressively.
- Convert storage values with `Number(...)`, `Boolean(...)`, or targeted parsing where appropriate.
- Use `null`/`undefined` intentionally for sparse per-site profile overrides.
- When reading from Chrome storage or DOM attributes, assume values may be missing or malformed.
- Keep data structures serializable for `chrome.storage.sync`.

## Error Handling And Logging

- Wrap storage, messaging, DOM injection, and async initialization in `try`/`catch`.
- Prefer logging through `window.VSC.logger` in runtime modules.
- Direct `console.error` is acceptable in bootstrap code, background code, tests, or when logger is not guaranteed yet.
- On recoverable failures, log and fall back to safe defaults instead of throwing.
- Preserve current behavior where initialization continues gracefully after partial failures.

## DOM And Extension-Specific Practices

- Be careful with content-script vs page-context differences; `StorageManager` handles both.
- Avoid breaking the message bridge between popup/content/page contexts.
- Respect Shadow DOM handling; some tests and runtime code depend on shadow-root traversal.
- Prefer minimal, non-invasive DOM changes because the extension runs on arbitrary websites.
- Keep controller placement logic compatible with site handlers and dynamic DOM changes.
- Do not assume a single media element exists.

## Testing Conventions

- Tests use `SimpleTestRunner` from `tests/helpers/test-utils.js`.
- Test files usually load dependencies with top-level `await`.
- Each test file exports its runner so it can be imported directly.
- Use helpers such as `installChromeMock()`, `resetMockStorage()`, and `loadCoreModules()` instead of duplicating environment setup.
- Prefer focused tests that validate browser-extension behavior, settings persistence, and DOM/media interactions.
- If you add a new test file, ensure it is wired into `tests/run-tests.js` or document why it is intentionally standalone.

## Editing Guidance

- Preserve existing behavior unless the task explicitly changes it.
- Do not hand-edit generated files in `dist/`.
- Avoid repo-wide formatting churn; keep diffs tight.
- Follow the surrounding file's style when working in legacy code, even if it differs from the preferred modern style.
- When modernizing a file, separate behavioral changes from cleanup when practical.

## Recommended Validation Before Finishing

- For logic changes: `pnpm test:unit`
- For cross-module behavior changes: `pnpm test:integration`
- For packaging/build changes: `pnpm build`
- For UI or extension-runtime changes likely to affect bundling: `pnpm build && pnpm test:unit`
- For popup/options/controller behavior that needs browser verification: `pnpm test:e2e` when feasible
