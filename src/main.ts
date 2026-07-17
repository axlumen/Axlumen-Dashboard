/**
 * main.ts — Axlumen Dashboard 插件入口
 *
 * 个人控制面板：三 Wiki 统计、项目追踪、待办、Memo、金句轮播
 *
 * 改造：
 * - onunload 时调用 AgentRunner.dispose() + AutomationEngine.stopAll()
 */

import { Plugin, WorkspaceLeaf } from 'obsidian';
import type { DashboardSettings } from './types';
import { DEFAULT_SETTINGS, DashboardSettingTab } from './settings';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './view';
import { AgentRunner } from './agent/AgentRunner';
import { VaultScanner } from './services/VaultScanner';
import { initLocalStore, flushLocalStore } from './utils/LocalStore';
import {
  atomicWrite, recoverFromTmp, createBackup, restoreFromBackup, safeRead,
} from './utils/atomicWrite';
import { getWriteLock, releaseAllWriteLocks } from './utils/WriteLock';

/** 递归深度合并：保留默认值结构，覆盖持久化数据 */
function deepMerge<T>(defaults: T, saved: Partial<T>): T {
  const result: any = Array.isArray(defaults) ? [...defaults] : { ...defaults };
  for (const key of Object.keys(saved) as (keyof T)[]) {
    const sv = saved[key];
    if (sv === undefined) continue;
    const dv = defaults[key];
    if (
      dv !== null && sv !== null &&
      typeof dv === 'object' && typeof sv === 'object' &&
      !Array.isArray(dv) && !Array.isArray(sv)
    ) {
      result[key] = deepMerge(dv, sv as any);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

export default class AxlumenDashboardPlugin extends Plugin {
  settings: DashboardSettings;
  private statusBarEl: HTMLElement | null = null;
  private _agentRunner: AgentRunner | null = null;
  private _vaultScanner: VaultScanner | null = null;

  /** 共享单例 AgentRunner（贯穿整个插件生命周期） */
  get agentRunner(): AgentRunner {
    if (!this._agentRunner) this._agentRunner = new AgentRunner(this.app);
    return this._agentRunner;
  }

  /** 共享单例 VaultScanner */
  get vaultScanner(): VaultScanner {
    if (!this._vaultScanner) this._vaultScanner = new VaultScanner(this.app);
    return this._vaultScanner;
  }

  async onload() {
    await this.loadSettings();

    // 初始化 LocalStore（从 data.json 读取轻量 UI 状态）
    initLocalStore(this);

    // 预创建共享实例
    this.agentRunner;
    this.vaultScanner;

    // 注册 Dashboard 视图
    this.registerView(
      VIEW_TYPE_DASHBOARD,
      (leaf) => new DashboardView(leaf, this)
    );

    // 侧栏图标
    this.addRibbonIcon('layout-dashboard', 'Axlumen Dashboard', () => {
      this.activateView();
    });

    // 命令面板
    this.addCommand({
      id: 'open-dashboard',
      name: '打开 Axlumen Dashboard',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'refresh-dashboard',
      name: '刷新 Dashboard 数据',
      callback: () => this.refreshAllDashboards(),
    });

    // 设置面板
    this.addSettingTab(new DashboardSettingTab(this.app, this));

    // ==================== P6: 命令面板完整注册 ====================

    this.addCommand({
      id: 'run-deep-research',
      name: 'Agent: Run Deep Research',
      callback: () => this.runWorkflow('deep-research-single'),
    });

    this.addCommand({
      id: 'run-inbox-routing',
      name: 'Agent: Run Inbox Auto-Routing',
      callback: () => this.runWorkflow('inbox-auto-routing'),
    });

    this.addCommand({
      id: 'run-vault-lint',
      name: 'Agent: Trigger Full Vault Lint',
      callback: () => this.runWorkflow('vault-lint-full-scan'),
    });

    this.addCommand({
      id: 'quick-capture-inbox',
      name: 'Quick Capture To Inbox',
      callback: () => this.quickCaptureToInbox(),
    });

    this.addCommand({
      id: 'clear-all-cache',
      name: 'Dashboard: Clear All Cache',
      callback: () => this.clearAllCache(),
    });

    // ==================== P6: 底部状态栏微件 ====================

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('axlumen-status-bar');
    this.updateStatusBar();

    // 状态栏点击监听器 — 使用 registerDomEvent 自动清理
    if (this.statusBarEl) {
      this.registerDomEvent(this.statusBarEl, 'click', () => {
        this.activateView();
      });
    }
  }

  onunload() {
    // 清理共享 runner（停定时器 / 杀 pending CLI / 清所有回调）
    this._agentRunner?.dispose();
    // 立即刷出 LocalStore 脏数据
    flushLocalStore();
    // 释放所有写锁
    releaseAllWriteLocks();
    // 主动清理所有 Dashboard 视图的 widget 资源
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    for (const leaf of leaves) {
      if (leaf.view instanceof DashboardView) {
        leaf.view.cleanup();
      }
    }
  }

  async loadSettings() {
    // 1. 尝试从 .tmp 恢复（上次写入被中断）
    await recoverFromTmp(this.app.vault, 'data.json');

    // 2. 尝试加载 data.json
    let saved: Partial<DashboardSettings> | null = null;
    try {
      const raw = await safeRead(this.app.vault, 'data.json');
      if (raw) {
        saved = JSON.parse(raw);
      }
    } catch (e) {
      console.error('[Axlumen] data.json 损坏，尝试从备份恢复:', e);
    }

    // 3. 如果 data.json 加载失败，尝试 .bak
    if (!saved) {
      try {
        const restored = await restoreFromBackup(this.app.vault, 'data.json');
        if (restored) {
          const raw = await safeRead(this.app.vault, 'data.json');
          if (raw) {
            saved = JSON.parse(raw);
          }
        }
      } catch (e) {
        console.error('[Axlumen] .bak 也损坏，使用默认配置:', e);
      }
    }

    // 4. 合并配置（保留默认值结构）
    this.settings = saved ? deepMerge(DEFAULT_SETTINGS, saved) : { ...DEFAULT_SETTINGS };
  }

  async saveSettings() {
    const lock = getWriteLock('data.json');
    await lock.acquire(async () => {
      await atomicWrite(this.app.vault, 'data.json', JSON.stringify(this.settings, null, 2));
      await createBackup(this.app.vault, 'data.json');
    });
    this.refreshAllDashboards();
  }

  /** 刷新所有打开的 Dashboard 视图 */
  private refreshAllDashboards() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    for (const leaf of leaves) {
      if (leaf.view instanceof DashboardView) {
        leaf.view.refresh();
      }
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf('tab');
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_DASHBOARD,
          active: true,
        });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  // ==================== P6: 命令处理辅助方法 ====================

  private runWorkflow(workflowId: string) {
    this.agentRunner.run(workflowId).catch(() => { /* 错误由 AgentRunner 内部处理 */ });
    this.activateView();
  }

  private async quickCaptureToInboxPromise(): Promise<void> {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const fileName = `Inbox/${today}-quick-capture-${Date.now().toString(36)}.md`;
      const content = `---\ncreated: ${today}\nstatus: inbox\n---\n\n`;
      await this.app.vault.create(fileName, content);
      await this.app.workspace.openLinkText(fileName, '', 'tab');
    } catch (e) {
      console.warn('[Axlumen] Quick Capture 失败:', (e as Error).message);
    }
  }

  private quickCaptureToInbox() {
    this.quickCaptureToInboxPromise().catch(() => {});
  }

  private async clearAllCachePromise(): Promise<void> {
    const cacheFiles = [
      'dashboard/cache/agent-runs.json',
      'dashboard/cache/vault-health.json',
      'dashboard/cache/feeds-cache.json',
    ];
    await Promise.all(cacheFiles.map(async (path) => {
      try {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) await this.app.vault.delete(file);
      } catch { /* ignore */ }
    }));
  }

  private clearAllCache() {
    this.clearAllCachePromise().then(() => {
      this.refreshAllDashboards();
      this.updateStatusBar();
    }).catch(() => {});
  }

  // ==================== P6: 状态栏更新 ====================

  updateStatusBar() {
    if (!this.statusBarEl) return;
    this.statusBarEl.empty();

    const dot = this.statusBarEl.createDiv({ cls: 'axlumen-sb-dot axlumen-sb-dot--idle' });
    dot.title = 'Axlumen Dashboard';

    this.vaultScanner.scanFullVault().then(result => {
      if (result.ok) {
        const count = result.value.inboxFiles?.length || 0;
        if (count > 0) {
          const badge = this.statusBarEl!.createSpan({ cls: 'axlumen-sb-badge', text: String(count) });
          badge.title = count + ' unprocessed inbox items';
        }
      }
    }).catch(() => {});

    this.statusBarEl.addClass('axlumen-sb-clickable');
  }
}
