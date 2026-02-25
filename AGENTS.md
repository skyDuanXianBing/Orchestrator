# AGENTS.md — Orchestrator

> Opencode Orchestrator: SDK-driven pipeline for AI agent coordination.
> pnpm monorepo with three packages: `server`, `shared`, `web`.

## Build / Lint / Test Commands

```bash
# ── Install ──
pnpm install

# ── Build (order matters: shared → server → web) ──
pnpm build              # builds all three in sequence
pnpm build:shared       # pnpm --filter @orchestrator/shared build
pnpm build:server       # pnpm --filter @orchestrator/server build
pnpm build:web          # pnpm --filter @orchestrator/web build

# ── Dev ──
pnpm dev                # starts server (port 3000) & web (port 5173) concurrently
pnpm dev:server         # tsx watch packages/server/src/index.ts
pnpm dev:web            # vite dev server

# ── Test (vitest, server package only) ──
pnpm test                                           # run all server tests once
pnpm --filter @orchestrator/server test:watch        # vitest in watch mode

# Run a single test file:
pnpm --filter @orchestrator/server exec vitest run test/circuit-breaker.test.ts

# Run a single test by name:
pnpm --filter @orchestrator/server exec vitest run -t "should stop after max retries"

# ── Lint ──
pnpm lint               # runs lint across all packages (pnpm -r lint)

# ── Clean ──
pnpm clean              # removes dist/ in all packages
```

## Project Structure

```
packages/
  shared/          # @orchestrator/shared — shared types & utilities (pure TS, no runtime deps)
    src/types/     # pipeline.ts, api.ts, events.ts, blackboard.ts, agent-result.ts
  server/          # @orchestrator/server — Express backend
    src/
      core/        # blackboard, circuit-breaker, client, gate-verifier, prompt-builder, state-machine
      pipeline/    # categories.ts, modes.ts, runner.ts
      routes/      # task.ts, pipeline.ts, events.ts, health.ts
      services/    # task-manager.ts
      utils/       # event-bus.ts, id-generator.ts, logger.ts
    test/          # vitest test files (*.test.ts)
  web/             # @orchestrator/web — Vue 3 + Vite frontend
    src/
      components/  # AppHeader, PhaseCard, PipelineGraph, LogStream, etc.
      composables/ # useSSE.ts, usePolling.ts
      stores/      # Pinia stores (task.ts)
      utils/       # http.ts (centralized HTTP client)
      views/       # Dashboard, CreateTask, TaskDetail
      i18n/        # vue-i18n translations
agents/            # Agent instruction markdown files (one per sub-agent role)
```

## TypeScript Configuration

- **Target**: ES2022, **Module**: ESNext, **Module Resolution**: bundler
- **Strict mode** is enabled globally (`tsconfig.base.json`)
- All packages use `"type": "module"` in package.json (pure ESM)
- Server & shared emit declarations (`declaration: true`, `declarationMap: true`)
- Web disables declarations; uses `jsx: "preserve"` with `jsxImportSource: "vue"`

## Code Style Guidelines

### Imports

- **Always use `.js` extensions** in relative imports (ESM requirement):
  ```ts
  import { TaskManager } from "./services/task-manager.js";  // correct
  import { TaskManager } from "./services/task-manager";     // wrong
  ```
- Use `import type` for type-only imports; separate value and type imports:
  ```ts
  import { Router } from "express";
  import type { Request, Response } from "express";
  ```
- Import shared types from `@orchestrator/shared` (workspace dependency):
  ```ts
  import { Category, Mode, PhaseStatus } from "@orchestrator/shared";
  import type { PipelineState, BlackboardJson } from "@orchestrator/shared";
  ```
- Use `node:` prefix for Node.js built-in modules:
  ```ts
  import fs from "node:fs";
  import path from "node:path";
  ```
- **Static imports only** — no dynamic `import()` unless lazy loading is required.

### Formatting & File Structure

