/**
 * CapabilityManifest.ts — 能力冷库：结构化能力追踪
 *
 * 三维状态分离：
 * - lifecycle: active / cold / disabled / reference / retired
 * - health: healthy / unverified / degraded / broken / missing
 * - risk: low / medium / high
 */

import { Disposable } from '../types';

// ==================== 类型定义 ====================

export type CapabilityLifeCycle = 'active' | 'cold' | 'disabled' | 'reference' | 'retired';
export type CapabilityHealth = 'healthy' | 'unverified' | 'degraded' | 'broken' | 'missing';
export type CapabilityRisk = 'low' | 'medium' | 'high';
export type CapabilitySource = 'workflow' | 'integration' | 'builtin';

export interface CapabilityEntry {
  id: string;
  name: string;
  /** Verb+Object+Output 模式，如 "Route+Inbox+Archive" */
  slot: string;
  source: CapabilitySource;
  lifecycle: CapabilityLifeCycle;
  health: CapabilityHealth;
  risk: CapabilityRisk;
  /** 路由条件 */
  purpose?: string;
  triggerPatterns: string[];
  disableWhen: string[];
  /** 健康追踪 */
  lastHealthCheck?: number;
  lastSuccessfulRun?: number;
  runCount: number;
  failureCount: number;
  consecutiveFailures: number;
  /** 元数据 */
  description: string;
  addedAt: number;
  updatedAt: number;
}

// ==================== Service ====================

export class CapabilityManifestService implements Disposable {
  private entries: Map<string, CapabilityEntry> = new Map();
  private saveCallback: () => void;
  private _disposed = false;

  static STORAGE_KEY = 'capabilityManifest';

  constructor(saveCallback: () => void) {
    this.saveCallback = saveCallback;
  }

  get disposed(): boolean { return this._disposed; }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.entries.clear();
  }

  // ---------- CRUD ----------

  register(entry: Omit<CapabilityEntry, 'addedAt' | 'updatedAt'>): void {
    const now = Date.now();
    const existing = this.entries.get(entry.id);
    this.entries.set(entry.id, {
      ...entry,
      addedAt: existing?.addedAt || now,
      updatedAt: now,
    });
    this.saveCallback();
  }

  unregister(id: string): void {
    this.entries.delete(id);
    this.saveCallback();
  }

  get(id: string): CapabilityEntry | undefined {
    return this.entries.get(id);
  }

  getAll(): CapabilityEntry[] {
    return Array.from(this.entries.values());
  }

  getBySource(source: CapabilitySource): CapabilityEntry[] {
    return this.getAll().filter(e => e.source === source);
  }

  // ---------- Health ----------

  recordSuccess(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.runCount++;
    entry.lastSuccessfulRun = Date.now();
    entry.consecutiveFailures = 0;
    entry.health = 'healthy';
    entry.updatedAt = Date.now();
    this.saveCallback();
  }

  recordFailure(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.failureCount++;
    entry.consecutiveFailures++;
    entry.updatedAt = Date.now();
    // 基于连续失败次数升级健康问题
    if (entry.consecutiveFailures >= 5) {
      entry.health = 'broken';
    } else if (entry.consecutiveFailures >= 2) {
      entry.health = 'degraded';
    }
    this.saveCallback();
  }

  updateHealth(id: string, health: CapabilityHealth): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.health = health;
    entry.lastHealthCheck = Date.now();
    entry.updatedAt = Date.now();
    this.saveCallback();
  }

  // ---------- Lifecycle ----------

  retire(id: string): void {
    this.setLifecycle(id, 'retired');
  }

  disable(id: string): void {
    this.setLifecycle(id, 'disabled');
  }

  activate(id: string): void {
    this.setLifecycle(id, 'active');
  }

  coldStart(id: string): void {
    this.setLifecycle(id, 'cold');
  }

  private setLifecycle(id: string, lifecycle: CapabilityLifeCycle): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.lifecycle = lifecycle;
    entry.updatedAt = Date.now();
    this.saveCallback();
  }

  // ---------- Persistence ----------

  load(data: CapabilityEntry[]): void {
    this.entries.clear();
    for (const entry of data) {
      this.entries.set(entry.id, entry);
    }
  }

  serialize(): CapabilityEntry[] {
    return Array.from(this.entries.values());
  }

  // ---------- Sync ----------

  /**
   * 从 workflow 模板同步。
   * 已存在的条目保留运行历史，不存在的创建新条目。
   */
  syncFromWorkflows(templates: Array<{ id: string; name: string; description: string; purpose?: string; trigger?: string; disableWhen?: string; riskLevel?: string }>): void {
    const now = Date.now();
    for (const tpl of templates) {
      const existing = this.entries.get(tpl.id);
      if (existing) {
        // 更新元数据，保留历史
        existing.name = tpl.name;
        existing.description = tpl.description;
        existing.purpose = tpl.purpose;
        existing.triggerPatterns = this.parseList(tpl.trigger || tpl.name);
        existing.disableWhen = this.parseList(tpl.disableWhen || '');
        existing.risk = (tpl.riskLevel as CapabilityRisk) || 'low';
        existing.updatedAt = now;
      } else {
        this.entries.set(tpl.id, {
          id: tpl.id,
          name: tpl.name,
          slot: this.inferSlot(tpl.name, tpl.description),
          source: 'workflow',
          lifecycle: 'active',
          health: 'unverified',
          risk: (tpl.riskLevel as CapabilityRisk) || 'low',
          purpose: tpl.purpose || tpl.description,
          triggerPatterns: this.parseList(tpl.trigger || tpl.name),
          disableWhen: this.parseList(tpl.disableWhen || ''),
          runCount: 0,
          failureCount: 0,
          consecutiveFailures: 0,
          description: tpl.description,
          addedAt: now,
          updatedAt: now,
        });
      }
    }
    this.saveCallback();
  }

  /**
   * 从第三方集成同步。
   */
  syncFromIntegrations(integrations: Array<{ id: string; name: string; description: string }>): void {
    const now = Date.now();
    for (const integ of integrations) {
      const existing = this.entries.get(integ.id);
      if (!existing) {
        this.entries.set(integ.id, {
          id: integ.id,
          name: integ.name,
          slot: this.inferSlot(integ.name, integ.description),
          source: 'integration',
          lifecycle: 'active',
          health: 'unverified',
          risk: 'low',
          triggerPatterns: [],
          disableWhen: [],
          runCount: 0,
          failureCount: 0,
          consecutiveFailures: 0,
          description: integ.description,
          addedAt: now,
          updatedAt: now,
        });
      }
    }
    this.saveCallback();
  }

  /** 从名称推断 Verb+Object+Output slot */
  private inferSlot(name: string, description: string): string {
    const text = `${name} ${description}`.toLowerCase();
    if (text.includes('inbox') || text.includes('routing')) return 'Route+Inbox+Archive';
    if (text.includes('research')) return 'Research+Topic+Report';
    if (text.includes('lint') || text.includes('health')) return 'Scan+Vault+Report';
    if (text.includes('diary') || text.includes('daily')) return 'Generate+Diary+Draft';
    if (text.includes('tag')) return 'Classify+Tags+Report';
    if (text.includes('rss') || text.includes('digest')) return 'Aggregate+Feeds+Digest';
    if (text.includes('github') || text.includes('repo')) return 'Evaluate+Project+Card';
    return `${name}+Process+Result`;
  }

  private parseList(s: string): string[] {
    return s.split(',').map(i => i.trim()).filter(i => i.length > 0);
  }
}
