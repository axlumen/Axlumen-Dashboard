/**
 * services/AutomationEngine.ts — 自动化规则引擎（v2 重构）
 *
 * v2 改造：
 * - Trigger 抽象为独立接口，每种触发条件一个实现类
 * - Engine 只负责规则 CRUD 和生命周期调度
 * - action 通过 actionName 映射到已注册的命令
 * - 所有 trigger 实现 Disposable，Engine dispose 时统一清理
 *
 * 规则持久化到 data.json 的 automationRules 字段。
 */

import { App } from 'obsidian';
import { AgentRunner } from '../agent/AgentRunner';
import { type ServiceResult, ok, err } from '../utils/ServiceResult';
import { CompositeDisposable } from '../utils/CompositeDisposable';
import {
  type Trigger, type TriggerConfig,
  createTriggerFromConfig,
} from './triggers';

// ==================== 类型 ====================

/** 旧版 TriggerType（兼容 workflows.ts UI） */
export type TriggerType = 'cron' | 'inbox_threshold' | 'on_startup' | 'event';

/** 动作名称 — 通过 actionName 映射到已注册的命令 */
export type ActionType = 'pull_rss' | 'pull_github' | 'inbox_auto_route' | 'vault_lint' | 'daily_diary';

/** 规则配置（持久化到 data.json） */
export interface RuleConfig {
  /** 唯一 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** Trigger 配置（序列化） */
  trigger: TriggerConfig;
  /** 动作名称 */
  actionName: ActionType;
  /** 绑定的工作流 ID（可选，供 AgentRunner 使用） */
  workflowId?: string;
  /** 上次执行时间戳 */
  lastRun?: number;
  /** 创建时间戳 */
  createdAt: number;
}

/** 旧版 AutomationRule（兼容 workflows.ts UI 和 view.ts） */
export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: TriggerType;
    intervalMinutes?: number;
    inboxCount?: number;
  };
  action: {
    type: ActionType;
    workflowId?: string;
  };
  lastRun?: number;
  createdAt: number;
}

/** 动作执行器 */
export type ActionExecutor = (
  rule: RuleConfig,
  source: string,
) => Promise<ServiceResult<void>>;

// ==================== AutomationEngine 类 ====================

export class AutomationEngine {
  private app: App;
  private runner: AgentRunner;
  private rules: RuleConfig[] = [];
  private triggers: Map<string, Trigger> = new Map();
  private composite: CompositeDisposable = new CompositeDisposable();
  private saveCallback: () => void;
  private actionExecutor: ActionExecutor | null = null;

  /**
   * @param app Obsidian App 实例
   * @param runner AgentRunner 实例
   * @param saveCallback 持久化回调 — 由 plugin 传入 `() => this.saveSettings()`
   */
  constructor(app: App, runner: AgentRunner, saveCallback: () => void) {
    this.app = app;
    this.runner = runner;
    this.saveCallback = saveCallback;
  }

  // ==================== 规则 CRUD ====================

  /** 加载规则（从持久化数据反序列化） */
  loadRules(rules: RuleConfig[] | AutomationRule[] | undefined): RuleConfig[] {
    if (!rules) {
      this.rules = [];
      return [];
    }

    // 兼容旧版 AutomationRule 格式
    this.rules = rules.map(r => this._normalizeRule(r));
    return this.rules;
  }

  /** 获取所有规则 */
  getRules(): RuleConfig[] {
    return [...this.rules];
  }

  /** 获取旧版格式规则（兼容 workflows.ts UI） */
  getLegacyRules(): AutomationRule[] {
    return this.rules.map(r => this._toLegacyRule(r));
  }

  /** 添加规则，返回 ruleId */
  addRule(config: Omit<RuleConfig, 'id' | 'createdAt'>): string {
    const id = 'rule-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const rule: RuleConfig = {
      ...config,
      id,
      createdAt: Date.now(),
    };
    this.rules.push(rule);
    this._save();

    // 如果规则启用，立即启动 trigger
    if (rule.enabled) {
      this._startTrigger(rule);
    }

