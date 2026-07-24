/**
 * widgets/memo.ts — 多卡片 Memo 面板 + 单卡组件
 *
 * 功能：多卡片笔记、颜色标记、保存为文件、横向滚动、wikilink 支持
 */

import { App, Notice } from 'obsidian';
import { div, el, esc } from '../utils/dom';
import { LocalStore } from '../utils/LocalStore';
import type { WidgetHandle } from '../types';

export interface MemoCard {
  id: string;
  title: string;
  body: string;
  color: string;
  createdAt: number;
}

/** createMemoCard 的选项 */
export interface MemoCardOptions {
  /** 编辑完成后回调（含 wikilink 保存后触发） */
  onUpdate?: (memo: MemoCard) => void;
  /** 删除回调 */
  onDelete?: (memo: MemoCard) => void;
}

const MEMO_COLORS = [
  { name: '默认', value: '' },
  { name: '粉色', value: '#F472B6' },
  { name: '蓝色', value: '#60A5FA' },
  { name: '绿色', value: '#34D399' },
  { name: '黄色', value: '#FBBF24' },
  { name: '紫色', value: '#A78BFA' },
  { name: '橙色', value: '#FB923C' },
];

function generateId(): string {
  return 'memo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 从文本中提取 [[wikilink]] 列表（去重） */
function extractWikilinks(text: string): string[] {
  const links: string[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const target = m[1].trim();
    if (target && !links.includes(target)) links.push(target);
  }
  return links;
}

// ===== 单张 Memo 卡片组件 =====

/**
 * 创建独立的 Memo 卡片 DOM。
 *
 * @param app     Obsidian App 实例（用于打开 wikilink）
 * @param memo    卡片数据
 * @param opts    可选回调
 * @returns       卡片 DOM 元素 + dispose 清理函数
 */
export function createMemoCard(
  app: App,
  memo: MemoCard,
  opts?: MemoCardOptions,
): { element: HTMLElement; dispose: () => void } {
  const disposers: Array<() => void> = [];

  const regEvent = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement, type: K, handler: (e: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, handler as EventListener);
    disposers.push(() => target.removeEventListener(type, handler as EventListener));
  };

  const card = div('ax-memo-card');
  if (memo.color) card.style.borderLeftColor = memo.color;

  // ---- 标题栏 ----
  const header = div('ax-memo-card-header');

  const titleInput = el('input', {
    class: 'ax-memo-card-title',
    type: 'text',
    value: memo.title,
    placeholder: '标题...',
  }) as HTMLInputElement;
  regEvent(titleInput, 'input', () => {
    memo.title = titleInput.value;
    opts?.onUpdate?.(memo);
  });
  header.appendChild(titleInput);

  // ---- 操作按钮 ----
  const actions = div('ax-memo-card-actions');

  // 颜色选择
  const colorBtn = div('ax-memo-color-btn');
  colorBtn.innerHTML = '●';
  if (memo.color) colorBtn.style.color = memo.color;
  colorBtn.title = '选择颜色';
  regEvent(colorBtn, 'click', (e) => {
    e.stopPropagation();
    showColorPicker(card, memo, colorBtn, opts);
  });
  actions.appendChild(colorBtn);

  // 保存为文件
  const saveBtn = div('ax-memo-save-btn');
  saveBtn.textContent = '↓';
  saveBtn.title = '保存为 Markdown 文件';
  regEvent(saveBtn, 'click', async () => {
    await saveAsNote(app, memo);
  });
  actions.appendChild(saveBtn);

  // 删除
  const deleteBtn = div('ax-memo-delete-btn');
  deleteBtn.textContent = '×';
  deleteBtn.title = '删除';
  regEvent(deleteBtn, 'click', () => {
    opts?.onDelete?.(memo);
  });
  actions.appendChild(deleteBtn);

  header.appendChild(actions);
  card.appendChild(header);

  // ---- 内容区（textarea） ----
  const textarea = el('textarea', {
    class: 'ax-memo-textarea',
    placeholder: '写下你的想法... 支持 [[wikilink]]',
  }) as HTMLTextAreaElement;
  textarea.value = memo.body;

  regEvent(textarea, 'input', () => {
    memo.body = textarea.value;
    updateWikilinks(wikilinksEl, memo, app);
    opts?.onUpdate?.(memo);
  });
  // 自动调整高度
  regEvent(textarea, 'input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
  card.appendChild(textarea);

  // ---- Wikilink 展示区 ----
  const wikilinksEl = div('ax-memo-wikilinks');
  updateWikilinks(wikilinksEl, memo, app);
  card.appendChild(wikilinksEl);

  // 延迟调整高度
  setTimeout(() => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }, 0);

  return {
    element: card,
    dispose() {
      for (const d of disposers) d();
    },
  };
}

// ===== Wikilink 渲染 =====

function updateWikilinks(container: HTMLElement, memo: MemoCard, app: App) {
  container.empty();
  const links = extractWikilinks(memo.body);
  if (links.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  for (const target of links) {
    const chip = div('ax-memo-wikilink-chip');
    chip.textContent = target;
    chip.title = `打开 [[${target}]]`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        app.workspace.openLinkText(target, '', 'tab');
      } catch {
        // 文件不存在时静默失败
      }
    });
    container.appendChild(chip);
  }
}

