/**
 * services/PluginIntegrations.ts — 第三方插件联动适配
 *
 * P6 新增：Dataview / Tasks / Templater / Style Settings 兼容。
 * 所有调用均增加存在性判断，未安装插件不报错、自动隐藏联动功能。
 */

import { App } from 'obsidian';

// ==================== 插件检测 ====================

export interface PluginAvailability {
  dataview: boolean;
  tasks: boolean;
  templater: boolean;
  styleSettings: boolean;
}

/** 检测第三方插件是否安装并启用 */
export function detectPlugins(app: App): PluginAvailability {
  const plugins = (app as any).plugins?.plugins || {};
  return {
    dataview: !!plugins['dataview'],
    tasks: !!plugins['tasks'],
    templater: !!plugins['templater-obsidian'] || !!plugins['templater'],
    styleSettings: !!plugins['style-settings'] || !!plugins['obsidian-style-settings'],
  };
}

// ==================== Dataview 集成 ====================

/** 获取 Dataview API 实例（不存在返回 null） */
function getDataviewApi(app: App): any | null {
  try {
    const plugin = (app as any).plugins?.plugins?.['dataview'];
    if (!plugin || !plugin.api) return null;
    // Dataview 可能尚未索引完成
    if (plugin.api.initialized === false) return null;
    return plugin.api;
  } catch {
    return null;
  }
}

/**
 * 尝试复用 Dataview 索引数据（返回完整页面数组）
 */
export async function getDataviewPages(app: App): Promise<any[] | null> {
  try {
    const dv = getDataviewApi(app);
    if (!dv) return null;
    const pages = dv.pages('');
    return pages?.array?.() || pages || [];
  } catch {
    return null;
  }
}

/**
 * 从 Dataview 索引获取指定目录的页面数量
 */
export async function getDataviewFolderCount(app: App, folder: string): Promise<number | null> {
  try {
    const dv = getDataviewApi(app);
    if (!dv) return null;
    const pages = dv.pages('"' + folder + '"');
    return pages?.length || 0;
  } catch {
    return null;
  }
}

/**
 * 从 Dataview 索引提取 inbox 文件列表（避免重新扫描）
 */
export async function getDataviewInboxFiles(app: App, inboxFolder: string = 'Inbox'): Promise<any[] | null> {
  try {
    const dv = getDataviewApi(app);
    if (!dv) return null;
    return dv.pages('"' + inboxFolder + '"').array() || [];
  } catch {
    return null;
  }
}

// ==================== Tasks 集成 ====================

/** 获取 Tasks API 实例 */
function getTasksApi(app: App): any | null {
  try {
    const plugin = (app as any).plugins?.plugins?.['tasks'];
    if (!plugin) return null;
    // Tasks 插件暴露了 observe() 和 parseTask() 等方法
    return plugin;
  } catch {
    return null;
  }
}

/**
 * 双向同步：将 Dashboard 任务状态同步到 Tasks 插件。
 * 实际执行：写回文件中的任务 checkbox 标记。
 */
