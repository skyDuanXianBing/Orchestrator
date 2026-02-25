<template>
  <div class="review-panel card">
    <div class="review-panel__header">
      <span class="review-panel__icon">&#9888;</span>
      <span class="review-panel__title">{{ t('review.title') }}</span>
    </div>

    <p class="review-panel__hint">
      {{ t('review.hint', { phaseId: currentPhaseId }) }}
    </p>

    <div class="form-group">
      <label class="form-label" for="review-comment">{{ t('review.commentLabel') }}</label>
      <textarea
        id="review-comment"
        v-model="comment"
        class="form-textarea"
        :placeholder="t('review.commentPlaceholder')"
        rows="3"
      ></textarea>
    </div>

    <div class="review-panel__actions">
      <button
        class="btn btn--primary"
        :disabled="submitting"
        @click="handleApprove"
      >
        <template v-if="submitting">
          <span class="spinner"></span>
        </template>
        {{ t('review.approve') }}
      </button>
      <button
        class="btn btn--danger"
        :disabled="submitting"
        @click="handleRevise"
      >
        {{ t('review.revise') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  taskId: string;
  currentPhaseId: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  submit: [action: "approve" | "revise", comment: string];
}>();

const comment = ref("");

function handleApprove(): void {
  emit("submit", "approve", comment.value);
}

function handleRevise(): void {
  if (!comment.value.trim()) {
    comment.value = "";
    // 修订时建议提供意见，但不强制
  }
  emit("submit", "revise", comment.value);
}
</script>

<style scoped>
.review-panel {
  border-color: var(--color-warning);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.review-panel__icon {
  font-size: 1.3rem;
  color: var(--color-warning);
}

.review-panel__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-warning);
}

.review-panel__hint {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.review-panel__actions {
  display: flex;
  gap: 12px;
}
</style>
