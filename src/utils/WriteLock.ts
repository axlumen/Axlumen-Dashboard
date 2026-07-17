/**
 * utils/WriteLock.ts — 基于 Promise 队列的写锁
 *
 * 保证同一资源的写入操作串行执行，避免并发写入冲突。
 * 实现 Disposable 接口，dispose 时清空队列。
 *
 * 特性：
 * - 非阻塞 UI（异步队列，不占用主线程）
 * - 幂等 dispose
 * - 队列中的操作可被取消（dispose 时）
 */

import type { Disposable } from '../types';

interface QueueEntry {
  fn: () => Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class WriteLock implements Disposable {
  private _disposed = false;
  private _queue: QueueEntry[] = [];
  private _running = false;
  private readonly _name: string;

  /**
   * @param name 锁名称（用于日志调试）
   */
  constructor(name: string = 'default') {
    this._name = name;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * 获取写锁并执行写入操作
   *
   * 如果当前有其他写入操作正在进行，会等待其完成后再执行。
   * 返回的 release 函数在写入完成后自动调用（不需要手动调用）。
   *
   * @param fn 要执行的写入操作
   * @returns Promise，写入完成后 resolve
   */
  async acquire(fn: () => Promise<void>): Promise<void> {
    if (this._disposed) {
      throw new Error(`[WriteLock:${this._name}] Lock is disposed`);
    }

    return new Promise<void>((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._processQueue();
    });
  }

  private async _processQueue(): Promise<void> {
    if (this._running || this._queue.length === 0) return;

    this._running = true;

    while (this._queue.length > 0 && !this._disposed) {
      const entry = this._queue.shift()!;
      try {
        await entry.fn();
        entry.resolve();
      } catch (e) {
        entry.reject(e instanceof Error ? e : new Error(String(e)));
      }
    }

    this._running = false;
  }

  /**
   * Disposable — 清空队列，拒绝所有等待中的操作
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    // 拒绝队列中所有等待的操作
    for (const entry of this._queue) {
      entry.reject(new Error(`[WriteLock:${this._name}] Lock disposed`));
    }
    this._queue = [];
  }
}

// ==================== 全局写锁实例 ====================

/**
 * 全局写锁注册表
 *
 * 为不同的持久化资源创建独立的写锁：
 * - data.json: 插件设置
 * - todos: 待办清单
 * - taskStore: Agent 任务记录
 */
const locks = new Map<string, WriteLock>();

/**
 * 获取或创建指定资源的写锁
 *
 * @param resource 资源名称（如 'data.json', 'todos', 'taskStore'）
 * @returns WriteLock 实例
 */
export function getWriteLock(resource: string): WriteLock {
  let lock = locks.get(resource);
  if (!lock) {
    lock = new WriteLock(resource);
    locks.set(resource, lock);
  }
  return lock;
}

/**
 * 释放指定资源的写锁
 *
 * @param resource 资源名称
 */
export function releaseWriteLock(resource: string): void {
  const lock = locks.get(resource);
  if (lock) {
    lock.dispose();
    locks.delete(resource);
  }
}

/**
 * 释放所有写锁
 */
export function releaseAllWriteLocks(): void {
  for (const lock of locks.values()) {
    lock.dispose();
  }
  locks.clear();
}
