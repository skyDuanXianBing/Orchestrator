# Phase 1 Context Report — task_1771944100

## 目标
- 在“阶段详情弹窗”中实时展示任意 sub-agent 的操作时间线（Read/Glob/Grep/Command/Edit/Artifact…），并与现有汇总字段并存。

## 现状：服务端可观测点（SDK 事件 / 现有 SSE）
- Opencode SDK 事件订阅入口：`packages/server/src/pipeline/runner.ts:508` `startEventForwarding()` → `client.event.subscribe()`。
- 事件分发点：`packages/server/src/pipeline/runner.ts:546` `forwardSdkEvent(event, sessionId, phaseId, agent)`。
- 当前已处理并“写入黑板汇总字段 + 发 SSE”的只有：
  - `file.edited`：`packages/server/src/pipeline/runner.ts:582` → `appendChangedFile()` → `stateMachine.updatePhase(...changedFiles)` + emit `SSEEventType.BLACKBOARD_UPDATED`。
  - `command.executed`：`packages/server/src/pipeline/runner.ts:587` → `appendExecutedCommand()` → `stateMachine.updatePhase(...commandsExecuted)` + emit `SSEEventType.BLACKBOARD_UPDATED`。
- 其他事件（目前仅打 LOG 或忽略）：
  - `message.part.updated`：仅对 `part.type === "text"` 做 120 字预览日志（`packages/server/src/pipeline/runner.ts:567`）。
  - `session.status` / `session.error`：日志。

## 关键发现：Read/Glob/Grep/Edit/Artifact 的最小抓取点
- Opencode SDK 的 `message.part.updated` 事件里，`part` 是一个联合类型（Text/Tool/File/Patch…）。其中：
  - `ToolPart` 包含：`tool`(工具名)、`callID`、`state.status`(pending/running/completed/error)、`state.input`、`state.metadata`、`state.time.start/end`、以及 `attachments?: FilePart[]`。
  - `PatchPart` 包含：`hash` + `files[]`（可用于“编辑了哪些文件”的补充来源）。
  - `FilePart` 包含：`url`/`mime`/`filename`/`source.path`（可用于“artifact 产生/附件”线索）。
- 该类型定义来源：`node_modules/.pnpm/@opencode-ai+sdk@1.2.10/node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts`（关键：`ToolPart`/`ToolState*`/`PatchPart`/`FilePart`）。

## 黑板写入链路（PhaseRecord 如何在运行中更新）
- 运行时状态：`packages/shared/src/types/pipeline.ts` `PhaseRuntime`。
- 状态更新：`packages/server/src/core/state-machine.ts:161` `updatePhase()` → `blackboard.write()`。
- PipelineState → BlackboardJson 映射：`packages/server/src/core/blackboard.ts:161` `stateToBlackboard()`。
- 任务详情读取：`packages/server/src/services/task-manager.ts:151` `getTaskDetail()` 返回 `task.blackboardLatestJson` 解析后的 `BlackboardJson`。
- 重要：服务端启动时的 hydration 优先走 `phases` 表（`packages/server/src/services/task-manager.ts:398`），因此 PhaseRuntime 新增字段必须同步持久化到：
  - `packages/server/src/db/repositories/phase-repository.ts`（否则重启后时间线会丢）。

## 前端实时刷新现状（SSE → fetchTaskDetail）
- SSE 订阅：`packages/web/src/composables/useSSE.ts`；支持事件回放（后端写了 `id: seq`）。
- Task 详情页：`packages/web/src/views/TaskDetail.vue:153` 对 `BLACKBOARD_UPDATED` 等事件触发 `store.fetchTaskDetail()`。
- 阶段详情弹窗数据来源：`packages/web/src/components/PipelineGraph.vue` 将 `task.blackboard.phases[phaseId]` 作为 prop 传给 `PhaseDetailModal.vue`；因此只要 blackboard 更新并重新 fetch，弹窗会自动拿到新字段并更新 UI。

## 差距与建议的最小集成方式
1) **采集**：在 `forwardSdkEvent()` 里增强 `message.part.updated` 分支：
   - 当 `part.type === "tool"`：基于 `tool` + `state` 生成 OperationTimelineEntry（禁止落地 output/raw，允许提取计数/耗时/退出码/路径样本等）。
   - 当 `part.type === "patch"`：追加 `fs.edit` 类条目（仅 files[]）。
   - 当 `part.type === "file"`：作为 `artifact.add` 线索（仅 url/filename/source.path，必要时归一化/脱敏）。
2) **持久化**：PhaseRuntime/PhaseRecord 新增 `operations`（最多 500）与 `operations_seq`（单调递增）；写入链路必须覆盖：
   - `packages/shared/src/types/pipeline.ts` / `packages/shared/src/types/blackboard.ts`
   - `packages/server/src/core/state-machine.ts` 初始化默认值
   - `packages/server/src/core/blackboard.ts` 映射
   - `packages/server/src/db/repositories/phase-repository.ts` + DB schema（或改 hydration 走 blackboard JSON）
3) **汇总字段同步**：继续在 append 操作时增量更新：
   - `changed_files` ← edit/patch/file.edited 的 path
   - `commands_executed` ← command tool / command.executed（脱敏后）
   - `artifact_pointers` ← file part / tool attachments / agent 最终 artifact_pointers（去重累积）

## SSE 策略建议
- 最小成本：继续复用 `BLACKBOARD_UPDATED` 驱动前端 `fetchTaskDetail()`（无需新增前端通道）。
- 更推荐（高频操作更省流量）：新增增量 SSE（例如 `phase_operation_appended`），payload 仅含 `{ phaseId, entry }`；前端可在不拉全量 blackboard 的情况下将条目合并进 store，同时仍以 blackboard 持久化为“单一事实来源”。