// ===== 颜色选择器 =====

function showColorPicker(
  card: HTMLElement,
  memo: MemoCard,
  anchor: HTMLElement,
  opts?: MemoCardOptions,
) {
  const existing = card.querySelector('.ax-memo-color-picker');
  if (existing) { existing.remove(); return; }

  const picker = div('ax-memo-color-picker');
  for (const c of MEMO_COLORS) {
    const swatch = div('ax-memo-color-swatch' + (c.value === memo.color ? ' active' : ''));
    if (c.value) swatch.style.backgroundColor = c.value;
    swatch.title = c.name;
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      memo.color = c.value;
      opts?.onUpdate?.(memo);
      if (c.value) {
        card.style.borderLeftColor = c.value;
        anchor.style.color = c.value;
      } else {
        card.style.borderLeftColor = '';
        anchor.style.color = '';
      }
      picker.remove();
    });
    picker.appendChild(swatch);
  }

  const closeBtn = div('ax-memo-color-close');
  closeBtn.textContent = '清除';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    memo.color = '';
    opts?.onUpdate?.(memo);
    card.style.borderLeftColor = '';
    anchor.style.color = '';
    picker.remove();
  });
  picker.appendChild(closeBtn);

  card.appendChild(picker);

  setTimeout(() => {
    const outsideClick = (e: MouseEvent) => {
      if (!picker.contains(e.target as Node)) {
        picker.remove();
        document.removeEventListener('click', outsideClick);
      }
    };
    document.addEventListener('click', outsideClick);
  }, 0);
}

// ===== 保存为 Markdown 文件 =====

async function saveAsNote(app: App, memo: MemoCard) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const title = memo.title || 'Untitled Memo';
    const safeName = title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
    const fileName = `Memos/${today}-${safeName}.md`;
    const content = [
      '---',
      `created: ${today}`,
      memo.color ? `color: ${memo.color}` : '',
      '---',
      '',
      `# ${title}`,
      '',
      memo.body,
    ].filter(Boolean).join('\n');

    await app.vault.create(fileName, content);
    new Notice(`已保存为 ${fileName}`);
  } catch (e) {
    new Notice('保存失败: ' + (e as Error).message);
  }
}

// ===== 主面板渲染函数 =====

export function createMemoPanel(
  app: App,
  createPanel: (title: string, color: string, subtitle: string) => HTMLElement,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = div('ax-section-memo');
  let disposed = false;
  const disposers: Array<() => void> = [];

  const regEvent = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement, type: K, handler: (e: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, handler as EventListener);
    disposers.push(() => target.removeEventListener(type, handler as EventListener));
  };

  // 加载 memo 数据
  let memos: MemoCard[] = loadMemos();

  function save() {
    LocalStore.setMemoDraft(JSON.stringify(memos));
  }

  // ---- 工具栏 ----
  const toolbar = div('ax-memo-toolbar');
  const addBtn = div('ax-memo-add-btn');
  addBtn.textContent = '+ 新建 Memo';
  toolbar.appendChild(addBtn);
  const spacer = div('ax-memo-toolbar-spacer');
  toolbar.appendChild(spacer);
  const countEl = div('ax-memo-count');
  countEl.textContent = `${memos.length} 张`;
  toolbar.appendChild(countEl);
  section.appendChild(toolbar);

  // ---- 卡片容器 ----
  const cardsContainer = div('ax-memo-cards');
  section.appendChild(cardsContainer);

  // ---- 渲染所有卡片 ----

  function renderCards() {
    cardsContainer.empty();
    countEl.textContent = `${memos.length} 张`;

    if (memos.length === 0) {
      const empty = div('ax-memo-empty');
      empty.textContent = '点击 "+ 新建 Memo" 开始记录';
      cardsContainer.appendChild(empty);
      return;
    }

    for (const memo of memos) {
      const { element } = createMemoCard(app, memo, {
        onUpdate: () => save(),
        onDelete: (m) => {
          memos = memos.filter(item => item.id !== m.id);
          save();
          renderCards();
        },
      });
      cardsContainer.appendChild(element);
    }
  }

  // ---- 新建 Memo ----
  regEvent(addBtn, 'click', () => {
    const newMemo: MemoCard = {
      id: generateId(),
      title: '',
      body: '',
      color: '',
      createdAt: Date.now(),
    };
    memos.unshift(newMemo);
    save();
    renderCards();
    const firstTitle = cardsContainer.querySelector('.ax-memo-card-title') as HTMLInputElement;
    if (firstTitle) firstTitle.focus();
  });

  // ---- 初始渲染 ----
  renderCards();

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

// ===== 本地存储 =====

function loadMemos(): MemoCard[] {
  try {
    const raw = LocalStore.getMemoDraft();
    if (raw && raw.startsWith('[')) {
      return JSON.parse(raw) as MemoCard[];
    }
  } catch { /* ignore */ }
  return [];
}
