/**
 * services/triggers/EventTrigger.ts — Vault 事件触发器
 *
 * 监听 Vault 的 modify/create/delete 事件，带 500ms 防抖。
 * 适用于"Vault 文件变化时自动执行"的场景。
 */

import { App, EventRef } from 'obsidian';
import type { Trigger, TriggerConfig } from './types';
import type { ServiceResult } from '../../utils/ServiceResult';

export const EVENT_TRIGGER_TYPE = 'event';

interface EventParams {
  /** 监听的事件类型：modify / create / delete / all */
  eventTypes?: string[];
  /** 防抖毫秒数，默认 500 */
  debounceMs?: number;
}

export class EventTrigger implements Trigger {
  readonly type = EVENT_TRIGGER_TYPE;
  private _disposed = false;
  private _action: (() => Promise<ServiceResult<void>>) | null = null;
  private _app: App;
  private _params: EventParams;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _registeredRefs: Array<{ ref: EventRef; type: string; handler: () => void }> = [];

  constructor(app: App, params: EventParams = {}) {
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

    const eventTypes = this._params.eventTypes && this._params.eventTypes.length > 0
      ? this._params.eventTypes
      : ['modify', 'create', 'delete'];

    const vault = this._app.vault;

    for (const eventType of eventTypes) {
      if (eventType === 'all') {
        for (const t of ['modify', 'create', 'delete'] as const) {
          this._registerEvent(vault, t);
        }
      } else {
        this._registerEvent(vault, eventType as 'modify' | 'create' | 'delete');
      }
    }
  }

  stop(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    for (const { type, handler } of this._registeredRefs) {
      try {
        this._app.vault.off(type as 'modify' | 'create' | 'delete', handler);
      } catch { /* ignore */ }
    }
    this._registeredRefs = [];
    this._action = null;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
  }

  serialize(): TriggerConfig {
    return {
      type: EVENT_TRIGGER_TYPE,
      params: { ...this._params },
    };
  }

  // ---------- 内部实现 ----------

  private _registerEvent(
    vault: App['vault'],
    eventType: 'modify' | 'create' | 'delete',
  ): void {
    const handler = () => {
      this._debouncedTrigger();
    };

    // Obsidian vault.on() 返回 EventRef
    // 使用 as any 绕过类型检查（handler 签名兼容所有事件类型）
    const ref = (vault as any).on(eventType, handler) as EventRef;
    this._registeredRefs.push({ ref, type: eventType, handler });
  }

  private _debouncedTrigger(): void {
    if (!this._action) return;
    const debounceMs = this._params.debounceMs ?? 500;

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._action?.();
    }, debounceMs);
  }

  // ---------- 工厂方法 ----------

  /** 从 TriggerConfig 反序列化 */
  static fromConfig(app: App, config: TriggerConfig): EventTrigger {
    const params = config.params as unknown as EventParams;
    return new EventTrigger(app, params);
  }
}
