<template>
  <div class="app">
    <AppHeader />
    <main class="app__main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app__main {
  flex: 1;
  padding: 32px 32px 40px;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .app__main {
    padding: 20px 16px 28px;
  }
}
</style>
