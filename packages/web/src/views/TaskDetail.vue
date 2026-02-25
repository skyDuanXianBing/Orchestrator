<template>
  <div class="task-detail">
    <!-- Loading -->
    <div v-if="store.loading && !task" class="empty-state">
      <span class="spinner"></span>
      <span class="empty-state__text">{{ t('detail.loading') }}</span>
    </div>

    <!-- Error -->
    <div v-else-if="!task && store.error" class="empty-state">
      <span class="empty-state__icon">&#9888;</span>
      <span class="empty-state__text">{{ store.error }}</span>
      <RouterLink to="/" class="btn">{{ t('detail.backDashboard') }}</RouterLink>
    </div>

    <!-- Content -->
    <template v-else-if="task">
      <!-- Header Bar -->
      <div class="task-detail__header">
        <div class="task-detail__header-left">
          <RouterLink to="/" class="btn btn--sm">{{ t('detail.back') }}</RouterLink>
          <h1 class="task-detail__title">{{ task.taskId }}</h1>
          <span class="badge" :class="statusBadgeClass(task.pipelineStatus)">
            {{ statusLabel(task.pipelineStatus) }}
          </span>
        </div>

        <div class="task-detail__header-right">
          <button
            v-if="canStart"
            class="btn btn--primary"
            :disabled="actionLoading"
            @click="handleStart"
          >
            {{ t('detail.startPipeline') }}
          </button>
          <button
            v-if="canAbort"
            class="btn btn--danger"
            :disabled="actionLoading"
            @click="handleAbort"
          >
            {{ t('detail.abort') }}
          </button>
        </div>
      </div>

      <!-- Task Info -->
      <div class="task-detail__info">
        <div class="task-detail__info-item">
          <span class="task-detail__info-label">{{ t('detail.category') }}</span>
          <span class="task-detail__info-value">
            {{ task.category }} — {{ categoryLabel(task.category) }}
          </span>
        </div>
        <div class="task-detail__info-item">
          <span class="task-detail__info-label">{{ t('detail.mode') }}</span>
          <span class="task-detail__info-value">{{ task.mode }}</span>
        </div>
        <div class="task-detail__info-item">
          <span class="task-detail__info-label">{{ t('detail.progress') }}</span>
          <span class="task-detail__info-value">
            {{ task.completedPhases }} / {{ task.totalPhases }}
          </span>
        </div>
        <div class="task-detail__info-item">
          <span class="task-detail__info-label">{{ t('detail.created') }}</span>
          <span class="task-detail__info-value">{{ formatDate(task.createdAt) }}</span>
        </div>
      </div>

      <!-- Requirement -->
      <div class="task-detail__requirement card">
        <div class="task-detail__section-title">{{ t('detail.requirement') }}</div>
        <p>{{ task.userRequirement }}</p>
      </div>

      <!-- Pipeline Graph -->
      <PipelineGraph
        :blackboard="task.blackboard"
        :current-phase-id="task.currentPhaseId"
      />

      <!-- Human Review Panel -->
      <HumanReviewPanel
        v-if="task.pipelineStatus === 'PAUSED_FOR_REVIEW' && task.currentPhaseId"
        :task-id="task.taskId"
        :current-phase-id="task.currentPhaseId"
        :submitting="reviewSubmitting"
        @submit="handleReviewSubmit"
      />

      <!-- Log Stream -->
      <LogStream
        :logs="sse.logs.value"
        :connected="sse.connected.value"
        @clear="sse.clearLogs"
      />

      <!-- Blackboard Viewer -->
      <BlackboardViewer :blackboard="task.blackboard" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTaskStore } from "../stores/task";
import { useSSE } from "../composables/useSSE";
import { usePolling } from "../composables/usePolling";
import PipelineGraph from "../components/PipelineGraph.vue";
import HumanReviewPanel from "../components/HumanReviewPanel.vue";
import LogStream from "../components/LogStream.vue";
import BlackboardViewer from "../components/BlackboardViewer.vue";
import { SSEEventType } from "@orchestrator/shared";

const { t, locale } = useI18n();

