// ============================================
// utils/id-generator.ts — Task ID 生成
// ============================================

/**
 * 生成唯一任务 ID
 * 格式: task_<timestamp>_<random4>
 */
export function generateTaskId(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).substring(2, 6);
  return `task_${timestamp}_${random}`;
}
