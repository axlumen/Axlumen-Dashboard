/**
 * widgets/activeTaskBar.ts — 活动任务状态栏（+ Disposable handle）
 *
 * 关键：订阅 runner 事件，必须通过 handle.dispose() 反注册。
 */

import { AgentRunner, AgentTaskStatus } from '../agent/AgentRunner';
import { el, div, esc } from '../utils/dom';
import { type WidgetHandle, createRootedDisposable } from '../types';

const MAX_LOG_LINES = 200;
const AUTO_HIDE_DELAY = 3000;

/** 返回 { bar, handle } — bar 注入 DOM，handle 在 onClose 时清理订阅 */
export function createActiveTaskBar(
  runner: AgentRunner,
  openLink: (path: string) => void,
): { bar: HTMLElement; handle: WidgetHandle } {
  const bar = div('ax-task-bar');
  bar.style.display = 'none';

  // 订阅并保存 off 函数
  const offs: Array<() => void> = [];

  offs.push(runner.onProgress((taskId, line, progress) => {
    updateBar(bar, runner, openLink);
    appendLog(bar, taskId, line, progress);
  }));

  offs.push(runner.onTick(() => {
    if (bar.style.display !== 'none') {
      updateBar(bar, runner, openLink);
    }
  }));

  offs.push(runner.onComplete((taskId, success, _outputPath) => {
    updateBar(bar, runner, openLink);
    if (!success) {
      appendLog(bar, taskId, '[stopped] 任务已终止', undefined, 'ax-task-bar-log-line--warn');
    }
    window.setTimeout(() => {
      const active = runner.getActiveTasks();
      if (active.length === 0) {
        hideBar(bar);
      }
    }, AUTO_HIDE_DELAY);
  }));

  const handle = createRootedDisposable([bar], () => {
    for (const off of offs) off();
    bar.empty();
  });

  return { bar, handle };
}

function updateBar(
  bar: HTMLElement,
  runner: AgentRunner,
  _openLink: (path: string) => void,
): void {
  const tasks = runner.getActiveTasks();

  if (tasks.length === 0) {
    hideBar(bar);
    return;
  }

  showBar(bar);
  bar.empty();

  const summary = div('ax-task-bar-summary');
  const dot = div('ax-task-bar-dot');

  if (tasks.length === 1) {
    const task = tasks[0];
    const elapsed = elapsedStr(task.startTime);
    const pct = task.progress != null ? ` · ${task.progress}%` : '';
    summary.innerHTML =
      '<span class="ax-task-bar-label">Agent Running</span>' +
      '<span class="ax-task-bar-name">' + esc(task.name) + '</span>' +
      '<span class="ax-task-bar-elapsed">' + elapsed + pct + '</span>';
  } else {
    summary.innerHTML =
      '<span class="ax-task-bar-label">Agent Running</span>' +
      '<span class="ax-task-bar-name">Running: ' + tasks.length + '</span>';
  }

  const queued = runner.getQueuedCount();
  if (queued > 0) {
    const queueInfo = div('ax-task-bar-queue', 'Running:' + tasks.length + ' · Queued:' + queued);
    summary.appendChild(queueInfo);
  }

  const rightActions = div('ax-task-bar-actions');

  const detailsBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm ax-task-bar-details-btn', type: 'button' }, 'Details');
  detailsBtn.addEventListener('click', () => toggleLogPanel(bar));

  const stopBtn = el('button', { class: 'ax-btn ax-btn-danger ax-btn-sm ax-task-bar-stop-btn', type: 'button' }, 'Stop');
  stopBtn.addEventListener('click', () => {
    runner.stopCurrentTask();
    updateBar(bar, runner, _openLink);
  });

  rightActions.appendChild(detailsBtn);
  rightActions.appendChild(stopBtn);

  summary.appendChild(rightActions);
  bar.appendChild(dot);
  bar.appendChild(summary);

  const progress = div('ax-task-bar-progress');
  const firstTask = tasks[0];
  if (firstTask.progress != null && firstTask.progress > 0) {
    progress.innerHTML = '<div class="ax-task-bar-progress-fill" style="width:' + firstTask.progress + '%"></div>';
  } else {
    progress.innerHTML = '<div class="ax-task-bar-progress-fill ax-task-bar-progress-fill--indeterminate"></div>';
  }
  bar.appendChild(progress);

  const logPanel = div('ax-task-bar-log-panel');
  logPanel.style.display = 'none';
  bar.appendChild(logPanel);

  tasks.forEach(task => {
    const taskLog = div('ax-task-bar-task-log');
    taskLog.dataset.taskId = task.id;
    const taskLabel = div('ax-task-bar-task-label', esc(task.name));
    taskLog.appendChild(taskLabel);
    logPanel.appendChild(taskLog);
  });
}

function appendLog(bar: HTMLElement, taskId: string, line: string, _progress?: number, extraClass?: string): void {
  const taskLog = bar.querySelector('.ax-task-bar-task-log[data-task-id="' + taskId + '"]') as HTMLElement;
  if (!taskLog) return;

  const lineEl = document.createElement('div');
  lineEl.className = 'ax-task-bar-log-line' + (extraClass ? ' ' + extraClass : '');
  lineEl.textContent = line;
  taskLog.appendChild(lineEl);

  const panel = bar.querySelector('.ax-task-bar-log-panel') as HTMLElement;
  if (panel) panel.scrollTop = panel.scrollHeight;

  const lines = taskLog.querySelectorAll('.ax-task-bar-log-line');
  if (lines.length > MAX_LOG_LINES) {
    lines[0].remove();
  }
}

function toggleLogPanel(bar: HTMLElement): void {
  const panel = bar.querySelector('.ax-task-bar-log-panel') as HTMLElement;
  const btn = bar.querySelector('.ax-task-bar-details-btn') as HTMLElement;
  if (!panel || !btn) return;

  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? 'Hide' : 'Details';
}

function showBar(bar: HTMLElement): void {
  if (bar.style.display !== 'none') return;
  bar.style.display = 'flex';
  bar.removeClass('ax-task-bar--hiding');
  bar.addClass('ax-task-bar--visible');
}

function hideBar(bar: HTMLElement): void {
  if (bar.style.display === 'none') return;
  bar.addClass('ax-task-bar--hiding');
  bar.removeClass('ax-task-bar--visible');
  window.setTimeout(() => {
    bar.style.display = 'none';
    bar.empty();
  }, 300);
}

function elapsedStr(startTime: number): string {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  if (sec < 60) return sec + 's';
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min + 'm' + s + 's';
}

export type { AgentTaskStatus };
