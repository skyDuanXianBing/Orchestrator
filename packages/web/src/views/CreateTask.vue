<template>
  <div class="create-task">
    <h1 class="create-task__title">{{ t('create.title') }}</h1>

    <form class="create-task__form card" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label class="form-label" for="requirement">{{ t('create.requirementLabel') }}</label>
        <textarea
          id="requirement"
          v-model="form.requirement"
          class="form-textarea"
          :placeholder="t('create.requirementPlaceholder')"
          rows="5"
          required
        ></textarea>
      </div>

      <div class="create-task__row">
        <div class="form-group">
          <label class="form-label" for="category">{{ t('create.categoryLabel') }}</label>
          <select id="category" v-model="form.category" class="form-select" required>
            <option value="A">{{ t('create.categoryA') }}</option>
            <option value="B">{{ t('create.categoryB') }}</option>
            <option value="C">{{ t('create.categoryC') }}</option>
            <option value="D">{{ t('create.categoryD') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="mode">{{ t('create.modeLabel') }}</label>
          <select id="mode" v-model="form.mode" class="form-select" required>
            <option value="FAST">{{ t('create.modeFast') }}</option>
            <option value="BALANCED">{{ t('create.modeBalanced') }}</option>
            <option value="COMPREHENSIVE">{{ t('create.modeComprehensive') }}</option>
            <option value="HARDENING">{{ t('create.modeHardening') }}</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="projectPath">{{ t('create.projectPathLabel') }}</label>
        <PathPicker v-model="form.projectPath" />
      </div>

      <div v-if="store.error" class="create-task__error">
        {{ store.error }}
      </div>

      <div class="create-task__actions">
        <RouterLink to="/" class="btn">{{ t('create.cancel') }}</RouterLink>
        <button type="submit" class="btn btn--primary" :disabled="store.loading">
          <template v-if="store.loading">
            <span class="spinner"></span>
            {{ t('create.creating') }}
          </template>
          <template v-else>
            {{ t('create.createTask') }}
          </template>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTaskStore } from "../stores/task.js";
import PathPicker from "../components/PathPicker.vue";
import type { Category, Mode } from "@orchestrator/shared";

const { t } = useI18n();
const store = useTaskStore();
const router = useRouter();

const form = reactive({
  requirement: "",
  category: "A" as Category,
  mode: "BALANCED" as Mode,
  projectPath: "",
});

async function handleSubmit(): Promise<void> {
  const result = await store.createTask({
    requirement: form.requirement,
    category: form.category,
    mode: form.mode,
    projectPath: form.projectPath || undefined,
  });

  if (result) {
    router.push({ name: "TaskDetail", params: { id: result.taskId } });
  }
}
</script>

<style scoped>
.create-task {
  max-width: 700px;
  margin: 0 auto;
}

.create-task__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 24px;
}

.create-task__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.create-task__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.create-task__error {
  padding: 12px 16px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  color: var(--color-error);
  font-size: 0.875rem;
}

.create-task__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
</style>
