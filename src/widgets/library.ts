/**
 * widgets/library.ts — Vault 文件浏览器
 *
 * 四种视图模式：grid / list / table / kanban
 * 功能：搜索、排序、筛选、分页、hover 预览、文件删除
 */

import { App, TFile, Platform } from 'obsidian';
import type { LibraryConfig, LibraryViewMode, PropertyFilter } from '../types';
import { div, esc } from '../utils/dom';
import { LocalStore } from '../utils/LocalStore';
import type { WidgetHandle } from '../types';

export interface LibraryFileResult {
  file: TFile;
  basename: string;
  mtime: number;
  ctime: number;
  frontmatter: Record<string, unknown>;
  tags: string[];
}

const DEFAULT_PAGE_SIZE = 20;

// ===== Vault 查询 =====

export function queryVaultFiles(app: App, config: LibraryConfig): LibraryFileResult[] {
  const files = app.vault.getMarkdownFiles();
  const results: LibraryFileResult[] = [];
  const scanFolders = (config.folders ?? [])
    .map(f => f.trim().replace(/^\/+|\/+$/g, ''))
    .filter(f => f.length > 0);

  for (const file of files) {
    if (file.path.startsWith('.')) continue;
    if (scanFolders.length > 0) {
      const lp = file.path.toLowerCase();
      if (!scanFolders.some(f => lp.startsWith(f.toLowerCase() + '/'))) continue;
    }
    const cache = app.metadataCache.getFileCache(file);
    const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
    const tags: string[] = [];
    if (cache?.tags) {
      for (const tag of cache.tags) tags.push(tag.tag);
    }
    results.push({
      file,
      basename: file.basename,
      mtime: file.stat.mtime,
      ctime: file.stat.ctime,
      frontmatter: fm,
      tags,
    });
  }
  sortResults(results, config.sortBy, config.sortDesc);
  return results;
}

function sortResults(results: LibraryFileResult[], sortBy: string, desc: boolean): void {
  results.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.basename.localeCompare(b.basename);
    else if (sortBy === 'modified') cmp = a.mtime - b.mtime;
    else if (sortBy === 'created') cmp = a.ctime - b.ctime;
    else {
      const aVal = a.frontmatter[sortBy];
      const bVal = b.frontmatter[sortBy];
      cmp = compareValues(aVal, bVal);
    }
    return desc ? -cmp : cmp;
  });
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const sa = String(a);
  const sb = String(b);
  const na = Number(sa);
  const nb = Number(sb);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return sa.localeCompare(sb);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH === 0) {
      const diffM = Math.floor(diffMs / (1000 * 60));
      return diffM <= 1 ? '刚刚' : `${diffM} 分钟前`;
    }
    return `${diffH} 小时前`;
  }
  if (diffDays < 30) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

// ===== 主渲染函数 =====

