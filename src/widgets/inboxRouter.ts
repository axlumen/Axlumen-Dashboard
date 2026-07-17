/**
 * widgets/inboxRouter.ts — Inbox 智能路由面板（+ Disposable handle）
 */

import { App } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { InboxFileItem } from '../services/VaultScanner';
import { type WidgetHandle, createRootedDisposable } from '../types';

export interface InboxRouterCallbacks {
  onRouteSingle?: (item: InboxFileItem) => void;
  onRouteAll?: (items: InboxFileItem[]) => void;
}

/** 返回 { section, handle } */
export function createInboxRouterPanel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
  openPath: (path: string) => void,
  items: InboxFileItem[],
  callbacks?: InboxRouterCallbacks,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('Inbox Intelligent Router', '#8B5CF6', '');
  section.style.setProperty('--ax-accent', '#8B5CF6');
  section.addClass('ax-ir-section');

  const cleaners: Array<() => void> = [];
  const timeouts: Set<number> = new Set();

  const safeTimeout = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms);
    timeouts.add(id);
    return id;
  };
  const registerCleanup = (fn: () => void) => { cleaners.push(fn); };

  // 顶部批量操作栏
  const toolbar = div('ax-ir-toolbar');
  const countBadge = div('ax-ir-count', String(items.length) + ' unprocessed items');
  toolbar.appendChild(countBadge);

  if (items.length > 0) {
    const routeAllBtn = el('button', { class: 'ax-btn ax-btn-primary ax-btn-sm', type: 'button' }, '📥 Route All Batch');
    const onRouteAllClick = () => {
      routeAllBtn.disabled = true;
      routeAllBtn.textContent = '路由中...';
      if (callbacks?.onRouteAll) {
        callbacks.onRouteAll(items);
      }
      safeTimeout(() => {
        routeAllBtn.disabled = false;
        routeAllBtn.textContent = '📥 Route All Batch';
      }, 2000);
    };
    routeAllBtn.addEventListener('click', onRouteAllClick);
    registerCleanup(() => routeAllBtn.removeEventListener('click', onRouteAllClick));
    toolbar.appendChild(routeAllBtn);
  }
  section.appendChild(toolbar);

  // 列表容器
  const list = div('ax-ir-list');

  if (items.length === 0) {
    const empty = div('ax-ir-empty', 'Inbox is clear, no pending files ✨');
    list.appendChild(empty);
  } else {
    items.forEach(item => {
      const row = div('ax-ir-item');

      const left = div('ax-ir-left');
      const title = el('a', { href: '#', class: 'ax-ir-title', 'data-path': item.path }, item.title);
      const onTitleClick = (e: MouseEvent) => { e.preventDefault(); openPath(item.path); };
      title.addEventListener('click', onTitleClick);
      registerCleanup(() => title.removeEventListener('click', onTitleClick));
      left.appendChild(title);

      const aging = div('ax-ir-aging ' + getAgingClass(item.daysOld));
      aging.textContent = item.daysOld + 'd';
      left.appendChild(aging);

      row.appendChild(left);

      const right = div('ax-ir-right');
      const routeBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, 'Auto-Route');
      const onRouteClick = () => {
        routeBtn.disabled = true;
        routeBtn.textContent = '⏳ Routing...';
        if (callbacks?.onRouteSingle) {
          callbacks.onRouteSingle(item);
        }
        safeTimeout(() => { routeBtn.textContent = '✅ Done'; }, 1500);
      };
      routeBtn.addEventListener('click', onRouteClick);
      registerCleanup(() => routeBtn.removeEventListener('click', onRouteClick));
      right.appendChild(routeBtn);
      row.appendChild(right);

      const onRowClick = (e: MouseEvent) => {
        if (e.target === routeBtn) return;
        openPath(item.path);
      };
      row.addEventListener('click', onRowClick);
      registerCleanup(() => row.removeEventListener('click', onRowClick));

      list.appendChild(row);
    });
  }

  section.appendChild(list);

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

/** 老化级别 */
function getAgingClass(days: number): string {
  if (days >= 7) return 'ax-ir-aging--danger';
  if (days >= 3) return 'ax-ir-aging--warn';
  return 'ax-ir-aging--ok';
}
