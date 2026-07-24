/**
 * widgets/inbox.ts — Inbox 面板（v1.5 增强 + Disposable handle）
 * 多选 + 批量归档 + 进度显示
 */

import { App, TFile } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { type WidgetHandle, createRootedDisposable } from '../types';
import { type ServiceResult, ok, err, renderErrorState } from '../utils/ServiceResult';

export interface InboxItem {
  path: string;
  basename: string;
  mtime: number;
  status: string;
  title: string;
}

/** 扫描 Inbox 目录 */
export async function scanInbox(app: App, dir: string = 'Inbox'): Promise<ServiceResult<InboxItem[]>> {
  try {
    const folder = app.vault.getAbstractFileByPath(dir);
    if (!folder) return ok([]);

    const items: InboxItem[] = [];
    const children = (folder as any).children || [];

    for (const child of children) {
      if (child.extension !== 'md') continue;
      const file = child as TFile;

      const content = await app.vault.read(file);
      const statusMatch = content.match(/^status:\s*(.+)$/m);
      const titleMatch = content.match(/^#\s+(.+)$/m);

      items.push({
        path: file.path,
        basename: file.basename,
        mtime: file.stat.mtime,
        status: statusMatch ? statusMatch[1].trim() : 'inbox',
        title: titleMatch ? titleMatch[1].trim() : file.basename,
      });
    }

    return ok(items.sort((a, b) => b.mtime - a.mtime));
  } catch (e) {
    console.error('[INBOX_SCAN_FAILED] scanInbox:', e);
    return err('INBOX_SCAN_FAILED', (e as Error).message || 'Inbox 扫描失败', true, e as Error);
  }
}

type Cleaner = () => void;

/**
 * 构建 Inbox UI
 * @param onBatchArchive 批量归档回调：接收选中的 InboxItem[]
 *
 * 返回 { section, handle }。view.ts 应持有 handle 并在 onClose 时 dispose。
 */
export function createInboxPanel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
  openPath: (path: string) => void,
  onBatchArchive?: (items: InboxItem[]) => Promise<void>,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('Inbox', '#8B5CF6', '待处理文件');

  // 多选状态
  const selected = new Set<string>();
  const cleaners: Cleaner[] = [];
  const timeouts: Set<number> = new Set();

  const safeTimeout = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms);
    timeouts.add(id);
    return id;
  };

  const registerCleanup = (fn: Cleaner) => { cleaners.push(fn); };

  // 工具栏（批量操作）
  const toolbar = div('ax-inbox-toolbar');
  toolbar.style.display = 'none';

  const selectAllBtn = el('button', { class: 'ax-btn ax-btn-ghost' }, '全选');
  const batchBtn = el('button', { class: 'ax-btn ax-btn-primary' }, '📥 批量归档');
  const selectedCount = el('span', { class: 'ax-inbox-selected-count' }, '');

  toolbar.appendChild(selectedCount);
  toolbar.appendChild(selectAllBtn);
  toolbar.appendChild(batchBtn);
  section.appendChild(toolbar);

  const content = div('ax-inbox-list');
  content.setAttribute('data-inbox-list', '');

  // 异步加载
  let currentItems: InboxItem[] = [];
  let lastError: import('../utils/ServiceResult').ServiceError | null = null;
  const loadInbox = () => {
    scanInbox(app).then(result => {
      if (result.ok) {
        currentItems = result.value;
        lastError = null;
      } else {
        console.error('[INBOX_WIDGET] scanInbox failed:', result.error.code);
        lastError = result.error;
      }
      renderItems();
      updateSubtitle();
    });
  };
  loadInbox();

  function renderItems() {
    content.empty();

    // 错误状态渲染
    if (lastError) {
      content.appendChild(renderErrorState(lastError, loadInbox));
      toolbar.style.display = 'none';
      return;
    }

    if (currentItems.length === 0) {
      const empty = div('ax-empty');
      empty.textContent = 'Inbox 空了 ✨';
      content.appendChild(empty);
      toolbar.style.display = 'none';
      return;
    }

    currentItems.forEach(item => {
      const row = div('ax-inbox-item');
      if (selected.has(item.path)) {
        row.addClass('ax-inbox-selected');
      }

      // 多选 checkbox
      const checkbox = el('input', { type: 'checkbox', class: 'ax-inbox-checkbox' }) as HTMLInputElement;
      checkbox.checked = selected.has(item.path);
      const onCheckboxChange = (e: Event) => {
        e.stopPropagation();
        if (checkbox.checked) {
          selected.add(item.path);
          row.addClass('ax-inbox-selected');
        } else {
          selected.delete(item.path);
          row.removeClass('ax-inbox-selected');
        }
        updateToolbar();
      };
      checkbox.addEventListener('change', onCheckboxChange);
      registerCleanup(() => checkbox.removeEventListener('change', onCheckboxChange));

      row.innerHTML = `
        <div class="ax-inbox-main">
          <span class="ax-inbox-title">${esc(item.title)}</span>
          <span class="ax-inbox-status ax-inbox-status-${esc(item.status)}">${esc(item.status)}</span>
        </div>
        <div class="ax-inbox-meta">
          <span class="ax-inbox-path">${esc(item.path)}</span>
        </div>
      `;
      row.insertBefore(checkbox, row.firstChild);

      // 点击打开文件（如果点击的是 checkbox 则不触发）
      const onRowClick = (e: MouseEvent) => {
        if (e.target === checkbox) return;
        e.preventDefault();
        openPath(item.path);
      };
      row.addEventListener('click', onRowClick);
      registerCleanup(() => row.removeEventListener('click', onRowClick));

      content.appendChild(row);
    });
  }

  function updateToolbar() {
    const count = selected.size;
    if (count > 0) {
      toolbar.style.display = 'flex';
      selectedCount.textContent = `已选 ${count} 项`;
    } else {
      toolbar.style.display = 'none';
    }
  }

  function updateSubtitle() {
    const subtitle = section.querySelector('small');
    if (subtitle) subtitle.textContent = `${currentItems.length} 个待处理`;
  }

  // 全选 / 取消全选
  const onSelectAllClick = () => {
    if (selected.size === currentItems.length) {
      selected.clear();
    } else {
      currentItems.forEach(item => selected.add(item.path));
    }
    renderItems();
    updateToolbar();
  };
  selectAllBtn.addEventListener('click', onSelectAllClick);
  registerCleanup(() => selectAllBtn.removeEventListener('click', onSelectAllClick));

  // 批量归档
  const onBatchClick = async () => {
    if (selected.size === 0) return;
    const itemsToArchive = currentItems.filter(item => selected.has(item.path));

    batchBtn.disabled = true;
    batchBtn.textContent = '归档中...';

    try {
      if (onBatchArchive) {
        await onBatchArchive(itemsToArchive);
      }
      selected.clear();
      toolbar.style.display = 'none';
      const refreshResult = await scanInbox(app);
      if (refreshResult.ok) {
        currentItems = refreshResult.value;
      }
      renderItems();
      updateSubtitle();
    } finally {
      batchBtn.disabled = false;
      batchBtn.textContent = '📥 批量归档';
    }
  };
  batchBtn.addEventListener('click', onBatchClick);
  registerCleanup(() => batchBtn.removeEventListener('click', onBatchClick));

  section.appendChild(content);

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

