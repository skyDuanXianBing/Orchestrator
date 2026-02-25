// ============================================
// composables/usePolling.ts — 轮询 composable
// ============================================

import { ref, onUnmounted } from "vue";

/**
 * 通用轮询 composable
 * @param callback 轮询时执行的回调
 * @param intervalMs 轮询间隔（毫秒），默认 5000
 */
export function usePolling(callback: () => void | Promise<void>, intervalMs = 5000) {
  const active = ref(false);
  let timerId: ReturnType<typeof setInterval> | null = null;

  function start(): void {
    if (timerId !== null) return;

    active.value = true;
    timerId = setInterval(() => {
      void callback();
    }, intervalMs);
  }

  function stop(): void {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    active.value = false;
  }

  onUnmounted(() => {
    stop();
  });

  return { active, start, stop };
}
