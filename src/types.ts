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

// ===== GullDock 插件配置（合并 apex + gulldock） =====
export interface DashboardSettings {
  // ---- 品牌 ----
  brandName: string;
  brandSub: string;
  quoteAuthor: string;

  // ---- 原有设置（保持兼容） ----
  countdowns: CountdownItem[];
  quickLinks: QuickLink[];
  commands: CommandRoute[];
  projects: ProjectCard[];
  quotes: QuoteItem[];
  wikis: WikiConfig[];
  /** 主题预设（island / nordic）— 兼容旧 theme 字段 */
  theme: 'island' | 'nordic';
  /** @deprecated 使用 theme */
  stylePreset?: string;
  claudeCodePath: string;
  agentDefaultModel: string;
  vaultPath: string;
  autoRefresh: boolean;
  widgets: WidgetConfig;
  banner: BannerConfig;
  uiState?: import('./utils/LocalStore').LocalStoreData;
  automationRules?: import('./services/AutomationEngine').RuleConfig[];

  // ---- Apex 新增设置 ----
  /** 侧栏 Widget 排序 */
  widgetOrder?: string[];
  /** 番茄钟 */
  pomodoroEnabled?: boolean;
  pomodoroWorkMinutes?: number;
  pomodoroShortBreakMinutes?: number;
  pomodoroLongBreakMinutes?: number;
  pomodoroLongBreakInterval?: number;
  pomodoroAutoStartBreak?: boolean;
  pomodoroSoundEnabled?: boolean;
  /** 天气 */
  widgetWeatherEnabled?: boolean;
  widgetWeatherCity?: string;
  widgetWeatherLat?: number;
  widgetWeatherLon?: number;
  /** 近期文档数量 */
  recentDocCount?: number;

  // ---- TGCR 整合设置 ----
  /** 隐私脱敏自定义规则 */
  privacySanitizeRules?: Array<Omit<import('./services/PrivacySanitizer').SanitizeRule, 'pattern'> & { pattern: string; flags?: string }>;
}

export interface WikiConfig {
  name: string;
  icon: string;
  color: string;
  rootPath: string;
  indexPage: string;
}

export interface CountdownItem {
  target: string;
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
  cover?: string;
}

export interface QuoteItem {
  text: string;
  source: string;
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
  agentStatus: boolean;
  quickMemo: boolean;
}

// ===== Banner 配置 =====
export interface BannerConfig {
  /** 金句轮播开关（默认关闭） */
  enableQuoteRotation: boolean;
  /** Banner 模式：detailed（摘要栏） / compact（简洁） */
  bannerMode: 'detailed' | 'compact';
  /** Banner 背景图路径 */
  backgroundImage?: string;
  /** 名言列表（用于轮播） */
  quotes?: QuoteItem[];
  /** 背景图列表（用于轮播） */
  images?: string[];
  /** 名言颜色覆盖 */
  quoteColor?: string;
}

/** DashboardData 中的 Banner 数据（Markdown 文件持久化） */
export interface BannerData {
  quote: string;
  author: string;
  image: string;
  quoteColor?: string;
  quotes?: QuoteItem[];
  images?: string[];
}

// ===== Kanban Card 折叠状态持久化 =====
export type CardCollapseState = Record<string, boolean>;

// ===== Kanban Card 排序持久化 =====
export type CardOrderState = string[];

// ===== Widget 句柄（需要被 view.ts 持有并销毁的引用） =====
export interface WidgetHandle extends Disposable {
  readonly roots: HTMLElement[];
}

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

// ===== Apex 数据模型（DashboardData — Markdown 文件持久化） =====

export type CardType = 'task' | 'note' | 'link' | 'project' | 'habit' | 'generic' | 'weather' | 'tracker';
export type CardSize = 'S' | 'M' | 'L';

export interface TaskItem {
  text: string;
  checked: boolean;
  reminder?: string;
  children?: TaskItem[];
  collapsed?: boolean;
}

export interface DocNode {
  path: string;
  children?: DocNode[];
  collapsed?: boolean;
}

export interface DashboardCard {
  id: string;
  title: string;
  type: CardType;
  column: string;
  body: string;
  tasks: TaskItem[];
  docs: DocNode[];
  url: string;
  wikiLink: string;
  progress: number;
  streak: number;
  dueDate: string;
  blockquote: string;
  color: string;
  coverImage: string;
  width: number;
  size: CardSize;
  gridCols: number;
  gridRows: number;
  gridCol: number;
  gridRow: number;
  weatherConfig?: WeatherConfig;
  trackerConfig?: TrackerConfig;
}

export interface WeatherConfig {
  latitude: number;
  longitude: number;
  cityName: string;
}

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  feelsLike: number;
  dailyMax: number[];
  dailyMin: number[];
  dailyCodes: number[];
  dailyDates: string[];
  fetchedAt: number;
}

export type TrackerStyle = 'line' | 'heatmap' | 'bar';

export interface TrackerConfig {
  key: string;
  days: number;
  style: TrackerStyle;
}

export interface TrackerDataPoint {
  date: string;
  value: number | null;
}

export type LibraryViewMode = 'grid' | 'list' | 'table' | 'kanban';

export interface PropertyFilter {
  property: string;
  values: string[];
  dateRange?: { start: string; end: string };
}