export function createLibraryPanel(
  app: App,
  createPanel: (title: string, color: string, subtitle: string) => HTMLElement,
  initialConfig?: LibraryConfig,
): { section: HTMLElement; handle: WidgetHandle } {
  const config: LibraryConfig = initialConfig ?? {
    filters: [],
    viewMode: 'grid',
    sortBy: 'modified',
    sortDesc: true,
    pageSize: DEFAULT_PAGE_SIZE,
    showProperties: true,
    propertyLimit: 6,
  };

  const section = div('ax-section-lib');
  let disposed = false;
  const disposers: Array<() => void> = [];

  const regEvent = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement, type: K, handler: (e: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, handler as EventListener);
    disposers.push(() => target.removeEventListener(type, handler as EventListener));
  };

  // ---- 工具栏 ----
  const toolbar = div('ax-lib-toolbar');

  const searchInput = document.createElement('input');
  searchInput.className = 'ax-lib-search';
  searchInput.type = 'text';
  searchInput.placeholder = '搜索文件名...';
  toolbar.appendChild(searchInput);

  const sortSelect = document.createElement('select');
  sortSelect.className = 'ax-lib-sort';
  for (const opt of [
    { value: 'modified', label: '最近修改' },
    { value: 'created', label: '创建时间' },
    { value: 'name', label: '文件名' },
  ]) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === config.sortBy) option.selected = true;
    sortSelect.appendChild(option);
  }
  toolbar.appendChild(sortSelect);

  const sortDirBtn = div('ax-lib-sort-dir');
  sortDirBtn.innerHTML = config.sortDesc ? '↓' : '↑';
  sortDirBtn.title = '切换排序方向';
  toolbar.appendChild(sortDirBtn);

  const viewToggle = div('ax-lib-view-toggle');
  const viewModes: LibraryViewMode[] = ['grid', 'list', 'table', 'kanban'];
  const viewLabels: Record<string, string> = { grid: '▦', list: '☰', table: '⊞', kanban: '⊟' };
  for (const mode of viewModes) {
    const btn = div('ax-lib-view-btn' + (mode === config.viewMode ? ' active' : ''));
    btn.textContent = viewLabels[mode] ?? '▪';
    btn.title = mode;
    btn.dataset.viewMode = mode;
    regEvent(btn, 'click', () => {
      viewToggle.querySelectorAll('.ax-lib-view-btn').forEach(b => b.removeClass('active'));
      btn.addClass('active');
      config.viewMode = mode;
      currentPage = 1;
      renderContent();
    });
    viewToggle.appendChild(btn);
  }
  toolbar.appendChild(viewToggle);

  const spacer = div('ax-lib-toolbar-spacer');
  toolbar.appendChild(spacer);

  const countEl = div('ax-lib-count');
  toolbar.appendChild(countEl);

  section.appendChild(toolbar);

  // ---- 内容区 ----
  const contentArea = div('ax-lib-files');
  section.appendChild(contentArea);

  // ---- 分页 ----
  const paginationArea = div('ax-lib-pagination');
  section.appendChild(paginationArea);

  let currentPage = 1;
  let allResults: LibraryFileResult[] = [];

  function renderContent(): void {
    contentArea.empty();
    paginationArea.empty();

    allResults = queryVaultFiles(app, config);

    // 搜索过滤
    const search = searchInput.value.trim().toLowerCase();
    if (search) {
      allResults = allResults.filter(r => r.basename.toLowerCase().includes(search));
    }

    // 快速日期筛选
    if (config.quickDateFilter) {
      const qdf = config.quickDateFilter;
      allResults = allResults.filter(r => {
        const ts = qdf.property === 'modified' ? r.mtime : r.ctime;
        const dateStr = new Date(ts).toISOString().slice(0, 10);
        if (qdf.start && dateStr < qdf.start) return false;
        if (qdf.end && dateStr > qdf.end) return false;
        return true;
      });
    }

    // 文件夹筛选
    if (config.folderFilter && config.folderFilter.length > 0) {
      const ff = config.folderFilter.map(f => f.trim().replace(/^\/+|\/+$/g, '')).filter(f => f.length > 0);
      if (ff.length > 0) {
        allResults = allResults.filter(r => {
          const lp = r.file.path.toLowerCase();
          return ff.some(f => lp.startsWith(f.toLowerCase() + '/'));
        });
      }
    }

    countEl.textContent = `${allResults.length} 个文件`;

    if (allResults.length === 0) {
      contentArea.createDiv({ cls: 'ax-lib-empty', text: '没有匹配的文件' });
      return;
    }

    // 分页
    const isKanban = config.viewMode === 'kanban';
    const pageSize = isKanban ? allResults.length : (config.pageSize ?? DEFAULT_PAGE_SIZE);
    const totalPages = isKanban ? 1 : Math.ceil(allResults.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const startIdx = isKanban ? 0 : (currentPage - 1) * pageSize;
    const endIdx = isKanban ? allResults.length : Math.min(startIdx + pageSize, allResults.length);
    const pageResults = allResults.slice(startIdx, endIdx);

    switch (config.viewMode) {
      case 'grid': renderGridView(pageResults); break;
      case 'list': renderListView(pageResults); break;
      case 'table': renderTableView(pageResults); break;
      case 'kanban': renderKanbanView(pageResults); break;
    }

    // 分页控件
    if (!isKanban && totalPages > 1) {
      renderPagination(paginationArea, currentPage, totalPages, (page) => {
        currentPage = page;
        renderContent();
      });
    }
  }

  // ---- 视图渲染 ----

  function renderGridView(results: LibraryFileResult[]): void {
    const grid = contentArea.createDiv({ cls: 'ax-lib-grid' });
    const showProps = config.showProperties !== false;
    const propLimit = Math.max(0, config.propertyLimit ?? 6);

    for (const result of results) {
      const card = grid.createDiv({ cls: 'ax-lib-card' });
      regEvent(card, 'click', () => openFile(result.file));

      card.createDiv({ cls: 'ax-lib-card-title', text: result.basename });

      const metaRow = card.createDiv({ cls: 'ax-lib-card-meta' });
      const parts = result.file.path.split('/');
      if (parts.length > 1) {
        metaRow.createDiv({ cls: 'ax-lib-card-path', text: parts.slice(0, -1).join('/') + '/' });
      }
      metaRow.createDiv({ cls: 'ax-lib-card-date', text: formatDate(result.ctime) });

      // 异步加载预览
      const previewEl = card.createDiv({ cls: 'ax-lib-card-preview' });
      loadPreview(app, result.file).then(text => {
        if (!previewEl.isConnected) return;
        if (text) previewEl.textContent = text;
        else previewEl.remove();
      }).catch(() => { if (previewEl.isConnected) previewEl.remove(); });

      // Frontmatter 徽章
      if (showProps && propLimit > 0) {
        const badges = card.createDiv({ cls: 'ax-lib-badges' });
        let count = 0;
        for (const [key, rawValue] of Object.entries(result.frontmatter)) {
          if (count >= propLimit) break;
          if (key === 'position' || key === 'tags') continue;
          const val = formatBadgeValue(rawValue);
          if (val === null) continue;
          const badge = badges.createDiv({ cls: 'ax-lib-badge' });
          badge.createDiv({ cls: 'ax-lib-badge-key', text: key + ':' });
          badge.createDiv({ cls: 'ax-lib-badge-val', text: val });
          count++;
        }
        if (count === 0) badges.remove();
      }
    }
  }

  function renderListView(results: LibraryFileResult[]): void {
    const list = contentArea.createDiv({ cls: 'ax-lib-list' });
    for (const result of results) {
      const item = list.createDiv({ cls: 'ax-lib-list-item' });
      regEvent(item, 'click', () => openFile(result.file));
      item.createDiv({ cls: 'ax-lib-list-name', text: result.basename });
      item.createDiv({ cls: 'ax-lib-list-spacer' });
      item.createDiv({ cls: 'ax-lib-list-date', text: formatDate(result.ctime) });
    }
  }

  function renderTableView(results: LibraryFileResult[]): void {
    const propKeys = new Set<string>();
    for (const result of results.slice(0, 20)) {
      for (const key of Object.keys(result.frontmatter)) {
        if (key === 'position') continue;
        propKeys.add(key);
        if (propKeys.size >= 4) break;
      }
    }
    const columns = ['name', 'modified', ...propKeys];

    const table = contentArea.createEl('table', { cls: 'ax-lib-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    for (const col of columns) {
      headerRow.createEl('th', {
        text: col === 'name' ? '文件名' : col === 'modified' ? '修改时间' : col,
      });
    }

    const tbody = table.createEl('tbody');
    for (const result of results) {
      const tr = tbody.createEl('tr');
      for (const col of columns) {
        const td = tr.createEl('td');
        if (col === 'name') {
          td.textContent = result.basename;
          td.addClass('ax-lib-table-name');
          regEvent(td, 'click', (e) => { e.stopPropagation(); openFile(result.file); });
        } else if (col === 'modified') {
          td.textContent = formatDate(result.mtime);
        } else {
          const value = result.frontmatter[col];
          td.textContent = value == null ? '—' : Array.isArray(value) ? value.map(String).join(', ') : str(value);
          if (value == null) td.addClass('ax-lib-table-empty');
        }
      }
    }
  }

  function renderKanbanView(results: LibraryFileResult[]): void {
    const groupBy = config.kanbanGroupBy ?? 'tags';
    const kanban = contentArea.createDiv({ cls: 'ax-lib-kanban' });
    const groups = new Map<string, LibraryFileResult[]>();
    const noGroup: LibraryFileResult[] = [];

    for (const result of results) {
      const value = result.frontmatter[groupBy];
      if (value == null) { noGroup.push(result); continue; }
      if (Array.isArray(value)) {
        for (const v of value) {
          const key = String(v);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(result);
        }
      } else {
        const key = str(value);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(result);
      }
    }

    for (const [groupName, groupResults] of groups) {
      const col = kanban.createDiv({ cls: 'ax-lib-kanban-col' });
      col.createDiv({ cls: 'ax-lib-kanban-col-title', text: `${groupName} (${groupResults.length})` });
      for (const result of groupResults) {
        const card = col.createDiv({ cls: 'ax-lib-kanban-card' });
        regEvent(card, 'click', () => openFile(result.file));
        card.createDiv({ cls: 'ax-lib-kanban-card-title', text: result.basename });
        card.createDiv({ cls: 'ax-lib-kanban-card-date', text: formatDate(result.mtime) });
      }
    }

    if (noGroup.length > 0) {
      const col = kanban.createDiv({ cls: 'ax-lib-kanban-col' });
      col.createDiv({ cls: 'ax-lib-kanban-col-title', text: `未分类 (${noGroup.length})` });
      for (const result of noGroup) {
        const card = col.createDiv({ cls: 'ax-lib-kanban-card' });
        regEvent(card, 'click', () => openFile(result.file));
        card.createDiv({ cls: 'ax-lib-kanban-card-title', text: result.basename });
      }
    }
  }

  // ---- 分页 ----

  function renderPagination(container: HTMLElement, current: number, total: number, onChange: (page: number) => void): void {
    const nav = container.createDiv({ cls: 'ax-lib-pagination-nav' });

    const prevBtn = nav.createDiv({ cls: 'ax-lib-pagination-btn' + (current <= 1 ? ' disabled' : ''), text: '<' });
    if (current > 1) regEvent(prevBtn, 'click', () => onChange(current - 1));

    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    const end = Math.min(total, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      const btn = nav.createDiv({ cls: 'ax-lib-pagination-page', text: '1' });
      regEvent(btn, 'click', () => onChange(1));
      if (start > 2) nav.createDiv({ cls: 'ax-lib-pagination-ellipsis', text: '...' });
    }

    for (let i = start; i <= end; i++) {
      const btn = nav.createDiv({ cls: 'ax-lib-pagination-page' + (i === current ? ' active' : ''), text: String(i) });
      if (i !== current) regEvent(btn, 'click', () => onChange(i));
    }

    if (end < total) {
      if (end < total - 1) nav.createDiv({ cls: 'ax-lib-pagination-ellipsis', text: '...' });
      const lastBtn = nav.createDiv({ cls: 'ax-lib-pagination-page', text: String(total) });
      regEvent(lastBtn, 'click', () => onChange(total));
    }

    const nextBtn = nav.createDiv({ cls: 'ax-lib-pagination-btn' + (current >= total ? ' disabled' : ''), text: '>' });
    if (current < total) regEvent(nextBtn, 'click', () => onChange(current + 1));
  }

  // ---- 工具函数 ----

  function openFile(file: TFile): void {
    if (!Platform.isMobile) {
      app.workspace.getLeaf(false).openFile(file);
    } else {
      void app.workspace.getLeaf(false).openFile(file);
    }
  }

  async function loadPreview(app: App, file: TFile): Promise<string> {
    const cache = app.metadataCache.getFileCache(file);
    const position = cache?.frontmatter?.position as { end: { line: number } } | undefined;
    if (!position) return '';
    const startLine = position.end.line + 1;
    const raw = await app.vault.cachedRead(file);
    const lines = raw.split('\n');
    const previewLines: string[] = [];
    for (let i = startLine; i < lines.length && previewLines.length < 3; i++) {
      const line = lines[i]!.replace(/^#+\s*/, '').trim();
      if (line && !line.startsWith('---') && !line.startsWith('```')) previewLines.push(line);
    }
    return previewLines.join(' ').slice(0, 120);
  }

  function formatBadgeValue(value: unknown): string | null {
    if (value == null) return null;
    if (Array.isArray(value)) {
      const items = value.map(v => v == null ? '' : String(v)).filter(v => v.length > 0);
      return items.length > 0 ? items.join(', ') : null;
    }
    if (typeof value === 'object') {
      try {
        const s = JSON.stringify(value).replace(/"/g, '').trim();
        return s.length > 0 && s.length <= 60 ? s : null;
      } catch { return null; }
    }
    const s = str(value).trim();
    return s.length > 0 ? s : null;
  }

  // ---- 事件绑定 ----

  let searchTimer: number | null = null;
  regEvent(searchInput, 'input', () => {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { currentPage = 1; renderContent(); }, 200);
  });

  regEvent(sortSelect, 'change', () => {
    config.sortBy = sortSelect.value;
    currentPage = 1;
    renderContent();
  });

  regEvent(sortDirBtn, 'click', () => {
    config.sortDesc = !config.sortDesc;
    sortDirBtn.textContent = config.sortDesc ? '↓' : '↑';
    currentPage = 1;
    renderContent();
  });

  // 初始渲染
  renderContent();

  return {
    section,
    handle: {
      get disposed() { return disposed; },
      roots: [section],
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const d of disposers) d();
        section.remove();
      },
    },
  };
}