export async function syncTaskToTasksPlugin(
  app: App, filePath: string, taskLine: string, done: boolean,
): Promise<boolean> {
  try {
    const tasksApi = getTasksApi(app);
    if (!tasksApi) return false;

    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) return false;

    const content = await app.vault.read(file as any);
    const lines = content.split('\n');
    // 查找并替换对应的任务行
    const taskIndex = lines.findIndex(l => l.includes(taskLine));
    if (taskIndex >= 0) {
      const marker = done ? '[x]' : '[ ]';
      lines[taskIndex] = lines[taskIndex].replace(/\[[ x]\]/, marker);
      await app.vault.modify(file as any, lines.join('\n'));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 批量触发 Tasks 插件的事件刷新（让 Tasks 视图更新）
 */
export function notifyTasksChanged(app: App): void {
  try {
    const plugin = (app as any).plugins?.plugins?.['tasks'];
    if (plugin?.triggerCacheUpdate) plugin.triggerCacheUpdate();
  } catch { /* ignore */ }
}

// ==================== Templater 集成 ====================

/**
 * Agent Workflow 输出笔记时，尝试通过 Templater 填充模板。
 * 真实实现：打开文件 → 运行 Templager 处理 → 关闭。
 */
export async function fillWithTemplater(app: App, filePath: string): Promise<boolean> {
  try {
    const tp = (app as any).plugins?.plugins?.['templater-obsidian']
      || (app as any).plugins?.plugins?.['templater'];
    if (!tp?.templater) return false;

    // 查找文件并打开
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) return false;

    // Templater 创建新笔记时自动触发（通过 new_file_template 配置）
    // 对于已有文件，尝试调用 append_template_to_active_file
    const leaf = app.workspace.getLeaf('tab');
    await leaf.openFile(file as any);

    if (tp.templater.append_template_to_active_file) {
      await tp.templater.append_template_to_active_file(file);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ==================== Style Settings 集成 ====================

export interface StyleSettingsConfig {
  accentColor: string;
  cardRadius: number;
  showGridBackground: boolean;
  densityMode: 'compact' | 'normal' | 'comfortable';
}

const STYLE_SETTINGS_KEY = 'axlumen_style_settings';

const DEFAULT_STYLE: StyleSettingsConfig = {
  accentColor: '#3fb8af',
  cardRadius: 6,
  showGridBackground: false,
  densityMode: 'normal',
};

/** 读取用户自定义样式配置（支持 Style Settings 插件或直接配置） */
export function getStyleConfig(): StyleSettingsConfig {
  try {
    const raw = localStorage.getItem(STYLE_SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULT_STYLE, ...saved };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_STYLE };
}

/** 保存用户自定义样式配置 */
export function saveStyleConfig(config: Partial<StyleSettingsConfig>): void {
  try {
    const current = getStyleConfig();
    localStorage.setItem(STYLE_SETTINGS_KEY, JSON.stringify({ ...current, ...config }));
    applyStyleConfig({ ...current, ...config });
  } catch {
    // ignore
  }
}

/** 应用样式配置到 CSS 变量 */
export function applyStyleConfig(config: StyleSettingsConfig): void {
  const root = document.querySelector('.axlumen-dashboard');
  if (!root) return;
  (root as HTMLElement).style.setProperty('--ax-accent', config.accentColor);
  (root as HTMLElement).style.setProperty('--ax-radius-sm', String(config.cardRadius) + 'px');
  (root as HTMLElement).style.setProperty('--ax-radius-md', String(config.cardRadius * 2) + 'px');
  (root as HTMLElement).style.setProperty('--ax-radius-lg', String(config.cardRadius * 3) + 'px');
  // Density
  if (config.densityMode === 'compact') {
    (root as HTMLElement).addClass('axlumen-density--compact');
    (root as HTMLElement).removeClass('axlumen-density--comfortable');
  } else if (config.densityMode === 'comfortable') {
    (root as HTMLElement).addClass('axlumen-density--comfortable');
    (root as HTMLElement).removeClass('axlumen-density--compact');
  } else {
    (root as HTMLElement).removeClass('axlumen-density--compact');
    (root as HTMLElement).removeClass('axlumen-density--comfortable');
  }
  // Grid background
  if (config.showGridBackground) {
    (root as HTMLElement).addClass('axlumen-grid-bg');
  } else {
    (root as HTMLElement).removeClass('axlumen-grid-bg');
  }
}

/** 监听 Style Settings 插件的事件（如果已安装） */
export function listenForStyleSettings(app: App, callback: (config: StyleSettingsConfig) => void): void {
  try {
    const styleSettings = (app as any).plugins?.plugins?.['style-settings'];
    if (!styleSettings) return;

    // Style Settings 通过 plugin 事件通知变更
    // @ts-ignore
    app.workspace.on('style-settings-change', (settings: any) => {
      if (settings?.plugin === 'axlumen-dashboard') {
        const config: StyleSettingsConfig = {
          accentColor: settings.accentColor || DEFAULT_STYLE.accentColor,
          cardRadius: settings.cardRadius || DEFAULT_STYLE.cardRadius,
          showGridBackground: settings.showGridBackground ?? DEFAULT_STYLE.showGridBackground,
          densityMode: settings.densityMode || DEFAULT_STYLE.densityMode,
        };
        applyStyleConfig(config);
        callback(config);
      }
    });
  } catch {
    // Style Settings 未安装或事件不可用
  }
}
