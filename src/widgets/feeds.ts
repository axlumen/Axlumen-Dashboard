/**
 * widgets/feeds.ts — 多源信息流模块（+ Disposable handle）
 *
 * MVP-1: 替换模拟数据为真实 GitHub API 和 RSS 数据
 */

import { App, requestUrl } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { LocalStore } from '../utils/LocalStore';
import { type WidgetHandle, createRootedDisposable } from '../types';
import {
  type ServiceResult, type ServiceError, ok, err, renderErrorState,
} from '../utils/ServiceResult';
import { FeedCache } from '../services/FeedCache';

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

// ---- GitHub API ----

interface GitHubRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
  updated_at: string;
}

async function fetchGitHubFeed(cache: FeedCache): Promise<FeedItem[]> {
  // 检查缓存
  const cached = await cache.get<FeedItem[]>('github-feed');
  if (cached) return cached;

  try {
    const response = await requestUrl({
      url: 'https://api.github.com/search/repositories?q=ai+agent&sort=stars&order=desc&per_page=10',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const data = response.json;
    const items: FeedItem[] = (data.items || []).slice(0, 6).map((repo: GitHubRepo) => ({
      source: 'github' as FeedSource,
      icon: '⭐',
      iconColor: '#FBBF24',
      title: repo.full_name,
      description: repo.description || 'No description',
      meta: '▴ ' + formatStars(repo.stargazers_count),
      time: formatRelativeTime(repo.updated_at),
      url: repo.html_url,
    }));

    // 写入缓存
    await cache.set('github-feed', items);
    return items;
  } catch (e) {
    console.error('[FEEDS] GitHub API error:', e);
    return [];
  }
}

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return (stars / 1000).toFixed(1) + 'k';
  }
  return String(stars);
}

// ---- RSS 解析 ----

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  creator?: string;
}

async function fetchRssFeed(cache: FeedCache): Promise<FeedItem[]> {
  // 检查缓存
  const cached = await cache.get<FeedItem[]>('rss-feed');
  if (cached) return cached;

  // 预设的 RSS 源列表（用户可配置）
  const RSS_SOURCES = [
    {
      url: 'https://hnrss.org/newest?q=AI+agent&points=100',
      name: 'Hacker News',
      icon: '🔶',
      color: '#FF6600',
    },
    {
      url: 'https://rss.app/feeds/v1.1/t8t2q2t8t2q2t2t8.xml',
      name: 'AI News',
      icon: '🤖',
      color: '#22D3EE',
    },
  ];

  const allItems: FeedItem[] = [];

  for (const source of RSS_SOURCES) {
    try {
      const response = await requestUrl({
        url: source.url,
      });

      const items = parseRSS(response.text, source);
      allItems.push(...items);
    } catch (e) {
      console.warn(`[FEEDS] RSS fetch failed for ${source.name}:`, e);
    }
  }

  // 按时间排序，取最新的
  const sorted = allItems
    .sort((a, b) => parseTimeToMinutes(b.time) - parseTimeToMinutes(a.time))
    .slice(0, 6);

  // 写入缓存
  await cache.set('rss-feed', sorted);
  return sorted;
}

function parseRSS(xml: string, source: { name: string; icon: string; color: string }): FeedItem[] {
  const items: FeedItem[] = [];

  // 简单的 XML 解析（不依赖外部库）
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded');

    if (title) {
      items.push({
        source: 'rss',
        icon: source.icon,
        iconColor: source.color,
        title: decodeHTML(title).substring(0, 80),
        description: decodeHTML(description || '').substring(0, 100),
        meta: source.name,
        time: pubDate ? formatRelativeTime(pubDate) : '未知时间',
        url: link || undefined,
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // 处理 CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // 普通标签
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function decodeHTML(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '') // 移除 HTML 标签
    .trim();
}

// ---- 时间格式化 ----

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return diffMin + 'min ago';
    if (diffHour < 24) return diffHour + 'h ago';
    if (diffDay < 7) return diffDay + 'd ago';
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } catch {
    return '未知时间';
  }
}

function parseTimeToMinutes(timeStr: string): number {
  if (timeStr.includes('刚刚')) return 0;
  if (timeStr.includes('min')) return parseInt(timeStr, 10);
  if (timeStr.includes('h ago')) return parseInt(timeStr, 10) * 60;
  if (timeStr.includes('d ago')) return parseInt(timeStr, 10) * 1440;
  return 9999;
}

// ---- 合并与排序 ----

function mergeFeeds(items: FeedItem[]): FeedItem[] {
  return items.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
}

function getLastRefreshTime(): string {
  return LocalStore.getFeedLastRefresh();
}

function saveRefreshTime(): void {
  const now = new Date();
  LocalStore.setFeedLastRefresh(
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
}

// ---- 获取 Feed 数据 ----

async function fetchFeedItems(
  tab: FeedTab,
  cache: FeedCache,
): Promise<ServiceResult<FeedItem[]>> {
  try {
    let items: FeedItem[] = [];

    if (tab === 'all') {
      const [githubItems, rssItems] = await Promise.all([
        fetchGitHubFeed(cache),
        fetchRssFeed(cache),
      ]);
      items = mergeFeeds([...githubItems, ...rssItems]);
    } else if (tab === 'github') {
      items = await fetchGitHubFeed(cache);
    } else if (tab === 'rss') {
      items = await fetchRssFeed(cache);
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

  // 初始化缓存
  const cache = new FeedCache(app.vault);

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

  // ---- Loading 状态 ----
  function showLoading() {
    list.empty();
    list.appendChild(el('div', { class: 'ax-feed-loading' }, '加载中...'));
  }

  // ---- 渲染列表 ----
  async function renderList() {
    list.empty();
    showLoading();

    const result = await fetchFeedItems(activeTab, cache);

    list.empty();

    if (!result.ok) {
      console.error('[FEEDS_WIDGET]', result.error.code, result.error.message);
      list.appendChild(renderErrorState(result.error, () => renderList()));
      return;
    }

    const items = result.value;

    if (items.length === 0) {
      list.appendChild(el('div', { class: 'ax-empty' }, '暂无信息'));
      return;
    }

    items.forEach(item => {
      const row = div('ax-feed-item');
      row.innerHTML =
        '<span class="ax-feed-icon" style="color:' + esc(item.iconColor) + '">' + esc(item.icon) + '</span>' +
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
  const onRefreshClick = async () => {
    refreshBtn.addClass('is-loading');
    refreshBtn.textContent = 'Refreshing...';

    // 清除缓存以强制刷新
    await cache.clear('github-feed');
    await cache.clear('rss-feed');

    await renderList();

    saveRefreshTime();
    const lr = footer.querySelector('.ax-feed-last-refresh');
    if (lr) lr.textContent = '上次刷新: ' + (getLastRefreshTime() || '--:--');
    refreshBtn.removeClass('is-loading');
    refreshBtn.textContent = 'Refresh feeds';
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