export interface LibraryConfig {
  filters: PropertyFilter[];
  viewMode: LibraryViewMode;
  sortBy: string;
  sortDesc: boolean;
  kanbanGroupBy?: string;
  pageSize?: number;
  showProperties?: boolean;
  propertyLimit?: number;
  quickDateFilter?: { property: 'created' | 'modified'; start: string; end: string };
  folders?: string[];
  folderFilter?: string[];
  excludeFolders?: string[];
  taskGroupBy?: 'date' | 'priority' | 'none';
}

export interface HeatmapConfig {
  folder: string;
  trackerKey: string;
  title?: string;
  period: 'pastYear' | 'thisYear';
}

export type SectionType =
  | 'dashboard' | 'memo' | 'todo' | 'projects' | 'notes'
  | 'library' | 'folder' | 'calendar'
  | 'images' | 'videos'
  | 'agent-workflows' | 'inbox-router' | 'feeds'
  | 'agent-status' | 'active-task';

export interface DashboardColumn {
  name: string;
  color: string;
  sectionType?: SectionType;
  cards: DashboardCard[];
  libraryConfig?: LibraryConfig;
  heatmapConfig?: HeatmapConfig;
  height?: number;
}

export interface DashboardData {
  dataVersion: number;
  banner: BannerData;
  quickActions: QuickAction[];
  quickActionOrder?: string[];
  hiddenPresets?: string[];
  columns: DashboardColumn[];
}

export const CURRENT_DASHBOARD_VERSION: number = 1;

export function migrateDashboardData(data: Partial<DashboardData>): DashboardData {
  const version = (data.dataVersion ?? 0) as number;
  if (version < 1) {
    if (!data.banner) {
      data.banner = { quote: 'Stay hungry, stay foolish.', author: 'Steve Jobs', image: '', quotes: [], images: [] };
    }
    if (!data.quickActions) data.quickActions = [];
    if (!data.columns) data.columns = [];
  }
  data.dataVersion = CURRENT_DASHBOARD_VERSION;
  return data as DashboardData;
}

// ===== Apex RenderCallbacks（渲染回调接口） =====
export interface RenderCallbacks {
  onCardEdit(card: DashboardCard): void;
  onOpenNoteInPopover(file: any): void;
  onCardDelete(cardId: string): void;
  onCheckboxToggle(cardId: string, taskPath: number[], checked: boolean): void;
  onTaskAdd(cardId: string, text: string, parentPath?: number[]): void;
  onTaskDelete(cardId: string, taskPath: number[]): void;
  onTaskReorder(cardId: string, fromPath: number[], toPath: number[], before: boolean): void;
  onTaskMoveToCard(srcCardId: string, fromPath: number[], destCardId: string, destPath: number[], mode: 'before' | 'after' | 'nest'): void;
  onTaskEdit(cardId: string, taskPath: number[], newText: string): void;
  onCardAdd(columnName: string): void;
  onColumnAdd(name: string, sectionType?: string): void;
  onRequestAddSection(): void;
  onColumnMove(fromIndex: number, toIndex: number): void;
  onColumnHeightChange(name: string, height: number): void;
  onBannerEdit(): void;
  onQuickActionAdd(): void;
  onQuickActionRemove(index: number): void;
  onMoveCard(cardId: string, targetColumn: string, targetIndex: number): void;
  onMemoUpdate(card: DashboardCard, updates: { body: string; blockquote: string }): void;
  onMemoSaveAsNote(card: DashboardCard): void;
  onTaskSaveToDaily(card: DashboardCard): void;
  onDocAdd(cardId: string, path: string): void;
  onDocDelete(cardId: string, docPath: number[]): void;
  onDocReorder(cardId: string, fromPath: number[], toPath: number[], before: boolean): void;
  onDocMoveToCard(srcCardId: string, fromPath: number[], destCardId: string, destPath: number[], mode: 'before' | 'after' | 'nest'): void;
  onDocNest(cardId: string, docPath: number[]): void;
  onDocToggleCollapse(cardId: string, docPath: number[]): void;
  onMemoColorChange(card: DashboardCard, color: string): void;
  onProjectCoverChange(card: DashboardCard, imagePath: string): void;
  onCardTitleEdit(cardId: string, newTitle: string): void;
  onCardWidthChange(cardId: string, width: number): void;
  onCardSizeChange(cardId: string, size: CardSize): void;
  onCardGridChange(cardId: string, gridCols: number, gridRows: number): void;
  onCardGridMove(cardId: string, gridCol: number, gridRow: number): void;
  onFileDrop(cardId: string, filePath: string): void;
  onColumnRename(oldName: string, newName: string): void;
  onColumnDelete(columnName: string): void;
  onTaskReminderEdit(cardId: string, taskPath: number[], reminder: string | undefined): void;
  onTaskNest(cardId: string, taskPath: number[]): void;
  onTaskNestInto(cardId: string, srcPath: number[], destPath: number[]): void;
  onTaskUnnest(cardId: string, taskPath: number[]): void;
  onTaskToggleCollapse(cardId: string, taskPath: number[]): void;
  onAddFromTemplate(columnName: string): void;
  onArchiveTasks(columnName: string): void;
  onLibraryConfigChange(columnName: string, config: LibraryConfig): void;
}
