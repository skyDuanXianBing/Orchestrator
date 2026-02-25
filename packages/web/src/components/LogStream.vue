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
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-stream__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.log-stream__title {
  font-size: 1rem;
  font-weight: 600;
}

.log-stream__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-stream__status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
}

.log-stream__status--on {
  background: rgba(52, 211, 153, 0.15);
  color: var(--color-success);
}

.log-stream__status--off {
  background: rgba(248, 113, 113, 0.15);
  color: var(--color-error);
}

.log-stream__container {
  height: 300px;
  overflow-y: auto;
  padding: 8px 0;
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.log-stream__empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
}

.log-stream__entry {
  display: flex;
  gap: 8px;
  padding: 3px 16px;
  line-height: 1.5;
  border-left: 3px solid transparent;
}

.log-stream__entry:hover {
  background: var(--color-bg-hover);
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
  opacity: 0.7;
}

.log-stream__time {
  color: var(--color-text-muted);
  flex-shrink: 0;
  width: 60px;
}

.log-stream__level {
  flex-shrink: 0;
  width: 42px;
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
  min-width: 160px;
}

.log-stream__msg {
  color: var(--color-text);
  word-break: break-word;
}
</style>
