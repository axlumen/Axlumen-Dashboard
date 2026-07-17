/**
 * 入场动效工具
 */

/** 交错入场：给一组元素添加渐入延迟 */
export function staggerEntrance(elements: HTMLElement[], baseDelay: number = 60) {
  elements.forEach((el, i) => {
    el.style.animationDelay = `${i * baseDelay}ms`;
  });
}

/** 进度条生长动画 */
export function animateProgressBars(container: HTMLElement) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll<HTMLElement>('[data-width]').forEach(el => {
        el.style.width = el.dataset.width || '0%';
      });
    }, 50);
  });
}
