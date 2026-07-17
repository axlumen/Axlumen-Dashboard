/**
 * CompositeDisposable.ts — 聚合 Disposable 容器
 *
 * 使用场景：view.ts 需要统一管理本轮视图生命周期内创建的所有 widget / listener。
 * 保证 LIFO（后进先出）顺序销毁——后挂载的先卸载，避免悬空引用。
 *
 * 特性：
 * - 幂等：重复 dispose 为空操作
 * - 防御性：dispose 后再次 add 为空操作（避免把新 view 的 disposable 误删）
 * - 隔离：每个 View 实例一个 CompositeDisposable，互不干扰
 */

import { Disposable, isDisposable } from '../types';

export class CompositeDisposable implements Disposable {
  private _disposables: Disposable[] = [];
  private _disposed = false;

  get disposed(): boolean {
    return this._disposed;
  }

  /** 批量注册 disposable。已 disposed 时调用为空操作。 */
  add(...disposables: Disposable[]): void {
    if (this._disposed) return;
    for (const d of disposables) {
      if (!d) continue;
      if (!isDisposable(d)) {
        // 严格模式防护：开发期报错，防止误用
        console.warn('[CompositeDisposable] 跳过非 Disposable 参数:', d);
        continue;
      }
      // 同一实例不重复注册
      if (this._disposables.includes(d)) continue;
      this._disposables.push(d);
    }
  }

  /** LIFO 顺序清理。已 disposed 实例跳过幂等。（幂等：多次调用仅第一次生效） */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    // 复制一份再清空，避免 dispose 回调内二次 add 破坏迭代
    const snapshot = this._disposables;
    this._disposables = [];
    for (let i = snapshot.length - 1; i >= 0; i--) {
      const d = snapshot[i];
      if (!d || d.disposed) continue;
      try {
        d.dispose();
      } catch (e) {
        console.warn('[CompositeDisposable] dispose 回调异常:', e);
      }
    }
  }
}
