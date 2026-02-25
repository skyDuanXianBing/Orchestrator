<template>
  <div class="phase-detail-modal__overlay" @click="handleClose">
    <div
      class="phase-detail-modal__dialog card"
      role="dialog"
      aria-modal="true"
      :aria-label="dialogAriaLabel"
      @click.stop
    >
      <div class="phase-detail-modal__header">
        <div>
          <h3 class="phase-detail-modal__title">{{ title }}</h3>
          <p class="phase-detail-modal__description">{{ description }}</p>
        </div>

        <button
          type="button"
          class="btn btn--sm"
          :aria-label="t('phaseDetail.close')"
          @click="handleClose"
        >
          {{ t("phaseDetail.close") }}
        </button>
      </div>

      <div class="phase-detail-modal__content">
        <div class="phase-detail-modal__row">
          <span class="phase-detail-modal__label">{{ t("phaseDetail.fields.status") }}</span>
          <span class="phase-detail-modal__value">{{ statusLabel }}</span>
        </div>

        <div class="phase-detail-modal__row">
          <span class="phase-detail-modal__label">{{ t("phaseDetail.fields.startedAt") }}</span>
          <span class="phase-detail-modal__value">{{ startedAtLabel }}</span>
        </div>

        <div class="phase-detail-modal__row">
          <span class="phase-detail-modal__label">{{ t("phaseDetail.fields.finishedAt") }}</span>
          <span class="phase-detail-modal__value">{{ finishedAtLabel }}</span>
        </div>

        <div class="phase-detail-modal__row">
          <span class="phase-detail-modal__label">{{ t("phaseDetail.fields.duration") }}</span>
          <span class="phase-detail-modal__value">{{ durationLabel }}</span>
        </div>

        <div class="phase-detail-modal__section">
          <div class="phase-detail-modal__label">{{ t("phaseDetail.fields.summary") }}</div>
          <div class="phase-detail-modal__block">{{ summaryLabel }}</div>
        </div>

        <div class="phase-detail-modal__section">
          <div class="phase-detail-modal__label">{{ t("phaseDetail.fields.errorSummary") }}</div>
          <div class="phase-detail-modal__block">{{ errorSummaryLabel }}</div>
        </div>

        <div class="phase-detail-modal__section">
          <div class="phase-detail-modal__label">{{ t("phaseDetail.fields.readFiles") }}</div>
          <ul v-if="readFiles.length > 0" class="phase-detail-modal__list">
            <li v-for="item in readFiles" :key="item" class="phase-detail-modal__list-item">
              {{ item }}
            </li>
          </ul>
          <div v-else class="phase-detail-modal__block">{{ t("phaseDetail.emptyList") }}</div>
        </div>

        <div class="phase-detail-modal__section">
          <div class="phase-detail-modal__label">{{ t("phaseDetail.fields.changedFiles") }}</div>
          <ul v-if="phase.changed_files.length > 0" class="phase-detail-modal__list">
            <li v-for="item in phase.changed_files" :key="item" class="phase-detail-modal__list-item">
              {{ item }}
            </li>
          </ul>
          <div v-else class="phase-detail-modal__block">{{ t("phaseDetail.emptyList") }}</div>
        </div>

        <div class="phase-detail-modal__section">
          <div class="phase-detail-modal__label">{{ t("phaseDetail.fields.commandsExecuted") }}</div>
          <ul v-if="phase.commands_executed.length > 0" class="phase-detail-modal__list">
            <li
              v-for="item in phase.commands_executed"
              :key="item"
              class="phase-detail-modal__list-item"
            >
              {{ item }}
            </li>
          </ul>
          <div v-else class="phase-detail-modal__block">{{ t("phaseDetail.emptyList") }}</div>
        </div>

        <div class="phase-detail-modal__section">
          <div class="phase-detail-modal__label">{{ t("phaseDetail.fields.artifactPointers") }}</div>
          <ul v-if="phase.artifact_pointers.length > 0" class="phase-detail-modal__list">
            <li
              v-for="item in phase.artifact_pointers"
              :key="item"
              class="phase-detail-modal__list-item"
            >
              {{ item }}
            </li>
          </ul>
          <div v-else class="phase-detail-modal__block">{{ t("phaseDetail.emptyList") }}</div>
        </div>

        <div class="phase-detail-modal__section">
          <div class="phase-detail-modal__label">{{ t("phaseDetail.fields.operationsTimeline") }}</div>
          <div
            v-if="operations.length > 0"
            ref="operationsTimelineRef"
            class="phase-detail-modal__timeline"
            @scroll="handleOperationsScroll"
          >
            <details
              v-for="entry in operations"
              :key="entry.op_id"
              class="phase-detail-modal__timeline-item"
            >
              <summary class="phase-detail-modal__timeline-summary">
                <span class="phase-detail-modal__timeline-time">{{ formatDateTime(entry.ts) }}</span>
                <span class="phase-detail-modal__timeline-type">{{ operationTypeLabel(entry.op_type) }}</span>
                <span class="phase-detail-modal__timeline-state">{{ operationStateLabel(entry.state) }}</span>
                <span class="phase-detail-modal__timeline-label">{{ entry.label }}</span>
              </summary>

              <div class="phase-detail-modal__timeline-body">
                <div class="phase-detail-modal__timeline-row">
                  <span class="phase-detail-modal__timeline-key">{{ t("phaseDetail.timeline.seq") }}</span>
                  <span class="phase-detail-modal__timeline-value">{{ entry.seq }}</span>
                </div>

                <div v-if="entry.target" class="phase-detail-modal__timeline-row">
                  <span class="phase-detail-modal__timeline-key">{{ t("phaseDetail.timeline.target") }}</span>
                  <pre class="phase-detail-modal__timeline-value">{{ formatJson(entry.target) }}</pre>
                </div>

                <div v-if="entry.meta" class="phase-detail-modal__timeline-row">
                  <span class="phase-detail-modal__timeline-key">{{ t("phaseDetail.timeline.meta") }}</span>
                  <pre class="phase-detail-modal__timeline-value">{{ formatJson(entry.meta) }}</pre>
                </div>

                <div v-if="entry.redaction" class="phase-detail-modal__timeline-row">
                  <span class="phase-detail-modal__timeline-key">{{ t("phaseDetail.timeline.redaction") }}</span>
                  <pre class="phase-detail-modal__timeline-value">{{ formatJson(entry.redaction) }}</pre>
                </div>
              </div>
            </details>
          </div>
          <div v-else class="phase-detail-modal__block">{{ t("phaseDetail.emptyList") }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { BlackboardJson, OperationTimelineEntry } from "@orchestrator/shared";

const props = defineProps<{
  phaseId: string;
  description: string;
  phase: BlackboardJson["phases"][string];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t, locale } = useI18n();
const durationTick = ref(Date.now());
let durationTimer: ReturnType<typeof setInterval> | null = null;
const OPERATIONS_AUTO_SCROLL_THRESHOLD_PX = 48;
const operationsTimelineRef = ref<HTMLDivElement | null>(null);
const shouldAutoScrollOperations = ref(true);

const title = computed(() => {
  return t("phaseDetail.title", { phaseId: props.phaseId });
});

const dialogAriaLabel = computed(() => {
  return t("phaseDetail.dialogAriaLabel", { phaseId: props.phaseId });
});

const statusLabel = computed(() => {
  const key = `phase.status.${props.phase.status}`;
  const translated = t(key);
  if (translated === key) {
    return props.phase.status;
  }
  return translated;
});

const startedAtLabel = computed(() => {
  return formatDateTime(props.phase.started_at);
});

const finishedAtLabel = computed(() => {
  return formatDateTime(props.phase.finished_at);
});

const durationLabel = computed(() => {
  const duration = calculateDuration(durationTick.value);
  if (duration === null) {
    return t("phaseDetail.notAvailable");
  }
  return formatDuration(duration);
});

watch(
  () => [props.phase.status, props.phase.started_at, props.phase.finished_at],
  () => {
    if (shouldRunDurationTimer()) {
      durationTick.value = Date.now();
      startDurationTimer();
      return;
    }

    stopDurationTimer();
  },
  { immediate: true },
);

onUnmounted(() => {
  stopDurationTimer();
});

const summaryLabel = computed(() => {
  if (!props.phase.summary || props.phase.summary.trim().length === 0) {
    return t("phaseDetail.emptyText");
  }
  return props.phase.summary;
});

const errorSummaryLabel = computed(() => {
  if (!props.phase.error_summary || props.phase.error_summary.trim().length === 0) {
    return t("phaseDetail.emptyText");
  }
  return props.phase.error_summary;
});

const readFiles = computed<string[]>(() => {
  if (!props.phase.read_files) {
    return [];
  }

  return [...props.phase.read_files];
});

const operations = computed<OperationTimelineEntry[]>(() => {
  if (!props.phase.operations || props.phase.operations.length === 0) {
    return [];
  }

  const deduped = new Map<string, OperationTimelineEntry>();

  for (const operation of props.phase.operations) {
    if (!deduped.has(operation.op_id)) {
      deduped.set(operation.op_id, operation);
    }
  }

  const sorted = Array.from(deduped.values());
  sorted.sort((a, b) => a.seq - b.seq);
  return sorted;
});

watch(
  () => operations.value.length,
  async (newLength, oldLength) => {
    if (newLength === 0) {
      shouldAutoScrollOperations.value = true;
      return;
    }

    if (newLength <= oldLength) {
      return;
    }

    if (!shouldAutoScrollOperations.value && oldLength > 0) {
      return;
    }

    await nextTick();
    scrollOperationsToBottom();
  },
);

function handleClose(): void {
  emit("close");
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return t("phaseDetail.notAvailable");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale.value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

function calculateDuration(nowMs: number): number | null {
  if (!props.phase.started_at) {
    return null;
  }

  const started = new Date(props.phase.started_at).getTime();
  if (Number.isNaN(started)) {
    return null;
  }

  if (props.phase.finished_at) {
    const finished = new Date(props.phase.finished_at).getTime();
    if (Number.isNaN(finished) || finished < started) {
      return null;
    }
    return finished - started;
  }

  if (props.phase.status === "IN_PROGRESS") {
    if (nowMs >= started) {
      return nowMs - started;
    }
  }

  return null;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return t("phaseDetail.duration.hms", {
      hours,
      minutes,
      seconds,
    });
  }

  if (minutes > 0) {
    return t("phaseDetail.duration.ms", {
      minutes,
      seconds,
    });
  }

  return t("phaseDetail.duration.seconds", { seconds });
}

function operationTypeLabel(opType: string): string {
  const key = `phaseDetail.timeline.opTypes.${opType}`;
  const translated = t(key);
  if (translated === key) {
    return opType;
  }
  return translated;
}

function operationStateLabel(state: string): string {
  const key = `phaseDetail.timeline.states.${state}`;
  const translated = t(key);
  if (translated === key) {
    return state;
  }
  return translated;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function handleOperationsScroll(): void {
  const container = operationsTimelineRef.value;
  if (!container) {
    return;
  }

  shouldAutoScrollOperations.value = isOperationsNearBottom(container);
}

function scrollOperationsToBottom(): void {
  const container = operationsTimelineRef.value;
  if (!container) {
    return;
  }

  container.scrollTop = container.scrollHeight;
  shouldAutoScrollOperations.value = true;
}

function isOperationsNearBottom(container: HTMLDivElement): boolean {
  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distanceToBottom <= OPERATIONS_AUTO_SCROLL_THRESHOLD_PX;
}

function shouldRunDurationTimer(): boolean {
  return props.phase.status === "IN_PROGRESS"
    && Boolean(props.phase.started_at)
    && !props.phase.finished_at;
}

function startDurationTimer(): void {
  if (durationTimer !== null) {
    return;
  }

  durationTimer = setInterval(() => {
    durationTick.value = Date.now();
  }, 1000);
}

function stopDurationTimer(): void {
  if (durationTimer === null) {
    return;
  }

  clearInterval(durationTimer);
  durationTimer = null;
}
</script>

<style scoped>
.phase-detail-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(7, 9, 14, 0.72);
  padding: 20px;
}

.phase-detail-modal__dialog {
  width: min(760px, 100%);
  max-height: min(720px, 88vh);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.phase-detail-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.phase-detail-modal__title {
  font-size: 1.05rem;
  font-weight: 600;
}

.phase-detail-modal__description {
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.phase-detail-modal__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-input);
  padding: 12px;
}

.phase-detail-modal__row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px;
  align-items: start;
}

