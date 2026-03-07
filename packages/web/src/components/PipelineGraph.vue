<template>
  <div class="pipeline-graph">
    <div class="pipeline-graph__title">
      {{ t('pipeline.title') }}
      <span class="pipeline-graph__count">
        {{ completedCount }}/{{ phaseEntries.length }}
      </span>
    </div>

    <div class="pipeline-graph__progress">
      <div
        class="pipeline-graph__progress-bar"
        :style="{ width: progressPercent + '%' }"
      ></div>
    </div>

    <div class="pipeline-graph__track">
      <template v-for="(entry, index) in phaseEntries" :key="entry.phaseId">
        <PhaseCard
          :phase="entry.record"
          :phase-id="entry.phaseId"
          :phase-index="index"
          :description="entry.description"
          :is-current="entry.phaseId === currentPhaseId"
          @select="handleOpenPhaseDetail"
        />
        <div
          v-if="index < phaseEntries.length - 1"
          class="pipeline-graph__connector"
          :class="connectorClass(entry.record.status)"
        >
          <span class="pipeline-graph__arrow">&#8594;</span>
        </div>
      </template>
    </div>

    <PhaseDetailModal
      v-if="selectedPhaseEntry"
      :phase-id="selectedPhaseEntry.phaseId"
      :description="selectedPhaseEntry.description"
      :phase="selectedPhaseEntry.record"
      @close="handleClosePhaseDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { BlackboardJson } from "@orchestrator/shared";
import PhaseCard from "./PhaseCard.vue";
import PhaseDetailModal from "./PhaseDetailModal.vue";

const { t } = useI18n();

const props = defineProps<{
  blackboard: BlackboardJson;
  currentPhaseId: string | null;
}>();

const selectedPhaseId = ref<string | null>(null);

interface PhaseEntry {
  phaseId: string;
  record: BlackboardJson["phases"][string];
  description: string;
}

const phaseEntries = computed<PhaseEntry[]>(() => {
  const phases = props.blackboard.phases;
  const ids = Object.keys(phases);

  // 按 phaseId 自然排序：phase_0, phase_0r, phase_1, ...
  ids.sort((a, b) => {
    const numA = parsePhaseNum(a);
    const numB = parsePhaseNum(b);
    if (numA !== numB) return numA - numB;
    // phase_0r 排在 phase_0 后面
    return a.length - b.length;
  });

  return ids.map((id) => ({
    phaseId: id,
    record: phases[id],
    description: getPhaseDescription(id),
  }));
});

const completedCount = computed(() => {
  return phaseEntries.value.filter(
    (e) => e.record.status === "SUCCESS" || e.record.status === "APPROVED_BY_HUMAN",
  ).length;
});

const progressPercent = computed(() => {
  if (phaseEntries.value.length === 0) return 0;
  return Math.round((completedCount.value / phaseEntries.value.length) * 100);
});

const selectedPhaseEntry = computed<PhaseEntry | null>(() => {
  if (!selectedPhaseId.value) {
    return null;
  }

  for (const entry of phaseEntries.value) {
    if (entry.phaseId === selectedPhaseId.value) {
      return entry;
    }
  }

  return null;
});

function getPhaseDescription(phaseId: string): string {
  const key = `pipeline.phaseDesc.${phaseId}`;
  const translated = t(key);
  // 如果 key 没有匹配到翻译，返回原始 phaseId
  if (translated === key) {
    return phaseId;
  }
  return translated;
}

function parsePhaseNum(id: string): number {
  const match = id.match(/phase_(\d+)/);
  return match ? Number(match[1]) : 0;
}

function connectorClass(status: string): string {
  if (status === "SUCCESS" || status === "APPROVED_BY_HUMAN") {
    return "pipeline-graph__connector--done";
  }
  return "";
}

function handleOpenPhaseDetail(phaseId: string): void {
  selectedPhaseId.value = phaseId;
}

function handleClosePhaseDetail(): void {
  selectedPhaseId.value = null;
}
</script>

<style scoped>
.pipeline-graph {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 251, 255, 0.97) 100%);
  box-shadow: var(--shadow-sm);
}

.pipeline-graph__title {
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.pipeline-graph__count {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.14);
}

.pipeline-graph__progress {
  height: 8px;
  background: var(--color-bg-input);
  border: 1px solid rgba(216, 227, 240, 0.92);
  border-radius: 999px;
  overflow: hidden;
}

.pipeline-graph__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.pipeline-graph__track {
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  padding: 8px 4px 16px;
}

.pipeline-graph__connector {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 0 8px;
  flex-shrink: 0;
}

.pipeline-graph__connector::before {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 999px;
  background: var(--color-border-strong);
}

.pipeline-graph__arrow {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: #ffffff;
  color: var(--color-text-muted);
  font-size: 1rem;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
}

.pipeline-graph__connector--done::before {
  background: rgba(22, 163, 74, 0.45);
}

.pipeline-graph__connector--done .pipeline-graph__arrow {
  color: var(--color-success);
  border-color: rgba(22, 163, 74, 0.24);
  background: rgba(22, 163, 74, 0.08);
}

@media (max-width: 768px) {
  .pipeline-graph {
    padding: 16px;
  }
}
</style>
