/**
 * utils/LocalStore.ts — 统一的插件本地状态存储
 *
 * Obsidian 插件规范要求使用 this.loadData()/this.saveData() 进行持久化，
 * 而非 localStorage（localStorage 不跨设备同步、不按 vault 隔离）。
 *
 * 本模块维护一个内存中的 UI 状态对象，通过 flush() 写入 plugin.saveData()。
 * 所有 get 方法返回内存中的缓存，set 方法同步更新内存 + 触发持久化回调。
 *
 * - 轻量 UI 状态（焦点、卡片折叠、卡片排序、memo 草稿、feed 刷新时间）
 * - 真正的配置数据（规则、设置）：通过 plugin.loadData / plugin.saveData
 */

import type AxlumenDashboardPlugin from '../main';

// ============== 类型 ==============

export interface FocusState {
  pinned: boolean;
  autoMode: boolean;
  focusIndex: number;
}

export type CardCollapseState = Record<string, boolean>;
export type CardOrderState = string[];

export interface LocalStoreData {
  focusState: FocusState;
  cardCollapse: CardCollapseState;
  cardOrder: string[];
  memoDraft: string;
  feedLastRefresh: string;
}

// ============== 默认值 ==============

const DEFAULT_DATA: LocalStoreData = {
  focusState: { pinned: false, autoMode: true, focusIndex: 0 },
  cardCollapse: {},
  cardOrder: [],
  memoDraft: '',
  feedLastRefresh: '',
};

// ============== 内部状态 ==============

let _data: LocalStoreData = { ...DEFAULT_DATA };
let _plugin: AxlumenDashboardPlugin | null = null;
let _dirty = false;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 初始化 LocalStore — 由 Plugin.onload 调用
 * 从 plugin.loadData() 读取持久化数据，合并到内存缓存
 */
export function initLocalStore(plugin: AxlumenDashboardPlugin): void {
  _plugin = plugin;
  const saved = plugin.settings.uiState as LocalStoreData | undefined;
  if (saved) {
    _data = {
      focusState: { ...DEFAULT_DATA.focusState, ...(saved.focusState || {}) },
      cardCollapse: { ...(saved.cardCollapse || {}) },
      cardOrder: [...(saved.cardOrder || [])],
      memoDraft: saved.memoDraft || '',
      feedLastRefresh: saved.feedLastRefresh || '',
    };
  }
}

/** 标记脏数据，防抖写入 */
function markDirty(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => flush(), 300);
}

/** 立即将内存状态写入 plugin.saveData() — 由 plugin.onunload 调用 */
export function flushLocalStore(): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  void flush();
}

function flush(): void {
  if (!_plugin || !_dirty) return;
  _dirty = false;
  const settings = _plugin.settings;
  settings.uiState = { ..._data };
  // fire-and-forget：saveSettings 内部已处理错误
  void _plugin.saveSettings();
}

// ============== 同步 getter/setter ==============

export const LocalStore = {
  // ---- 焦点状态 ----
  getFocusState(): FocusState {
    return { ..._data.focusState };
  },
  setFocusState(state: FocusState): void {
    _data.focusState = { ...state };
    _dirty = true;
    markDirty();
  },

  // ---- 卡片折叠状态 ----
  getCardCollapse(): CardCollapseState {
    return { ..._data.cardCollapse };
  },
  setCardCollapse(state: CardCollapseState): void {
    _data.cardCollapse = { ...state };
    _dirty = true;
    markDirty();
  },

  // ---- 卡片排序 ----
  getCardOrder(validCardIds: string[]): string[] {
    const saved = _data.cardOrder || [];
    const valid = saved.filter((id) => validCardIds.includes(id));
    for (const id of validCardIds) {
      if (!valid.includes(id)) valid.push(id);
    }
    return valid;
  },
  setCardOrder(order: string[]): void {
    _data.cardOrder = [...order];
    _dirty = true;
    markDirty();
  },

  // ---- Memo 草稿 ----
  getMemoDraft(): string {
    return _data.memoDraft || '';
  },
  setMemoDraft(value: string): void {
    _data.memoDraft = value;
    _dirty = true;
    markDirty();
  },
  clearMemoDraft(): void {
    _data.memoDraft = '';
    _dirty = true;
    markDirty();
  },

  // ---- Feed 最后刷新时间 ----
  getFeedLastRefresh(): string {
    return _data.feedLastRefresh || '';
  },
  setFeedLastRefresh(value: string): void {
    _data.feedLastRefresh = value;
    _dirty = true;
    markDirty();
  },

  // ---- 清空所有本地状态（调试/重置用） ----
  clearAll(): void {
    _data = { ...DEFAULT_DATA };
    _dirty = true;
    markDirty();
  },
};