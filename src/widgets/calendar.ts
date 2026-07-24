/**
 * widgets/calendar.ts — 任务日历面板
 *
 * 功能：月视图、周视图、Vault 任务扫描、日期导航
 * 简化版：不依赖 alltasks-scan，直接扫描 .md 文件中的 checkbox
 */

import { App, TFile, Notice } from 'obsidian';
import { div, esc } from '../utils/dom';
import type { WidgetHandle } from '../types';

export interface CalendarTask {
  text: string;
  checked: boolean;
  file: TFile;
  line: number;
  date: string; // ISO date YYYY-MM-DD
}

// ===== Vault 任务扫描 =====

async function scanVaultTasks(app: App, excludeFolders: string[] = []): Promise<CalendarTask[]> {
  const tasks: CalendarTask[] = [];
  const files = app.vault.getMarkdownFiles();

  for (const file of files) {
    if (file.path.startsWith('.')) continue;
    const lp = file.path.toLowerCase();
    if (excludeFolders.some(f => lp.startsWith(f.toLowerCase() + '/'))) continue;

    try {
      const content = await app.vault.cachedRead(file);
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^[\s]*- \[([ xX])\]\s+(.+)/);
        if (!match) continue;
        const checked = match[1] !== ' ';
        const text = match[2].trim();

        // 提取日期：查找 YYYY-MM-DD 格式
        const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          tasks.push({
            text: text.replace(/\d{4}-\d{2}-\d{2}/, '').trim() || text,
            checked,
            file,
            line: i,
            date: dateMatch[1],
          });
        }
      }
    } catch {
      // 跳过无法读取的文件
    }
  }
  return tasks;
}

// ===== 日期工具 =====

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): Date {
  const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() + offset);
  return m;
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

// ===== 主渲染函数 =====

