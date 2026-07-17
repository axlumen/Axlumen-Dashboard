/**
 * widgets/todos.ts — 待办清单模块（v1.4 重构 + Disposable）
 * 合并手动待办（JSON 文件）+ Daily Note 解析任务
 */

import { App, TFile } from 'obsidian';
import { TodoItem } from '../types';
import { ParsedTask } from '../services/taskParser';
import { el, div } from '../utils/dom';
import { TODOS_FILE_PATH, TODOS_FILE_PATH_LEGACY, TODOS_DIR } from '../constants';
import { type WidgetHandle, createRootedDisposable } from '../types';
import { atomicWrite, safeRead } from '../utils/atomicWrite';
import { getWriteLock } from '../utils/WriteLock';

/** 写入锁：防止并发操作丢失数据 */
let busy = false;

/** 任务三态 */
type TaskState = 'todo' | 'doing' | 'done';

/** 统一的内部任务视图 */
interface UnifiedTask {
  id: string;
  text: string;
  state: TaskState;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  source: 'manual' | 'parsed';
  sourcePath?: string;
  hasLink?: boolean;
}

type Cleaner = () => void;

/**
 * 返回值改为 { section, handle }。
 * view.ts 将 handle 加入 CompositeDisposable，onClose 时统一 dispose。
 */
export async function createTodosPanel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): Promise<{ section: HTMLElement; handle: WidgetHandle }> {
  const cleaners: Cleaner[] = [];
  const timers: Set<number> = new Set();
  const section = createSection('今日待办', '#FBBF24', '');

  const registerCleanup = (fn: Cleaner) => { cleaners.push(fn); };
  /**
   * 追踪 setTimeout：返回 timerId，并在触发后自动从集合移除。
   * 不劫持全局 setTimeout，避免副作用扩散。
   */
  const safeTimeout = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  // 加载两类任务
  const manualTodos = await loadTodos(app);
  const parsedTasks = await loadParsedTasks(app);

  // 统一视图
  const unify = unifyTasks(manualTodos, parsedTasks);

  // 进度条
  const progress = div('ax-todo-progress');
  updateProgressHTML(progress, unify);
  section.appendChild(progress);

  // 输入框（使用一次性追踪 addEventListener）
  const inputRow = div('ax-todo-input-row');
  const input = el('input', {
    type: 'text',
    placeholder: '添加新任务...',
    class: 'ax-todo-input',
    id: 'ax-todo-input',
  }) as HTMLInputElement;
  const addBtn = el('button', { class: 'ax-todo-add', id: 'ax-todo-add' }, '+');
  const onAddClick = () => addTodo(app, input, section);
  const onInputKey = (e: KeyboardEvent) => { if (e.key === 'Enter') addTodo(app, input, section); };
  addBtn.addEventListener('click', onAddClick);
  input.addEventListener('keydown', onInputKey);
  registerCleanup(() => addBtn.removeEventListener('click', onAddClick));
  registerCleanup(() => input.removeEventListener('keydown', onInputKey));
  inputRow.appendChild(input);
  inputRow.appendChild(addBtn);
  section.appendChild(inputRow);

  // 列表
  const list = div('ax-todo-list', '');
  list.id = 'ax-todo-list';
  section.appendChild(list);

  renderTodoList(app, list, unify, progress, { registerCleanup, safeTimeout });

  // 构建 handle：统一清理 listeners + timers
  const handle = createRootedDisposable([section], () => {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    for (const fn of cleaners) {
      try { fn(); } catch { /* ignore */ }
    }
    section.empty();
  });

  return { section, handle };
}

// ==================== 数据加载 ====================

/**
 * 一次性迁移：旧路径 → 新路径
 * 将 .axlumen-todos.json 迁移到 _axlumen/todos.json（YAML frontmatter 格式）
 */
