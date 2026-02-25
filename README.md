# Opencode Orchestrator

<p align="center">
  <b>SDK-driven pipeline for AI agent coordination.</b>
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#中文">简体中文</a>
</p>

---

## <a id="english">English</a>

### Introduction

**Opencode Orchestrator** is a SDK-driven pipeline system designed for coordinating and managing AI agents. Built as a `pnpm` monorepo, it seamlessly integrates a highly structured backend (`@orchestrator/server`) with a modern, reactive frontend (`@orchestrator/web`), both sharing types and utilities through a common package (`@orchestrator/shared`).

### Architecture & Tech Stack

The project utilizes a strict modern stack focusing on type safety and modularity:

* **Package Manager**: `pnpm` workspace
* **Language**: TypeScript (Pure ESM, strictly typed)
* **Backend (`@orchestrator/server`)**: Node.js, Express, Vitest (for testing)
* **Frontend (`@orchestrator/web`)**: Vue 3 (Composition API / Script Setup), Vite, Pinia (State Management), Vue Router, Vue I18n
* **Shared (`@orchestrator/shared`)**: Pure TypeScript definitions and utilities

#### Directory Structure

```text
packages/
  ├── shared/          # @orchestrator/shared — Shared types & utilities (pure TS)
  ├── server/          # @orchestrator/server — Express backend API and Pipeline logic
  └── web/             # @orchestrator/web — Vue 3 + Vite frontend application
agents/                # Markdown instruction files for various sub-agent roles
```

### Getting Started

#### Prerequisites

* Node.js `>= 18.0.0`
* pnpm `>= 8.0.0`

#### Installation

```bash
# Install all dependencies at the root level
pnpm install
```

#### Build

Because of internal dependencies (shared -> server/web), you must build in sequence:

```bash
# Build all packages in the correct sequence
pnpm build

# Or build individually
pnpm build:shared
pnpm build:server
pnpm build:web
```

#### Development

```bash
# Start both server (port 3000) and web (port 5173) concurrently
pnpm dev

# Or start individually
pnpm dev:server
pnpm dev:web
```

#### Testing & Linting

```bash
# Run server tests (using Vitest)
pnpm test

# Run tests in watch mode
pnpm --filter @orchestrator/server test:watch

# Run linter across all packages
pnpm lint
```

### Core Concepts

* **Monorepo Strategy**: Uses `pnpm` workspaces for easy dependency sharing.
* **Pure ESM**: The entire project uses `"type": "module"`. Static imports with `.js` extensions are mandatory for relative files.
* **i18n Mandatory**: The frontend strictly uses `vue-i18n`. Hardcoded strings in components are prohibited.

For more detailed development instructions, please refer to the `AGENTS.md` file located at the project root.

---

## <a id="中文">简体中文</a>

### 项目简介

**Opencode Orchestrator** 是一个由 SDK 驱动的 AI 智能体（Agent）协调流水线系统。项目采用 `pnpm` Monorepo 架构进行构建，无缝集成了一个结构化后端（`@orchestrator/server`）与一个现代化的响应式前端（`@orchestrator/web`），同时通过公共包（`@orchestrator/shared`）共享类型定义和工具函数。

### 架构与技术栈

本项目采用了严格的现代技术栈，注重类型安全与模块化：

* **包管理器**: `pnpm` workspace
* **语言**: TypeScript (纯 ESM，严格类型检查)
* **后端 (`@orchestrator/server`)**: Node.js, Express, Vitest (单元测试)
* **前端 (`@orchestrator/web`)**: Vue 3 (Composition API / `<script setup>`), Vite, Pinia (状态管理), Vue Router, Vue I18n
* **公共包 (`@orchestrator/shared`)**: 纯 TypeScript 定义与通用工具

#### 目录结构

```text
packages/
  ├── shared/          # @orchestrator/shared — 共享类型和工具 (纯 TS)
  ├── server/          # @orchestrator/server — Express 后端 API 与流水线逻辑
  └── web/             # @orchestrator/web — Vue 3 + Vite 前端应用
agents/                # 针对不同子 Agent 角色的 Markdown 指令文件
```

### 快速开始

#### 环境要求

* Node.js `>= 18.0.0`
* pnpm `>= 8.0.0`

#### 安装依赖

```bash
# 在项目根目录执行，安装所有依赖
pnpm install
```

#### 构建项目

由于包之间存在依赖关系（shared -> server/web），构建必须按顺序执行：

```bash
# 顺序构建所有包
pnpm build

# 也可以单独构建
pnpm build:shared
pnpm build:server
pnpm build:web
```

#### 本地开发

```bash
# 同时启动后端服务（端口 3000）和前端页面（端口 5173）
pnpm dev

# 或者单独启动
pnpm dev:server
pnpm dev:web
```

#### 测试与代码风格检查

```bash
# 运行后端单元测试 (Vitest)
pnpm test

# 以监听模式运行测试
pnpm --filter @orchestrator/server test:watch

# 对所有包执行 lint 检查
pnpm lint
```

### 核心规范说明

* **Monorepo 策略**: 采用 `pnpm` workspaces 进行包管理。
* **纯 ESM 规范**: 整个项目配置了 `"type": "module"`，在相对路径引用时强制要求携带 `.js` 扩展名。
* **强制国际化 (i18n)**: 前端全面引入 `vue-i18n`，严禁在组件、Store 或页面模板中硬编码任何中英文字符串。

更多详细的开发指南和架构约束，请查阅根目录下的 `AGENTS.md` 文件。
