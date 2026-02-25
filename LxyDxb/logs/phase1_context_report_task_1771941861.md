# 阶段详情弹窗实时更新 — 现状梳理与最小改动建议（Phase 1 Context）

## 需求要点（对齐口径）

- 以 Blackboard 中 `PhaseRecord` 为单一事实来源：`status/started_at/finished_at/changed_files/commands_executed/artifact_pointers/summary/error_summary`。
- 实时优先级：SSE 推送驱动；SSE 不可用时轮询降级；执行中耗时每 1 秒动态递增，完成后冻结。

需求文档：`doc/阶段详情实时展示/01_需求规格说明书.md:12`

## 当前数据流（Server → Web → Modal）

1) Task 详情与黑板

- Web：`packages/web/src/views/TaskDetail.vue:136` 首次 `store.fetchTaskDetail(taskId)` 拉取 `GET /api/task/:id`。
- Server：`packages/server/src/routes/task.ts:80` → `TaskManager.getTaskDetail()` 返回 `TaskDetailResponse.blackboard`（类型：`packages/shared/src/types/api.ts:35`）。
- 黑板持久化：`PipelineStateMachine.updatePhase()` / `advance()` / `setCurrentPhaseIndex()` 触发 `BlackboardManager.write()`（`packages/server/src/core/state-machine.ts:119`，`packages/server/src/core/blackboard.ts:93`）。

2) SSE 事件

- Server SSE 路由：`GET /api/events/:taskId`（`packages/server/src/routes/events.ts:33`），支持按 seq 回放历史事件（Last-Event-ID / lastSeq）。
- 事件来源：`PipelineRunner.emit()` → `EventBus.emit()`（`packages/server/src/pipeline/runner.ts:628`，`packages/server/src/utils/event-bus.ts:32`）。

3) Modal 的数据来源

- `PipelineGraph` 从 `task.blackboard.phases` 读取 `PhaseRecord`，并直接把 record 传入 `PhaseDetailModal`（`packages/web/src/components/PipelineGraph.vue:37`）。
- 因此弹窗是否“实时”，取决于 `TaskDetail` 页是否及时刷新 `task.blackboard`。

## BLACKBOARD_UPDATED：发射位置与载荷

- 定义：`SSEEventType.BLACKBOARD_UPDATED = "blackboard_updated"`（`packages/shared/src/types/events.ts:20`）。
- 仅有一个 emit 点：`packages/server/src/pipeline/runner.ts:583`，由 opencode SDK 事件 `file.edited` 触发。
- 当前载荷仅包含：`{ phaseId, file }`（`packages/server/src/pipeline/runner.ts:583`），不包含 blackboard 全量/phaseRecord 全量/版本号。

结论：前端想拿到最新 PhaseRecord，只能在收到该事件后再调用 `GET /api/task/:id`（当前就是这么做的）。

## PhaseRecord 是否会“执行中增量更新”

- 会在阶段开始时落盘一次：写入 `IN_PROGRESS + started_at`（`packages/server/src/pipeline/runner.ts:242`）。
- 会在阶段结束时落盘一次：写入 `SUCCESS/FAILED + finished_at + lists + summary/error_summary`（`packages/server/src/pipeline/runner.ts:318`）。
- **执行中不会逐步追加** `changed_files/commands_executed/artifact_pointers`：
  - 虽然 `file.edited` 会 emit `BLACKBOARD_UPDATED`，但当前不会 `stateMachine.updatePhase()` 去把 `file` 追加进 `changedFiles`。
  - `command.executed` 已在 `extractEventSessionId()` 中识别，但 `forwardSdkEvent()` 未处理该事件，也不会写入 `commandsExecuted`。

结论：当前 UI 的“执行中增量列表”无法靠 blackboard 自然实现（blackboard 本身不变），只能等阶段结束一次性出现。

## Web 侧实时刷新与计时的主要缺口

1) SSE 刷新事件缺口

- `TaskDetail.vue` 订阅的 `refreshEvents` 不包含 `PHASE_STARTED`（`packages/web/src/views/TaskDetail.vue:141`），导致 `started_at/status=IN_PROGRESS` 的可见性依赖 5s polling，无法满足 1s 目标。

2) Polling 未做“降级”，而是常驻

- 当前实现：无论 SSE 是否连接成功，`polling.start()` 都会启动且不会自动停止（`packages/web/src/views/TaskDetail.vue:133`）。
- 这与“SSE-first + polling fallback”的产品口径不一致。

3) 进行中耗时不会每秒跳动

- `PhaseDetailModal.vue` 的 duration 计算使用 `Date.now()`（`packages/web/src/components/PhaseDetailModal.vue:188`），但没有定时 reactive tick；因此只会在 props 变化时重算，不会每秒更新。

4) 潜在的 SSE handler 重复触发

- `useSSE.connect()` 已对每个 eventType 建立 listener，并在内部调用 `handlers.get(eventType)`（`packages/web/src/composables/useSSE.ts:175`）。
- 但 `useSSE.on()` 在 `eventSource` 已存在时还会再 `addEventListener()` 一次（`packages/web/src/composables/useSSE.ts:43`）。
- `TaskDetail.vue` 里 `sse.connect()` 先执行、再 `sse.on(...)` 注册刷新（`packages/web/src/views/TaskDetail.vue:136`），会导致同一事件可能触发两次 `fetchTaskDetail()`（一次来自 connect 内部 listener，一次来自 on 动态 listener）。

## 最小改动建议（不改交互/布局）

### Web（SSE 优先 + 轮询降级 + 动态耗时）

- 在 `packages/web/src/views/TaskDetail.vue:141` 的 `refreshEvents` 增加：`SSEEventType.PHASE_STARTED`（必要时也可加 `PIPELINE_STARTED`）。
- Polling 改为 fallback：watch `sse.connected`，断开时按 2s 轮询 `fetchTaskDetail()`，连接恢复后停止轮询。
- `PhaseDetailModal` 增加 1s timer tick（仅当 `started_at` 存在、`finished_at == null` 且 `status == IN_PROGRESS` 时启用），完成后停止并冻结。
- 清理/修正 `useSSE.on()` 的动态 addEventListener 行为，避免重复触发（保留“Map handlers + connect 内统一派发”即可）。

### Server（让黑板在执行中真正增量可见）

- 在 `packages/server/src/pipeline/runner.ts:546` 的 `forwardSdkEvent()`：
  - `file.edited` 时，将 `event.properties.file` 去重追加进当前 phase 的 `changedFiles`，通过 `stateMachine.updatePhase(phaseId, { changedFiles: next })` 写入黑板，然后再 emit `BLACKBOARD_UPDATED`。
  - 增加对 `command.executed` 的处理：追加到 `commandsExecuted`，同样写入黑板。

这样前端继续沿用现有策略（收到事件→`fetchTaskDetail()`）就能在弹窗看到“执行中逐步追加”。