async function migrateTodosIfNeeded(app: App): Promise<void> {
  // 检查新路径是否已有文件
  const newFile = app.vault.getAbstractFileByPath(TODOS_FILE_PATH);
  if (newFile instanceof TFile) return; // 已迁移

  // 检查旧路径是否有文件
  const legacyFile = app.vault.getAbstractFileByPath(TODOS_FILE_PATH_LEGACY);
  if (!(legacyFile instanceof TFile)) return; // 没有旧文件

  try {
    const raw = await app.vault.read(legacyFile);
    const todos: TodoItem[] = JSON.parse(raw);

    // 写入新路径（YAML frontmatter 格式）
    const content = formatTodosYaml(todos);
    await atomicWrite(app.vault, TODOS_FILE_PATH, content);

    // 删除旧文件
    await app.vault.delete(legacyFile);

    console.log(`[Todos] Migrated ${todos.length} todos from legacy path`);
  } catch (e) {
    console.error('[Todos] Migration failed:', e);
  }
}

/**
 * 格式化为 YAML frontmatter + JSON body
 *
 * 格式：
 * ---
 * version: 1
 * count: 3
 * ---
 * [
 *   { "id": "...", "text": "...", ... },
 *   ...
 * ]
 */
function formatTodosYaml(todos: TodoItem[]): string {
  const frontmatter = [
    '---',
    'version: 1',
    `count: ${todos.length}`,
    '---',
    '',
  ].join('\n');

  return frontmatter + JSON.stringify(todos, null, 2);
}

/**
 * 解析 YAML frontmatter + JSON body
 * 兼容旧格式（纯 JSON）和新格式（YAML frontmatter + JSON）
 */
function parseTodosContent(raw: string): TodoItem[] {
  // 检查是否有 YAML frontmatter
  if (raw.startsWith('---')) {
    const parts = raw.split('---');
    if (parts.length >= 3) {
      // 跳过 frontmatter（parts[1]），解析 body（parts[2]）
      const body = parts.slice(2).join('---').trim();
      if (body) {
        return JSON.parse(body);
      }
    }
  }

  // 旧格式：纯 JSON
  return JSON.parse(raw);
}

async function loadTodos(app: App): Promise<TodoItem[]> {
  try {
    // 启动时执行迁移
    await migrateTodosIfNeeded(app);

    const file = app.vault.getAbstractFileByPath(TODOS_FILE_PATH);
    if (file instanceof TFile) {
      const data = await app.vault.read(file);
      return parseTodosContent(data);
    }
    return [];
  } catch {
    return [];
  }
}

async function saveTodos(app: App, todos: TodoItem[]) {
  const lock = getWriteLock('todos');
  await lock.acquire(async () => {
    try {
      const content = formatTodosYaml(todos);
      const existing = app.vault.getAbstractFileByPath(TODOS_FILE_PATH);
      if (existing instanceof TFile) {
        await app.vault.modify(existing, content);
      } else {
        // 确保 _axlumen 目录存在
        const dir = app.vault.getAbstractFileByPath(TODOS_DIR);
        if (!dir) {
          await app.vault.createFolder(TODOS_DIR);
        }
        await app.vault.create(TODOS_FILE_PATH, content);
      }
    } catch (e) {
      console.error('保存待办失败:', e);
    }
  });
}

async function loadParsedTasks(app: App): Promise<ParsedTask[]> {
  try {
    const { parseTasksFromDailyNotes } = await import('../services/taskParser');
    return await parseTasksFromDailyNotes(app);
  } catch {
    return [];
  }
}

// ==================== 统一视图 ====================

function unifyTasks(manual: TodoItem[], parsed: ParsedTask[]): UnifiedTask[] {
  const result: UnifiedTask[] = [];

  for (const m of manual) {
    result.push({
      id: m.id,
      text: m.text,
      state: m.state || (m.done ? 'done' : 'todo'),
      priority: 'medium',
      dueDate: new Date(m.createdAt).toISOString().slice(0, 10),
      source: 'manual',
    });
  }

  for (const p of parsed) {
    const hasLink = /\[\[.*?\]\]/.test(p.text);
    result.push({
      id: `parsed_${p.source}_${p.text.slice(0, 20)}`,
      text: p.text,
      state: p.done ? 'done' : 'todo',
      priority: p.priority,
      dueDate: p.dueDate,
      source: 'parsed',
      sourcePath: p.source,
      hasLink,
    });
  }

  return result;
}

