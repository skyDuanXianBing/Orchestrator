<template>
  <div class="path-picker">
    <div class="path-picker__control">
      <input
        id="projectPath"
        :value="modelValue"
        class="form-input path-picker__input"
        type="text"
        :placeholder="t('create.projectPathPlaceholder')"
        @input="handleInput"
      />

      <button
        type="button"
        class="btn path-picker__trigger"
        @click="handleOpenBrowser"
      >
        {{ t("create.browsePathBtn") }}
      </button>
    </div>

    <div v-if="isDialogOpen" class="path-picker__overlay" @click="handleCloseBrowser">
      <div class="path-picker__dialog card" role="dialog" aria-modal="true" @click.stop>
        <div class="path-picker__header">
          <h3 class="path-picker__title">{{ t("create.directoryBrowser") }}</h3>
        </div>

        <div class="path-picker__current-path">
          <span class="path-picker__label">{{ t("create.currentPath") }}</span>
          <input :value="currentPath" class="form-input" type="text" readonly />
        </div>

        <div class="path-picker__toolbar">
          <button
            type="button"
            class="btn btn--sm"
            :disabled="isLoading || parentPath === null"
            @click="handleGoToParent"
          >
            {{ t("create.parentDirectory") }}
          </button>
        </div>

        <div class="path-picker__list">
          <div v-if="isLoading" class="path-picker__state text-secondary">
            {{ t("create.loadingDirectories") }}
          </div>

          <div v-else-if="loadError" class="path-picker__state text-error">
            {{ loadError }}
          </div>

          <div v-else-if="entries.length === 0" class="path-picker__state text-secondary">
            {{ t("create.emptyDirectory") }}
          </div>

          <ul v-else class="path-picker__items">
            <li v-for="entry in entries" :key="entry.path">
              <button
                type="button"
                class="path-picker__item"
                @click="handleOpenDirectory(entry.path)"
              >
                <span class="path-picker__item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M3 6.5C3 5.67157 3.67157 5 4.5 5H9.2C9.53137 5 9.8537 5.10972 10.1162 5.31187L11.8838 6.68813C12.1463 6.89028 12.4686 7 12.8 7H19.5C20.3284 7 21 7.67157 21 8.5V17.5C21 18.3284 20.3284 19 19.5 19H4.5C3.67157 19 3 18.3284 3 17.5V6.5Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span class="path-picker__item-name">{{ entry.name }}</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="path-picker__footer">
          <div class="path-picker__selected">
            <span class="path-picker__label">{{ t("create.currentPath") }}</span>
            <input :value="selectedPath" class="form-input" type="text" readonly />
          </div>

          <div class="path-picker__actions">
            <button type="button" class="btn" @click="handleCloseBrowser">
              {{ t("create.cancel") }}
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="isLoading || selectedPath.length === 0"
              @click="handleConfirm"
            >
              {{ t("create.selectDirectory") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { httpGet } from "../utils/http.js";

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface DirectoryListResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();
const isDialogOpen = ref(false);
const isLoading = ref(false);
const loadError = ref("");
const currentPath = ref("");
const parentPath = ref<string | null>(null);
const selectedPath = ref("");
const entries = ref<DirectoryEntry[]>([]);

function handleInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  emit("update:modelValue", target.value);
}

function buildDirectoriesUrl(pathValue?: string): string {
  if (!pathValue || pathValue.trim().length === 0) {
    return "/api/directories";
  }

  return `/api/directories?path=${encodeURIComponent(pathValue)}`;
}

async function fetchDirectories(pathValue?: string): Promise<void> {
  isLoading.value = true;
  loadError.value = "";

  try {
    const response = await httpGet<DirectoryListResponse>(
      buildDirectoriesUrl(pathValue),
    );
    currentPath.value = response.currentPath;
    parentPath.value = response.parentPath;
    entries.value = response.entries;
    selectedPath.value = response.currentPath;
  } catch (error) {
    entries.value = [];
    const message = error instanceof Error ? error.message : "";
    if (message.length > 0) {
      loadError.value = `${t("create.directoryLoadError")}: ${message}`;
    } else {
      loadError.value = t("create.directoryLoadError");
    }
  } finally {
    isLoading.value = false;
  }
}

function handleOpenBrowser(): void {
  isDialogOpen.value = true;
  void fetchDirectories();
}

function handleCloseBrowser(): void {
  isDialogOpen.value = false;
}

function handleOpenDirectory(directoryPath: string): void {
  void fetchDirectories(directoryPath);
}

function handleGoToParent(): void {
  if (!parentPath.value) {
    return;
  }

  void fetchDirectories(parentPath.value);
}

function handleConfirm(): void {
  emit("update:modelValue", selectedPath.value);
  isDialogOpen.value = false;
}
</script>

<style scoped>
.path-picker__control {
  display: flex;
  gap: 8px;
}

.path-picker__input {
  flex: 1;
  min-width: 0;
}

.path-picker__trigger {
  min-width: 76px;
  justify-content: center;
}

.path-picker__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.34);
  padding: 20px;
}

.path-picker__dialog {
  width: min(760px, 100%);
  max-height: min(680px, 85vh);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.path-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.path-picker__title {
  font-size: 1.05rem;
  font-weight: 600;
}

.path-picker__current-path,
.path-picker__selected {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.path-picker__label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.path-picker__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.path-picker__list {
  min-height: 180px;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-input);
  padding: 8px;
}

.path-picker__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  font-size: 0.875rem;
}

.path-picker__items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.path-picker__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  padding: 8px;
  text-align: left;
  cursor: pointer;
}

.path-picker__item:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border);
}

.path-picker__item-icon {
  width: 16px;
  height: 16px;
  color: var(--color-info);
  flex-shrink: 0;
}

.path-picker__item-icon svg {
  width: 100%;
  height: 100%;
}

.path-picker__item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-picker__footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.path-picker__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
