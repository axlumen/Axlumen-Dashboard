// ===== Disposable 接口（统一资源清理契约） =====

/**
 * 统一资源清理契约。
 * 所有持有事件监听器、定时器、订阅的组件（Widget、Service、Runner）都应实现此接口。
 */
export interface Disposable {
  /** 执行资源清理。幂等——多次调用仅第一次生效。 */
  dispose(): void;
  /** 是否已 disposed。 */
  readonly disposed: boolean;
}

/**
 * WidgetHandle：widget 返回给 view.ts 的句柄。
 * view.ts 在 onClose 时统一调用 dispose 并 remove DOM。
 */
export interface WidgetHandle extends Disposable {
  /** 此 handle 注入的 DOM 根节点 */
  readonly roots: HTMLElement[];
}

/** 创建不追踪 DOM 根节点的 disposable（用于纯 subscription 场景） */
export function createDisposable(dispose: () => void): Disposable {
  return { disposed: false, dispose };
}

/** 追踪 DOM 根节点的 handle */
export function createRootedDisposable(
  roots: HTMLElement[],
  cleanup: () => void,
): WidgetHandle {
  let disposed = false;
  return {
    get disposed() { return disposed; },
    roots: [...roots],
    dispose() {
      if (disposed) return;
      disposed = true;
      try { cleanup(); } catch { /* ignore */ }
      for (const r of roots) r.remove();
    },
  };
}

/** 类型守卫：判断对象是否实现了 Disposable */
export function isDisposable(v: unknown): v is Disposable {
  return !!v && typeof (v as Disposable).dispose === 'function' && 'disposed' in (v as Disposable);
}

// ===== 插件配置 =====
export interface DashboardSettings {
  // 品牌
  brandName: string;
  brandSub: string;
  quoteAuthor: string;
  // 倒计时（支持多个）
  countdowns: CountdownItem[];
  // 快捷入口
  quickLinks: QuickLink[];
  // 命令路由
  commands: CommandRoute[];
  // 项目卡片
  projects: ProjectCard[];
  // 金句
  quotes: QuoteItem[];
  // Wiki 配置
  wikis: WikiConfig[];
  // 主题
  theme: 'island' | 'nordic';
  // Claude Code CLI
  claudeCodePath: string;
  agentDefaultModel: string;
  // Vault 绝对路径（桌面端，供 Agent CLI 使用）
  vaultPath: string;
  // 事件驱动
  autoRefresh: boolean;
  // 侧栏 Widget 开关
  widgets: WidgetConfig;
  // Banner 配置
  banner: BannerConfig;
  // 轻量 UI 状态（由 LocalStore 管理，持久化到 data.json）
  uiState?: import('./utils/LocalStore').LocalStoreData;
  // 自动化规则（持久化到 data.json，替代 localStorage）
  automationRules?: import('./services/AutomationEngine').RuleConfig[];
}

export interface CountdownItem {
  target: string; // ISO date string
  label: string;
}

export interface QuickLink {
  icon: string;
  label: string;
  path: string;
}

export interface CommandRoute {
  command: string;
  description: string;
}

export interface ProjectCard {
  priority: 'p0' | 'p1' | 'p2' | 'b';
  tag: string;
  name: string;
  description: string;
  trace: string;
  path: string;
  emoji: string;
  gradient: string;
}

export interface QuoteItem {
  text: string;
  source: string;
}

export interface WikiConfig {
  name: string;
  icon: string;
  color: string;
  rootPath: string;
  indexPage: string;
}

// ===== Vault 扫描结果 =====
export interface WikiStats {
  name: string;
  icon: string;
  color: string;
  concepts: number;
  entities: number;
  sources: number;
  comparisons: number;
  synthesis: number;
  total: number;
  healthScore: number;
  rootPath: string;
  indexPage: string;
}

export interface VaultStats {
  generatedAt: string;
  wikis: WikiStats[];
  totalNotes: number;
  totalConcepts: number;
  totalEntities: number;
  totalSources: number;
  focus: FocusItem[];
}

export interface FocusItem {
  level: 'hot' | 'warn' | 'ok';
  title: string;
  desc: string;
}

// ===== 待办 =====
export interface TodoItem {
  id: string;
  text: string;
  tag: string;
  done: boolean;
  state?: 'todo' | 'doing' | 'done';
  createdAt: number;
}

// ===== Quick Actions =====
export interface QuickAction {
  id: string;
  name: string;
  type: 'file' | 'command';
  target: string;
  icon: string;
}

// ===== Focus Item =====
export interface FocusProject {
  name: string;
  path: string;
  stage: string;
  nextAction: string;
}

// ===== Sidebar Widget 配置 =====
export interface WidgetConfig {
  weekCalendar: boolean;
  agentStatus: boolean;
  quickMemo: boolean;
}

// ===== Banner 配置 =====
export interface BannerConfig {
  /** 金句轮播开关（默认关闭） */
  enableQuoteRotation: boolean;
  /** Banner 模式：detailed（摘要栏） / compact（简洁） */
  bannerMode: 'detailed' | 'compact';
}

// ===== Kanban Card 折叠状态持久化 =====
export type CardCollapseState = Record<string, boolean>;

// ===== Kanban Card 排序持久化 =====
export type CardOrderState = string[];

// ===== Widget 句柄（需要被 view.ts 持有并销毁的引用） =====

/**
 * WidgetHandle：widget 内部追踪的资源清理句柄。
 *
 * view.ts 内的 CompositeDisposable 通过此对象统一管理：
 * - 解注册所有 bindEvent / bindInterval / bindTimeout 注册的资源
 * - 移除 widget 注入的 DOM 子节点
 */
export interface WidgetHandle extends Disposable {
  /** 此 handle 注入的 DOM 根节点列表——dispose 时统一 remove */
  readonly roots: HTMLElement[];
}

/** 创建一个空句柄（无 DOM 追踪） */
export function createWidgetHandle(cleanup: () => void): WidgetHandle {
  return {
    disposed: false,
    roots: [],
    dispose,
  };
  function dispose() {
    if (this.disposed) return;
    (this as { disposed: boolean }).disposed = true;
    for (const r of this.roots) r.remove();
    cleanup();
  }
}

/** 创建一个追踪 DOM 根的句柄 */
export function createRootedWidgetHandle(
  roots: HTMLElement[],
  cleanup: () => void,
): WidgetHandle {
  return {
    disposed: false,
    roots: [...roots],
    dispose,
  };
  function dispose() {
    if (this.disposed) return;
    (this as { disposed: boolean }).disposed = true;
    cleanup();
    for (const r of this.roots) r.remove();
  }
}
