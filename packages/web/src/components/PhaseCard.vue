<template>
  <button
    type="button"
    class="phase-card"
    :class="statusClass"
    :aria-label="detailAriaLabel"
    @click="handleSelect"
  >
    <div class="phase-card__header">
      <span class="phase-card__index">{{ phaseIndex + 1 }}</span>
      <span class="phase-card__status-icon">{{ statusIcon }}</span>
    </div>

    <div class="phase-card__body">
      <div class="phase-card__id">{{ phaseId }}</div>
      <div class="phase-card__desc">{{ description }}</div>
      <div v-if="agentName" class="phase-card__agent">{{ agentName }}</div>
    </div>

    <div class="phase-card__footer">
      <span class="badge" :class="badgeClass">{{ statusLabel }}</span>
      <span v-if="retryCount > 0" class="phase-card__retry">
        {{ t('phase.retry') }}: {{ retryCount }}
      </span>
    </div>

    <div v-if="summary" class="phase-card__summary">
      {{ summary }}
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { PhaseRecord } from "@orchestrator/shared";

const { t } = useI18n();

const props = defineProps<{
  phase: PhaseRecord;
  phaseId: string;
  phaseIndex: number;
  description: string;
  isCurrent: boolean;
}>();

const emit = defineEmits<{
  select: [phaseId: string];
}>();

const agentName = computed(() => props.phase.agent);
const retryCount = computed(() => props.phase.retry_count);
const summary = computed(() => props.phase.summary);
const status = computed(() => props.phase.status);

const statusClass = computed(() => {
  const base = `phase-card--${status.value.toLowerCase()}`;
  return props.isCurrent ? `${base} phase-card--current` : base;
});

const badgeClass = computed(() => {
  switch (status.value) {
    case "PENDING": return "badge--idle";
    case "IN_PROGRESS": return "badge--running";
    case "SUCCESS": return "badge--completed";
    case "FAILED": return "badge--failed";
    case "SKIPPED": return "badge--idle";
    case "APPROVED_BY_HUMAN": return "badge--completed";
    default: return "badge--idle";
  }
});

const statusLabel = computed(() => {
  const key = `phase.status.${status.value}`;
  const translated = t(key);
  // 如果 key 没有匹配到翻译，返回原始值
  if (translated === key) {
    return status.value;
  }
  return translated;
});

const statusIcon = computed(() => {
  switch (status.value) {
    case "PENDING": return "\u25CB"; // ○
    case "IN_PROGRESS": return "\u25D4"; // ◔
    case "SUCCESS": return "\u2713"; // ✓
    case "FAILED": return "\u2717"; // ✗
    case "SKIPPED": return "\u2014"; // —
    case "APPROVED_BY_HUMAN": return "\u2713"; // ✓
    default: return "\u25CB";
  }
});

const detailAriaLabel = computed(() => {
  return t("phaseDetail.openAriaLabel", { phaseId: props.phaseId });
});

function handleSelect(): void {
  emit("select", props.phaseId);
}
</script>

<style scoped>
.phase-card {
  border: 1px solid var(--color-border);
  outline: none;
  cursor: pointer;
  text-align: left;
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  padding: 14px;
  min-width: 180px;
  max-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.phase-card:hover {
  box-shadow: var(--shadow-sm);
}

.phase-card:focus-visible {
  box-shadow: 0 0 0 2px var(--color-primary);
}

.phase-card--current {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary), var(--shadow-sm);
}

.phase-card--in_progress {
  border-color: var(--color-primary);
}

.phase-card--success,
.phase-card--approved_by_human {
  border-color: var(--color-success);
}

.phase-card--failed {
  border-color: var(--color-error);
}

.phase-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phase-card__index {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

.phase-card__status-icon {
  font-size: 1rem;
}

.phase-card--success .phase-card__status-icon,
.phase-card--approved_by_human .phase-card__status-icon {
  color: var(--color-success);
}

.phase-card--failed .phase-card__status-icon {
  color: var(--color-error);
}

.phase-card--in_progress .phase-card__status-icon {
  color: var(--color-primary);
  animation: pulse 2s ease-in-out infinite;
}

.phase-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.phase-card__id {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.phase-card__desc {
  font-size: 0.85rem;
  color: var(--color-text);
  line-height: 1.4;
}

.phase-card__agent {
  font-size: 0.75rem;
  color: var(--color-purple);
  font-family: var(--font-mono);
}

.phase-card__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.phase-card__retry {
  font-size: 0.7rem;
  color: var(--color-warning);
  font-family: var(--font-mono);
}

.phase-card__summary {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
  padding-top: 6px;
  line-height: 1.4;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
