// ============================================
// i18n/index.ts — vue-i18n 实例
// ============================================

import { createI18n } from "vue-i18n";
import en from "./locales/en";
import zhCN from "./locales/zh-CN";

const STORAGE_KEY = "orchestrator_locale";

/** 读取浏览器语言偏好，回退 en */
function detectLocale(): string {
  // 优先读取用户之前选择的语言
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh-CN") {
    return stored;
  }

  // 检测浏览器语言
  const browserLang = navigator.language;
  if (browserLang.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

/** 持久化语言选择 */
export function persistLocale(locale: string): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

export type MessageSchema = typeof en;

export const i18n = createI18n<[MessageSchema], "en" | "zh-CN">({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: "en",
  messages: {
    en,
    "zh-CN": zhCN,
  },
});
