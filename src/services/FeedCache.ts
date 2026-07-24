/**
 * services/FeedCache.ts — Feed 数据缓存服务
 *
 * 缓存外部 API 数据到 vault，减少重复请求。
 * 缓存路径：dashboard/cache/{key}.json
 * TTL：30 分钟
 */

import { App, TFile } from 'obsidian';
import { atomicWrite, safeRead } from '../utils/atomicWrite';

const CACHE_DIR = 'dashboard/cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class FeedCache {
  private vault: App['vault'];
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(vault: App['vault']) {
    this.vault = vault;
  }

  /**
   * 获取缓存数据，如果过期或不存在则返回 null
   */
  async get<T>(key: string): Promise<T | null> {
    // 1. 先检查内存缓存
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
      return memEntry.data as T;
    }

    // 2. 从文件缓存读取
    try {
      const filePath = `${CACHE_DIR}/${key}.json`;
      const content = await safeRead(this.vault, filePath);
      if (!content) return null;

      const entry: CacheEntry<T> = JSON.parse(content);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        this.memoryCache.set(key, entry);
        return entry.data;
      }
    } catch {
      // 缓存文件损坏，忽略
    }

    return null;
  }

  /**
   * 写入缓存数据
   */
  async set<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };

    // 写入内存缓存
    this.memoryCache.set(key, entry);

    // 写入文件缓存
    try {
      const filePath = `${CACHE_DIR}/${key}.json`;
      await atomicWrite(this.vault, filePath, JSON.stringify(entry, null, 2));
    } catch (e) {
      console.warn(`[FeedCache] Failed to write cache for ${key}:`, e);
    }
  }

  /**
   * 检查缓存是否有效
   */
  async isValid(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * 清除指定缓存
   */
  async clear(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      const filePath = `${CACHE_DIR}/${key}.json`;
      const file = this.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.vault.delete(file);
      }
    } catch {
      // 忽略删除错误
    }
  }
}
