/**
 * services/triggers/InboxThresholdTrigger.ts — Inbox 阈值触发器
 *
 * 定时轮询 Inbox 文件夹计数，当文件数量 ≥ 阈值时触发 action。
 * 轮询间隔可配置，默认 60 秒。
 */

import { App } from 'obsidian';
import type { Trigger, TriggerConfig } from './types';
import type { ServiceResult } from '../../utils/ServiceResult';

export const INBOX_THRESHOLD_TRIGGER_TYPE = 'inbox_threshold';

interface InboxThresholdParams {
  /** 触发阈值（Inbox 文件数量） */
  threshold: number;
  /** 轮询间隔毫秒数，默认 60_000 (1 分钟) */
  pollIntervalMs?: number;
  /** Inbox 目录路径，默认 "Inbox" */
  inboxPath?: string;
}

export class InboxThresholdTrigger implements Trigger {
  readonly type = INBOX_THRESHOLD_TRIGGER_TYPE;
  private _disposed = false;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _action: (() => Promise<ServiceResult<void>>) | null = null;
  private _params: InboxThresholdParams;
  private _app: App;
  /** 防重复触发：上次触发时间 */
  private _lastTriggeredAt = 0;
  /** 防重复冷却期：5 分钟 */
  private _cooldownMs = 300_000;

  constructor(app: App, params: InboxThresholdParams) {
    this._app = app;
    this._params = params;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  start(action: () => Promise<ServiceResult<void>>): void {
    if (this._disposed) return;
    this.stop();
    this._action = action;

    const pollMs = this._params.pollIntervalMs || 60_000;

    // 立即检查一次
    this._checkAndTrigger();

    // 定时轮询
    this._timer = setInterval(() => {
      this._checkAndTrigger();
    }, pollMs);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._action = null;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
  }

  serialize(): TriggerConfig {
    return {
      type: INBOX_THRESHOLD_TRIGGER_TYPE,
      params: { ...this._params },
    };
  }

  // ---------- 内部实现 ----------

  private _checkAndTrigger(): void {
    if (!this._action) return;

    const inboxPath = this._params.inboxPath || 'Inbox';
    const folder = this._app.vault.getAbstractFileByPath(inboxPath);
    if (!folder || !('children' in folder)) return;

    const count = (folder as any).children?.length ?? 0;
    if (count >= this._params.threshold) {
      // 防重复：5 分钟内不重复触发
      const now = Date.now();
      if (now - this._lastTriggeredAt < this._cooldownMs) return;
      this._lastTriggeredAt = now;
      this._action();
    }
  }

  // ---------- 工厂方法 ----------

  /** 从 TriggerConfig 反序列化 */
  static fromConfig(app: App, config: TriggerConfig): InboxThresholdTrigger {
    const params = config.params as unknown as InboxThresholdParams;
    return new InboxThresholdTrigger(app, params);
  }
}
