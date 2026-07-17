/**
 * widgets/vaultHealth.ts — Vault 全局健康数据面板（+ Disposable handle）
 */

import { App } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { VaultScanner, VaultHealthData } from '../services/VaultScanner';
import { type WidgetHandle, createRootedDisposable } from '../types';

/** 返回 { section, handle } */
export function createVaultHealthPanel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('Vault Health Overview', '#3fb8af', '');
  section.style.setProperty('--ax-accent', '#3fb8af');
  section.addClass('ax-vh-section');

  const cleaners: Array<() => void> = [];
  const timeouts: Set<number> = new Set();

  const safeTimeout = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms);
    timeouts.add(id);
    return id;
  };
  const registerCleanup = (fn: () => void) => { cleaners.push(fn); };

  // 内容容器
  const content = div('ax-vh-content');
  section.appendChild(content);
  const scanner = new VaultScanner(app);
  loadAndRender(content, scanner, registerCleanup, safeTimeout);

  const handle = createRootedDisposable([section], () => {
    for (const id of timeouts) window.clearTimeout(id);
    timeouts.clear();
    for (const fn of cleaners) {
      try { fn(); } catch { /* ignore */ }
    }
    section.empty();
  });

  return { section, handle };
}

type CleanerReg = (fn: () => void) => void;
type TimeoutFn = (fn: () => void, ms: number) => number;

async function loadAndRender(
  content: HTMLElement,
  scanner: VaultScanner,
  registerCleanup: CleanerReg,
  safeTimeout: TimeoutFn,
): Promise<void> {
  content.empty();

  // 显示进度条
  const progressContainer = div('ax-vh-scan-progress');
  const progressBar = div('ax-vh-scan-progress-bar');
  const progressText = div('ax-vh-scan-progress-text', '扫描 Vault 数据...');
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);
  content.appendChild(progressContainer);

  const result = await scanner.scanFull((pct, message) => {
    progressBar.style.width = pct + '%';
    if (message) progressText.textContent = message;
  });

  content.empty();
  if (result.ok) {
    content.appendChild(renderPanel(content, result.value, scanner, registerCleanup, safeTimeout));
  } else {
    console.error('[VAULT_HEALTH_WIDGET] scanFull failed:', result.error.code);
    content.appendChild(div('ax-vh-error', '数据加载失败，点击重试'));
    const retryBtn = el('button', { class: 'ax-btn ax-btn-ghost', type: 'button' }, '重试');
    const onRetry = () => loadAndRender(content, scanner, registerCleanup, safeTimeout);
    retryBtn.addEventListener('click', onRetry);
    registerCleanup(() => retryBtn.removeEventListener('click', onRetry));
    content.appendChild(retryBtn);
  }
}

function renderPanel(
  content: HTMLElement,
  data: VaultHealthData,
  scanner: VaultScanner,
  registerCleanup: CleanerReg,
  safeTimeout: TimeoutFn,
): HTMLElement {
  const panel = div('ax-vh-panel');

  // ---- 顶部栏 ----
  const header = div('ax-vh-header');

  const title = div('ax-vh-title', 'VAULT HEALTH OVERVIEW');

  const right = div('ax-vh-header-right');
  const lastScanned = div('ax-vh-last-scanned', 'Last scanned: ' + (data.lastScanned || '--:--'));

  let scanning = false;
  const rescanBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm ax-vh-rescan-btn', type: 'button' }, 'Rescan');
  const onRescanClick = async () => {
    if (scanning) return;
    scanning = true;
    rescanBtn.disabled = true;
    rescanBtn.addClass('is-loading');
    rescanBtn.textContent = 'Scanning...';

    // 显示进度条
    const progressBar = div('ax-vh-scan-progress');
    const progressFill = div('ax-vh-scan-progress-fill');
    progressBar.appendChild(progressFill);
    header.appendChild(progressBar);

    try {
      const forceResult = await scanner.forceScan((pct) => {
        progressFill.style.width = pct + '%';
      });
      if (forceResult.ok) {
        const newPanel = renderPanel(content, forceResult.value, scanner, registerCleanup, safeTimeout);
        content.empty();
        content.appendChild(newPanel);
      }
    } finally {
      progressBar.remove();
      scanning = false;
      rescanBtn.disabled = false;
      rescanBtn.removeClass('is-loading');
      rescanBtn.textContent = 'Rescan';
    }
  };
  rescanBtn.addEventListener('click', onRescanClick);
  registerCleanup(() => rescanBtn.removeEventListener('click', onRescanClick));

  right.appendChild(lastScanned);
  right.appendChild(rescanBtn);
  header.appendChild(title);
  header.appendChild(right);
  panel.appendChild(header);

  // ---- 左右分栏 ----
  const body = div('ax-vh-body');

  body.appendChild(renderLeftRing(data));
  body.appendChild(renderRightMetrics(data));

  panel.appendChild(body);

  // ---- 底部全局统计 ----
  panel.appendChild(renderGlobalStats(data));

  return panel;
}

