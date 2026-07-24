/**
 * constants.ts — 全局常量 + 设计令牌
 */

/* ========================================================================
   DESIGN TOKENS — single source of truth (mirrors DESIGN.md)
   These drive both CSS custom properties and TypeScript constants.
   ======================================================================== */

/** Radius scale — single system, no mixed radii per DESIGN.md §5 Shape Consistency */
export const RADIUS_S = 4;   /** inputs, small badges, compact rows */
export const RADIUS_M = 8;   /** buttons, cards, inbox items */
export const RADIUS_L = 10;  /** kanban section rows */

/** Spacing grid — 8px base unit per DESIGN.md §6 */
export const SPACE_UNIT = 8;
export const SECTION_GAP = 12;         /** vertical gap between kanban sections */
export const SECTION_PADDING = 16;     /** internal horizontal padding */
export const SECTION_PADDING_COMPACT = 10;  /** internal horizontal padding (compact) */

/** Font stacks — per DESIGN.md §3 Typography */
export const FONT_DISPLAY = '"Libre Baskerville", Georgia, serif';
export const FONT_BODY = '"DM Sans", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
export const FONT_MONO = '"IBM Plex Mono", var(--font-monospace-theme, var(--font-monospace, monospace))';

/** Motion — per DESIGN.md §6 */
export const MOTION_FAST = '150ms cubic-bezier(0.16, 1, 0.3, 1)';
export const MOTION_BASE = '250ms cubic-bezier(0.16, 1, 0.3, 1)';
export const MOTION_COUNT_UP = '1100ms cubic-bezier(0.16, 1, 0.3, 1)';
export const MOTION_LOADING_BAR = '1500ms ease-in-out';

/** Semantic color hex — per DESIGN.md §2 (color-mix wraps these at runtime) */
export const HEX_SUCCESS = '#22c55e';
export const HEX_WARN = '#f59e0b';
export const HEX_DANGER = '#ef4444';
export const HEX_INFO = '#60a5fa';

/* Legacy aliases (kept for backward compat) */
export const SUCCESS_HEX = HEX_SUCCESS;

/* ========================================================================
   TIME CONSTANTS
   ======================================================================== */

/** 毫秒/天 */
export const MS_PER_DAY = 86_400_000;

/** 毫秒/分钟 */
export const MS_PER_MINUTE = 60_000;

/** 毫秒/小时 */
export const MS_PER_HOUR = 3_600_000;

/** 时钟刷新间隔 */
export const CLOCK_INTERVAL_MS = 30_000;

/** Toast 显示时长 */
export const TOAST_DURATION_MS = 1_500;

/** Memo 聚焦延迟 */
export const MEMO_FOCUS_DELAY_MS = 200;

/** 设置面板防抖延迟 */
export const SETTINGS_DEBOUNCE_MS = 300;

/** 健康度评分 — 内容新鲜度阈值（天） */
export const HEALTH_FRESHNESS_THRESHOLDS = [30, 60, 90] as const;

/** 健康度评分 — 新鲜度得分 */
export const HEALTH_FRESHNESS_SCORES = [25, 18, 10, 5] as const;

/** 健康度评分 — 各维度满分 */
export const HEALTH_INDEX_SCORE = 15;
export const HEALTH_STRUCTURE_SCORE = 25;
export const HEALTH_LOG_SCORE = 20;

/* ========================================================================
   WIDGET CONSTANTS
   ======================================================================== */

/** 热力图 */
export const HEATMAP_CELL_SIZE = 12;
export const HEATMAP_GAP = 3;
export const HEATMAP_LOW_THRESHOLD = 2;
export const HEATMAP_HIGH_THRESHOLD = 5;

/** 事件驱动刷新防抖延迟 */
export const AUTO_REFRESH_DEBOUNCE_MS = 500;

/** 存储路径 */
export const TODOS_FILE_PATH_LEGACY = '.gulldock-todos.json';
export const TODOS_FILE_PATH = '_gulldock/todos.json';
export const TODOS_DIR = '_gulldock';
export const MEMO_STORAGE_KEY = 'gulldock_memo';
