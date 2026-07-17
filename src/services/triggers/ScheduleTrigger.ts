/**
 * services/triggers/ScheduleTrigger.ts — 定时触发器
 *
 * 支持两种模式：
 * - "every"：每隔 N 毫秒执行一次
 * - "at"：每天在指定 HH:MM 执行一次
 *
 * 不依赖 cron 解析库，纯 setTimeout/setInterval 实现。
 */

import type { Trigger, TriggerConfig } from './types';

export const SCHEDULE_TRIGGER_TYPE = 'schedule';

interface ScheduleParams {
  /** "every" = 固定间隔，"at" = 每天定时 */
  mode: 'every' | 'at';
  /** 模式 "every" 时的间隔毫秒数 */
  intervalMs?: number;
  /** 模式 "at" 时的小时 (0-23) */
  hour?: number;
  /** 模式 "at" 时的分钟 (0-59) */
  minute?: number;
}

export class ScheduleTrigger implements Trigger {
  readonly type = SCHEDULE_TRIGGER_TYPE;
  private _disposed = false;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _intervalTimer: ReturnType<typeof setInterval> | null = null;
  private _action: (() => Promise<import('../../utils/ServiceResult').ServiceResult<void>>) | null = null;
  private _params: ScheduleParams;

  constructor(params: ScheduleParams) {
    this._params = params;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  start(action: () => Promise<import('../../utils/ServiceResult').ServiceResult<void>>): void {
    if (this._disposed) return;
    this.stop();
    this._action = action;

    if (this._params.mode === 'every' && this._params.intervalMs) {
      this._startInterval(this._params.intervalMs);
    } else if (this._params.mode === 'at' && this._params.hour != null && this._params.minute != null) {
      this._startDaily(this._params.hour, this._params.minute);
    }
  }

  stop(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._intervalTimer) {
      clearInterval(this._intervalTimer);
      this._intervalTimer = null;
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
      type: SCHEDULE_TRIGGER_TYPE,
      params: { ...this._params },
    };
  }

  // ---------- 内部实现 ----------

  private _startInterval(ms: number): void {
    this._intervalTimer = setInterval(() => {
      this._action?.();
    }, ms);
  }

  private _startDaily(hour: number, minute: number): void {
    const scheduleNext = () => {
      if (this._disposed || !this._action) return;

      const now = new Date();
      const target = new Date();
      target.setHours(hour, minute, 0, 0);

      // 如果目标时间已过，设为明天
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const delay = target.getTime() - now.getTime();
      this._timer = setTimeout(() => {
        this._action?.();
        scheduleNext(); // 安排下一次
      }, delay);
    };

    scheduleNext();
  }

  // ---------- 工厂方法 ----------

  /** 创建固定间隔触发器 */
  static every(intervalMs: number): ScheduleTrigger {
    return new ScheduleTrigger({ mode: 'every', intervalMs });
  }

  /** 创建每天定时触发器 */
  static at(hour: number, minute: number): ScheduleTrigger {
    return new ScheduleTrigger({ mode: 'at', hour, minute });
  }

  /** 从 TriggerConfig 反序列化 */
  static fromConfig(config: TriggerConfig): ScheduleTrigger {
    const params = config.params as unknown as ScheduleParams;
    return new ScheduleTrigger(params);
  }
}
