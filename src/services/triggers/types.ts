/**
 * services/triggers/types.ts — Trigger 接口定义
 *
 * Trigger 是 AutomationEngine 的核心抽象：
 * 每种触发条件（定时、Inbox阈值、启动、Vault事件）实现此接口。
 * Engine 只负责规则 CRUD 和生命周期调度，不关心具体触发逻辑。
 */

import type { Disposable } from '../../types';
import type { ServiceResult } from '../../utils/ServiceResult';

// ==================== TriggerConfig（持久化用） ====================

/** Trigger 的可序列化配置，用于 data.json 持久化 */
export interface TriggerConfig {
  /** Trigger 类型标识符 */
  readonly type: string;
  /** 类型特定参数 */
  readonly params: Record<string, unknown>;
}

// ==================== Trigger 接口 ====================

/**
 * Trigger 接口 — 所有触发器的统一契约
 *
 * 生命周期：
 * 1. Engine 从 data.json 反序列化 TriggerConfig
 * 2. Engine 根据 config.type 创建对应 Trigger 实例
 * 3. 调用 start(action) 启动触发器
 * 4. 触发器在条件满足时调用 action() 回调
 * 5. Engine 调用 stop() 或 dispose() 停止触发器
 */
export interface Trigger extends Disposable {
  /** Trigger 类型标识符（与 TriggerConfig.type 对应） */
  readonly type: string;

  /**
   * 启动触发器
   * @param action 触发时执行的回调，返回 ServiceResult 不 throw
   */
  start(action: () => Promise<ServiceResult<void>>): void;

  /** 停止触发器（不销毁，可重新 start） */
  stop(): void;

  /** 序列化为 TriggerConfig（用于持久化） */
  serialize(): TriggerConfig;
}
