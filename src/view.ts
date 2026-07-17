/**
 * view.ts — Dashboard 主视图 (v2.1)
 *
 * v2.1 Changes:
 *   [1] Hero Focus merged into Banner      — eliminates ~120px vertical stack
 *   [2] Quick Actions moved to Sidebar      — eliminates ~48px standalone bar
 *   [3] Active Task Bar moved to Sidebar    — eliminates ~40px standalone bar
 *   [4] Duplicate Workflows removed from Kanban — only rendered in Sidebar
 *   [5] Vault scan consolidated to single await in render() — no double I/O
 *   [6] Agent Status + Workflows combined into one sidebar panel
 *   [7] Sidebar trimmed: duplicate Action Bar removed
 */

import { ItemView, WorkspaceLeaf, Events } from 'obsidian';
import type AxlumenDashboardPlugin from './main';
import { scanVault, getRecentFiles } from './scanner';
import type {
  VaultStats, QuickAction, FocusProject, CardCollapseState,
  CardOrderState, ProjectCard,
} from './types';
import { el, div, animateCount, esc } from './utils/dom';
import { staggerEntrance, animateProgressBars } from './utils/animate';
import { debounce } from './utils/debounce';
import { LocalStore } from './utils/LocalStore';
import {
  CLOCK_INTERVAL_MS, TOAST_DURATION_MS,
  AUTO_REFRESH_DEBOUNCE_MS, MS_PER_DAY,
} from './constants';
import { buildIngestPrompt, buildQueryPrompt } from './prompts';
import { createTodosPanel } from './widgets/todos';
import { createCountdownPanel } from './widgets/countdown';
import { createHeatmapPanel } from './widgets/heatmap';
import {
  createInboxPanel, scanInbox, buildInboxIngestPrompt, InboxItem,
} from './widgets/inbox';
import { createWeekCalendarWidget } from './widgets/weekCalendar';
import { createAgentStatusWidget } from './widgets/agentStatus';
import { createFeedsPanel } from './widgets/feeds';
import { createWorkflowsPanel, RulesStore } from './widgets/workflows';
import { createActiveTaskBar } from './widgets/activeTaskBar';
import { createVaultHealthPanel } from './widgets/vaultHealth';
import { createInboxRouterPanel } from './widgets/inboxRouter';
import { AgentRunner } from './agent/AgentRunner';
import { enqueueAgentTask, AgentTaskType } from './agent/claudeCode';
import { addTask, completeTask, failTask, getTasksByStatus, listRecentTasks } from './agent/taskStore';
import { VaultScanner, VaultHealthData } from './services/VaultScanner';
import { AutomationEngine } from './services/AutomationEngine';
import { CompositeDisposable } from './utils/CompositeDisposable';
import { LazyRenderer } from './utils/LazyRenderer';
import { renderErrorState } from './utils/ServiceResult';
import type { WidgetHandle, Disposable } from './types';

/* ========================================================================
   SVG Icon System — inline stroke-path SVGs (currentColor, 1.5)
   ======================================================================== */
const ICON_PATHS: Record<string, string> = {
  'grid':
    '<rect x="3" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="14" width="7" height="7" rx="1"/>',
  'map':
    '<path d="M9 3l-2 2-2-2v12l2 2 2-2 2 2 2-2V3l-2 2-2-2z"/>' +
    '<path d="M9 3v12M13 5v12"/>',
  'graph':
    '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/>' +
    '<circle cx="12" cy="18" r="2"/>' +
    '<path d="M6 8l6 8M18 8l-6 8M8 6h8"/>',
};

