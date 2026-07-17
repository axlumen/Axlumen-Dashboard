/**
 * utils/LazyRenderer.ts — IntersectionObserver-based 懒渲染引擎
 *
 * 卡片外壳（标题栏 + 折叠按钮 + 空内容区）立即插入 DOM，
 * 实际内容渲染函数注册到 LazyRenderer，滚动到可视区域附近时才执行。
 *
 * 实现 Disposable 接口：dispose() 断开 observer、清空 pending map。
 */

import type { Disposable } from '../types';

/** 待渲染条目 */
interface PendingEntry {
  el: HTMLElement;
  renderFn: () => void;
  /** 是否已触发过渲染 */
  rendered: boolean;
}

export class LazyRenderer implements Disposable {
  private _disposed = false;
  private _observer: IntersectionObserver | null = null;
  private _pending: Map<HTMLElement, PendingEntry> = new Map();
  private _root: Element | null = null;

  /**
   * @param root  IntersectionObserver 的 root 元素（Kanban 滚动容器）。
   *             传 null 则使用 viewport。
   */
  constructor(root: Element | null = null) {
    this._root = root;
    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          const record = this._pending.get(target);
          if (!record || record.rendered) {
            this._observer!.unobserve(target);
            continue;
          }
          record.rendered = true;
          this._observer!.unobserve(target);
          this._pending.delete(target);
          try {
            record.renderFn();
          } catch (e) {
            console.error('[LazyRenderer] render error:', e);
          }
        }
      },
      {
        root: this._root,
        rootMargin: '200px 0px',
        threshold: 0,
      },
    );
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * 注册待渲染节点。
   * @param el       需要懒渲染的 DOM 元素（内容区容器）
   * @param renderFn 实际渲染逻辑（只执行一次）
   */
  register(el: HTMLElement, renderFn: () => void): void {
    if (this._disposed || !this._observer) return;
    // 如果已经渲染过，直接执行
    const existing = this._pending.get(el);
    if (existing?.rendered) return;
    this._pending.set(el, { el, renderFn, rendered: false });
    this._observer.observe(el);
  }

  /**
   * 手动触发渲染（首屏卡片）。
   * 元素被 unobserve 并从 pending 中移除。
   */
  forceRender(el: HTMLElement): void {
    const record = this._pending.get(el);
    if (!record || record.rendered) return;
    record.rendered = true;
    if (this._observer) this._observer.unobserve(el);
    this._pending.delete(el);
    try {
      record.renderFn();
    } catch (e) {
      console.error('[LazyRenderer] forceRender error:', e);
    }
  }

  /**
   * 取消某个元素的懒渲染注册（折叠时调用）。
   * 如果尚未渲染，从 pending 中移除并 unobserve。
   * 返回是否成功取消（尚未渲染时返回 true）。
   */
  unregister(el: HTMLElement): boolean {
    const record = this._pending.get(el);
    if (!record) return false;
    if (record.rendered) return false;
    if (this._observer) this._observer.unobserve(el);
    this._pending.delete(el);
    return true;
  }

  /** Disposable — 断开 observer、清空 pending */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._pending.clear();
  }
}
