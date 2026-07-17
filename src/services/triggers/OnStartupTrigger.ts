/**
 * services/triggers/OnStartupTrigger.ts — 启动触发器
 *
 * start() 时立即执行一次 action（幂等）。
 * 适用于"插件启动时自动执行"的场景。
 */

import type { Trigger, TriggerConfig } from './types';
import type { ServiceResult } from '../../utils/ServiceResult';

export const ON_STARTUP_TRIGGER_TYPE = 'on_startup';

export class OnStartupTrigger implements Trigger {
  readonly type = ON_STARTUP_TRIGGER_TYPE;
  private _disposed = false;
  private _action: (() => Promise<ServiceResult<void>>) | null = null;
  /** 幂等标记：是否已执行过 */
  private _executed = false;

  get disposed(): boolean {
    return this._disposed;
  }

  start(action: () => Promise<ServiceResult<void>>): void {
    if (this._disposed) return;
    this._action = action;

    // 幂等：只执行一次
    if (!this._executed) {
      this._executed = true;
      this._action();
    }
  }

  stop(): void {
    this._action = null;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
  }

  serialize(): TriggerConfig {
    return {
      type: ON_STARTUP_TRIGGER_TYPE,
      params: {},
    };
  }

  // ---------- 工厂方法 ----------

  /** 从 TriggerConfig 反序列化 */
  static fromConfig(_config: TriggerConfig): OnStartupTrigger {
    return new OnStartupTrigger();
  }
}