.phase-detail-modal__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.phase-detail-modal__label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.phase-detail-modal__value,
.phase-detail-modal__block,
.phase-detail-modal__list-item {
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--color-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.phase-detail-modal__list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.phase-detail-modal__timeline {
  max-height: 320px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.phase-detail-modal__timeline-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-panel);
}

.phase-detail-modal__timeline-summary {
  cursor: pointer;
  list-style: none;
  display: grid;
  grid-template-columns: 160px 120px 100px 1fr;
  gap: 8px;
  padding: 8px 10px;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--color-text);
}

.phase-detail-modal__timeline-summary::-webkit-details-marker {
  display: none;
}

.phase-detail-modal__timeline-time,
.phase-detail-modal__timeline-type,
.phase-detail-modal__timeline-state {
  color: var(--color-text-secondary);
}

.phase-detail-modal__timeline-body {
  border-top: 1px solid var(--color-border);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.phase-detail-modal__timeline-row {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 8px;
  align-items: start;
}

.phase-detail-modal__timeline-key {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.phase-detail-modal__timeline-value {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
}

@media (max-width: 640px) {
  .phase-detail-modal__row {
    grid-template-columns: 1fr;
  }

  .phase-detail-modal__timeline-summary {
    grid-template-columns: 1fr;
  }
}
</style>
