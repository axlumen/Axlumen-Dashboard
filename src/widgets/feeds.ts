/**
 * widgets/feeds.ts — 多源信息流模块（+ Disposable handle）
 */

import { App } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { LocalStore } from '../utils/LocalStore';
import { type WidgetHandle, createRootedDisposable } from '../types';
import {
  type ServiceResult, type ServiceError, ok, err, renderErrorState,
} from '../utils/ServiceResult';

type FeedSource = 'github' | 'rss';
type FeedTab = 'all' | FeedSource;

interface FeedItem {
  source: FeedSource;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  meta: string;
  time: string;
  url?: string;
}

function mockGitHubFeed(): FeedItem[] {
  return [
    { source: 'github', icon: '⭐', iconColor: '#FBBF24', title: 'anthropics/claude-code', description: 'AI-powered coding assistant for the terminal', meta: '▴ 12.4k', time: '2h ago' },
    { source: 'github', icon: '⭐', iconColor: '#FBBF24', title: 'obsidianmd/obsidian-api', description: 'Type definitions for the Obsidian API', meta: '▴ 3.2k', time: '5h ago' },
    { source: 'github', icon: '⭐', iconColor: '#FBBF24', title: 'koekeishiya/yabai', description: 'A tiling window manager for macOS', meta: '▴ 8.7k', time: '8h ago' },
    { source: 'github', icon: '⭐', iconColor: '#FBBF24', title: 'sindresorhus/awesome', description: 'Awesome lists about all kinds of interesting topics', meta: '▴ 42.1k', time: '1d ago' },
  ];
}

function mockRssFeed(): FeedItem[] {
  return [
    { source: 'rss', icon: '📡', iconColor: '#22D3EE', title: 'Building a Second Brain — A Practical Framework', description: 'Forte Labs', meta: 'RSS', time: '1h ago' },
    { source: 'rss', icon: '📡', iconColor: '#22D3EE', title: 'AI agents that actually ship software', description: 'Latent Space', meta: 'RSS', time: '3h ago' },
    { source: 'rss', icon: '📡', iconColor: '#22D3EE', title: 'The Zettelkasten Method: How to take smart notes', description: 'Being Punctual', meta: 'RSS', time: '6h ago' },
    { source: 'rss', icon: '📡', iconColor: '#22D3EE', title: 'Deep Research: What agents do in 2026', description: 'Import AI', meta: 'RSS', time: '1d ago' },
  ];
}

function mergeFeeds(items: FeedItem[]): FeedItem[] {
  return items.sort((a, b) => {
    const parseTime = (t: string): number => {
      if (t.includes('刚刚')) return 0;
      if (t.includes('min')) return parseInt(t, 10);
      if (t.includes('h ago')) return parseInt(t, 10) * 60;
      if (t.includes('d ago')) return parseInt(t, 10) * 1440;
      return 9999;
    };
    return parseTime(a.time) - parseTime(b.time);
  });
}

function getLastRefreshTime(): string {
  return LocalStore.getFeedLastRefresh();
}