    return id;
  }

  /** 移除规则 */
  removeRule(ruleId: string): void {
    this._stopTrigger(ruleId);
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this._save();
  }

  /** 启用规则 */
  enableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule || rule.enabled) return;
    rule.enabled = true;
    this._save();
    this._startTrigger(rule);
  }

  /** 禁用规则 */
  disableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule || !rule.enabled) return;
    rule.enabled = false;
    this._save();
    this._stopTrigger(ruleId);
  }

  /** 手动执行规则 */
  async runRule(ruleId: string, source: string = 'manual'): Promise<ServiceResult<void>> {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return err('RULE_NOT_FOUND', `规则 ${ruleId} 不存在`, false);
    return this._executeRule(rule, source);
  }

  // ==================== 生命周期 ====================

  /** 启动所有启用的规则 */
  startAll(): void {
    for (const rule of this.rules) {
      if (rule.enabled) {
        this._startTrigger(rule);
      }
    }
  }

  /** 停止所有规则 */
  stopAll(): void {
    for (const ruleId of this.triggers.keys()) {
      this._stopTrigger(ruleId);
    }
  }

  /** 设置动作执行器 */
  setActionExecutor(executor: ActionExecutor): void {
    this.actionExecutor = executor;
  }

  /** Disposable — 停止所有 trigger 并清理 */
  dispose(): void {
    this.stopAll();
    this.composite.dispose();
    this.rules = [];
  }

  // ==================== 兼容旧版 API ====================

  /** 旧版：启动所有 cron 规则（兼容 view.ts） */
  startAllCron(): void {
    this.startAll();
  }

  /** 旧版：检查 Inbox 阈值（兼容 view.ts vault-scan-finish 事件） */
  checkInboxThreshold(inboxCount: number): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.trigger.type === 'inbox_threshold') {
        const threshold = rule.trigger.params.threshold as number || 5;
        if (inboxCount >= threshold) {
          this._executeRule(rule, 'auto-threshold');
        }
      }
    }
  }

  /** 旧版：执行 startup 规则（兼容 view.ts） */
  executeStartupRules(): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.trigger.type === 'on_startup') {
        this._executeRule(rule, 'auto-startup');
      }
    }
  }

  /** 旧版：执行单条规则（兼容 workflows.ts） */
  async runRuleLegacy(rule: AutomationRule, source: string): Promise<ServiceResult<void>> {
    const normalized = this._normalizeRule(rule);
    return this._executeRule(normalized, source);
  }

  // ==================== 内部方法 ====================

  /** 启动单个 trigger */
  private _startTrigger(rule: RuleConfig): void {
    this._stopTrigger(rule.id); // 先停旧的

    try {
      const trigger = createTriggerFromConfig(this.app, rule.trigger);
      this.triggers.set(rule.id, trigger);
      this.composite.add(trigger);

      trigger.start(() => this._executeRule(rule, `auto-${rule.trigger.type}`));
    } catch (e) {
      console.error('[AutomationEngine] Failed to start trigger:', e);
    }
  }

  /** 停止单个 trigger */
  private _stopTrigger(ruleId: string): void {
    const trigger = this.triggers.get(ruleId);
    if (trigger) {
      trigger.stop();
      this.triggers.delete(ruleId);
    }
  }

  /** 执行规则 */
  private async _executeRule(rule: RuleConfig, source: string): Promise<ServiceResult<void>> {
    // 防重复：同一规则 5 分钟内不重复触发
    if (rule.lastRun && Date.now() - rule.lastRun < 300_000) return ok(undefined);

    rule.lastRun = Date.now();
    this._save();

    // 使用自定义执行器（如果设置）
    if (this.actionExecutor) {
      return this.actionExecutor(rule, source);
    }

    // 默认执行器：通过 AgentRunner 调度工作流
    const workflowId = rule.workflowId;
    if (!workflowId) return ok(undefined);

    try {
      await this.runner.scheduleAutoTask(workflowId, undefined, source);
      return ok(undefined);
    } catch (e) {
      console.error('[AUTOMATION_FAILED] executeRule:', e);
      return err('AUTOMATION_FAILED', (e as Error).message || '规则执行失败', true, e as Error);
    }
  }

  /** 持久化 */
  private _save(): void {
    this.saveCallback();
  }

  // ==================== 格式转换 ====================

  /** 标准化旧版 AutomationRule 为 RuleConfig */
  private _normalizeRule(rule: RuleConfig | AutomationRule): RuleConfig {
    // 已经是 RuleConfig 格式
    if ('trigger' in rule && typeof rule.trigger === 'object' && 'type' in rule.trigger && 'params' in rule.trigger) {
      return rule as RuleConfig;
    }

    // 旧版 AutomationRule 格式
    const legacy = rule as AutomationRule;
    const triggerConfig: TriggerConfig = this._convertLegacyTrigger(legacy.trigger);

    return {
      id: legacy.id,
      name: legacy.name,
      enabled: legacy.enabled,
      trigger: triggerConfig,
      actionName: legacy.action.type,
      workflowId: legacy.action.workflowId,
      lastRun: legacy.lastRun,
      createdAt: legacy.createdAt,
    };
  }

  /** 转换旧版 trigger 格式为 TriggerConfig */
  private _convertLegacyTrigger(trigger: AutomationRule['trigger']): TriggerConfig {
    switch (trigger.type) {
      case 'cron':
        return {
          type: 'schedule',
          params: { mode: 'every', intervalMs: (trigger.intervalMinutes || 60) * 60_000 },
        };
      case 'inbox_threshold':
        return {
          type: 'inbox_threshold',
          params: { threshold: trigger.inboxCount || 5 },
        };
      case 'on_startup':
        return {
          type: 'on_startup',
          params: {},
        };
      default:
        return {
          type: 'schedule',
          params: { mode: 'every', intervalMs: 3600_000 },
        };
    }
  }

  /** 转换 RuleConfig 为旧版 AutomationRule（兼容 UI） */
  private _toLegacyRule(rule: RuleConfig): AutomationRule {
    let triggerType: TriggerType = 'cron';
    let intervalMinutes: number | undefined;
    let inboxCount: number | undefined;

    if (rule.trigger.type === 'schedule') {
      const params = rule.trigger.params as { mode: string; intervalMs?: number };
      if (params.mode === 'every' && params.intervalMs) {
        triggerType = 'cron';
        intervalMinutes = Math.round(params.intervalMs / 60_000);
      } else if (params.mode === 'at') {
        triggerType = 'cron';
        intervalMinutes = 1440; // 每天
      }
    } else if (rule.trigger.type === 'inbox_threshold') {
      triggerType = 'inbox_threshold';
      inboxCount = (rule.trigger.params as { threshold: number }).threshold;
    } else if (rule.trigger.type === 'on_startup') {
      triggerType = 'on_startup';
    } else if (rule.trigger.type === 'event') {
      triggerType = 'event';
    }

    return {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      trigger: { type: triggerType, intervalMinutes, inboxCount },
      action: { type: rule.actionName, workflowId: rule.workflowId },
      lastRun: rule.lastRun,
      createdAt: rule.createdAt,
    };
  }
}
