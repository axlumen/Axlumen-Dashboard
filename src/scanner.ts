/**
 * scanner.ts — Vault 扫描器
 * 扫描三个 Wiki 目录，统计概念/实体/来源/对比/综合数量
 */

import { App, TFile, TFolder, Vault } from 'obsidian';
import { WikiConfig, WikiStats, VaultStats } from './types';
import { MS_PER_DAY, HEALTH_INDEX_SCORE, HEALTH_STRUCTURE_SCORE, HEALTH_FRESHNESS_THRESHOLDS, HEALTH_FRESHNESS_SCORES, HEALTH_LOG_SCORE } from './constants';

/** Wiki 子目录名 → 类型映射 */
const TYPE_DIRS: Record<string, keyof Pick<WikiStats, 'concepts' | 'entities' | 'sources' | 'comparisons' | 'synthesis'>> = {
  'concepts': 'concepts',
  'entities': 'entities',
  'sources': 'sources',
  'comparisons': 'comparisons',
  'synthesis': 'synthesis',
};

/** 递归收集目录下所有 .md 文件 */
function collectMarkdownFiles(folder: TFolder, result: TFile[]): void {
  for (const c of folder.children) {
    if (c instanceof TFile && c.extension === 'md') {
      result.push(c);
    } else if (c instanceof TFolder) {
      collectMarkdownFiles(c, result);
    }
  }
}

/** 一次遍历完成：统计页面数量 + 收集文件用于健康度计算 */
function scanWiki(vault: Vault, wiki: WikiConfig): { stats: WikiStats; allFiles: TFile[] } {
  const stats: WikiStats = {
    name: wiki.name,
    icon: wiki.icon,
    color: wiki.color,
    concepts: 0, entities: 0, sources: 0, comparisons: 0, synthesis: 0,
    total: 0, healthScore: 100,
    rootPath: wiki.rootPath,
    indexPage: wiki.indexPage,
  };

  const wikiDir = `${wiki.rootPath}/wiki`;
  const folder = vault.getAbstractFileByPath(wikiDir);
  const allFiles: TFile[] = [];

  if (!folder || !(folder instanceof TFolder)) return { stats, allFiles };

  for (const child of folder.children) {
    if (!(child instanceof TFolder)) continue;
    const dirName = child.name.toLowerCase();
    const statKey = TYPE_DIRS[dirName];

    // 收集该子目录下的所有 .md 文件
    const dirFiles: TFile[] = [];
    collectMarkdownFiles(child, dirFiles);

    // 统计页面数
    if (statKey) stats[statKey] = dirFiles.length;
    allFiles.push(...dirFiles);
  }

  stats.total = stats.concepts + stats.entities + stats.sources +
                stats.comparisons + stats.synthesis;

  // 健康度：复用已收集的文件
  stats.healthScore = calculateHealthScore(vault, wiki, allFiles);
  return { stats, allFiles };
}