// ==================== 渲染 ====================

function updateProgressHTML(progress: HTMLElement, tasks: UnifiedTask[]) {
  const doneCount = tasks.filter(t => t.state === 'done').length;
  const pct = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
  progress.innerHTML = `
    <div class="ax-todo-stats ax-task-progress-bar">
      <span id="ax-todo-count">${doneCount} done / ${tasks.length} total</span>
      <span id="ax-todo-pct">${pct}%</span>
    </div>
    <div class="ax-bar"><i id="ax-todo-bar" data-width="${pct}%"></i></div>
  `;
}

/** 循环切换 todo → doing → done */
function nextState(current: TaskState): TaskState {
  if (current === 'todo') return 'doing';
  if (current === 'doing') return 'done';
  return 'todo';
}

/** 复选框样式 class */
function checkClass(state: TaskState): string {
  if (state === 'done') return 'ax-task-check ax-check-done';
  if (state === 'doing') return 'ax-task-check ax-check-doing';
  return 'ax-task-check';
}

interface RenderHooks {
  registerCleanup: (fn: Cleaner) => void;
  safeTimeout: (fn: () => void, ms: number) => number;
}

function renderTodoList(
  app: App,
  listEl: HTMLElement,
  tasks: UnifiedTask[],
  progressEl: HTMLElement,
  hooks: RenderHooks,
) {
  listEl.empty();

  tasks.forEach((task, i) => {
    const item = div(`ax-task ${task.state === 'done' ? 'ax-task-done' : ''} ${task.state === 'doing' ? 'ax-task-doing' : ''}`);
    item.setAttribute('draggable', 'true');
    item.dataset.index = String(i);

    // 三态复选框
    const check = el('span', { class: checkClass(task.state) });
    if (task.state === 'done') check.textContent = '✓';
    const onCheckClick = async (e: MouseEvent) => {
      e.stopPropagation();
      await cycleTaskState(app, tasks, i, listEl, progressEl);
    };
    check.addEventListener('click', onCheckClick);
    hooks.registerCleanup(() => check.removeEventListener('click', onCheckClick));

    // 任务文本
    const text = el('span', { class: 'ax-task-text' }, task.text);

    // 右侧 meta
    const meta = div('ax-task-meta');

    // 优先级标签
    const prio = el('span', { class: `ax-priority ax-priority-${task.priority}` }, task.priority);
    meta.appendChild(prio);

    // Wikilink 指示
    if (task.hasLink) {
      const link = el('span', { class: 'ax-task-link', title: '关联笔记' }, '🔗');
      const onLinkClick = (e: MouseEvent) => {
        e.stopPropagation();
        const match = task.text.match(/\[\[(.+?)\]\]/);
        if (match) app.workspace.openLinkText(match[1], '', 'tab');
      };
      link.addEventListener('click', onLinkClick);
      hooks.registerCleanup(() => link.removeEventListener('click', onLinkClick));
      meta.appendChild(link);
    }

    // 来源标签
    if (task.source === 'parsed') {
      const tag = el('span', { class: 'ax-todo-source' }, '📅');
      tag.title = `来自: ${task.sourcePath}`;
      meta.appendChild(tag);
    }

    // 日期
    if (task.dueDate) {
      const today = new Date().toISOString().slice(0, 10);
      const isOverdue = task.dueDate < today && task.state !== 'done';
      const dateTag = el('span', {
        class: `ax-todo-date ${isOverdue ? 'ax-todo-overdue' : ''}`,
      }, task.dueDate.slice(5));
      meta.appendChild(dateTag);
    }

    item.appendChild(check);
    item.appendChild(text);
    item.appendChild(meta);

    // 整行点击：循环切换状态
    const onItemClick = async () => {
      await cycleTaskState(app, tasks, i, listEl, progressEl);
    };
    item.addEventListener('click', onItemClick);
    hooks.registerCleanup(() => item.removeEventListener('click', onItemClick));

    // 拖拽重排
    setupDragReorder(item, tasks, i, app, listEl, progressEl, hooks);

    listEl.appendChild(item);
  });

  if (tasks.length === 0) {
    listEl.appendChild(el('div', { class: 'ax-empty' }, '暂无任务'));
  }
}

