/**
 * widgets/weekCalendar.ts — Week Calendar 侧栏小部件（+ Disposable handle）
 */

import { App } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { type WidgetHandle, createRootedDisposable } from '../types';

/** 获取当天偏移天数（目标日期 - 今天）的 YYYY-MM-DD */
function dayOffsetDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** 统计指定日期的笔记修改数量 */
function countNotesForDate(app: App, dateStr: string): number {
  try {
    const files = app.vault.getMarkdownFiles();
    return files.filter(f => {
      const m = new Date(f.stat.mtime);
      return m.toISOString().slice(0, 10) === dateStr;
    }).length;
  } catch {
    return 0;
  }
}

/** 笔记数密度等级：0=无, 1=少(1-2), 2=中(3-5), 3=多(6+) */
function densityLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}

/** 尝试打开指定日期的 Daily Note */
function openDailyNote(app: App, offset: number) {
  const dateStr = dayOffsetDate(offset);
  const candidates = [
    `${dateStr}.md`,
    `daily/${dateStr}.md`,
    `Daily/${dateStr}.md`,
    `日记/${dateStr}.md`,
  ];
  for (const path of candidates) {
    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      app.workspace.openLinkText(path, '', 'tab');
      return;
    }
  }
  const today = new Date();
  const label = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  app.workspace.openLinkText(`${dateStr} ${label}`, '', 'tab').catch(() => {});
}

/** 返回 { section, handle } */
export function createWeekCalendarWidget(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('本周', '#22D3EE', '');
  section.style.setProperty('--ax-accent', '#22D3EE');

  const cleaners: Array<() => void> = [];
  const registerCleanup = (fn: () => void) => { cleaners.push(fn); };

  const grid = div('ax-wc-grid');
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const today = new Date();
  const todayDow = today.getDay();
  const mondayOffset = -(todayDow === 0 ? 6 : todayDow - 1);

  for (let i = 0; i < 7; i++) {
    const offset = mondayOffset + i;
    const dateStr = dayOffsetDate(offset);
    const noteCount = countNotesForDate(app, dateStr);
    const level = densityLevel(noteCount);
    const isToday = offset === 0;

    const cell = div('ax-wc-cell');
    if (isToday) cell.addClass('ax-wc-today');

    const dayLabel = el('span', { class: 'ax-wc-day-label' }, weekDays[i]);
    cell.appendChild(dayLabel);

    const dateNum = el('span', { class: 'ax-wc-date-num' }, String(new Date(dateStr).getDate()));
    cell.appendChild(dateNum);

    const dots = div('ax-wc-dots');
    if (level === 1) {
      dots.appendChild(div('ax-wc-dot ax-wc-dot-1'));
    } else if (level === 2) {
      for (let n = 0; n < 2; n++) dots.appendChild(div('ax-wc-dot ax-wc-dot-2'));
    } else if (level >= 3) {
      for (let n = 0; n < 3; n++) dots.appendChild(div('ax-wc-dot ax-wc-dot-3'));
    } else {
      dots.appendChild(div('ax-wc-dot ax-wc-dot-empty'));
    }
    cell.appendChild(dots);

    cell.title = `${dateStr} · ${noteCount} 篇笔记`;

    const onCellClick = () => openDailyNote(app, offset);
    cell.addEventListener('click', onCellClick);
    registerCleanup(() => cell.removeEventListener('click', onCellClick));

    grid.appendChild(cell);
  }

  section.appendChild(grid);

  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners) {
      try { fn(); } catch { /* ignore */ }
    }
    section.empty();
  });

  return { section, handle };
}
