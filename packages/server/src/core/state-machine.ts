// ============================================
// core/state-machine.ts — 流水线状态机
// ============================================

import type {
  Category,
  PhaseDefinition,
  PhaseRuntime,
  PipelineState,
} from "@orchestrator/shared";
import type { Mode } from "@orchestrator/shared";
import {
  Category as PipelineCategory,
  Mode as PipelineMode,
  PhaseStatus,
} from "@orchestrator/shared";
import { getBasePhases, getMiniOverridePhases } from "../pipeline/categories.js";
import { getModePhases } from "../pipeline/modes.js";
import type { BlackboardManager } from "./blackboard.js";

export class PipelineStateMachine {
  private state: PipelineState;
  private phases: readonly PhaseDefinition[];
  private blackboard: BlackboardManager;

  private shouldUseLegacyFastModifyFlow(
    category: Category,
    mode: Mode,
    initialState?: PipelineState,
  ): boolean {
    if (!initialState) {
      return false;
    }

    if (category !== PipelineCategory.MODIFY || mode !== PipelineMode.FAST) {
      return false;
    }

    return Object.prototype.hasOwnProperty.call(initialState.phases, "phase_3")
      || Object.prototype.hasOwnProperty.call(initialState.phases, "phase_4");
  }

  private resolvePhases(
    category: Category,
    mode: Mode,
    initialState?: PipelineState,
  ): readonly PhaseDefinition[] {
    if (mode === PipelineMode.MINI) {
      return getMiniOverridePhases(category);
    }

    const basePhases = getBasePhases(category);

    if (this.shouldUseLegacyFastModifyFlow(category, mode, initialState)) {
      return getModePhases(category, PipelineMode.BALANCED, basePhases);
    }

    return getModePhases(category, mode, basePhases);
  }

  private createDefaultPhaseRuntime(phase: PhaseDefinition): PhaseRuntime {
    return {
      phaseType: phase.type,
      agent: phase.agent,
      status: PhaseStatus.PENDING,
      retryCount: 0,
      startedAt: null,
      finishedAt: null,
      sessionId: null,
      taskId: null,
      artifacts: [],
      changedFiles: [],
      commandsExecuted: [],
      readFiles: [],
      operations: [],
      operationsSeq: 0,
      errorSummary: null,
      summary: null,
    };
  }

  private normalizeInitialState(state: Readonly<PipelineState>): PipelineState {
    const normalizedPhases: Record<string, PhaseRuntime> = {};

    for (const phase of this.phases) {
      const runtime = state.phases[phase.phaseId];
      if (runtime) {
        normalizedPhases[phase.phaseId] = {
          ...runtime,
          artifacts: [...runtime.artifacts],
          changedFiles: [...runtime.changedFiles],
          commandsExecuted: [...runtime.commandsExecuted],
          readFiles: runtime.readFiles ? [...runtime.readFiles] : [],
          operations: runtime.operations ? [...runtime.operations] : [],
          operationsSeq: runtime.operationsSeq ?? 0,
        };
      } else {
        normalizedPhases[phase.phaseId] = this.createDefaultPhaseRuntime(phase);
      }
    }

    let currentPhaseIndex = state.currentPhaseIndex;
    if (currentPhaseIndex < 0) {
      currentPhaseIndex = 0;
    }
    if (currentPhaseIndex > this.phases.length) {
      currentPhaseIndex = this.phases.length;
    }

    return {
      ...state,
      currentPhaseIndex,
      phases: normalizedPhases,
    };
  }

  constructor(
    taskId: string,
    category: Category,
    mode: Mode,
    userRequirement: string,
    projectPath: string,
    blackboard: BlackboardManager,
    initialState?: PipelineState,
  ) {
    // MINI 使用专用最小流水线；其他模式按基础阶段与模式规则组装最终阶段序列。
    this.phases = this.resolvePhases(category, mode, initialState);

    this.blackboard = blackboard;

    if (initialState) {
      this.state = this.normalizeInitialState(initialState);
      return;
    }

    // 初始化运行时状态
    const now = new Date().toISOString();
    this.state = {
      taskId,
      category,
      mode,
      currentPhaseIndex: 0,
      phases: {},
      docPath: `doc/${userRequirement.substring(0, 20)}/`,
      projectPath,
      userRequirement,
      createdAt: now,
      updatedAt: now,
    };

    // 为每个阶段创建初始运行时状态
    for (const phase of this.phases) {
      this.state.phases[phase.phaseId] = this.createDefaultPhaseRuntime(phase);
    }
  }

  /** 获取当前阶段定义 */
  getCurrentPhase(): PhaseDefinition | null {
    if (this.state.currentPhaseIndex >= this.phases.length) {
      return null; // 流水线完成
    }
    return this.phases[this.state.currentPhaseIndex];
  }

  /** 门禁通过 → 推进到下一阶段 */
  advance(): void {
    this.state.currentPhaseIndex++;
    this.state.updatedAt = new Date().toISOString();
    const currentPhase = this.getCurrentPhase();
    const currentPhaseId = currentPhase ? currentPhase.phaseId : null;
    this.blackboard.write(this.state, "advance", currentPhaseId);
  }

  /** 当前阶段是否已完成整个流水线 */
  isComplete(): boolean {
    return this.state.currentPhaseIndex >= this.phases.length;
  }

  /** 获取总阶段数 */
  getTotalPhases(): number {
    return this.phases.length;
  }

  /** 获取当前阶段索引 */
  getCurrentPhaseIndex(): number {
    return this.state.currentPhaseIndex;
  }

  /** 将 currentPhaseIndex 设置到指定位置（用于人工审阅后回退） */
  setCurrentPhaseIndex(index: number): void {
    if (index < 0 || index > this.phases.length) {
      throw new Error(`Invalid phase index: ${index}`);
    }
    this.state.currentPhaseIndex = index;
    this.state.updatedAt = new Date().toISOString();
    const currentPhase = this.getCurrentPhase();
    const currentPhaseId = currentPhase ? currentPhase.phaseId : null;
    this.blackboard.write(this.state, "set_current_phase_index", currentPhaseId);
  }

  /** 获取所有阶段定义 */
  getPhaseDefinitions(): readonly PhaseDefinition[] {
    return this.phases;
  }

  /** 更新指定阶段的运行时状态 */
  updatePhase(phaseId: string, update: Partial<PhaseRuntime>): void {
    const existing = this.state.phases[phaseId];
    if (!existing) {
      throw new Error(`Phase ${phaseId} not found in state`);
    }
    this.state.phases[phaseId] = { ...existing, ...update };
    this.state.updatedAt = new Date().toISOString();
    const currentPhase = this.getCurrentPhase();
    const currentPhaseId = currentPhase ? currentPhase.phaseId : null;
    this.blackboard.write(this.state, `update_phase:${phaseId}`, currentPhaseId);
  }

  /** 获取当前完整状态（只读快照） */
  getState(): Readonly<PipelineState> {
    return this.state;
  }
}
