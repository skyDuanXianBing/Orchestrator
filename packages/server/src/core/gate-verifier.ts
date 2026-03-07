// ============================================
// core/gate-verifier.ts — 门禁校验器
// ============================================

import type { Category, Mode, PhaseRecord } from "@orchestrator/shared";
import { Category as PipelineCategory, Mode as PipelineMode, PhaseType } from "@orchestrator/shared";

interface GateVerifyOptions {
  category?: Category;
  mode?: Mode;
}

export interface GateResult {
  passed: boolean;
  reason: string;
}

export class GateVerifier {
  private hasArbitrationPassOverride(phaseRecord: PhaseRecord): boolean {
    const arbitration = phaseRecord.arbitration;
    if (!arbitration) {
      return false;
    }

    if (arbitration.recommended_action !== "PASS_WITH_WARN") {
      return false;
    }

    if (arbitration.risk_level === "HIGH" || arbitration.uncertain) {
      return false;
    }

    return true;
  }

  private shouldRelaxArtifactRequirement(options?: GateVerifyOptions): boolean {
    return options?.mode === PipelineMode.MINI || options?.category === PipelineCategory.READ;
  }

  private hasExecutionEvidence(phaseRecord: PhaseRecord): boolean {
    return phaseRecord.artifact_pointers.length > 0 || phaseRecord.changed_files.length > 0;
  }

  /**
   * 验证指定阶段是否满足门禁条件
   * 纯确定性逻辑，不依赖 LLM 判断
   */
  verify(phaseRecord: PhaseRecord, phaseType: PhaseType, options?: GateVerifyOptions): GateResult {
    // 人类审阅门禁：检查是否已获批准
    if (phaseType === PhaseType.HUMAN_REVIEW) {
      if (phaseRecord.status === "APPROVED_BY_HUMAN") {
        return { passed: true, reason: "用户已批准需求文档" };
      }
      return { passed: false, reason: "等待用户审阅需求文档" };
    }

    const shouldRelaxArtifactRequirement = this.shouldRelaxArtifactRequirement(options);
    const hasArbitrationPassOverride = this.hasArbitrationPassOverride(phaseRecord);

    // 代理门禁：检查 3 个硬性条件
    const conditions: Array<{ check: boolean; label: string }> = [
      {
        check: phaseRecord.status === "SUCCESS" || hasArbitrationPassOverride,
        label: `status 为 ${phaseRecord.status}，需要 SUCCESS`,
      },
      {
        check: phaseRecord.finished_at !== null,
        label: `finished_at 为 ${phaseRecord.finished_at}，需要非空`,
      },
      {
        check: shouldRelaxArtifactRequirement
          ? true
          : this.hasExecutionEvidence(phaseRecord),
        label: "缺少产出物或变更文件记录",
      },
    ];

    const failures = conditions.filter((c) => !c.check);

    if (failures.length === 0) {
      return { passed: true, reason: "所有门禁条件满足" };
    }

    const reasons = failures.map((f) => f.label).join("; ");
    return { passed: false, reason: reasons };
  }
}