function icon(name: string, size = 14): string {
  const d = ICON_PATHS[name] || ICON_PATHS['grid'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

// v2.1 — 'workflows' removed from CARD_IDS (rendered in Sidebar only)
const CARD_IDS = [
  'kpi', 'todos', 'heatmap', 'vaultHealth', 'feeds', 'projects', 'recent',
];

export const VIEW_TYPE_DASHBOARD = 'axlumen-dashboard-view';

export class DashboardView extends ItemView {
  plugin: AxlumenDashboardPlugin;
  private stats: VaultStats | null = null;
  private clockInterval: number | null = null;
  private currentPage: string = 'overview';

  // Event-driven
  private vaultEvents: Events | null = null;
  private debouncedRefresh: (() => void) | null = null;
  private _isRendering = false;
  private _renderCooldown = 0;

  // KPI data
  private inboxCount = 0;
  private taskCompletionPct = 0;
  private worstHealthScore = 100;

  // KPI subtitle data
  private healthDelta = 0;
  private oldestInboxDays = 0;
  private tasksToday = 0;
  private tasksOverdue = 0;
  private notesThisMonth = 0;
  private lastSyncTime = '';

  // Banner daily summary data
  private bannerTodoDone = 0;
  private bannerTodoTotal = 0;
  private bannerInboxCount = 0;
  private bannerAgentRunning = 0;
  private bannerAgentTotal = 0;
  private bannerHealthScore = 100;
  private bannerStatusLevel: 'green' | 'yellow' | 'red' = 'green';
  private bannerSummaryEl: HTMLElement | null = null;
  private bannerLiveEl: HTMLElement | null = null;

  // Sidebar / Banner state
  private sidebarPinned = false;
  private sidebarExpanded = false;
  private bannerCollapsed = false;

  // Agent Runner (shared singleton)
  private agentRunner: AgentRunner | null = null;

  // v2.1: handles for active workflows and live subscribers
  // activeTaskBarHandle is created once per render; tracked for runner unsubscriptions
  private activeTaskBarHandle: Disposable | null = null;

  /**
   * CompositeDisposable — manages view-scoped resources:
   *   - Widget handles (register addEventListener / setTimeout / runner subscriptions)
   *   - Auto-disposed on view unload / refresh
   *
   * Refresh flow: composite.dispose() in cleanup() → render() creates a new CompositeDisposable.
   */
  private composite: CompositeDisposable = new CompositeDisposable();

  // Vault Scanner
  private vaultScanner: VaultScanner | null = null;
  private vaultHealthData: VaultHealthData | null = null;

  // Automation Engine
  private automationEngine: AutomationEngine | null = null;

  // Focus system
  private focusPinned = false;
  private focusAutoMode = true;
  private focusProjects: FocusProject[] = [];
  private currentFocusIndex = -1;

  // Quick Actions
  private quickActions: QuickAction[] = [];

  // Quote rotation
  private bannerQuoteIndex = 0;
  private static readonly QUOTE_ROTATION_MS = 60_000;
  private quoteRotationTimer: number | null = null;

  // Page definitions
  private readonly pages = [
    { id: 'overview', icon: 'grid', label: '总览' },
    { id: 'vault', icon: 'map', label: '全库视图' },
    { id: 'graph', icon: 'graph', label: '知识图谱' },
  ];

  // Lazy renderer for Kanban cards
  private lazyRenderer: LazyRenderer | null = null;

  // DOM event cleanup tracking
  private _domCleanup: Array<() => void> = [];

  constructor(leaf: WorkspaceLeaf, plugin: AxlumenDashboardPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE_DASHBOARD; }
  getDisplayText() { return 'Axlumen Dashboard'; }
  getIcon() { return 'layout-dashboard'; }

  // ==================== Lifecycle ====================

  async onOpen() {
    this.containerEl.empty();
    this.containerEl.addClass('axlumen-dashboard');

    // Reset composite (onOpen can be called multiple times after close)
    this.composite = new CompositeDisposable();

    this.agentRunner = this.plugin.agentRunner;
    this.vaultScanner = this.plugin.vaultScanner;

    // Automation engine — persisted via plugin.saveSettings() (data.json)
    this.automationEngine = new AutomationEngine(
      this.app,
      this.agentRunner,
      () => {
        const engine = this.automationEngine;
        if (engine) {
          this.plugin.settings.automationRules = engine.getRules();
          void this.plugin.saveSettings();
        }
      },
    );
    this.automationEngine.loadRules(this.plugin.settings.automationRules);
    this.automationEngine.startAll();

    this.loadFocusState();

    this.debouncedRefresh = debounce(() => {
      this.stats = null;
      this.refresh();
    }, AUTO_REFRESH_DEBOUNCE_MS);

    this.registerVaultEvents();
    this.registerVaultScanListener();
    this.registerStorageEventListener();
    await this.render();
  }

  async onClose() { this.cleanup(); }

  cleanup() {
    // Dispose lazy renderer
    this.lazyRenderer?.dispose();
    this.lazyRenderer = null;

    // Dispose all view-scoped widget handles + runner subscriptions
    this.composite.dispose();
    this.composite = new CompositeDisposable();

    if (this.clockInterval) {
      window.clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.quoteRotationTimer) {
      window.clearInterval(this.quoteRotationTimer);
      this.quoteRotationTimer = null;
    }
    this.automationEngine?.dispose();
    this.automationEngine = null;
    this.unregisterVaultEvents();
    this.cleanupDomEvents();
    // Clear the active task bar DOM (the handle was already disposed via composite)
    this.activeTaskBarHandle = null;
    // Final DOM wipe
    this.containerEl.empty();
  }

  /** Clean up manually-tracked DOM listeners */
  private cleanupDomEvents(): void {
    for (const h of this._domCleanup) h();
    this._domCleanup = [];
  }

  /** Register a DOM event that auto-cleans on view unload */
  private regDom<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler as EventListener, options);
    this._domCleanup.push(
      () => target.removeEventListener(type, handler as EventListener, options),
    );
  }

  // ==================== Event System ====================

  private registerVaultEvents() {
    if (!this.plugin.settings.autoRefresh) return;
    const vault = this.app.vault;
    this.vaultEvents = vault;
    this.registerEvent(vault.on('modify', this.handleVaultChange));
    this.registerEvent(vault.on('create', this.handleVaultChange));
    this.registerEvent(vault.on('delete', this.handleVaultChange));
  }

  private unregisterVaultEvents() { this.vaultEvents = null; }

  private handleVaultChange = () => {
    if (this._isRendering || Date.now() < this._renderCooldown) return;
    this.debouncedRefresh?.();
  };

  /** Listen for vault-scan-finish custom event */
  private registerVaultScanListener(): void {
    this.registerDomEvent(
      document as any, 'vault-scan-finish' as any,
      this.handleVaultScanFinish as any,
    );
  }

  private handleVaultScanFinish = () => {
    if (this.vaultScanner) {
      this.vaultScanner.scanIncremental().then(result => {
        if (result.ok) {
          this.vaultHealthData = result.value;
          this.automationEngine?.checkInboxThreshold(result.value.inboxFiles.length);
          this.flashLiveIndicator();
          this.refreshBanner();
        }
      }).catch(() => {});
    }
  };

  /** Listen for agent-finish custom event */
  private registerStorageEventListener(): void {
    this.registerDomEvent(
      document as any, 'dashboard-agent-finish' as any,
      this.handleAgentFinish as any,
    );
  }

  private handleAgentFinish = () => {
    this.flashLiveIndicator();
    this.refreshBanner();
  };

  /** Banner status pulse highlight */
  private flashLiveIndicator(): void {
    this.refreshBanner();
  }

  // ==================== Focus State Persistence ====================

  private loadFocusState(): void {
    const state = LocalStore.getFocusState();
    this.focusPinned = state.pinned;
    this.focusAutoMode = state.autoMode;
    this.currentFocusIndex = state.focusIndex;
  }

  private saveFocusState(): void {
    LocalStore.setFocusState({
      pinned: this.focusPinned,
      autoMode: this.focusAutoMode,
      focusIndex: this.currentFocusIndex,
    });
  }

  private initFocusData() {
    const settingProjects: FocusProject[] = this.plugin.settings.projects.map(
      (p: ProjectCard) => ({
        name: p.name,
        path: p.path,
        stage: p.priority || '',
        nextAction: p.description || '',
      }),
    );
    this.focusProjects = settingProjects.length > 0 ? settingProjects : [
      { name: 'Axlumen Dashboard', path: 'projects/axlumen-dashboard', stage: 'Phase 1', nextAction: '完成 Dashboard 改造' },
      { name: '知识库重构', path: 'projects/knowledge-restructure', stage: '规划阶段', nextAction: '确定 Wiki 分类体系' },
      { name: '安全审计工具', path: 'projects/security-audit', stage: '调研阶段', nextAction: '评估工具链' },
    ];
    if (this.focusAutoMode && !this.focusPinned) {
      this.currentFocusIndex = 0;
    }
  }

  // ==================== Quick Actions ====================

  private initQuickActions() {
    const cmds: Array<Omit<QuickAction, 'id'>> = [
      { name: 'New Diary', type: 'file', target: 'diary/new', icon: '📝' },
      { name: 'Deep Research', type: 'command', target: 'editor:open', icon: '🔬' },
      { name: 'Pull RSS', type: 'command', target: 'rss:sync', icon: '📡' },
      { name: 'GitHub Feeds', type: 'command', target: 'github:refresh', icon: '⭐' },
      { name: 'Inbox Ingest', type: 'command', target: 'inbox:archive', icon: '📥' },
      { name: 'Vault Lint', type: 'command', target: 'vault:health', icon: '🏥' },
    ];
    this.quickActions = cmds.map((c, i) => ({ ...c, id: 'qa-' + i }));
  }

  private executeQuickAction(qa: QuickAction) {
    if (qa.type === 'file') {
      this.openPath(qa.target);
    } else {
      const cmd = this.app.commands.commands?.[qa.target];
      if (cmd) {
        try { this.app.commands.executeCommandById(qa.target); }
        catch { this.showToast('执行命令失败: ' + qa.name); }
      } else {
        this.showToast('Command: ' + qa.name + ' (mock — wire up in settings)');
      }
    }
  }

  // ==================== Refresh / Page Switch ====================

  async refresh() {
    this.stats = null;
    this.composite.dispose();
    this.composite = new CompositeDisposable();
    this.cleanupDomEvents();
    this.containerEl.empty();
    await this.render();
  }

  private switchPage(pageId: string) {
    this.currentPage = pageId;
    this.containerEl.querySelectorAll('.ax-sidebar-nav-item[data-page]').forEach(btn => {
      btn.toggleClass('ax-sidebar-nav-active', btn.getAttribute('data-page') === pageId);
    });
    this.containerEl.querySelectorAll('.ax-page').forEach(page => {
      const isTarget = page.getAttribute('data-page') === pageId;
      page.toggleClass('ax-page-hidden', !isTarget);
      page.toggleClass('ax-page-active', isTarget);
    });
  }

  // ==================== MAIN RENDER ====================

  private async render() {
    this._isRendering = true;
    try {
      const settings = this.plugin.settings;
      const container = this.containerEl;

      // Parallel independent I/O
      const [stats] = await Promise.all([
        this.stats || scanVault(this.app, settings.wikis),
        this.computeKpiData(),
      ]);
      if (!this.stats) this.stats = stats;

      // v2.1 [5] — Single vault scan (cached for heatmap, vaultHealth, inbox)
      if (!this.vaultHealthData && this.vaultScanner) {
        try {
          const scanResult = await this.vaultScanner.scanIncremental();
          if (scanResult.ok) this.vaultHealthData = scanResult.value;
        }
        catch { /* degrade gracefully */ }
      }

      const app = div('ax-app');
      app.addClass('apex-dashboard-root');
      app.setAttribute('data-theme', settings.theme);
      app.addClass('axlumen-theme-' + settings.theme);

      // v2.1 [1] — Banner with integrated compact focus
      this.initFocusData();
      app.appendChild(this.createBanner());

      // Main layout: Sidebar + Kanban
      const mainLayout = div('ax-main-layout');

      // ---- Left Sidebar ----
      const sidebar = div('ax-sidebar');
      if (this.sidebarPinned) sidebar.addClass('ax-sidebar--pinned');
      else if (this.sidebarExpanded) sidebar.addClass('ax-sidebar--expanded');
      else sidebar.addClass('ax-sidebar--collapsed');
      await this.renderWidgetSidebar(sidebar);
      mainLayout.appendChild(sidebar);

      const slimIndicator = div('ax-sidebar-slim-indicator');
      mainLayout.appendChild(slimIndicator);

      // ---- Kanban Content ----
      const content = div('ax-kanban-wrapper');

      // Overview page (Kanban)
      const pageOverview = div('ax-page');
      pageOverview.setAttribute('data-page', 'overview');
      const kanban = div('ax-kanban');

      // Initialize lazy renderer with kanban as scroll root
      this.lazyRenderer = new LazyRenderer(kanban);

      const order = this.getCardOrder();
      const FIRST_SCREEN_COUNT = 4;
      for (let i = 0; i < order.length; i++) {
        const cardId = order[i];
        try {
          const card = this.createCardById(cardId);
          if (card) {
            kanban.appendChild(card);
            // Force render first N cards (首屏)
            if (i < FIRST_SCREEN_COUNT) {
              const contentEl = card.querySelector('.ax-card-lazy-content') as HTMLElement;
              if (contentEl) this.lazyRenderer.forceRender(contentEl);
            }
          }
        } catch (e) {
          console.error('[DASHBOARD]', 'WIDGET_RENDER_FAILED', cardId, e);
          kanban.appendChild(renderErrorState({
            code: 'WIDGET_RENDER_FAILED',
            message: cardId + ' 加载失败',
            recoverable: false,
          }));
        }
      }
      kanban.appendChild(this.createFooter());
      pageOverview.appendChild(kanban);
      content.appendChild(pageOverview);

      // Vault page
      const pageVault = div('ax-page');
      pageVault.setAttribute('data-page', 'vault');
      pageVault.appendChild(this.createVaultSection());
      pageVault.appendChild(this.createFooter());
      content.appendChild(pageVault);

      // Graph page
      const pageGraph = div('ax-page');
      pageGraph.setAttribute('data-page', 'graph');
      pageGraph.appendChild(this.createGraphSection());
      pageGraph.appendChild(this.createFooter());
      content.appendChild(pageGraph);

      mainLayout.appendChild(content);
      app.appendChild(mainLayout);

      container.appendChild(app);
      container.appendChild(el('div', { class: 'ax-toast' }));

      this.switchPage(this.currentPage);
      this.startClock();
      this.setupSidebarBehavior(sidebar, slimIndicator);
      this.setupQuoteRotation();
      this.refreshBanner();

      // Entrance animations
      requestAnimationFrame(() => {
        setTimeout(() => {
          const cards = container.querySelectorAll<HTMLElement>(
            '.ax-panel, .ax-card, .ax-section-row',
          );
          staggerEntrance(Array.from(cards), 60);
          animateProgressBars(container);
        }, 50);
      });

      this._renderCooldown = Date.now() + 2000;
    } finally {
      this._isRendering = false;
    }
  }

  // ==================== Widget Sidebar ====================

  private async renderWidgetSidebar(sidebar: HTMLElement) {
    const scroll = div('ax-sidebar-scroll');
    const widgets = this.plugin.settings.widgets;

    // 1. v2.1 [2] — Compact Quick Actions (top of sidebar, replaces old Action Bar)
    this.initQuickActions();
    scroll.appendChild(this.createSidebarQuickActions());
    scroll.appendChild(div('ax-sidebar-divider'));

    // 2. v2.1 [3] — Active Task Bar (moved into sidebar)
    try {
      const { bar, handle: activeTaskBarHandle } = createActiveTaskBar(
        this.plugin.agentRunner, (path) => this.openPath(path),
      );
      this.activeTaskBarHandle = activeTaskBarHandle;
      this.composite.add(activeTaskBarHandle);
      scroll.appendChild(bar);
    } catch (e) {
      console.error('[DASHBOARD]', 'TASK_BAR_FAILED', e);
      scroll.appendChild(renderErrorState({
        code: 'TASK_BAR_FAILED', message: '任务栏加载失败', recoverable: false,
      }));
    }
    scroll.appendChild(div('ax-sidebar-divider'));

    // 3. KPI compact bar
    scroll.appendChild(this.createSidebarKpiBar());
    scroll.appendChild(div('ax-sidebar-divider'));

    // 4. Tab navigation
    scroll.appendChild(this.createSidebarNav());
    scroll.appendChild(div('ax-sidebar-divider'));

    // 5. Week Calendar (height-limited)
    if (widgets.weekCalendar) {
      try {
        const { section: cal, handle: calHandle } = createWeekCalendarWidget(
          this.app, this.createPanelSection.bind(this),
        );
        cal.style.maxHeight = '140px';
        cal.style.overflow = 'hidden';
        scroll.appendChild(cal);
        this.composite.add(calHandle);
      } catch (e) {
        console.error('[DASHBOARD]', 'WEEK_CALENDAR_FAILED', e);
      }
      scroll.appendChild(div('ax-sidebar-divider'));
    }

    // 6. v2.1 [4][6] — Agent & Workflows combined (no duplicate)
    try {
      scroll.appendChild(await this.createCombinedAgentPanel());
    } catch (e) {
      console.error('[DASHBOARD]', 'AGENT_PANEL_FAILED', e);
      scroll.appendChild(renderErrorState({
        code: 'AGENT_PANEL_FAILED', message: 'Agent 面板加载失败', recoverable: false,
      }));
    }
    scroll.appendChild(div('ax-sidebar-divider'));

    // 7. Inbox Router (uses cached vaultHealthData — no extra scan)
    try {
      const inboxFiles = this.vaultHealthData?.inboxFiles ?? [];
      const { section: irSection, handle: irHandle } = createInboxRouterPanel(
        this.app,
        this.createPanelSection.bind(this),
        (path: string) => this.openPath(path),
        inboxFiles,
        {
          onRouteSingle: (_item: InboxItem) => { this.triggerAgentInboxRoute(); },
          onRouteAll: (_items: InboxItem[]) => { this.triggerAgentInboxRoute(); },
        },
      );
      scroll.appendChild(irSection);
      this.composite.add(irHandle);
    } catch (e) {
      console.error('[DASHBOARD]', 'INBOX_ROUTER_FAILED', e);
    }
    scroll.appendChild(div('ax-sidebar-divider'));

    // 8. Countdown
    try {
      const { section: cdSection, handle: cdHandle } = createCountdownPanel(
        this.plugin.settings,
        () => this.plugin.saveSettings(),
        (msg: string) => this.showToast(msg),
        this.createPanelSection.bind(this),
      );
      scroll.appendChild(cdSection);
    } catch (e) {
      console.error('[DASHBOARD]', 'COUNTDOWN_FAILED', e);
    }
    scroll.appendChild(div('ax-sidebar-divider'));

    // 9. Quick Memo
    if (widgets.quickMemo) {
      scroll.appendChild(this.createQuickMemoWidget());
    }

    sidebar.appendChild(scroll);

    // Pin toggle button
    const pinBtn = el('button', { class: 'ax-sidebar-pin-btn', type: 'button' });
    pinBtn.innerHTML = this.sidebarPinned ? '📌' : '📍';
    pinBtn.title = this.sidebarPinned ? '取消固定侧栏' : '固定侧栏';
    this.regDom(pinBtn, 'click', (e) => {
      e.stopPropagation();
      this.sidebarPinned = !this.sidebarPinned;
      if (this.sidebarPinned) {
        sidebar.addClass('ax-sidebar--pinned');
        sidebar.removeClass('ax-sidebar--expanded ax-sidebar--collapsed');
        this.sidebarExpanded = false;
      } else {
        sidebar.removeClass('ax-sidebar--pinned');
        sidebar.addClass('ax-sidebar--collapsed');
        this.sidebarExpanded = false;
      }
      pinBtn.innerHTML = this.sidebarPinned ? '📌' : '📍';
    });
    sidebar.appendChild(pinBtn);
  }

  // ---------- Sidebar sub-components ----------

  /** v2.1 [2] — Compact Quick Actions in sidebar */
  private createSidebarQuickActions(): HTMLElement {
    const section = this.createPanelSection('Quick Actions', '#38BDF8', '');
    const grid = div('ax-sqa-grid');
    this.quickActions.forEach(qa => {
      const btn = el('button', {
        class: 'ax-sqa-btn',
        type: 'button',
        title: qa.name,
      });
      btn.innerHTML =
        '<span class="ax-sqa-icon">' + esc(qa.icon || '') + '</span>' +
        '<span class="ax-sqa-label">' + esc(qa.name) + '</span>';
      this.regDom(btn, 'click', () => {
        btn.addClass('is-active');
        setTimeout(() => btn.removeClass('is-active'), 600);
        this.executeQuickAction(qa);
      });
      grid.appendChild(btn);
    });
    section.appendChild(grid);
    return section;
  }

  /** v2.1 [6] — Combined Agent Status + Workflows panel */
  private async createCombinedAgentPanel(): Promise<HTMLElement> {
    const panel = this.createPanelSection('Agent & Workflows', '#818CF8', '');

    // Agent status (compact)
    const { section: agentEl, handle: agentHandle } = await createAgentStatusWidget(
      this.app, this.createPanelSection.bind(this),
    );
    panel.appendChild(agentEl);
    this.composite.add(agentHandle);

    // Divider
    panel.appendChild(div('ax-panel-divider'));

    // Workflows
    const rulesStore: RulesStore = {
      getRules: () => this.plugin.settings.automationRules || [],
      saveRules: (rules) => {
        this.plugin.settings.automationRules = rules;
        void this.plugin.saveSettings();
      },
    };
    const { section: workflowsEl, handle: workflowsHandle } = await createWorkflowsPanel(
      this.app,
      this.createPanelSection.bind(this),
      this.agentRunner || undefined,
      rulesStore,
    );
    panel.appendChild(workflowsEl);
    this.composite.add(workflowsHandle);

    return panel;
  }

  /** Quick Memo — textarea + save to Inbox */
  private createQuickMemoWidget(): HTMLElement {
    const section = this.createPanelSection('Quick Memo', '#F472B6', '');
    section.style.setProperty('--ax-accent', '#F472B6');

    const memoArea = el('textarea', {
      class: 'ax-memo ax-memo--compact',
      placeholder: '快速记录... [[wikilink]]',
    }) as HTMLTextAreaElement;

    const actions = div('ax-memo-actions');
    const saveBtn = el(
      'button', { class: 'ax-btn ax-btn-primary ax-btn-sm' }, '💾 保存到 Inbox',
    );
    this.regDom(saveBtn, 'click', async () => {
      const text = memoArea.value.trim();
      if (!text) { this.showToast('先写点东西'); return; }
      try {
        const today = new Date().toISOString().slice(0, 10);
        const fileName = `Inbox/${today}-${Date.now().toString(36)}.md`;
        const content = `---\ncreated: ${today}\nstatus: inbox\n---\n\n${text}\n`;
        await this.app.vault.create(fileName, content);
        memoArea.value = '';
        this.showToast('已保存到 Inbox');
      } catch (e) {
        this.showToast('保存失败: ' + (e as Error).message);
      }
    });
    actions.appendChild(saveBtn);
    section.appendChild(memoArea);
    section.appendChild(actions);
    return section;
  }

  // ==================== Card Collapse + Drag/Drop ====================

  private getCardCollapseState(): CardCollapseState {
    return LocalStore.getCardCollapse();
  }

  private saveCardCollapseState(state: CardCollapseState): void {
    LocalStore.setCardCollapse(state);
  }

  private getCardOrder(): string[] {
    return LocalStore.getCardOrder(CARD_IDS);
  }

  private saveCardOrder(order: string[]): void {
    LocalStore.setCardOrder(order);
  }

  /**
   * v2.1 [4] — 'workflows' case removed (Sidebar only)
   *
   * 创建卡片外壳 + 注册懒渲染。
   * 卡片外壳（标题栏 + 折叠按钮）立即插入 DOM，
   * 内容渲染函数注册到 LazyRenderer，滚动到可视区域时才执行。
   */
  private createCardById(cardId: string): HTMLElement | null {
    // 卡片标题映射
    const TITLES: Record<string, string> = {
      kpi: '性能指标',
      todos: '今日待办',
      heatmap: '写作热力图',
      vaultHealth: 'Vault Health Overview',
      feeds: '信息流',
      projects: '活跃项目',
      recent: '最近编辑',
    };

    const title = TITLES[cardId];
    if (!title) return null;

    // 创建卡片外壳（标题栏 + 空内容区）
    const { section: shell, cards: contentArea } =
      this.createSectionScaffold('ax-section-' + cardId, title);
    shell.setAttribute('data-card-id', cardId);

    // 内容区添加 lazy class
    contentArea.addClass('ax-card-lazy-content');

    // 创建渲染函数
    const renderFn = () => {
      try {
        let inner: HTMLElement | null = null;
        switch (cardId) {
          case 'kpi':        inner = this.createKpiContent(); break;
          case 'todos':      inner = this.createTodosContent(); break;
          case 'heatmap':    inner = this.createHeatmapContent(); break;
          case 'vaultHealth': inner = this.createVaultHealthContent(); break;
          case 'feeds':      inner = this.createFeedsContent(); break;
          case 'projects':   inner = this.createProjectsContent(); break;
          case 'recent':     inner = this.createRecentFilesContent(); break;
        }
        if (inner) {
          contentArea.appendChild(inner);
          shell.removeClass('ax-card--skeleton');
        }
      } catch (e) {
        console.error('[WIDGET_RENDER_FAILED] createCardById(' + cardId + '):', e);
        contentArea.appendChild(this.createErrorFallback(cardId));
      }
    };

    // 注册到 LazyRenderer（折叠的卡片不注册）
    const collapseState = this.getCardCollapseState();
    if (!collapseState[cardId] && this.lazyRenderer) {
      this.lazyRenderer.register(contentArea, renderFn);
    }

    // 增强卡片（折叠 + 拖拽）
    this.enhanceCardWithCollapseAndDrag(shell, cardId, contentArea, renderFn);

    // 首屏时添加骨架样式
    const isCollapsed = collapseState[cardId] || false;
    if (!isCollapsed) shell.addClass('ax-card--skeleton');

    return shell;
  }

  /** 不可恢复的 Widget 错误占位 */
  private createErrorFallback(cardId: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'ax-section-row ax-widget-error ax-widget-error--fatal';
    el.innerHTML =
      '<div class="ax-widget-error-icon">⚠</div>' +
      '<div class="ax-widget-error-text">模块暂时不可用</div>' +
      '<div class="ax-widget-error-code">' + cardId + '</div>';
    return el;
  }

  private enhanceCardWithCollapseAndDrag(
    card: HTMLElement,
    cardId: string,
    contentArea?: HTMLElement,
    renderFn?: () => void,
  ): void {
    const collapseState = this.getCardCollapseState();
    const isCollapsed = collapseState[cardId] || false;

    const header =
      (card.querySelector('.ax-section-header') as HTMLElement)
      || card.querySelector('.ax-section-title') as HTMLElement;
    if (!header) return;

    if (isCollapsed) card.addClass('ax-card--collapsed');

    // Drag handle
    const dragHandle = div('ax-card-drag-handle');
    dragHandle.innerHTML = '<span class="ax-drag-grip"></span>';
    dragHandle.title = '拖拽排序';
    card.insertBefore(dragHandle, card.firstChild);

    // Collapse button
    const collapseBtn = el('button', {
      class: 'ax-card-collapse-btn',
      type: 'button',
      title: isCollapsed ? '展开' : '折叠',
    });
    collapseBtn.innerHTML = isCollapsed ? '▸' : '▾';

    const actions = header.querySelector('.ax-section-header-actions') as HTMLElement;
    if (actions) actions.appendChild(collapseBtn);
    else header.appendChild(collapseBtn);

    this.regDom(collapseBtn, 'click', (e) => {
      e.stopPropagation();
      const collapsed = card.hasClass('ax-card--collapsed');
      card.toggleClass('ax-card--collapsed', !collapsed);
      collapseBtn.innerHTML = collapsed ? '▾' : '▸';
      collapseBtn.title = collapsed ? '折叠' : '展开';
      const state = this.getCardCollapseState();
      state[cardId] = !collapsed;
      this.saveCardCollapseState(state);

      // 折叠/展开时处理懒渲染注册
      if (contentArea && renderFn && this.lazyRenderer) {
        if (!collapsed) {
          // 展开：注册懒渲染，用 setTimeout(0) 不阻塞主线程
          setTimeout(() => {
            this.lazyRenderer!.register(contentArea, renderFn);
            card.removeClass('ax-card--skeleton');
          }, 0);
        } else {
          // 折叠：取消懒渲染注册
          this.lazyRenderer.unregister(contentArea);
        }
      }
    });

    this.setupCardDragAndDrop(card, dragHandle, cardId);
  }

  private setupCardDragAndDrop(
    card: HTMLElement, handle: HTMLElement, cardId: string,
  ): void {
    handle.setAttribute('draggable', 'true');

    this.regDom(handle, 'dragstart', (e) => {
      card.addClass('ax-card--dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardId);
      }
    });

    this.regDom(handle, 'dragend', () => {
      card.removeClass('ax-card--dragging');
      card.parentElement?.querySelectorAll('.ax-card--drop-target')
        .forEach(el => el.removeClass('ax-card--drop-target'));
    });

    this.regDom(card, 'dragover', (e) => {
      if (!card.hasClass('ax-card--dragging')) {
        e.preventDefault();
        card.addClass('ax-card--drop-target');
      }
    });

    this.regDom(card, 'dragleave', () => {
      card.removeClass('ax-card--drop-target');
    });

    this.regDom(card, 'drop', (e) => {
      e.preventDefault();
      card.removeClass('ax-card--drop-target');
      const fromId = e.dataTransfer?.getData('text/plain');
      if (!fromId || fromId === cardId) return;
      const order = this.getCardOrder();
      const fromIdx = order.indexOf(fromId);
      const toIdx = order.indexOf(cardId);
      if (fromIdx < 0 || toIdx < 0) return;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, fromId);
      this.saveCardOrder(order);
      this.refresh();
    });
  }

  // ==================== Banner (with integrated Focus + Daily Summary) ====================

  /** v2.2 — Banner: Brand + Focus + Daily Summary + Status Indicator */
  private createBanner(): HTMLElement {
    const settings = this.plugin.settings;
    const bannerMode = settings.banner?.bannerMode || 'detailed';
    const banner = div('ax-banner');
    if (this.bannerCollapsed) banner.addClass('ax-banner--collapsed');
    if (bannerMode === 'compact') banner.addClass('ax-banner--compact');

    // Gradient background
    const bgLayer = div('ax-banner-bg');
    banner.appendChild(bgLayer);

    const overlay = div('ax-banner-overlay');

    // ---- Top row: Brand | Focus | Status ----
    const topRow = div('ax-banner-top-row');

    // Brand
    const brand = div('ax-banner-brand');
    const brandMark = div('ax-header-mark');
    brandMark.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" ' +
      'fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      '<path d="M5 8L7 10L11 6" fill="none" stroke="currentColor" ' +
      'stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    const brandText = div('ax-banner-brand-text');
    brandText.innerHTML =
      '<div class="ax-header-title">' + esc(settings.brandName) + '</div>' +
      '<div class="ax-header-sub">AGENTIC VAULT</div>';
    brand.appendChild(brandMark);
    brand.appendChild(brandText);
    topRow.appendChild(brand);

    // Focus selector
    topRow.appendChild(this.createBannerFocusCompact());

    // Status indicator (replaces old LIVE pill)
    this.bannerLiveEl = this.createStatusIndicator();
    topRow.appendChild(this.bannerLiveEl);

    overlay.appendChild(topRow);

    // ---- Summary section (detailed mode only) ----
    if (bannerMode === 'detailed') {
      this.bannerSummaryEl = this.createDailySummaryBar();
      overlay.appendChild(this.bannerSummaryEl);
    }

    // ---- Quote section (only if enabled) ----
    if (settings.banner?.enableQuoteRotation) {
      const quotes = settings.quotes;
      if (quotes && quotes.length > 0) {
        this.bannerQuoteIndex = 0;
        const quoteSection = div('ax-banner-quote-section');
        const quoteText = div('ax-banner-quote');
        quoteText.textContent = quotes[0].text;
        const quoteAuthor = div('ax-banner-author');
        quoteAuthor.textContent = '— ' + quotes[0].source;
        quoteSection.appendChild(quoteText);
        quoteSection.appendChild(quoteAuthor);
        overlay.appendChild(quoteSection);
      }
    }

    banner.appendChild(overlay);

    // Collapse toggle
    const pinBtn = el('button', { class: 'ax-banner-pin-btn', type: 'button' });
    pinBtn.innerHTML = this.bannerCollapsed ? '▸' : '▾';
    this.regDom(pinBtn, 'click', (e) => {
      e.stopPropagation();
      this.bannerCollapsed = !this.bannerCollapsed;
      banner.toggleClass('ax-banner--collapsed', this.bannerCollapsed);
      pinBtn.innerHTML = this.bannerCollapsed ? '▸' : '▾';
    });
    banner.appendChild(pinBtn);

    return banner;
  }

  /** Status indicator pill with color-coded health */
  private createStatusIndicator(): HTMLElement {
    const live = div('ax-banner-live');
    this.updateBannerStatus();
    return live;
  }

  /** Update status indicator color based on data */
  private updateBannerStatus(): void {
    if (!this.bannerLiveEl) return;

    // Determine status level
    const hasOverdue = this.tasksOverdue > 0;
    const inboxHigh = this.bannerInboxCount >= 10;
    const hasTodayDue = this.tasksToday > 0;
    const agentError = this.bannerAgentRunning > 0 && this.bannerAgentTotal > this.bannerAgentRunning + 5;

    let level: 'green' | 'yellow' | 'red' = 'green';
    if (hasOverdue || agentError) {
      level = 'red';
    } else if (hasTodayDue || inboxHigh) {
      level = 'yellow';
    }

    // Update class with transition
    const prevLevel = this.bannerStatusLevel;
    this.bannerStatusLevel = level;

    this.bannerLiveEl.removeClass('ax-banner-live--green');
    this.bannerLiveEl.removeClass('ax-banner-live--yellow');
    this.bannerLiveEl.removeClass('ax-banner-live--red');
    this.bannerLiveEl.addClass('ax-banner-live--' + level);

    // Build status text
    const statusTexts: string[] = [];
    if (hasOverdue) statusTexts.push(this.tasksOverdue + ' 过期');
    if (inboxHigh) statusTexts.push('Inbox ' + this.bannerInboxCount);
    if (hasTodayDue && !hasOverdue) statusTexts.push(this.tasksToday + ' 待办');
    if (this.bannerAgentRunning > 0) statusTexts.push(this.bannerAgentRunning + ' Agent');

    const statusText = statusTexts.length > 0 ? statusTexts.join(' · ') : '正常';
    this.bannerLiveEl.innerHTML = '<i></i>' + esc(statusText);

    // Flash animation on level change
    if (prevLevel !== level) {
      this.bannerLiveEl.addClass('ax-banner-live--flash');
      setTimeout(() => {
        this.bannerLiveEl?.removeClass('ax-banner-live--flash');
      }, 600);
    }
  }

  /** Daily summary bar with key metrics */
  private createDailySummaryBar(): HTMLElement {
    const summary = div('ax-banner-summary');

    // Todo: X/Y done
    const todoItem = div('ax-banner-summary-item');
    todoItem.innerHTML =
      '<span class="ax-banner-summary-icon">📋</span>' +
      '<span class="ax-banner-summary-label">待办</span>' +
      '<span class="ax-banner-summary-value" id="ax-banner-todo">' +
        this.bannerTodoDone + '/' + this.bannerTodoTotal + ' 已完成</span>';
    summary.appendChild(todoItem);

    // Inbox: N unprocessed
    const inboxItem = div('ax-banner-summary-item');
    inboxItem.innerHTML =
      '<span class="ax-banner-summary-icon">📥</span>' +
      '<span class="ax-banner-summary-label">Inbox</span>' +
      '<span class="ax-banner-summary-value" id="ax-banner-inbox">' +
        this.bannerInboxCount + ' 条未处理</span>';
    summary.appendChild(inboxItem);

    // Agent: running/total
    const agentItem = div('ax-banner-summary-item');
    agentItem.innerHTML =
      '<span class="ax-banner-summary-icon">🤖</span>' +
      '<span class="ax-banner-summary-label">Agent</span>' +
      '<span class="ax-banner-summary-value" id="ax-banner-agent">' +
        this.bannerAgentRunning + '/' + this.bannerAgentTotal + ' 运行中</span>';
    summary.appendChild(agentItem);

    // Health: XX/100
    const healthItem = div('ax-banner-summary-item');
    healthItem.innerHTML =
      '<span class="ax-banner-summary-icon">💚</span>' +
      '<span class="ax-banner-summary-label">健康度</span>' +
      '<span class="ax-banner-summary-value" id="ax-banner-health">' +
        this.bannerHealthScore + '/100</span>';
    summary.appendChild(healthItem);

    return summary;
  }

  /** Refresh banner summary data from cached widget data (no re-scan) */
  private refreshBanner(): void {
    // Gather data from existing caches (no new scans)
    this.gatherBannerData();

    // Update summary bar values
    const todoEl = this.containerEl.querySelector('#ax-banner-todo');
    if (todoEl) {
      todoEl.textContent = this.bannerTodoDone + '/' + this.bannerTodoTotal + ' 已完成';
    }
    const inboxEl = this.containerEl.querySelector('#ax-banner-inbox');
    if (inboxEl) {
      inboxEl.textContent = this.bannerInboxCount + ' 条未处理';
      inboxEl.parentElement?.toggleClass('ax-banner-summary-item--warn', this.bannerInboxCount >= 10);
    }
    const agentEl = this.containerEl.querySelector('#ax-banner-agent');
    if (agentEl) {
      agentEl.textContent = this.bannerAgentRunning + '/' + this.bannerAgentTotal + ' 运行中';
    }
    const healthEl = this.containerEl.querySelector('#ax-banner-health');
    if (healthEl) {
      healthEl.textContent = this.bannerHealthScore + '/100';
    }

    // Update status indicator
    this.updateBannerStatus();
  }

  /** Gather banner data from existing cached sources (no scans) */
  private gatherBannerData(): void {
    // Todo data: use existing KPI data
    this.bannerTodoDone = this.tasksToday;
    this.bannerTodoTotal = this.tasksToday + this.tasksOverdue;
    if (this.bannerTodoTotal === 0) {
      // Fallback: count from vault files
      const taskFiles = this.app.vault.getMarkdownFiles().filter(f =>
        f.path.includes('task') || f.path.includes('Task')
        || f.path.includes('todo') || f.path.includes('Todo'),
      );
      this.bannerTodoTotal = Math.min(taskFiles.length, 50);
    }

    // Inbox data: use existing cached count
    this.bannerInboxCount = this.inboxCount;

    // Agent data: from taskStore (in-memory, no scan)
    const running = getTasksByStatus('running');
    const allRecent = listRecentTasks(20);
    this.bannerAgentRunning = running.length;
    this.bannerAgentTotal = allRecent.length || running.length;

    // Health score: from existing cached data
    this.bannerHealthScore = this.vaultHealthData
      ? Math.round(this.vaultHealthData.healthScore ?? 85)
      : (this.worstHealthScore || 85);
  }

  /** v2.1 [1] — Compact focus selector embedded in banner top row */
  private createBannerFocusCompact(): HTMLElement {
    const focus = div('ax-banner-focus');

    if (this.currentFocusIndex >= 0 && this.focusProjects.length > 0) {
      const fp = this.focusProjects[this.currentFocusIndex];

      // Info
      const info = div('ax-banner-focus-info');
      const label = div('ax-banner-focus-label', 'CURRENT FOCUS');
      const title = div('ax-banner-focus-title', fp.name);
      title.title = fp.stage + ' · ' + fp.nextAction;
      info.appendChild(label);
      info.appendChild(title);
      focus.appendChild(info);

      // Controls
      const controls = div('ax-banner-focus-controls');

      // Select
      const select = el('select', {
        class: 'ax-banner-focus-select',
      }) as HTMLSelectElement;
      this.focusProjects.forEach((p, i) => {
        select.appendChild(el('option', { value: String(i) }, p.name));
      });
      select.value = String(this.currentFocusIndex);
      this.regDom(select, 'change', () => {
        this.currentFocusIndex = parseInt(select.value, 10);
        this.focusPinned = true;
        this.saveFocusState();
        const newFp = this.focusProjects[this.currentFocusIndex];
        title.textContent = newFp.name;
        title.title = newFp.stage + ' · ' + newFp.nextAction;
      });
      controls.appendChild(select);

      // Jump
      const jumpBtn = el('button', {
        class: 'ax-banner-focus-btn', type: 'button',
      }, '⤓');
      jumpBtn.title = '跳转到笔记';
      this.regDom(jumpBtn, 'click', () => {
        if (this.currentFocusIndex >= 0) {
          this.openPath(this.focusProjects[this.currentFocusIndex].path);
        }
      });
      controls.appendChild(jumpBtn);

      // AI Research
      const aiBtn = el('button', {
        class: 'ax-banner-focus-btn', type: 'button',
        title: 'AI 深度调研',
      }, '🔬');
      this.regDom(aiBtn, 'click', () => {
        if (this.agentRunner && this.currentFocusIndex >= 0) {
          const f = this.focusProjects[this.currentFocusIndex];
          this.agentRunner.run('deep-research-single', { topic: f.name });
          this.showToast('已启动深度调研: ' + f.name);
        }
      });
      controls.appendChild(aiBtn);

      // Mode label
      const mode = el('span', { class: 'ax-banner-focus-mode' },
        this.focusPinned ? '📌' : '✨');
      mode.title = this.focusPinned ? '手动固定焦点' : '自动推荐焦点';
      controls.appendChild(mode);

      focus.appendChild(controls);
    } else {
      focus.appendChild(div('ax-banner-focus-empty', 'No active focus'));
    }

    return focus;
  }

  /** Quote rotation with fade transition (only if enabled in settings) */
  private setupQuoteRotation() {
    if (this.quoteRotationTimer) {
      window.clearInterval(this.quoteRotationTimer);
      this.quoteRotationTimer = null;
    }
    // Respect setting: only rotate if enabled
    if (!this.plugin.settings.banner?.enableQuoteRotation) return;
    const quotes = this.plugin.settings.quotes;
    if (quotes.length <= 1) return;
    const quoteEl = this.containerEl.querySelector('.ax-banner-quote');
    const authorEl = this.containerEl.querySelector('.ax-banner-author');
    if (!quoteEl || !authorEl) return;

    this.quoteRotationTimer = this.registerInterval(window.setInterval(() => {
      this.bannerQuoteIndex = (this.bannerQuoteIndex + 1) % quotes.length;
      const next = quotes[this.bannerQuoteIndex];
      quoteEl.addClass('ax-banner-quote--fading');
      authorEl.addClass('ax-banner-author--fading');
      window.setTimeout(() => {
        quoteEl.textContent = next.text;
        authorEl.textContent = '— ' + next.source;
        quoteEl.removeClass('ax-banner-quote--fading');
        authorEl.removeClass('ax-banner-author--fading');
      }, 300);
    }, DashboardView.QUOTE_ROTATION_MS));
  }

  // ==================== Sidebar Components ====================

  /** KPI subtitle data (computed) */
  private get kpiSubTexts() {
    return {
      healthClass:
        this.healthDelta > 0 ? 'ax-kpi-up'
        : this.healthDelta < 0 ? 'ax-kpi-down' : 'ax-kpi-neutral',
      healthText:
        this.healthDelta !== 0
          ? (this.healthDelta > 0 ? '+' : '') + this.healthDelta + ' wk'
          : '持平',
      inboxSub: this.inboxCount > 0 ? this.oldestInboxDays + 'd oldest' : 'clear',
      taskSub:
        this.tasksToday + ' now'
        + (this.tasksOverdue > 0 ? ' · ' + this.tasksOverdue + ' overdue' : ''),
      notesSub: this.notesThisMonth > 0 ? '+' + this.notesThisMonth + ' mo' : '—',
    };
  }

  /** Sidebar KPI compact bar */
  private createSidebarKpiBar(): HTMLElement {
    const { healthClass, healthText, inboxSub, taskSub, notesSub } = this.kpiSubTexts;

    const bar = div('ax-sidebar-kpi-bar');
    bar.innerHTML =
      '<div class="ax-sidebar-kpi-row">' +
        '<b data-count="' + (this.stats?.totalNotes || 0) + '">0</b>' +
        '<span>Notes</span>' +
        '<small class="ax-kpi-neutral">' + esc(notesSub) + '</small>' +
      '</div>' +
      '<div class="ax-sidebar-kpi-row">' +
        '<b data-count="' + this.inboxCount + '">0</b>' +
        '<span>Inbox</span>' +
        '<small class="' + (this.inboxCount > 0 ? 'ax-kpi-down' : 'ax-kpi-up') + '">' +
          esc(inboxSub) +
        '</small>' +
      '</div>' +
      '<div class="ax-sidebar-kpi-row">' +
        '<b data-count="' + this.taskCompletionPct + '" data-suffix="%">0</b>' +
        '<span>Task</span>' +
        '<small class="ax-kpi-neutral">' + esc(taskSub) + '</small>' +
      '</div>' +
      '<div class="ax-sidebar-kpi-row">' +
        '<b data-count="' + this.worstHealthScore + '" data-suffix="%">0</b>' +
        '<span>Health</span>' +
        '<small class="' + healthClass + '">' + esc(healthText) + '</small>' +
      '</div>' +
      '<div class="ax-sidebar-sync">' +
        '<span class="ax-sync-label">SYNC</span>' +
        '<span class="ax-sync-time">' + esc(this.lastSyncTime || '--:--') + '</span>' +
      '</div>';

    const refreshBtn = el('button', { class: 'ax-sidebar-refresh', type: 'button' });
    refreshBtn.innerHTML = '<span class="ax-refresh-icon"></span>';
    refreshBtn.title = '手动全量刷新';
    this.regDom(refreshBtn, 'click', () => {
      refreshBtn.addClass('is-loading');
      setTimeout(() => { this.refresh(); refreshBtn.removeClass('is-loading'); }, 600);
    });
    bar.appendChild(refreshBtn);

    requestAnimationFrame(() => {
      bar.querySelectorAll<HTMLElement>('[data-count]').forEach(b => {
        animateCount(b, parseInt(b.dataset.count || '0'), 900, b.dataset.suffix || '');
      });
    });

    return bar;
  }

  /** Sidebar tab navigation */
  private createSidebarNav(): HTMLElement {
    const nav = div('ax-sidebar-nav');
    this.pages.forEach(page => {
      const item = el('button', {
        class: 'ax-sidebar-nav-item'
          + (page.id === this.currentPage ? ' ax-sidebar-nav-active' : ''),
        'data-page': page.id,
      });
      item.innerHTML =
        '<span class="ax-sidebar-nav-icon">' + icon(page.icon) + '</span>' +
        '<span class="ax-sidebar-nav-label">' + esc(page.label) + '</span>';
      this.regDom(item, 'click', () => this.switchPage(page.id));
      nav.appendChild(item);
    });
    return nav;
  }

  /** Sidebar hover-expand + outside-click-collapse behaviour */
  private setupSidebarBehavior(sidebar: HTMLElement, slimIndicator: HTMLElement) {
    const expandOnHover = (e: MouseEvent) => {
      if (this.sidebarPinned) return;
      if (!sidebar.hasClass('ax-sidebar--collapsed')) return;
      e.preventDefault();
      sidebar.removeClass('ax-sidebar--collapsed');
      sidebar.addClass('ax-sidebar--expanded');
      this.sidebarExpanded = true;
    };
    this.regDom(sidebar, 'mouseenter', expandOnHover);
    this.regDom(slimIndicator, 'mouseenter', expandOnHover);

    const outsideHandler = (e: MouseEvent) => {
      if (this.sidebarPinned) return;
      if (!this.sidebarExpanded) return;
      if (sidebar.contains(e.target as Node)) return;
      sidebar.removeClass('ax-sidebar--expanded');
      sidebar.addClass('ax-sidebar--collapsed');
      this.sidebarExpanded = false;
    };
    this.regDom(this.containerEl, 'click', outsideHandler);
  }

  // ==================== Kanban Sections ====================

  /** KPI Hero Section */
  private createKpiSection(): HTMLElement {
    const sectionEl = div('ax-section-row ax-section-kpi');

    const hdc = this.healthDelta > 0 ? 'ax-kpi-up'
      : this.healthDelta < 0 ? 'ax-kpi-down' : 'ax-kpi-neutral';
    const hdt = this.healthDelta
      ? (this.healthDelta > 0 ? '+' : '') + this.healthDelta + ' this week'
      : 'no change';
    const isub = this.inboxCount > 0 ? this.oldestInboxDays + 'd oldest' : 'all clear';
    const tsub = this.tasksToday + ' today'
      + (this.tasksOverdue > 0 ? ', ' + this.tasksOverdue + ' overdue' : '');
    const nsub = this.notesThisMonth > 0 ? '+' + this.notesThisMonth + ' this month' : '—';

    const header = div('ax-section-header');
    header.innerHTML =
      '<div class="ax-section-title-wrap">' +
        '<h3 class="ax-section-title">性能指标</h3>' +
      '</div>' +
      '<div class="ax-section-header-actions">' +
        '<span class="ax-live"><i></i>LIVE</span>' +
        '<button class="ax-section-refresh-btn" title="刷新">' +
          '<span class="ax-refresh-icon"></span>' +
        '</button>' +
      '</div>';
    sectionEl.appendChild(header);

    const kpiGrid = div('ax-kpi-grid');
    kpiGrid.innerHTML =
      '<div class="ax-kpi-card">' +
        '<b data-count="' + (this.stats?.totalNotes || 0) + '">0</b>' +
        '<span class="ax-kpi-label">Notes</span>' +
        '<small class="ax-kpi-sub ax-kpi-neutral">' + esc(nsub) + '</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + (this.stats?.totalConcepts || 0) + '">0</b>' +
        '<span class="ax-kpi-label">Concepts</span>' +
        '<small class="ax-kpi-sub ax-kpi-neutral">wiki pages</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + this.inboxCount + '">0</b>' +
        '<span class="ax-kpi-label">Inbox</span>' +
        '<small class="ax-kpi-sub ' + (this.inboxCount > 0 ? 'ax-kpi-down' : 'ax-kpi-up') + '">' +
          esc(isub) +
        '</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + this.taskCompletionPct + '" data-suffix="%">0</b>' +
        '<span class="ax-kpi-label">Task Flow</span>' +
        '<small class="ax-kpi-sub ax-kpi-neutral">' + esc(tsub) + '</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + this.worstHealthScore + '" data-suffix="%">0</b>' +
        '<span class="ax-kpi-label">Health</span>' +
        '<small class="ax-kpi-sub ' + hdc + '">' + esc(hdt) + '</small>' +
      '</div>';
    sectionEl.appendChild(kpiGrid);

    const clockRow = div('ax-kpi-clock-row');
    clockRow.innerHTML =
      '<div class="ax-clock-compact">' +
        '<span class="ax-clock-time" id="ax-time">00<em>:</em>00</span>' +
        '<span class="ax-clock-date" id="ax-date"></span>' +
      '</div>' +
      '<div class="ax-header-sync">' +
        '<span class="ax-sync-label">Last sync</span>' +
        '<span class="ax-sync-time">' + esc(this.lastSyncTime || '--:--') + '</span>' +
      '</div>';
    sectionEl.appendChild(clockRow);

    requestAnimationFrame(() => {
      kpiGrid.querySelectorAll<HTMLElement>('[data-count]').forEach(b => {
        animateCount(b, parseInt(b.dataset.count || '0'), 1100, b.dataset.suffix || '');
      });
    });

    const kpiRefreshBtn = header.querySelector('.ax-section-refresh-btn');
    if (kpiRefreshBtn) {
      const btn = kpiRefreshBtn as HTMLElement;
      this.regDom(btn, 'click', () => {
        btn.addClass('is-loading');
        setTimeout(() => { this.refresh(); }, 600);
      });
    }

    return sectionEl;
  }

  /** Todos Section */
  private createTodosSectionSync(): HTMLElement {
    const { section: sectionEl, cards: cardsContainer } =
      this.createSectionScaffold('ax-section-todos', '今日待办');
    const todoPlaceholder = div('ax-panel');
    cardsContainer.appendChild(todoPlaceholder);
    createTodosPanel(this.app, this.createPanelSection.bind(this)).then(todos => {
      if (todoPlaceholder.parentNode) {
        todoPlaceholder.parentNode.replaceChild(todos.section, todoPlaceholder);
      }
      if (todos.handle) this.composite.add(todos.handle);
    });
    return sectionEl;
  }

  /** Heatmap Section */
  private createHeatmapSectionSync(): HTMLElement {
    const { section: sectionEl, cards: cardsContainer } =
      this.createSectionScaffold('ax-section-heatmap', '写作热力图');
    const { section: hmSection, handle: hmHandle } =
      createHeatmapPanel(this.app, this.createPanelSection.bind(this), this.vaultHealthData);
    cardsContainer.appendChild(hmSection);
    this.composite.add(hmHandle);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }

  /** Vault Health Section */
  private createVaultHealthSection(): HTMLElement {
    const { section: sectionEl, cards: cardsContainer } =
      this.createSectionScaffold('ax-section-vault-health', 'Vault Health Overview');
    cardsContainer.addClass('ax-vh-cards-container');
    if (!this.vaultScanner) this.vaultScanner = new VaultScanner(this.app);
    const { section: panel, handle: vhHandle } =
      createVaultHealthPanel(this.app, this.createPanelSection.bind(this));
    cardsContainer.appendChild(panel);
    this.composite.add(vhHandle);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }

  /** Feeds Section */
  private createFeedsSection(): HTMLElement {
    const sectionEl = div('ax-section-row ax-section-feeds');
    const { section: feedsSection, handle: feedsHandle } =
      createFeedsPanel(this.app, this.createPanelSection.bind(this));
    sectionEl.appendChild(feedsSection);
    this.composite.add(feedsHandle);
    return sectionEl;
  }

  /** Active Projects Section */
  private createProjectsSectionSync(): HTMLElement {
    const { section: sectionEl, cards: cardsContainer } =
      this.createSectionScaffold('ax-section-projects', '活跃项目');
    const grid = div('ax-project-grid');
    this.plugin.settings.projects.forEach((proj: any) => {
      const card = el('a', { href: '#', class: 'ax-project', 'data-path': proj.path });
      card.innerHTML =
        '<div class="ax-project-cover" style="background:' + esc(proj.gradient) + '">' +
          '<em>' + esc(proj.emoji) + '</em>' +
        '</div>' +
        '<span class="ax-tag ax-tag-' + esc(proj.priority) + '">' + esc(proj.tag) + '</span>' +
        '<h3>' + esc(proj.name) + '</h3>' +
        '<p>' + esc(proj.description) + '</p>' +
        '<div class="ax-trace">' + esc(proj.trace) + '</div>';
      this.regDom(card, 'click', (e) => { e.preventDefault(); this.openPath(proj.path); });
      grid.appendChild(card);
    });
    cardsContainer.appendChild(grid);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }

  // ==================== Lazy Content Methods ====================
  // These methods return ONLY the content element (no shell/header).
  // Used by createCardById for lazy rendering.

  /** KPI content (grid + clock) — lazy */
  private createKpiContent(): HTMLElement {
    const container = div('ax-kpi-lazy-content');

    const hdc = this.healthDelta > 0 ? 'ax-kpi-up'
      : this.healthDelta < 0 ? 'ax-kpi-down' : 'ax-kpi-neutral';
    const hdt = this.healthDelta
      ? (this.healthDelta > 0 ? '+' : '') + this.healthDelta + ' this week'
      : 'no change';
    const isub = this.inboxCount > 0 ? this.oldestInboxDays + 'd oldest' : 'all clear';
    const tsub = this.tasksToday + ' today'
      + (this.tasksOverdue > 0 ? ', ' + this.tasksOverdue + ' overdue' : '');
    const nsub = this.notesThisMonth > 0 ? '+' + this.notesThisMonth + ' this month' : '—';

    const kpiGrid = div('ax-kpi-grid');
    kpiGrid.innerHTML =
      '<div class="ax-kpi-card">' +
        '<b data-count="' + (this.stats?.totalNotes || 0) + '">0</b>' +
        '<span class="ax-kpi-label">Notes</span>' +
        '<small class="ax-kpi-sub ax-kpi-neutral">' + esc(nsub) + '</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + (this.stats?.totalConcepts || 0) + '">0</b>' +
        '<span class="ax-kpi-label">Concepts</span>' +
        '<small class="ax-kpi-sub ax-kpi-neutral">wiki pages</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + this.inboxCount + '">0</b>' +
        '<span class="ax-kpi-label">Inbox</span>' +
        '<small class="ax-kpi-sub ' + (this.inboxCount > 0 ? 'ax-kpi-down' : 'ax-kpi-up') + '">' +
          esc(isub) +
        '</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + this.taskCompletionPct + '" data-suffix="%">0</b>' +
        '<span class="ax-kpi-label">Task Flow</span>' +
        '<small class="ax-kpi-sub ax-kpi-neutral">' + esc(tsub) + '</small>' +
      '</div>' +
      '<div class="ax-kpi-card">' +
        '<b data-count="' + this.worstHealthScore + '" data-suffix="%">0</b>' +
        '<span class="ax-kpi-label">Health</span>' +
        '<small class="ax-kpi-sub ' + hdc + '">' + esc(hdt) + '</small>' +
      '</div>';
    container.appendChild(kpiGrid);

    const clockRow = div('ax-kpi-clock-row');
    clockRow.innerHTML =
      '<div class="ax-clock-compact">' +
        '<span class="ax-clock-time" id="ax-time-lazy">00<em>:</em>00</span>' +
        '<span class="ax-clock-date" id="ax-date-lazy"></span>' +
      '</div>' +
      '<div class="ax-header-sync">' +
        '<span class="ax-sync-label">Last sync</span>' +
        '<span class="ax-sync-time">' + esc(this.lastSyncTime || '--:--') + '</span>' +
      '</div>';
    container.appendChild(clockRow);

    requestAnimationFrame(() => {
      kpiGrid.querySelectorAll<HTMLElement>('[data-count]').forEach(b => {
        animateCount(b, parseInt(b.dataset.count || '0'), 1100, b.dataset.suffix || '');
      });
    });

    return container;
  }

  /** Todos content — lazy */
  private createTodosContent(): HTMLElement {
    const container = div('ax-todos-lazy-content');
    const todoPlaceholder = div('ax-panel');
    container.appendChild(todoPlaceholder);
    createTodosPanel(this.app, this.createPanelSection.bind(this)).then(todos => {
      if (todoPlaceholder.parentNode) {
        todoPlaceholder.parentNode.replaceChild(todos.section, todoPlaceholder);
      }
      if (todos.handle) this.composite.add(todos.handle);
    });
    return container;
  }

  /** Heatmap content — lazy, Canvas-based */
  private createHeatmapContent(): HTMLElement {
    const container = div('ax-heatmap-lazy-content');
    const { section: hmSection, handle: hmHandle } =
      createHeatmapPanel(this.app, this.createPanelSection.bind(this), this.vaultHealthData);
    container.appendChild(hmSection);
    this.composite.add(hmHandle);
    return container;
  }

  /** Vault Health content — lazy */
  private createVaultHealthContent(): HTMLElement {
    const container = div('ax-vh-lazy-content');
    container.addClass('ax-vh-cards-container');
    if (!this.vaultScanner) this.vaultScanner = new VaultScanner(this.app);
    const { section: panel, handle: vhHandle } =
      createVaultHealthPanel(this.app, this.createPanelSection.bind(this));
    container.appendChild(panel);
    this.composite.add(vhHandle);
    return container;
  }

  /** Feeds content — lazy */
  private createFeedsContent(): HTMLElement {
    const container = div('ax-feeds-lazy-content');
    const { section: feedsSection, handle: feedsHandle } =
      createFeedsPanel(this.app, this.createPanelSection.bind(this));
    container.appendChild(feedsSection);
    this.composite.add(feedsHandle);
    return container;
  }

  /** Projects content — lazy */
  private createProjectsContent(): HTMLElement {
    const container = div('ax-projects-lazy-content');
    const grid = div('ax-project-grid');
    this.plugin.settings.projects.forEach((proj: any) => {
      const card = el('a', { href: '#', class: 'ax-project', 'data-path': proj.path });
      card.innerHTML =
        '<div class="ax-project-cover" style="background:' + esc(proj.gradient) + '">' +
          '<em>' + esc(proj.emoji) + '</em>' +
        '</div>' +
        '<span class="ax-tag ax-tag-' + esc(proj.priority) + '">' + esc(proj.tag) + '</span>' +
        '<h3>' + esc(proj.name) + '</h3>' +
        '<p>' + esc(proj.description) + '</p>' +
        '<div class="ax-trace">' + esc(proj.trace) + '</div>';
      this.regDom(card, 'click', (e) => { e.preventDefault(); this.openPath(proj.path); });
      grid.appendChild(card);
    });
    container.appendChild(grid);
    return container;
  }

  /** Recent files content — lazy */
  private createRecentFilesContent(): HTMLElement {
    const container = div('ax-recent-lazy-content');
    const list = div('ax-recent-list');
    const files = getRecentFiles(this.app, 8);
    files.forEach(file => {
      const item = el('a', { href: '#', class: 'ax-recent-item', 'data-path': file.path });
      const date = new Date(file.stat.mtime);
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + ' ' +
        String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0');
      item.innerHTML =
        '<span class="ax-recent-name">' + esc(file.basename) + '</span>' +
        '<span class="ax-recent-date">' + esc(dateStr) + '</span>';
      this.regDom(item, 'click', (e) => { e.preventDefault(); this.openPath(file.path); });
      list.appendChild(item);
    });
    container.appendChild(list);
    return container;
  }

  /** Recent Files Section */
  private createRecentFilesSection(): HTMLElement {
    const { section: sectionEl, cards: cardsContainer } =
      this.createSectionScaffold('ax-section-recent', '最近编辑');
    const list = div('ax-recent-list');
    const files = getRecentFiles(this.app, 8);
    files.forEach(file => {
      const item = el('a', { href: '#', class: 'ax-recent-item', 'data-path': file.path });
      const date = new Date(file.stat.mtime);
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + ' ' +
        String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0');
      item.innerHTML =
        '<span class="ax-recent-name">' + esc(file.basename) + '</span>' +
        '<span class="ax-recent-date">' + esc(dateStr) + '</span>';
      this.regDom(item, 'click', (e) => { e.preventDefault(); this.openPath(file.path); });
      list.appendChild(item);
    });
    cardsContainer.appendChild(list);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }

  // ==================== Full-Page Sections ====================

  /** Vault overview page */
  private createVaultSection(): HTMLElement {
    const sectionEl = div('ax-section-row ax-section-vault');

    // Distribution chart
    const distSection = this.createPanelSection(
      '知识库分布', '#34D399',
      '共 ' + (this.stats?.totalNotes || 0) + ' 篇',
    );
    const bars = div('ax-barchart');
    if (this.stats) {
      const maxVal = Math.max(1, ...this.stats.wikis.map(w => w.total));
      this.stats.wikis.forEach(wiki => {
        const row = el('div', { class: 'ax-barrow', 'data-path': wiki.indexPage });
        row.innerHTML =
          '<span class="ax-bt">' + esc(wiki.icon) + ' ' + esc(wiki.name) + '</span>' +
          '<span class="ax-bwrap"><i style="--bc1:' + esc(wiki.color) +
          ';--bc2:' + esc(this.lightenColor(wiki.color)) +
          '" data-width="' + (wiki.total / maxVal * 100).toFixed(1) + '%"></i></span>' +
          '<span class="ax-bn">' + wiki.total + '</span>';
        this.regDom(row, 'click', () => this.openPath(wiki.indexPage));
        row.style.cursor = 'pointer';
        bars.appendChild(row);
      });
    }
    distSection.appendChild(bars);
    sectionEl.appendChild(distSection);

    // Health scores
    const healthSection = this.createPanelSection('Wiki 健康度', '#A78BFA', '');
    const content = div('ax-health');
    if (this.stats) {
      this.stats.wikis.forEach(wiki => {
        const row = div('ax-health-row');
        row.innerHTML =
          '<span class="ax-health-icon">' + esc(wiki.icon) + '</span>' +
          '<span class="ax-health-name">' + esc(wiki.name) + '</span>' +
          '<span class="ax-health-score" style="color:' + esc(wiki.color) + '">' +
            wiki.healthScore + '%' +
          '</span>';
        content.appendChild(row);
      });
    }
    healthSection.appendChild(content);
    sectionEl.appendChild(healthSection);

    return sectionEl;
  }

  /** Graph page */
  private createGraphSection(): HTMLElement {
    const sectionEl = div('ax-section-row ax-section-graph');
    const totalLinks = (this.stats as any)?.totalLinks ?? 0;
    const panel = this.createPanelSection(
      '知识图谱', '#F59E0B',
      (this.stats?.totalNotes || 0) + ' 个节点 · ' + totalLinks + ' 条连接',
    );

    const graphContainer = div('ax-graph-container');
    graphContainer.style.cssText =
      'min-height:400px;display:flex;align-items:center;justify-content:center;' +
      'color:var(--text-muted);font-size:0.85rem;';
    graphContainer.textContent =
      'Knowledge graph visualization — integrate with Obsidian graph view or external renderer';
    panel.appendChild(graphContainer);

    sectionEl.appendChild(panel);
    return sectionEl;
  }

  // ==================== Shared Scaffolding ====================

  /** Create a section row with header and content area */
  private createSectionScaffold(
    className: string, title: string,
  ): { section: HTMLElement; cards: HTMLElement } {
    const section = div('ax-section-row ' + className);
    const header = div('ax-section-header');
    header.innerHTML =
      '<div class="ax-section-title-wrap">' +
        '<h3 class="ax-section-title">' + esc(title) + '</h3>' +
      '</div>' +
      '<div class="ax-section-header-actions"></div>';
    section.appendChild(header);
    const cards = div('ax-section-cards');
    section.appendChild(cards);
    return { section, cards };
  }

  /** Create a styled panel container (used by widget factories) */
  createPanelSection(title: string, color: string, subtitle: string): HTMLElement {
    const panel = div('ax-panel');
    panel.style.setProperty('--ax-accent', color);
    const header = div('ax-panel-header');
    header.innerHTML =
      '<h4 class="ax-panel-title">' + esc(title) + '</h4>' +
      (subtitle ? '<span class="ax-panel-sub">' + esc(subtitle) + '</span>' : '');
    panel.appendChild(header);
    return panel;
  }

  private createFooter(): HTMLElement {
    const footer = div('ax-footer');
    footer.innerHTML =
      '<span class="ax-footer-text">Axlumen Dashboard · Agent-First Vault Intelligence</span>';
    return footer;
  }

  // ==================== Utilities ====================

  private startClock() {
    if (this.clockInterval) window.clearInterval(this.clockInterval);
    const update = () => {
      const now = new Date();
      const timeEl = this.containerEl.querySelector('#ax-time');
      const dateEl = this.containerEl.querySelector('#ax-date');
      if (timeEl) {
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        timeEl.innerHTML = h + '<em>:</em>' + m;
      }
      if (dateEl) {
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        dateEl.textContent =
          (now.getMonth() + 1) + '/' + now.getDate() + ' 周' + days[now.getDay()];
      }
    };
    update();
    this.clockInterval = window.setInterval(update, CLOCK_INTERVAL_MS);
  }

  private showToast(msg: string) {
    const toast = this.containerEl.querySelector('.ax-toast') as HTMLElement;
    if (!toast) return;
    toast.textContent = msg;
    toast.addClass('ax-toast--visible');
    setTimeout(() => toast.removeClass('ax-toast--visible'), TOAST_DURATION_MS);
  }

  private openPath(path: string) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) {
      this.app.workspace.openLinkText(path, '', false);
    } else {
      this.showToast('未找到: ' + path);
    }
  }

  private openGlobalSearch() {
    // @ts-ignore — Obsidian internal command
    this.app.commands.executeCommandById('global-search:open');
  }

  private lightenColor(hex: string): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xFF) + 40);
    const g = Math.min(255, ((num >> 8) & 0xFF) + 40);
    const b = Math.min(255, ((num & 0xFF) + 40));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ==================== Scan Progress ====================

  private updateScanProgress(pct: number, message?: string): void {
    let progressEl = this.containerEl.querySelector('.ax-scan-progress') as HTMLElement;
    if (!progressEl) {
      progressEl = div('ax-scan-progress');
      progressEl.innerHTML =
        '<div class="ax-scan-progress-bar"></div>' +
        '<span class="ax-scan-progress-text"></span>';
      // 插入到 Banner 的 LIVE 指示灯旁边
      const live = this.containerEl.querySelector('.ax-banner-live');
      if (live && live.parentNode) {
        live.parentNode.insertBefore(progressEl, live.nextSibling);
      } else {
        const banner = this.containerEl.querySelector('.ax-banner');
        if (banner) banner.appendChild(progressEl);
      }
    }

    const bar = progressEl.querySelector('.ax-scan-progress-bar') as HTMLElement;
    const text = progressEl.querySelector('.ax-scan-progress-text') as HTMLElement;
    if (bar) bar.style.width = pct + '%';
    if (text && message) text.textContent = message;
  }

  private clearScanProgress(): void {
    const progressEl = this.containerEl.querySelector('.ax-scan-progress');
    if (progressEl) {
      progressEl.remove();
    }
  }

  // ==================== KPI Data Computation ====================

  private async computeKpiData() {
    // Inbox count + oldest item
    const inboxFiles = this.app.vault.getFiles().filter(f =>
      f.path.startsWith('Inbox/') || f.path.startsWith('inbox/'),
    );
    this.inboxCount = inboxFiles.length;
    if (inboxFiles.length > 0) {
      const oldest = Math.min(...inboxFiles.map(f => f.stat.ctime));
      this.oldestInboxDays = Math.floor((Date.now() - oldest) / MS_PER_DAY);
    } else {
      this.oldestInboxDays = 0;
    }

    // Task completion
    let totalTasks = 0;
    let completedTasks = 0;
    const taskFiles = this.app.vault.getMarkdownFiles().filter(f =>
      f.path.includes('task') || f.path.includes('Task')
      || f.path.includes('todo') || f.path.includes('Todo'),
    );
    for (const file of taskFiles.slice(0, 50)) {
      const content = await this.app.vault.cachedRead(file);
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (/^- $$[ x]$$/.test(trimmed)) {
          totalTasks++;
          if (/^- $$x$$/.test(trimmed)) completedTasks++;
        }
      }
    }
    this.taskCompletionPct =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    this.tasksToday = completedTasks;
    this.tasksOverdue = 0;

    // Health score
    this.worstHealthScore = this.vaultHealthData
      ? Math.round(this.vaultHealthData.healthScore ?? 85)
      : 85;
    this.healthDelta = 0;

    // Notes this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    this.notesThisMonth = this.app.vault.getMarkdownFiles()
      .filter(f => f.stat.ctime >= monthStart).length;

    // Last sync time
    this.lastSyncTime =
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');
  }

  // ==================== Agent Actions ====================

  private triggerAgentInboxRoute() {
    if (!this.agentRunner) { this.showToast('Agent 未就绪'); return; }
    this.showToast('启动 Inbox 路由...');
    this.agentRunner.run('inbox-route', {})
      .then(() => this.showToast('Inbox 路由完成'))
      .catch(() => this.showToast('Inbox 路由失败'));
  }
}