function saveRefreshTime(): void {
  const now = new Date();
  LocalStore.setFeedLastRefresh(
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
}

/** 获取指定 Tab 的 FeedItem 列表，返回 ServiceResult */
function fetchFeedItems(tab: FeedTab): ServiceResult<FeedItem[]> {
  try {
    let items: FeedItem[] = [];
    if (tab === 'all') {
      items = mergeFeeds([...mockGitHubFeed(), ...mockRssFeed()]);
    } else if (tab === 'github') {
      items = mockGitHubFeed();
    } else if (tab === 'rss') {
      items = mockRssFeed();
    }
    return ok(items);
  } catch (e) {
    return err('FEED_FETCH_FAILED', '获取信息流失败', true, e as Error);
  }
}

export type { FeedItem, FeedTab };

/** 返回 { section, handle } */
export function createFeedsPanel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('信息流', '#6366F1', '');
  section.style.setProperty('--ax-accent', '#6366F1');
  section.addClass('ax-feeds-section');

  const cleaners: Array<() => void> = [];
  const timeouts: Set<number> = new Set();

  const safeTimeout = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => { timeouts.delete(id); fn(); }, ms);
    timeouts.add(id);
    return id;
  };
  const registerCleanup = (fn: () => void) => { cleaners.push(fn); };

  // ---- Tab Bar ----
  const tabBar = div('ax-feed-tabs');
  const tabs: { id: FeedTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'github', label: 'GitHub' },
    { id: 'rss', label: 'RSS' },
  ];

  let activeTab: FeedTab = 'all';

  const tabMap = new Map<FeedTab, HTMLElement>();

  tabs.forEach(t => {
    const tab = el('button', {
      class: 'ax-feed-tab' + (t.id === activeTab ? ' ax-feed-tab--active' : ''),
      type: 'button',
      'data-tab': t.id,
    }, t.label);
    tabMap.set(t.id, tab);
    tabBar.appendChild(tab);
  });
  section.appendChild(tabBar);

  // ---- List Container ----
  const list = div('ax-feed-list');
  section.appendChild(list);

  // ---- Footer ----
  const footer = div('ax-feed-footer');
  const lastRefresh = getLastRefreshTime();
  footer.innerHTML =
    '<span class="ax-feed-last-refresh">上次刷新: ' + (lastRefresh || '--:--') + '</span>';
  const refreshBtn = el('button', { class: 'ax-feed-refresh-btn', type: 'button' }, 'Refresh feeds');
  footer.appendChild(refreshBtn);
  section.appendChild(footer);

  function renderList() {
    list.empty();

    const result = fetchFeedItems(activeTab);
    if (!result.ok) {
      console.error('[FEEDS_WIDGET]', result.error.code, result.error.message);
      list.appendChild(renderErrorState(result.error, () => renderList()));
      return;
    }

    const items = result.value;

    items.forEach(item => {
      const row = div('ax-feed-item');
      row.innerHTML =
        '<span class="ax-feed-icon" style="color:' + item.iconColor + '">' + item.icon + '</span>' +
        '<span class="ax-feed-body">' +
          '<span class="ax-feed-title">' + esc(item.title) + '</span>' +
          '<span class="ax-feed-desc">' + esc(item.description) + '</span>' +
        '</span>' +
        '<span class="ax-feed-meta">' + esc(item.meta) + ' · ' + esc(item.time) + '</span>';
      if (item.url) {
        row.style.cursor = 'pointer';
        const onRowClick = () => { if (item.url) window.open(item.url, '_blank'); };
        row.addEventListener('click', onRowClick);
        registerCleanup(() => row.removeEventListener('click', onRowClick));
      }
      list.appendChild(row);
    });

    if (items.length === 0) {
      list.appendChild(el('div', { class: 'ax-empty' }, '暂无信息'));
    }
  }

  function switchTab(tabId: FeedTab) {
    activeTab = tabId;
    tabMap.forEach((el, id) => {
      el.toggleClass('ax-feed-tab--active', id === tabId);
    });
    renderList();
  }

  // Tab 事件
  tabs.forEach(t => {
    const tab = tabMap.get(t.id);
    if (tab) {
      const onTabClick = () => switchTab(t.id);
      tab.addEventListener('click', onTabClick);
      registerCleanup(() => tab.removeEventListener('click', onTabClick));
    }
  });

  // 刷新按钮
  const onRefreshClick = () => {
    refreshBtn.addClass('is-loading');
    refreshBtn.textContent = 'Refreshing...';
    safeTimeout(() => {
      saveRefreshTime();
      renderList();
      const lr = footer.querySelector('.ax-feed-last-refresh');
      if (lr) lr.textContent = '上次刷新: ' + (getLastRefreshTime() || '--:--');
      refreshBtn.removeClass('is-loading');
      refreshBtn.textContent = 'Refresh feeds';
    }, 600);
  };
  refreshBtn.addEventListener('click', onRefreshClick);
  registerCleanup(() => refreshBtn.removeEventListener('click', onRefreshClick));

  // 初始渲染
  renderList();

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