/**
 * 读取 Inbox 文件内容为 ingest prompt
 * 批量归档时外部调用，构造 Claude Code ingest 任务
 */
export async function buildInboxIngestPrompt(app: App, items: InboxItem[]): Promise<string> {
  const parts: string[] = [
    '你是 GullDock 的知识库管理助手。请将以下 Inbox 文件归档到合适的 Wiki。',
    '',
    '## 处理规则',
    '1. 读取每个 Inbox 文件的内容',
    '2. 根据内容分类：技术类 → tech-wiki，金融类 → finance-wiki，个人类 → Axlumen-wiki',
    '3. 在目标 Wiki 的 raw/ 目录下创建清洗后的原始文件',
    '4. 创建正式的 Wiki 页面（concepts/entities/sources 之一）',
    '5. 归档完成后，将原 Inbox 文件的 frontmatter status 改为 "archived"',
    '6. 或将文件从 Inbox/ 移动到 archive/ 目录',
    '',
    '## 要归档的文件',
  ];

  for (const item of items) {
    const file = app.vault.getAbstractFileByPath(item.path);
    if (file instanceof TFile) {
      const content = await app.vault.read(file);
      parts.push(`\n### ${item.path}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``);
    }
  }

  parts.push('', '## 完成后', '报告每个文件的处理结果（目标路径、页面类型）');

  return parts.join('\n');
}
