/**
 * DOM 工具函数 — 纯 DOM API 构建 UI
 */

/** 创建元素并设置属性 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') {
        element.className = value;
      } else if (key === 'style') {
        element.style.cssText = value;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element.setAttribute(key, value);
      }
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }
  return element;
}

/** 快捷创建 div */
export function div(cls?: string, ...children: (Node | string)[]) {
  return el('div', cls ? { class: cls } : undefined, ...children);
}

/** HTML 转义：防 XSS */
export function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 数字滚动动画 */
export function animateCount(
  element: HTMLElement,
  end: number,
  duration: number = 1100,
  suffix: string = ''
) {
  if (!end) {
    element.textContent = '0' + suffix;
    return;
  }
  const t0 = performance.now();
  function step(t: number) {
    const k = Math.min(1, (t - t0) / duration);
    const ease = 1 - Math.pow(1 - k, 3);
    element.textContent = Math.round(end * ease) + suffix;
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