function renderLeftRing(data: VaultHealthData): HTMLElement {
  const left = div('ax-vh-left');

  const score = data.healthScore;
  const deg = Math.round((score / 100) * 360);
  const ring = div('ax-vh-ring');
  ring.style.background = `conic-gradient(var(--ax-accent, #3fb8af) ${deg}deg, var(--ax-line, #1e293b) ${deg}deg)`;

  const inner = div('ax-vh-ring-inner');
  const scoreNum = div('ax-vh-ring-score', String(score));
  const scoreLabel = div('ax-vh-ring-label', 'HEALTH');
  inner.appendChild(scoreNum);
  inner.appendChild(scoreLabel);
  ring.appendChild(inner);
  left.appendChild(ring);

  const delta = data.weeklyDelta;
  const trend = div('ax-vh-trend ' + (delta >= 0 ? 'ax-vh-trend--up' : 'ax-vh-trend--down'));
  trend.textContent = (delta >= 0 ? '+' : '') + delta + ' this week';
  left.appendChild(trend);

  return left;
}

function renderRightMetrics(data: VaultHealthData): HTMLElement {
  const right = div('ax-vh-metrics');

  right.appendChild(createMetricCard({
    title: 'Link Health', value: data.brokenLinks, total: data.totalLinks, unit: 'broken', visual: 'bar', visualValue: data.totalLinks > 0 ? Math.round((1 - data.brokenLinks / data.totalLinks) * 100) : 100,
    risk: data.brokenLinks > 10 ? `${data.brokenLinks} 断链需修复` : '正常', riskLevel: data.brokenLinks > 10 ? 'high' : data.brokenLinks > 5 ? 'medium' : 'low',
  }));
  right.appendChild(createMetricCard({
    title: 'Tag Coverage', value: data.tagCoverage, total: 100, unit: '%', visual: 'bar', visualValue: data.tagCoverage,
    risk: data.tagCoverage < 60 ? '覆盖率偏低' : '良好', riskLevel: data.tagCoverage < 60 ? 'medium' : 'low',
  }));
  right.appendChild(createMetricCard({
    title: 'Orphan Notes', value: data.orphanNotes, total: data.totalNotes, unit: 'notes', visual: 'bar', visualValue: data.totalNotes > 0 ? Math.round((1 - data.orphanNotes / data.totalNotes) * 100) : 100,
    risk: data.orphanNotes > 15 ? '孤立笔记过多' : '正常', riskLevel: data.orphanNotes > 15 ? 'high' : data.orphanNotes > 8 ? 'medium' : 'low',
  }));
  right.appendChild(createMetricCard({
    title: 'Frontmatter', value: 72, total: 100, unit: '%', visual: 'bar', visualValue: 72, risk: '部分笔记缺少元数据', riskLevel: 'medium',
  }));
  right.appendChild(createMetricCard({
    title: 'Folder Balance', value: data.folderDistribution.length, total: 0, unit: 'dirs', visual: 'bars', visualValue: 0, risk: '分布较均匀', riskLevel: 'low', extraData: data.folderDistribution,
  }));
  right.appendChild(createMetricCard({
    title: 'Weekly Activity', value: 12, total: 0, unit: 'notes', visual: 'delta', visualValue: 12, risk: '+3 vs 上周', riskLevel: 'low', delta: 3,
  }));

  return right;
}

