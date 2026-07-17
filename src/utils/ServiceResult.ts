/**
 * utils/ServiceResult.ts — 统一 Service 层错误边界
 *
 * 纯类型 + 工厂函数，零运行时开销。
 * 所有 Service 方法内部 try-catch 后返回 ServiceResult，
 * 不向上抛异常，Widget 根据 ok/error 渲染对应状态。
 */

// ==================== 类型 ====================

/** Service 层统一错误对象 */
export interface ServiceError {
  /** 机器可读错误码，如 VAULT_SCAN_FAILED、CLI_TIMEOUT */
  code: string;
  /** 人类可读错误信息 */
  message: string;
  /** 是否可恢复（Widget 可展示重试按钮） */
  recoverable: boolean;
  /** 原始异常（可选） */
  cause?: Error;
}

/** 成功结果 */
export interface ServiceOk<T> {
  ok: true;
  value: T;
}

/** 失败结果 */
export interface ServiceErr {
  ok: false;
  error: ServiceError;
}

/** Service 方法统一返回类型 */
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

// ==================== 工厂函数 ====================

/** 构造成功结果 */
export function ok<T>(value: T): ServiceResult<T> {
  return { ok: true, value };
}

/** 构造失败结果 */
export function err<T>(
  code: string,
  message: string,
  recoverable: boolean = true,
  cause?: Error,
): ServiceResult<T> {
  return { ok: false, error: { code, message, recoverable, cause } };
}

// ==================== 辅助 ====================

/** 包裹 async 函数：异常自动转为 ServiceResult */
export async function wrapAsync<T>(
  fn: () => Promise<T>,
  code: string,
  recoverable: boolean = true,
): Promise<ServiceResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(code, (e as Error).message || '未知错误', recoverable, e as Error);
  }
}

/** 同步版本 */
export function wrapSync<T>(
  fn: () => T,
  code: string,
  recoverable: boolean = true,
): ServiceResult<T> {
  try {
    return ok(fn());
  } catch (e) {
    return err(code, (e as Error).message || '未知错误', recoverable, e as Error);
  }
}

// ==================== Widget Error Rendering ====================

import { el, div } from './dom';

/** Widget 错误状态渲染函数 */
export function renderErrorState(
  error: ServiceError,
  onRetry?: () => void,
): HTMLElement {
  if (error.recoverable && onRetry) {
    // 可恢复 → 轻量提示条 + 重试按钮
    const container = div('ax-widget-error ax-widget-error--recoverable');
    const msg = el('span', { class: 'ax-widget-error-msg' }, error.message || '加载失败');
    const retryBtn = el('button', {
      class: 'ax-btn ax-btn-ghost ax-btn-sm',
      type: 'button',
    }, '点击重试');
    retryBtn.addEventListener('click', onRetry);
    container.appendChild(msg);
    container.appendChild(retryBtn);
    return container;
  }

  // 不可恢复 → 灰化占位卡片
  const placeholder = div('ax-widget-error ax-widget-error--fatal');
  placeholder.innerHTML =
    '<div class="ax-widget-error-icon">⚠</div>' +
    '<div class="ax-widget-error-text">模块暂时不可用</div>' +
    '<div class="ax-widget-error-code">' + (error.code || '') + '</div>';
  return placeholder;
}