/** 计算 Wiki 健康度评分（0-100），接收已收集的文件避免重复遍历 */
function calculateHealthScore(vault: Vault, wiki: WikiConfig, wikiFiles: TFile[]): number {
  let score = 0;

  // 1. 索引覆盖率
  const indexFile = vault.getAbstractFileByPath(wiki.indexPage);
  if (indexFile instanceof TFile) score += HEALTH_INDEX_SCORE;

  const wikiDir = wiki.rootPath + '/wiki';
  const wikiFolder = vault.getAbstractFileByPath(wikiDir);
  if (wikiFolder instanceof TFolder) {
    const hasContent = wikiFolder.children.some(c => c instanceof TFolder && c.children.length > 0);
    if (hasContent) score += HEALTH_INDEX_SCORE;
  }

  // 2. 目录结构完整性
  const requiredDirs = ['concepts', 'entities', 'sources'];
  for (const dir of requiredDirs) {
    const path = wikiDir + '/' + dir;
    if (vault.getAbstractFileByPath(path) instanceof TFolder) {
      score += HEALTH_STRUCTURE_SCORE / requiredDirs.length;
    }
  }

  // 3. 内容新鲜度（使用传入的文件列表，不重新遍历）
  if (wikiFiles.length > 0) {
    const daysSinceUpdate = (Date.now() - Math.max(...wikiFiles.map(f => f.stat.mtime))) / MS_PER_DAY;
    let matched = false;
    for (let i = 0; i < HEALTH_FRESHNESS_THRESHOLDS.length; i++) {
      if (daysSinceUpdate <= HEALTH_FRESHNESS_THRESHOLDS[i]) {
        score += HEALTH_FRESHNESS_SCORES[i];
        matched = true;
        break;
      }
    }
    if (!matched) score += HEALTH_FRESHNESS_SCORES[HEALTH_FRESHNESS_SCORES.length - 1];
  }

  // 4. 日志完整性
  const logFolder = vault.getAbstractFileByPath(wiki.rootPath + '/log');
  if (logFolder instanceof TFolder && logFolder.children.length > 0) {
    score += HEALTH_LOG_SCORE;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** 扫描整个 vault，生成统计数据 */
export async function scanVault(app: App, wikis: WikiConfig[]): Promise<VaultStats> {
  // 扫描时失效缓存
  recentFilesCache = null;

  const wikiStats: WikiStats[] = [];
  for (const wiki of wikis) {
    const { stats } = scanWiki(app.vault, wiki);
    wikiStats.push(stats);
  }

  const totalNotes = wikiStats.reduce((sum, w) => sum + w.total, 0);
  const totalConcepts = wikiStats.reduce((sum, w) => sum + w.concepts, 0);
  const totalEntities = wikiStats.reduce((sum, w) => sum + w.entities, 0);
  const totalSources = wikiStats.reduce((sum, w) => sum + w.sources, 0);

  return {
    generatedAt: new Date().toLocaleString('zh-CN'),
    wikis: wikiStats,
    totalNotes,
    totalConcepts,
    totalEntities,
    totalSources,
    focus: [],
  };
}

// ==================== 最近文件缓存（带 TTL + 防抖失效） ====================

interface RecentFilesCache {
  count: number;
  files: TFile[];
  timestamp: number;
}

let recentFilesCache: RecentFilesCache | null = null;
let recentFilesInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

/** 缓存 TTL：5 秒 */
const RECENT_FILES_TTL_MS = 5_000;

/** 失效防抖：500ms */
const RECENT_FILES_DEBOUNCE_MS = 500;

/**
 * 获取最近修改的文件（带 TTL 缓存）
 *
 * 缓存策略：
 * - TTL 5 秒内直接返回缓存
 * - vault 事件后 500ms 防抖才失效缓存
 * - count 变化时立即失效
 */
export function getRecentFiles(app: App, count: number = 5): TFile[] {
  const now = Date.now();

  // 检查缓存是否有效
  if (recentFilesCache &&
      recentFilesCache.count === count &&
      now - recentFilesCache.timestamp < RECENT_FILES_TTL_MS) {
    return recentFilesCache.files;
  }

  // 缓存失效，重新计算
  const files = app.vault.getMarkdownFiles()
    .sort((a, b) => b.stat.mtime - a.stat.mtime)
    .slice(0, count);

  recentFilesCache = { count, files, timestamp: now };
  return files;
}

/**
 * 使最近文件缓存失效（带防抖）
 *
 * 由 VaultScanner 的 vault 事件监听器调用，
 * 500ms 防抖合并高频事件
 */
export function invalidateRecentFilesCache(): void {
  if (recentFilesInvalidateTimer) {
    clearTimeout(recentFilesInvalidateTimer);
  }
  recentFilesInvalidateTimer = setTimeout(() => {
    recentFilesCache = null;
    recentFilesInvalidateTimer = null;
  }, RECENT_FILES_DEBOUNCE_MS);
}

// ==================== 写作热力图 ====================

export interface DayActivity {
  date: string;
  count: number;
}

export function getWritingActivity(app: App, days: number = 90): DayActivity[] {
  const now = new Date();
  const files = app.vault.getMarkdownFiles();
  const dayMap = new Map<string, number>();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }

  for (const file of files) {
    const mtime = new Date(file.stat.mtime);
    const key = mtime.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }
  }

  return Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
