/**
 * widgets/agentStatus.ts — Agent 运行状态小部件（+ Disposable handle）
 */

import { App } from 'obsidian';
import { el, div } from '../utils/dom';
import { getTasksByStatus, listRecentTasks } from '../agent/taskStore';
import { readQueue } from '../agent/claudeCode';
import { MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } from '../constants';
import { type WidgetHandle, createRootedDisposable } from '../types';

function shortTime(ts: number): string {
  if (!ts) return '--';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function relativeTime(ts: number): string {
  if (!ts) return '--';
  const diff = Date.now() - ts;
  if (diff < MS_PER_MINUTE) return '刚刚';
  if (diff < MS_PER_HOUR) return Math.floor(diff / MS_PER_MINUTE) + ' 分钟前';
  if (diff < MS_PER_DAY) return Math.floor(diff / MS_PER_HOUR) + ' 小时前';
  return shortTime(ts);
}

/** 返回 { section, handle } */
export async function createAgentStatusWidget(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): Promise<{ section: HTMLElement; handle: WidgetHandle }> {
  const section = createSection('Agent', '#10B981', '');
  section.style.setProperty('--ax-accent', '#10B981');

  const allTasks = listRecentTasks(10);
  const runningTasks = getTasksByStatus('running');
  const isRunning = runningTasks.length > 0;
  const lastTask = allTasks.length > 0 ? allTasks[0] : null;
  const lastRunTime = lastTask ? lastTask.startedAt : 0;

  let queueCount = 0;
  try {
    const queueResult = await readQueue(app.vault);
    if (queueResult.ok) {
      queueCount = queueResult.value.filter(t => t.status === 'pending').length;
    }
  } catch { /* ignore */ }

  const statusRow = div('ax-agent-status-row');
  statusRow.innerHTML =
    '<div class="ax-agent-led' + (isRunning ? ' ax-agent-led--running' : ' ax-agent-led--idle') + '"></div>' +
    '<span class="ax-agent-state-text">' + (isRunning ? '运行中' : '空闲') + '</span>' +
    (queueCount > 0 ? '<span class="ax-agent-queue-badge">' + queueCount + '</span>' : '');
  section.appendChild(statusRow);

  if (isRunning) {
    const progressBar = div('ax-agent-progress');
    progressBar.innerHTML = '<div class="ax-agent-progress-bar"></div>';
    section.appendChild(progressBar);
  }

  const meta = div('ax-agent-meta');
  meta.innerHTML = '<span class="ax-agent-meta-label">LAST RUN</span>' +
    '<span class="ax-agent-meta-time">' + (isRunning ? '进行中...' : relativeTime(lastRunTime)) + '</span>';
  section.appendChild(meta);

  const runningCount = runningTasks.length;
  const doneCount = allTasks.filter(t => t.status === 'done').length;
  const errCount = allTasks.filter(t => t.status === 'error').length;

  const stats = div('ax-agent-stats');
  stats.innerHTML =
    '<div class="ax-agent-stat"><b>' + runningCount + '</b><span>运行</span></div>' +
    '<div class="ax-agent-stat"><b>' + doneCount + '</b><span>完成</span></div>' +
    '<div class="ax-agent-stat"><b>' + errCount + '</b><span>失败</span></div>';
  section.appendChild(stats);

  // 该 widget 无 addEventListener（纯 DOM+innerHTML），handle 仅做幂等 remove
  const handle = createRootedDisposable([section], () => { section.empty(); });

  return { section, handle };
}

/** 精简版 Agent 面板（用于 kanban section 区域） */
export function createAgentRunsPanelForKanban(
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('Agent Runs', '#6366F1', '最近任务');
  section.style.setProperty('--ax-accent', '#6366F1');

  const list = div('ax-agent-runs');
  const tasks = listRecentTasks(5);

  if (tasks.length === 0) {
    const empty = div('ax-empty');
    empty.textContent = '暂无 Agent 任务记录';
    list.appendChild(empty);
  } else {
    tasks.forEach(task => {
      const item = div('ax-agent-run ax-agent-run-' + task.status);
      const timeStr = new Date(task.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const duration = task.finishedAt ? '(' + ((task.finishedAt - task.startedAt) / 1000).toFixed(1) + 's)' : '';
      const statusIcon = task.status === 'running' ? '⏳' : task.status === 'done' ? '✅' : '❌';
      item.innerHTML =
        '<span class="ax-agent-run-icon">' + statusIcon + '</span>' +
        '<span class="ax-agent-run-type">' + (task.type || '--') + '</span>' +
        '<span class="ax-agent-run-time">' + timeStr + ' ' + duration + '</span>';
      list.appendChild(item);
    });
  }

  section.appendChild(list);
  const handle = createRootedDisposable([section], () => { section.empty(); });

  return { section, handle };
}
