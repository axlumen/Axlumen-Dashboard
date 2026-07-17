/**
 * debounce.ts — 防抖工具
 * 事件驱动刷新时合并高频触发，避免每次按键都重建 DOM
 */

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  }) as T;
}