- Double quotes for strings.
- Trailing commas in multi-line structures.
- File headers follow this pattern:
  ```ts
  // ============================================
  // module/file.ts — Brief Chinese description
  // ============================================
  ```
- Section separators within files use: `// ─── Section Name ───`

### Naming Conventions

| Kind              | Convention       | Example                       |
|-------------------|------------------|-------------------------------|
| Variables/funcs   | camelCase        | `taskManager`, `fetchTasks`   |
| Constants         | UPPER_SNAKE_CASE | `MAX_RETRIES`, `CORS_ORIGIN`  |
| Classes           | PascalCase       | `CircuitBreaker`, `EventBus`  |
| Enums             | PascalCase       | `PhaseStatus`, `Category`     |
| Enum members      | UPPER_SNAKE_CASE | `IN_PROGRESS`, `AGENT_GATE`   |
| Interfaces/Types  | PascalCase       | `PhaseRuntime`, `SSELogEntry` |
| Files             | kebab-case       | `circuit-breaker.ts`          |
| Vue components    | PascalCase       | `PhaseCard.vue`               |
| Composables       | camelCase `use*` | `useSSE.ts`, `usePolling.ts`  |
| Test files        | kebab-case       | `circuit-breaker.test.ts`     |

### Types & Interfaces

- Prefer `interface` for object shapes; use `type` for unions/aliases.
- Enums use string values (not numeric): `PENDING = "PENDING"`.
- Mark immutable definitions with `readonly`:
  ```ts
  export interface PhaseDefinition {
    readonly phaseId: string;
    readonly agent: AgentName | null;
  }
  ```
- Explicit return types on all exported functions.
- Use `unknown` instead of `any`; narrow with type guards or `instanceof`.

### Error Handling

- Wrap fallible operations in `try/catch`; never silently swallow errors.
- Pattern for catching unknown errors:
  ```ts
  catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
  }
  ```
- API responses use unified `ApiResponse<T>` envelope: `{ success, data, error }`.
- Use custom error classes where appropriate (e.g., `HttpError`).

### Vue 3 / Frontend

- **Vue 3 with `<script setup lang="ts">`** — no Options API.
- **Pinia** for all global state; use Composition API style (`defineStore("name", () => {})`).
- Prefer `ref()` over `reactive()`.
- Scoped styles: `<style scoped>`.
- **Centralized HTTP**: all requests go through `utils/http.ts` (`httpGet`, `httpPost`, `httpDelete`). Never use raw `fetch()` or `axios` directly in components/stores.
- Composables go in `composables/` and are named `use*.ts`.
- **Internationalization (MANDATORY)**: All user-facing text in the frontend **MUST** use `vue-i18n` (`t('key')`)。**STRICTLY PROHIBITED** to hardcode any visible text (Chinese, English, or any language) in templates, components, stores, or composables. This includes but is not limited to: button labels, form placeholders, status text, error messages, select/option display text, table headers, and tooltips. New i18n keys must be added to both `i18n/locales/zh-CN.ts` and `i18n/locales/en.ts` simultaneously.

### API Design

- All routes prefixed with `/api/`.
- Vite dev proxy forwards `/api` to `http://localhost:3000`.
- Consistent JSON response: `{ success: boolean; data: T | null; error: string | null }`.
- Router factories: `createXxxRouter(dependencies): Router`.

### Testing

- **Framework**: Vitest (server package).
- Tests live in `packages/server/test/` as `*.test.ts`.
- Import test utilities from vitest: `import { describe, expect, it, afterEach } from "vitest"`.
- Use temp directories for filesystem tests; clean up in `afterEach`.
- Shared package has a manual verification script: `node packages/shared/test/verify-agent-result.mjs`.

### Environment & Configuration

- Node.js >= 18, pnpm >= 8.
- No hardcoded URLs — use env vars (`PORT`, `CORS_ORIGIN`, `DEBUG`).
- `.env` files are gitignored; never commit secrets.
