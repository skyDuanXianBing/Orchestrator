<template>
  <div class="dashboard">
    <div class="dashboard__header">
      <h1 class="dashboard__title">{{ t('dashboard.title') }}</h1>
      <RouterLink to="/create" class="btn btn--primary">
        {{ t('dashboard.newTask') }}
      </RouterLink>
    </div>

    <div v-if="store.error" class="dashboard__error">
      {{ store.error }}
    </div>

    <div v-if="store.loading && tasks.length === 0" class="empty-state">
      <span class="spinner"></span>
      <span class="empty-state__text">{{ t('dashboard.loadingTasks') }}</span>
    </div>

    <div v-else-if="tasks.length === 0" class="empty-state">
      <span class="empty-state__icon">&#128230;</span>
      <span class="empty-state__text">{{ t('dashboard.noTasks') }}</span>
      <RouterLink to="/create" class="btn btn--primary">
        {{ t('dashboard.createFirst') }}
      </RouterLink>
    </div>

    <div v-else class="dashboard__grid">
      <div
        v-for="task in tasks"
        :key="task.taskId"
        class="task-card card"
        @click="goToTask(task.taskId)"
      >
        <div class="task-card__top">
          <span class="badge" :class="statusBadgeClass(task.pipelineStatus)">
            {{ statusLabel(task.pipelineStatus) }}
          </span>
          <span class="task-card__category">
            {{ categoryLabel(task.category) }}
          </span>
        </div>

        <div class="task-card__requirement">
          {{ truncate(task.userRequirement, 120) }}
        </div>

        <div class="task-card__meta">
          <div class="task-card__meta-row">
            <span class="task-card__label">{{ t('dashboard.mode') }}</span>
            <span class="task-card__value">{{ task.mode }}</span>
          </div>
          <div class="task-card__meta-row">
            <span class="task-card__label">{{ t('dashboard.progress') }}</span>
            <span class="task-card__value">
              {{ task.completedPhases }}/{{ task.totalPhases }}
            </span>
          </div>
          <div class="task-card__meta-row">
            <span class="task-card__label">{{ t('dashboard.phaseLabel') }}</span>
            <span class="task-card__value task-card__value--mono">
              {{ task.currentPhaseId ?? "-" }}
            </span>
          </div>
        </div>

        <div class="task-card__footer">
          <span class="task-card__id">{{ task.taskId }}</span>
          <span class="task-card__time">{{ formatDate(task.createdAt) }}</span>
        </div>

        <div class="task-card__actions" @click.stop>
          <button
            v-if="canDelete(task.pipelineStatus)"
            class="btn btn--sm btn--danger"
            @click="handleDelete(task.taskId)"
          >
            {{ t('dashboard.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTaskStore } from "../stores/task";
import { usePolling } from "../composables/usePolling";

const { t } = useI18n();
const store = useTaskStore();
const router = useRouter();

const tasks = computed(() => store.tasks);

onMounted(async () => {
  await store.fetchTasks();
  polling.start();
});

const polling = usePolling(() => store.fetchTasks(), 8000);

function goToTask(taskId: string): void {
  router.push({ name: "TaskDetail", params: { id: taskId } });
}

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
  const key = `dashboard.category.${category}`;
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

function canDelete(status: string): boolean {
  return status !== "RUNNING" && status !== "PAUSED_FOR_REVIEW";
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

async function handleDelete(taskId: string): Promise<void> {
  const confirmed = window.confirm(t('dashboard.confirmDelete', { taskId }));
  if (!confirmed) return;
  await store.deleteTask(taskId);
}
</script>

<style scoped>
.dashboard__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard__title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-text);
}

.dashboard__error {
  padding: 12px 16px;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  color: var(--color-error);
  margin-bottom: 16px;
  font-size: 0.875rem;
  box-shadow: var(--shadow-sm);
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

.task-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 250, 255, 0.96) 100%);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.task-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.task-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-card__category {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.task-card__requirement {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--color-text);
  min-height: 54px;
}

.task-card__meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.task-card__meta-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 92px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--color-bg-panel);
  border: 1px solid rgba(216, 227, 240, 0.85);
}

.task-card__label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.task-card__value {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.task-card__value--mono {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.task-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
}

.task-card__id {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.task-card__time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.task-card__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .dashboard__grid {
    grid-template-columns: 1fr;
  }
}
</style>