const props = defineProps<{
  id: string;
}>();

const store = useTaskStore();
const task = computed(() => store.currentTask);
const actionLoading = ref(false);
const reviewSubmitting = ref(false);

// SSE 连接
const sse = useSSE(props.id);

// 轮询作为 SSE 断线降级策略（2s）
const polling = usePolling(() => store.fetchTaskDetail(props.id), 2000);

watch(
  () => sse.connected.value,
  (isConnected) => {
    if (isConnected) {
      polling.stop();
      return;
    }

    polling.start();
  },
  { immediate: true },
);

onMounted(async () => {
  await store.fetchTaskDetail(props.id);
  sse.connect();

  // SSE 事件触发详情刷新
  const refreshEvents = [
    SSEEventType.PIPELINE_STARTED,
    SSEEventType.PHASE_STARTED,
    SSEEventType.PHASE_COMPLETED,
    SSEEventType.PHASE_FAILED,
    SSEEventType.PIPELINE_COMPLETED,
    SSEEventType.PIPELINE_FAILED,
    SSEEventType.PIPELINE_ABORTED,
    SSEEventType.HUMAN_REVIEW_REQUIRED,
    SSEEventType.HUMAN_REVIEW_COMPLETED,
    SSEEventType.BLACKBOARD_UPDATED,
    SSEEventType.CIRCUIT_BREAKER_TRIGGERED,
  ];

  for (const eventType of refreshEvents) {
    sse.on(eventType, () => {
      void store.fetchTaskDetail(props.id);
    });
  }
});

// 当 taskId 路由参数变化时重新加载
watch(
  () => props.id,
  async (newId) => {
    sse.disconnect();
    polling.stop();

    await store.fetchTaskDetail(newId);

    sse.connect();
  },
);

const canStart = computed(() => {
  if (!task.value) return false;
  const status = task.value.pipelineStatus;
  return status === "IDLE" || status === "FAILED" || status === "ABORTED";
});

const canAbort = computed(() => {
  if (!task.value) return false;
  const status = task.value.pipelineStatus;
  return status === "RUNNING" || status === "PAUSED_FOR_REVIEW";
});

function statusBadgeClass(status: string): string {
  switch (status) {
    case "IDLE": return "badge--idle";
    case "RUNNING": return "badge--running";
    case "PAUSED_FOR_REVIEW": return "badge--paused";
    case "COMPLETED": return "badge--completed";
    case "FAILED": return "badge--failed";
    case "ABORTED": return "badge--aborted";
    default: return "badge--idle";
  }
}

function categoryLabel(category: string): string {
  const key = `detail.category_${category}`;
  const translated = t(key);
  if (translated === key) {
    return category;
  }
  return translated;
}

function statusLabel(pipelineStatus: string): string {
  const key = `status.${pipelineStatus}`;
  const translated = t(key);
  if (translated === key) {
    return pipelineStatus;
  }
  return translated;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const loc = locale.value === "zh-CN" ? "zh-CN" : "en-US";
    return date.toLocaleString(loc);
  } catch {
    return iso;
  }
}

async function handleStart(): Promise<void> {
  actionLoading.value = true;
  await store.startPipeline(props.id);
  actionLoading.value = false;
}

async function handleAbort(): Promise<void> {
  const confirmed = window.confirm(t('detail.confirmAbort'));
  if (!confirmed) return;

  actionLoading.value = true;
  await store.abortPipeline(props.id);
  actionLoading.value = false;
}

async function handleReviewSubmit(
  action: "approve" | "revise",
  comment: string,
): Promise<void> {
  reviewSubmitting.value = true;
  await store.submitReview(props.id, {
    action,
    comment: comment || undefined,
  });
  reviewSubmitting.value = false;
}
</script>

<style scoped>
.task-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.task-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.task-detail__header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-detail__header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-detail__title {
  font-size: 1.2rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.task-detail__info {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.task-detail__info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-detail__info-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.task-detail__info-value {
  font-size: 0.9rem;
  color: var(--color-text);
}

.task-detail__requirement {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-detail__requirement p {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.task-detail__section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}
</style>
