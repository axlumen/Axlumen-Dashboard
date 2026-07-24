/**
 * CacheService.ts — 统一缓存服务
 *
 * 管理所有外部数据的缓存：天气、GitHub、RSS、TickTick。
 * 支持 TTL、手动失效、内存+localStorage 双层缓存。
 */

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export interface CacheConfig {
  /** 缓存 TTL（毫秒），默认 30 分钟 */
  ttlMs?: number;
  /** 存储键前缀 */
  prefix?: string;
}

const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
const STORAGE_PREFIX = 'gulldock-cache';

export class CacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private defaultTtl: number;

  constructor(config?: CacheConfig) {
    this.defaultTtl = config?.ttlMs ?? DEFAULT_TTL;
  }

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @param ttlMs 可选的自定义 TTL
   * @returns 缓存的数据，如果过期或不存在则返回 null
   */
  get<T>(key: string, ttlMs?: number): T | null {
    const effectiveTtl = ttlMs ?? this.defaultTtl;

    // 1. 先查内存缓存
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() - memEntry.fetchedAt < effectiveTtl) {
      return memEntry.data as T;
    }

    // 2. 再查 localStorage
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
      if (raw) {
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() - entry.fetchedAt < effectiveTtl) {
          // 回填内存缓存
          this.memoryCache.set(key, entry);
          return entry.data;
        }
      }
    } catch { /* ignore */ }

    return null;
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 要缓存的数据
   */
  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };

    // 写入内存
    this.memoryCache.set(key, entry);

    // 写入 localStorage
    try {
      localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(entry));
    } catch { /* localStorage 满了就忽略 */ }
  }

  /**
   * 手动失效某个缓存
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}:${key}`);
    } catch { /* ignore */ }
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX + ':'));
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch { /* ignore */ }
  }

  /**
   * 获取缓存状态（调试用）
   */
  getStatus(): { memoryEntries: number; storageEntries: number } {
    let storageEntries = 0;
    try {
      storageEntries = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX + ':')).length;
    } catch { /* ignore */ }
    return { memoryEntries: this.memoryCache.size, storageEntries };
  }
}

// ===== 预定义缓存键 =====

export const CACHE_KEYS = {
  WEATHER: 'weather',
  GITHUB_FEED: 'github-feed',
  RSS_FEED: 'rss-feed',
  TICKTICK_SNAPSHOT: 'ticktick-snapshot',
  VAULT_HEALTH: 'vault-health',
} as const;

// ===== 单例导出 =====

let _instance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!_instance) {
    _instance = new CacheService();
  }
  return _instance;
}