export function createCalendarPanel(
  app: App,
  createPanel: (title: string, color: string, subtitle: string) => HTMLElement,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = div('ax-section-cal');
  let disposed = false;
  const disposers: Array<() => void> = [];

  const regEvent = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement, type: K, handler: (e: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, handler as EventListener);
    disposers.push(() => target.removeEventListener(type, handler as EventListener));
  };

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let view: 'month' | 'week' = 'month';
  let weekStart = mondayOf(now);
  let allTasks: CalendarTask[] = [];
  let byDay = new Map<string, CalendarTask[]>();

  // ---- 导航栏 ----
  const nav = div('ax-cal-nav');

  const prevBtn = div('ax-cal-nav-btn');
  prevBtn.textContent = '‹';
  prevBtn.title = '上一个';
  nav.appendChild(prevBtn);

  const labelEl = div('ax-cal-nav-label');
  nav.appendChild(labelEl);

  const nextBtn = div('ax-cal-nav-btn');
  nextBtn.textContent = '›';
  nextBtn.title = '下一个';
  nav.appendChild(nextBtn);

  // 视图切换
  const viewToggle = div('ax-cal-view-toggle');
  const monthBtn = div('ax-cal-view-btn active');
  monthBtn.textContent = '月';
  monthBtn.dataset.view = 'month';
  viewToggle.appendChild(monthBtn);
  const weekBtn = div('ax-cal-view-btn');
  weekBtn.textContent = '周';
  weekBtn.dataset.view = 'week';
  viewToggle.appendChild(weekBtn);
  nav.appendChild(viewToggle);

  const spacer = div('ax-cal-nav-spacer');
  nav.appendChild(spacer);

  const todayBtn = div('ax-cal-today-btn');
  todayBtn.textContent = '今天';
  nav.appendChild(todayBtn);

  section.appendChild(nav);

  // ---- 内容区 ----
  const gridHost = div('ax-cal-host');
  section.appendChild(gridHost);

  // ---- 日程弹窗 ----
  let agendaPopup: HTMLElement | null = null;

  function closeAgenda() {
    if (agendaPopup) { agendaPopup.remove(); agendaPopup = null; }
  }

  function showDayAgenda(iso: string, tasks: CalendarTask[]) {
    closeAgenda();
    agendaPopup = div('ax-cal-agenda');
    agendaPopup.createDiv({ cls: 'ax-cal-agenda-title', text: iso });

    if (tasks.length === 0) {
      agendaPopup.createDiv({ cls: 'ax-cal-agenda-empty', text: '当天无任务' });
    } else {
      for (const task of tasks) {
        const row = div('ax-cal-agenda-task' + (task.checked ? ' is-done' : ''));
        const check = row.createEl('input', { type: 'checkbox' });
        check.checked = task.checked;
        regEvent(check, 'change', async () => {
          await toggleTask(app, task, !task.checked);
          task.checked = !task.checked;
          row.toggleClass('is-done', task.checked);
        });
        row.createSpan({ cls: 'ax-cal-agenda-task-text', text: task.text });
        row.createSpan({ cls: 'ax-cal-agenda-task-file', text: task.file.basename });
        agendaPopup.appendChild(row);
      }
    }

    const closeBtn = div('ax-cal-agenda-close');
    closeBtn.textContent = '×';
    regEvent(closeBtn, 'click', closeAgenda);
    agendaPopup.appendChild(closeBtn);

    gridHost.appendChild(agendaPopup);

    // 点击外部关闭
    setTimeout(() => {
      const outsideClick = (e: MouseEvent) => {
        if (agendaPopup && !agendaPopup.contains(e.target as Node)) {
          closeAgenda();
          document.removeEventListener('click', outsideClick);
        }
      };
      document.addEventListener('click', outsideClick);
      disposers.push(() => document.removeEventListener('click', outsideClick));
    }, 0);
  }

  // ---- 切换任务状态 ----

  async function toggleTask(app: App, task: CalendarTask, nextChecked: boolean): Promise<void> {
    try {
      const content = await app.vault.read(task.file);
      const lines = content.split('\n');
      if (task.line < lines.length) {
        lines[task.line] = lines[task.line].replace(
          nextChecked ? /^(\s*- \[) \]/ : /^(\s*- \[)x\]/i,
          '$1' + (nextChecked ? 'x' : ' '),
        );
        await app.vault.modify(task.file, lines.join('\n'));
        // 刷新数据
        await refreshTasks();
      }
    } catch {
      new Notice('切换任务状态失败');
    }
  }

  // ---- 刷新任务数据 ----

  async function refreshTasks() {
    allTasks = await scanVaultTasks(app);
    byDay = new Map<string, CalendarTask[]>();
    for (const task of allTasks) {
      const existing = byDay.get(task.date) ?? [];
      existing.push(task);
      byDay.set(task.date, existing);
    }
  }

  // ---- 月视图 ----

  function renderMonthGrid() {
    gridHost.empty();
    const todayIso = toIsoDate(new Date());
    const firstOfMonth = new Date(year, month, 1);
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - leading);

    labelEl.textContent = `${MONTH_NAMES[month]} ${year}`;

    const wrap = div('ax-cal-grid');

    // 星期头
    const head = div('ax-cal-weekdays');
    for (const label of WEEKDAY_NAMES) {
      head.createDiv({ cls: 'ax-cal-weekday', text: label });
    }
    wrap.appendChild(head);

    // 日期网格
    const body = div('ax-cal-body');
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const iso = toIsoDate(d);
      const inMonth = d.getMonth() === month;
      const isToday = iso === todayIso;
      const dayTasks = byDay.get(iso) ?? [];

      const cell = div('ax-cal-cell'
        + (inMonth ? '' : ' is-outside')
        + (isToday ? ' is-today' : '')
        + (dayTasks.length > 0 ? ' has-tasks' : ''));

      cell.createDiv({ cls: 'ax-cal-cell-num', text: String(d.getDate()) });

      const list = div('ax-cal-cell-list');
      const maxShow = 3;
      for (const task of dayTasks.slice(0, maxShow)) {
        const chip = div('ax-cal-chip' + (task.checked ? ' is-done' : ''));
        chip.textContent = task.text.slice(0, 20);
        chip.title = task.text;
        list.appendChild(chip);
      }
      if (dayTasks.length > maxShow) {
        list.createDiv({ cls: 'ax-cal-more', text: `+${dayTasks.length - maxShow}` });
      }
      cell.appendChild(list);

      regEvent(cell, 'click', () => showDayAgenda(iso, dayTasks));
      body.appendChild(cell);
    }
    wrap.appendChild(body);
    gridHost.appendChild(wrap);
  }

  // ---- 周视图 ----

  function renderWeekGrid() {
    gridHost.empty();
    const todayIso = toIsoDate(new Date());

    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    labelEl.textContent = `${weekStart.getMonth() + 1}/${weekStart.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;

    const wrap = div('ax-cal-week');

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = toIsoDate(d);
      const isToday = iso === todayIso;
      const dayTasks = (byDay.get(iso) ?? []).slice().sort((a, b) => a.checked === b.checked ? 0 : a.checked ? 1 : -1);

      const dayRow = div('ax-cal-week-row' + (isToday ? ' is-today' : ''));
      const head = div('ax-cal-week-row-head');
      head.createDiv({ cls: 'ax-cal-week-row-name', text: WEEKDAY_NAMES[i] });
      head.createDiv({ cls: 'ax-cal-week-row-date', text: `${d.getMonth() + 1}/${d.getDate()}` });
      if (dayTasks.length > 0) {
        head.createDiv({ cls: 'ax-cal-week-row-count', text: String(dayTasks.length) });
      }
      regEvent(head, 'click', () => showDayAgenda(iso, dayTasks));
      dayRow.appendChild(head);

      const list = div('ax-cal-week-row-list');
      const maxShow = 6;
      for (const task of dayTasks.slice(0, maxShow)) {
        const row = div('ax-cal-week-task' + (task.checked ? ' is-done' : ''));
        const check = row.createEl('input', { type: 'checkbox' });
        check.checked = task.checked;
        regEvent(check, 'change', async (e) => {
          e.stopPropagation();
          await toggleTask(app, task, !task.checked);
          render();
        });
        row.createSpan({ cls: 'ax-cal-week-task-text', text: task.text });
        list.appendChild(row);
      }
      if (dayTasks.length > maxShow) {
        list.createDiv({ cls: 'ax-cal-more', text: `+${dayTasks.length - maxShow}` });
      }
      dayRow.appendChild(list);
      wrap.appendChild(dayRow);
    }

    gridHost.appendChild(wrap);
  }

  // ---- 统一渲染入口 ----

  async function render() {
    closeAgenda();
    if (allTasks.length === 0) await refreshTasks();
    if (view === 'month') renderMonthGrid();
    else renderWeekGrid();
  }

  // ---- 导航 ----

  function shift(delta: number) {
    if (view === 'week') {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + delta * 7);
      weekStart = d;
    } else {
      let m = month + delta;
      let y = year;
      while (m < 0) { m += 12; y -= 1; }
      while (m > 11) { m -= 12; y += 1; }
      month = m;
      year = y;
    }
    render();
  }

  function resetToToday() {
    const t0 = new Date();
    year = t0.getFullYear();
    month = t0.getMonth();
    weekStart = mondayOf(t0);
  }

  // ---- 事件绑定 ----
  regEvent(prevBtn, 'click', () => shift(-1));
  regEvent(nextBtn, 'click', () => shift(1));
  regEvent(todayBtn, 'click', () => { resetToToday(); render(); });
  regEvent(monthBtn, 'click', () => {
    if (view === 'month') return;
    view = 'month';
    monthBtn.addClass('active');
    weekBtn.removeClass('active');
    render();
  });
  regEvent(weekBtn, 'click', () => {
    if (view === 'week') return;
    view = 'week';
    weekBtn.addClass('active');
    monthBtn.removeClass('active');
    weekStart = mondayOf(new Date());
    render();
  });

  // 初始渲染
  render();

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
