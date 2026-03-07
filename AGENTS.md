# AGENTS.md — Orchestrator

> Opencode Orchestrator: SDK-driven pipeline for AI agent coordination.
> Monorepo: `packages/shared`, `packages/server`, `packages/web`.

## Build / Lint / Test Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev                # run server + web concurrently
pnpm dev:server         # server only (tsx watch)
pnpm dev:web            # web only (vite)

# Build (recommended order: shared -> server -> web)
pnpm build
pnpm build:shared
pnpm build:server
pnpm build:web

# Test (Vitest, server package)
pnpm test
pnpm --filter @orchestrator/server test:watch

# Run a single test file
pnpm --filter @orchestrator/server exec vitest run test/circuit-breaker.test.ts

# Run a single test by test name pattern
pnpm --filter @orchestrator/server exec vitest run -t "should stop after max retries"

# Lint / clean
pnpm lint
pnpm clean

# Shared package manual verification
node packages/shared/test/verify-agent-result.mjs
```

## Project Structure

```text
packages/
  shared/      # @orchestrator/shared: shared types/utilities (pure TS)
    src/
      index.ts
      types/
    test/
      verify-agent-result.mjs
  server/      # @orchestrator/server: Express backend
    src/
      core/
      db/
      pipeline/
      routes/
      services/
      utils/
      index.ts
    test/
      *.test.ts
  web/         # @orchestrator/web: Vue 3 + Vite frontend
    src/
      components/
      composables/
      i18n/
      stores/
      utils/
      views/
      App.vue
      main.ts
```

## Code Style Guidelines

### Imports

- Always use static imports; avoid dynamic `import()` unless truly needed.
- Always include `.js` extension for relative TS/ESM imports.
- Use `import type` for type-only imports.
- Use `node:` prefix for Node built-ins.
- Import shared contracts from `@orchestrator/shared` instead of duplicating types.

### Formatting and File Organization

- Use double quotes consistently.
- Keep trailing commas in multi-line objects/arrays/parameters.
- Prefer small, focused modules in kebab-case filenames.
- Existing files commonly use header and section comment separators; keep consistency.

### Naming Conventions

- Variables/functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE`.
- Classes/enums/interfaces/types/components: `PascalCase`.
- Test files: `*.test.ts` in kebab-case.
- Composables: `useXxx.ts`.

### Types and Data Modeling

- Prefer `interface` for object contracts; use `type` for unions and aliases.
- Enums should use string values.
- Use `readonly` for immutable fields in shared contracts.
- Avoid `any`; use `unknown` and narrow with guards.

### Error Handling

- Wrap fallible operations in `try/catch`.
- Never swallow errors silently.
- Handle unknown errors with `instanceof Error` narrowing.
- Use consistent API envelope: `{ success, data, error }`.
- Prefer dedicated error classes (e.g., `HttpError`) for transport/domain errors.

### Backend and API Conventions

- Keep all HTTP routes under `/api/*`.
- Prefer router factories with dependency injection (e.g., `createXxxRouter(deps)`).
- Return typed JSON responses based on shared `ApiResponse<T>`.
- Do not hardcode secrets or deployment URLs; rely on env vars.

### Frontend (Vue 3) Conventions

- Use Vue 3 with `<script setup lang="ts">`.
- Use Pinia for shared/global state.
- Prefer `ref()` for reactivity unless `reactive()` is clearly better.
- Use scoped styles in SFCs.
- Use centralized HTTP utilities in `src/utils/http.ts`; do not call `fetch`/`axios` directly in views/stores/components.
- All user-facing strings must go through `vue-i18n` (`t("...")`).
- When adding new UI text, update both locale files:
  - `packages/web/src/i18n/locales/zh-CN.ts`
  - `packages/web/src/i18n/locales/en.ts`

## Testing Guidelines

- Test framework is Vitest in `packages/server/test`.
- Keep tests deterministic and isolated; clean temporary resources in `afterEach`.
- Prefer targeted runs during iteration (single file or `-t` pattern).
- Before delivery, run at least the relevant tests and a build for impacted packages.

## Cursor / Copilot Rule Files

Scanned locations and results:

- `.cursor/rules/`: not found
- `.cursorrules`: not found
- `.github/copilot-instructions.md`: not found

If these files are added later, merge their directives into this document and treat conflicts as high-priority review items.
