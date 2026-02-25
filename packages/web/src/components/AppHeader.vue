<template>
  <header class="header">
    <div class="header__inner">
      <RouterLink to="/" class="header__logo">
        <span class="header__logo-icon">&#9881;</span>
        <span class="header__logo-text">{{ t('header.brand') }}</span>
      </RouterLink>

      <nav class="header__nav">
        <RouterLink to="/" class="header__link">{{ t('header.dashboard') }}</RouterLink>
        <RouterLink to="/create" class="header__link">{{ t('header.createTask') }}</RouterLink>
      </nav>

      <div class="header__right">
        <button class="header__lang-btn" @click="toggleLocale">
          {{ t('header.langSwitch') }}
        </button>

        <div class="header__status">
          <span
            class="header__dot"
            :class="serverOnline ? 'header__dot--online' : 'header__dot--offline'"
          ></span>
          <span class="header__status-text">
            {{ serverOnline ? t('header.serverOnline') : t('header.offline') }}
          </span>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTaskStore } from "../stores/task";
import { persistLocale } from "../i18n";

const { t, locale } = useI18n();
const store = useTaskStore();
const serverOnline = ref(false);

onMounted(async () => {
  await store.fetchHealth();
  serverOnline.value = store.health !== null;
});

function toggleLocale(): void {
  const next = locale.value === "en" ? "zh-CN" : "en";
  locale.value = next;
  persistLocale(next);
}
</script>

<style scoped>
.header {
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  padding: 0 32px;
  height: 56px;
  flex-shrink: 0;
}

.header__inner {
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 32px;
}

.header__logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-weight: 700;
  font-size: 1.1rem;
}

.header__logo:hover {
  color: var(--color-text);
}

.header__logo-icon {
  font-size: 1.3rem;
}

.header__nav {
  display: flex;
  gap: 20px;
  flex: 1;
}

.header__link {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  padding: 4px 0;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}

.header__link:hover,
.header__link.router-link-active {
  color: var(--color-text);
  border-bottom-color: var(--color-primary);
}

.header__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header__lang-btn {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.header__lang-btn:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
}

.header__status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.header__dot--online {
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.header__dot--offline {
  background: var(--color-error);
}

.header__status-text {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
