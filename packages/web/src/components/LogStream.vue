<template>
  <div class="log-stream">
    <div class="log-stream__header">
      <span class="log-stream__title">{{ t('log.title') }}</span>
      <div class="log-stream__controls">
        <span
          class="log-stream__status"
          :class="connected ? 'log-stream__status--on' : 'log-stream__status--off'"
        >
          {{ connected ? t('log.connected') : t('log.disconnected') }}
        </span>
        <button class="btn btn--sm" @click="handleClear">{{ t('log.clear') }}</button>
        <button class="btn btn--sm" @click="toggleAutoScroll">
          {{ t('log.autoScroll') }}: {{ autoScroll ? t('log.on') : t('log.off') }}
        </button>
      </div>
    </div>

    <div
      ref="logContainer"
      class="log-stream__container"
    >
      <div v-if="foldedLogs.length === 0" class="log-stream__empty">
        {{ t('log.waiting') }}
      </div>
      <div
        v-for="entry in foldedLogs"
        :key="entry.id"
        class="log-stream__entry"
        :class="`log-stream__entry--${entry.level}`"
      >
        <span class="log-stream__time">{{ formatTime(entry.timestamp) }}</span>
        <span class="log-stream__level">{{ entry.level.toUpperCase() }}</span>
        <span class="log-stream__type">{{ entry.type }}</span>
        <span class="log-stream__msg">{{ formatMessage(entry) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import type { SSELogEntry } from "../composables/useSSE";

const { t } = useI18n();

const props = defineProps<{
  logs: SSELogEntry[];
  connected: boolean;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const logContainer = ref<HTMLElement | null>(null);
const autoScroll = ref(true);

interface FoldedLogEntry extends SSELogEntry {
  repeatCount: number;
}

const foldedLogs = computed<FoldedLogEntry[]>(() => {
  const result: FoldedLogEntry[] = [];

  for (const entry of props.logs) {
    const lastEntry = result[result.length - 1];
    if (!lastEntry) {
      result.push({
        ...entry,
        repeatCount: 1,
      });
      continue;
    }

    const isSameLevel = lastEntry.level === entry.level;
    const isSameType = lastEntry.type === entry.type;
    const isSameMessage = lastEntry.message === entry.message;
    if (isSameLevel && isSameType && isSameMessage) {
      lastEntry.repeatCount += 1;
      // 折叠重复日志时，展示最后一次出现的时间戳。
      lastEntry.timestamp = entry.timestamp;
      lastEntry.id = entry.id;
      continue;
    }

    result.push({
      ...entry,
      repeatCount: 1,
    });
  }

  return result;
});

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  } catch {
    return "--:--:--";
  }
}

function handleClear(): void {
  emit("clear");
}

function toggleAutoScroll(): void {
  autoScroll.value = !autoScroll.value;
}

function formatMessage(entry: FoldedLogEntry): string {
  if (entry.repeatCount <= 1) {
    return entry.message;
  }

  const repeatSuffix = t("log.repeatSuffix", {
    count: entry.repeatCount,
  });
  return `${entry.message}${repeatSuffix}`;
}

// 日志更新时自动滚动到底部
watch(
  () => props.logs.length,
  async () => {
    if (!autoScroll.value) return;
    await nextTick();
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  },
);
</script>

<style scoped>
.log-stream {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 250, 255, 0.96) 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.log-stream__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.78);
}

.log-stream__title {
  font-size: 1rem;
  font-weight: 600;
}

.log-stream__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.log-stream__status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid transparent;
}

.log-stream__status--on {
  background: rgba(22, 163, 74, 0.10);
  border-color: rgba(22, 163, 74, 0.18);
  color: var(--color-success);
}

.log-stream__status--off {
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.16);
  color: var(--color-error);
}

.log-stream__container {
  height: 300px;
  overflow-y: auto;
  padding: 10px 12px 12px;
  background: var(--color-bg-panel);
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.log-stream__empty {
  padding: 32px 24px;
  text-align: center;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.72);
}

.log-stream__entry {
  display: grid;
  grid-template-columns: 64px 52px minmax(140px, 180px) 1fr;
  gap: 10px;
  align-items: start;
  margin-bottom: 8px;
  padding: 10px 12px;
  line-height: 1.5;
  border: 1px solid rgba(216, 227, 240, 0.9);
  border-left: 4px solid transparent;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.log-stream__entry:hover {
  background: #ffffff;
  border-color: var(--color-border-strong);
}

.log-stream__entry--info {
  border-left-color: var(--color-info);
}

.log-stream__entry--warn {
  border-left-color: var(--color-warning);
}

.log-stream__entry--error {
  border-left-color: var(--color-error);
}

.log-stream__entry--debug {
  border-left-color: var(--color-text-muted);
  opacity: 0.82;
}

.log-stream__time {
  color: var(--color-text-muted);
  flex-shrink: 0;
  width: 64px;
}

.log-stream__level {
  flex-shrink: 0;
  width: 52px;
  font-weight: 600;
}

.log-stream__entry--info .log-stream__level {
  color: var(--color-info);
}

.log-stream__entry--warn .log-stream__level {
  color: var(--color-warning);
}

.log-stream__entry--error .log-stream__level {
  color: var(--color-error);
}

.log-stream__entry--debug .log-stream__level {
  color: var(--color-text-muted);
}

.log-stream__type {
  color: var(--color-purple);
  flex-shrink: 0;
  min-width: 140px;
}

.log-stream__msg {
  color: var(--color-text);
  word-break: break-word;
}

@media (max-width: 900px) {
  .log-stream__entry {
    grid-template-columns: 64px 52px 1fr;
  }

  .log-stream__type {
    grid-column: 3;
  }

  .log-stream__msg {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .log-stream__container {
    padding: 8px;
  }

  .log-stream__entry {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .log-stream__time,
  .log-stream__level,
  .log-stream__type {
    width: auto;
    min-width: 0;
  }
}
</style>