interface MetricCardConfig {
  title: string; value: number; total: number; unit: string;
  visual: 'bar' | 'bars' | 'delta'; visualValue: number;
  risk: string; riskLevel: 'low' | 'medium' | 'high';
  extraData?: { name: string; count: number }[]; delta?: number;
}

function createMetricCard(cfg: MetricCardConfig): HTMLElement {
  const card = div('ax-vh-metric ax-vh-metric--' + cfg.riskLevel);

  const title = div('ax-vh-metric-title', cfg.title);
  card.appendChild(title);

  const valueRow = div('ax-vh-metric-value-row');
  const valueEl = div('ax-vh-metric-value', String(cfg.value));
  const unitEl = div('ax-vh-metric-unit', cfg.unit);
  valueRow.appendChild(valueEl);
  valueRow.appendChild(unitEl);
  card.appendChild(valueRow);

  if (cfg.visual === 'bar') {
    const bar = div('ax-vh-metric-bar');
    const fill = div('ax-vh-metric-bar-fill');
    fill.style.width = cfg.visualValue + '%';
    if (cfg.riskLevel === 'high') fill.addClass('ax-vh-metric-bar-fill--danger');
    else if (cfg.riskLevel === 'medium') fill.addClass('ax-vh-metric-bar-fill--warn');
    bar.appendChild(fill);
    card.appendChild(bar);
  } else if (cfg.visual === 'bars' && cfg.extraData) {
    const bars = div('ax-vh-metric-bars');
    const maxVal = Math.max(1, ...cfg.extraData.map(d => d.count));
    cfg.extraData.slice(0, 6).forEach(d => {
      const row = div('ax-vh-metric-bars-row');
      const label = div('ax-vh-metric-bars-label', d.name.split('/').pop() || d.name);
      const track = div('ax-vh-metric-bars-track');
      const fill = div('ax-vh-metric-bars-fill');
      fill.style.width = Math.round((d.count / maxVal) * 100) + '%';
      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      bars.appendChild(row);
    });
    card.appendChild(bars);
  } else if (cfg.visual === 'delta') {
    const deltaEl = div('ax-vh-metric-delta ' + ((cfg.delta || 0) >= 0 ? 'ax-vh-metric-delta--up' : 'ax-vh-metric-delta--down'));
    deltaEl.textContent = ((cfg.delta || 0) >= 0 ? '▲ +' : '▼ ') + Math.abs(cfg.delta || 0);
    card.appendChild(deltaEl);
  }

  const risk = div('ax-vh-metric-risk', cfg.risk);
  card.appendChild(risk);

  return card;
}

function renderGlobalStats(data: VaultHealthData): HTMLElement {
  const stats = div('ax-vh-global-stats');
  stats.innerHTML =
    '<span class="ax-vh-stat"><b>' + data.totalNotes + '</b> 总笔记</span>' +
    '<span class="ax-vh-stat-sep">·</span>' +
    '<span class="ax-vh-stat"><b>' + data.totalTags + '</b> 标签</span>' +
    '<span class="ax-vh-stat-sep">·</span>' +
    '<span class="ax-vh-stat"><b>' + data.totalLinks + '</b> 内链</span>' +
    '<span class="ax-vh-stat-sep">·</span>' +
    '<span class="ax-vh-stat"><b>' + data.dailyActivityMultiDim.notes.filter(d => d.count > 0).length + '</b> 活跃天</span>';
  return stats;
}
