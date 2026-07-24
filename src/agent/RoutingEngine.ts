/**
 * RoutingEngine.ts — AgentRunner 与 WorkflowRegistry 之间的胶水层
 *
 * 职责：
 * 1. 从 workflow 模板填充 registry
 * 2. 构建 RoutingContext（实时状态）
 * 3. 根据用户输入自动选择最佳 workflow
 */

import { App } from 'obsidian';
import { WorkflowRegistry, WorkflowRoute, RoutingContext, RoutingMatch } from './WorkflowRegistry';
import type { AgentRunner, WorkflowTemplate } from './AgentRunner';

export class RoutingEngine {
  private registry: WorkflowRegistry;
  private runner: AgentRunner;
  private app: App;

  constructor(app: App, runner: AgentRunner) {
    this.app = app;
    this.runner = runner;
    this.registry = new WorkflowRegistry();
  }

  /** 获取底层 registry（用于直接操作） */
  getRegistry(): WorkflowRegistry {
    return this.registry;
  }

  /**
   * 从扫描的 workflow 模板填充 registry。
   * 每次调用会重建整个 registry。
   */
  async syncFromWorkflows(): Promise<void> {
    const templates = await this.runner.scanWorkflows();
    this.registry = new WorkflowRegistry();

    for (const tpl of templates) {
      this.registry.register({
        id: tpl.id,
        purpose: tpl.purpose || tpl.description || tpl.name,
        triggerPatterns: this.parseCommaList(tpl.trigger || tpl.name),
        disableWhen: this.parseCommaList(tpl.disableWhen || ''),
        riskLevel: tpl.riskLevel || 'low',
        outputHint: tpl.defaultOutput || '',
      });
    }
  }

  /**
   * 根据用户输入自动选择最佳 workflow。
   * 返回 null = "不需要工具"。
   */
  async route(userInput: string): Promise<WorkflowRoute | null> {
    // 确保 registry 已填充
    if (this.registry.getAll().length === 0) {
      await this.syncFromWorkflows();
    }

    const context = await this.buildContext();
    const matches = this.registry.match(userInput, context);

    if (matches.length === 0) return null;

    // 最高分匹配
    return matches[0].route;
  }

  /**
   * 返回所有匹配结果（用于 UI 展示候选列表）。
   */
  async routeWithCandidates(userInput: string, limit: number = 5): Promise<RoutingMatch[]> {
    if (this.registry.getAll().length === 0) {
      await this.syncFromWorkflows();
    }

    const context = await this.buildContext();
    return this.registry.match(userInput, context).slice(0, limit);
  }

  /** 从实时状态构建 RoutingContext */
  private async buildContext(): Promise<RoutingContext> {
    const inboxCount = await this.getInboxCount();
    const lastRunTime = this.runner.getRunHistoryTimestamps();

    return {
      hasActiveTask: this.runner.getActiveTasks().length > 0,
      inboxCount,
      lastRunTime,
      currentHour: new Date().getHours(),
    };
  }

  /** 获取 inbox 文件数 */
  private async getInboxCount(): Promise<number> {
    try {
      const files = this.app.vault.getMarkdownFiles();
      return files.filter(f => f.path.startsWith('Inbox/')).length;
    } catch {
      return 0;
    }
  }

  /** 逗号分隔列表解析 */
  private parseCommaList(s: string): string[] {
    return s.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
}
