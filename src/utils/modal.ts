/**
 * utils/modal.ts — 模态框公共工具（P6）
 *
 * - ESC 快捷键关闭
 * - 统一的 overlay/modal 创建
 */

import { el, div } from './dom';

export interface ModalConfig {
  title: string;
  content: HTMLElement;
  actions?: HTMLElement;
  wide?: boolean;
  onClose?: () => void;
}

/**
 * 创建支持 ESC 关闭的模态框
 */
export function createModal(config: ModalConfig): { overlay: HTMLElement; close: () => void } {
  const overlay = el('div', { class: 'ax-modal-overlay' });
  const modal = el('div', { class: 'ax-modal' + (config.wide ? ' ax-modal--wide' : '') });

  // 标题
  const titleEl = el('h3', { class: 'ax-modal-title' }, config.title);
  modal.appendChild(titleEl);

  // Content
  if (config.content) {
    modal.appendChild(config.content);
  }

  // Actions
  if (config.actions) {
    modal.appendChild(config.actions);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // 关闭函数
  const close = () => {
    overlay.remove();
    config.onClose?.();
    document.removeEventListener('keydown', handleEsc);
  };

  // ESC 关闭
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', handleEsc);

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
    }
  });

  return { overlay, close };
}

/**
 * 创建标准底部操作栏（关闭按钮）
 */
export function createModalActions(close: () => void, extra?: HTMLElement): HTMLElement {
  const actions = div('ax-modal-actions');
  const closeBtn = el('button', { class: 'ax-btn ax-btn-ghost', type: 'button' }, '关闭');
  closeBtn.addEventListener('click', close);

  if (extra) actions.appendChild(extra);
  actions.appendChild(closeBtn);
  return actions;
}
