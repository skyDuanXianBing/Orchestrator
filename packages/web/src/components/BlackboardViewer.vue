<template>
  <div class="blackboard-viewer">
    <div class="blackboard-viewer__header">
      <span class="blackboard-viewer__title">{{ t('blackboard.title') }}</span>
      <button class="btn btn--sm" @click="toggleCollapse">
        {{ collapsed ? t('blackboard.expand') : t('blackboard.collapse') }}
      </button>
    </div>

    <div v-if="!collapsed" class="blackboard-viewer__content">
      <div class="blackboard-viewer__section">
        <div class="blackboard-viewer__label">{{ t('blackboard.taskId') }}</div>
        <div class="blackboard-viewer__value blackboard-viewer__value--mono">
          {{ blackboard.task_id }}
        </div>
      </div>

      <div class="blackboard-viewer__section">
        <div class="blackboard-viewer__label">{{ t('blackboard.categoryMode') }}</div>
        <div class="blackboard-viewer__value">
          {{ blackboard.category }} / {{ blackboard.mode }}
        </div>
      </div>

      <div class="blackboard-viewer__section">
        <div class="blackboard-viewer__label">{{ t('blackboard.requirement') }}</div>
        <div class="blackboard-viewer__value">
          {{ blackboard.user_requirement }}
        </div>
      </div>

      <div v-if="blackboard.global_context" class="blackboard-viewer__section">
        <div class="blackboard-viewer__label">{{ t('blackboard.globalContext') }}</div>
        <div class="blackboard-viewer__tree">
          <div
            v-if="blackboard.global_context.relevant_files.length > 0"
            class="blackboard-viewer__entry"
          >
            <span class="blackboard-viewer__key">{{ t('blackboard.relevantFiles') }}:</span>
            <ul class="blackboard-viewer__list">
              <li
                v-for="file in blackboard.global_context.relevant_files"
                :key="file"
              >
                {{ file }}
              </li>
            </ul>
          </div>

          <div
            v-if="blackboard.global_context.api_contracts.length > 0"
            class="blackboard-viewer__entry"
          >
            <span class="blackboard-viewer__key">{{ t('blackboard.apiContracts') }}:</span>
            <ul class="blackboard-viewer__list">
              <li
                v-for="contract in blackboard.global_context.api_contracts"
                :key="contract"
              >
                {{ contract }}
              </li>
            </ul>
          </div>

          <div
            v-if="blackboard.global_context.critical_logic.length > 0"
            class="blackboard-viewer__entry"
          >
            <span class="blackboard-viewer__key">{{ t('blackboard.criticalLogic') }}:</span>
            <ul class="blackboard-viewer__list">
              <li
                v-for="logic in blackboard.global_context.critical_logic"
                :key="logic"
              >
                {{ logic }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="blackboard-viewer__section">
        <div class="blackboard-viewer__label">{{ t('blackboard.rawJson') }}</div>
        <button class="btn btn--sm" @click="toggleRawJson">
          {{ showRawJson ? t('blackboard.hide') : t('blackboard.show') }}
        </button>
        <pre v-if="showRawJson" class="blackboard-viewer__json">{{ formattedJson }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import type { BlackboardJson } from "@orchestrator/shared";

const { t } = useI18n();

const props = defineProps<{
  blackboard: BlackboardJson;
}>();

const collapsed = ref(false);
const showRawJson = ref(false);

const formattedJson = computed(() => {
  return JSON.stringify(props.blackboard, null, 2);
});

function toggleCollapse(): void {
  collapsed.value = !collapsed.value;
}

function toggleRawJson(): void {
  showRawJson.value = !showRawJson.value;
}
</script>

<style scoped>
.blackboard-viewer {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.blackboard-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.blackboard-viewer__title {
  font-size: 1rem;
  font-weight: 600;
}

.blackboard-viewer__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blackboard-viewer__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.blackboard-viewer__label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.blackboard-viewer__value {
  font-size: 0.85rem;
  color: var(--color-text);
  line-height: 1.4;
}

.blackboard-viewer__value--mono {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.blackboard-viewer__tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 8px;
  border-left: 2px solid var(--color-border);
}

.blackboard-viewer__entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.blackboard-viewer__key {
  font-size: 0.8rem;
  color: var(--color-purple);
  font-family: var(--font-mono);
}

.blackboard-viewer__list {
  list-style: none;
  padding-left: 12px;
}

.blackboard-viewer__list li {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  line-height: 1.6;
}

.blackboard-viewer__list li::before {
  content: "- ";
  color: var(--color-text-muted);
}

.blackboard-viewer__json {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  margin-top: 4px;
  line-height: 1.5;
  white-space: pre;
}
</style>