async function cycleTaskState(
  app: App,
  tasks: UnifiedTask[],
  index: number,
  listEl: HTMLElement,
  progressEl: HTMLElement,
) {
  if (busy) return;
  busy = true;
  try {
    const task = tasks[index];
    if (task.source === 'manual') {
      const manual = await loadTodos(app);
      const target = manual.find(m => m.id === task.id);
      if (target) {
        target.state = nextState(task.state);
        target.done = target.state === 'done';
      }
      await saveTodos(app, manual);
    }
    tasks[index].state = nextState(tasks[index].state);
    renderTodoList(app, listEl, tasks, progressEl, { registerCleanup: () => {}, safeTimeout: window.setTimeout.bind(window) });
    updateTodoProgress(progressEl, tasks);
  } finally {
    busy = false;
  }
}

function setupDragReorder(
  item: HTMLElement,
  tasks: UnifiedTask[],
  index: number,
  app: App,
  listEl: HTMLElement,
  progressEl: HTMLElement,
  hooks: RenderHooks,
) {
  const onDragStart = (e: DragEvent) => {
    item.addClass('ax-task-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  };
  const onDragEnd = () => {
    item.removeClass('ax-task-dragging');
    listEl.querySelectorAll('.ax-task-drag-over').forEach(el => el.removeClass('ax-task-drag-over'));
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    item.addClass('ax-task-drag-over');
  };
  const onDragLeave = () => {
    item.removeClass('ax-task-drag-over');
  };
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    item.removeClass('ax-task-drag-over');
    const fromIdx = parseInt(e.dataTransfer?.getData('text/plain') || '-1', 10);
    if (fromIdx < 0 || fromIdx === index) return;
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(index, 0, moved);
    renderTodoList(app, listEl, tasks, progressEl, { registerCleanup: () => {}, safeTimeout: window.setTimeout.bind(window) });
    updateTodoProgress(progressEl, tasks);
  };

  item.addEventListener('dragstart', onDragStart);
  item.addEventListener('dragend', onDragEnd);
  item.addEventListener('dragover', onDragOver);
  item.addEventListener('dragleave', onDragLeave);
  item.addEventListener('drop', onDrop);

  hooks.registerCleanup(() => {
    item.removeEventListener('dragstart', onDragStart);
    item.removeEventListener('dragend', onDragEnd);
    item.removeEventListener('dragover', onDragOver);
    item.removeEventListener('dragleave', onDragLeave);
    item.removeEventListener('drop', onDrop);
  });
}

function updateTodoProgress(progressEl: HTMLElement, tasks: UnifiedTask[]) {
  const done = tasks.filter(t => t.state === 'done').length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const countEl = progressEl.querySelector('#ax-todo-count');
  const pctEl = progressEl.querySelector('#ax-todo-pct');
  const barEl = progressEl.querySelector('#ax-todo-bar') as HTMLElement;
  if (countEl) countEl.textContent = `${done} done / ${tasks.length} total`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${pct}%`;
}

async function addTodo(app: App, input: HTMLInputElement, section: HTMLElement) {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true;
  try {
    const todos = await loadTodos(app);
    todos.push({ id: Date.now().toString(), text, tag: '', done: false, state: 'todo', createdAt: Date.now() });
    await saveTodos(app, todos);
    input.value = '';
    const listEl = section.querySelector('#ax-todo-list') as HTMLElement;
    const progressEl = section.querySelector('.ax-todo-progress') as HTMLElement;
    if (listEl && progressEl) {
      const parsed = await loadParsedTasks(app);
      const unified = unifyTasks(todos, parsed);
      renderTodoList(app, listEl, unified, progressEl, { registerCleanup: () => {}, safeTimeout: window.setTimeout.bind(window) });
      updateProgressHTML(progressEl, unified);
    }
  } finally {
    busy = false;
  }
}
