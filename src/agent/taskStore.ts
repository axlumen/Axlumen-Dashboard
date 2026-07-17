/**
 * taskStore.ts — Agent 任务状态追踪
 * 内存中维护最近 20 条任务记录，供 Dashboard UI 渲染
 */

import type { AgentTaskType } from './claudeCode';
export type { AgentTaskType };

export type TaskStatus = 'running' | 'done' | 'error';

export interface TaskRecord {
  id: string;
  type: AgentTaskType;
  status: TaskStatus;
  startedAt: number;
  finishedAt?: number;
  output?: string;
  error?: string;
}

const MAX_RECORDS = 20;

/** 内存中的任务记录，模块级单例 */
const records: TaskRecord[] = [];

/** 生成唯一 ID（不使用 crypto.randomUUID 保持兼容） */
function genId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 创建一条 running 状态的任务记录
 */
export function addTask(type: AgentTaskType): string {
  const id = genId();
  records.unshift({
    id,
    type,
    status: 'running',
    startedAt: Date.now(),
  });
  trimRecords();
  return id;
}

/**
 * 将任务标记为成功
 */
export function completeTask(id: string, output?: string): void {
  const task = records.find(r => r.id === id);
  if (task) {
    task.status = 'done';
    task.finishedAt = Date.now();
    task.output = output;
  }
}

/**
 * 将任务标记为失败
 */
export function failTask(id: string, error: string): void {
  const task = records.find(r => r.id === id);
  if (task) {
    task.status = 'error';
    task.finishedAt = Date.now();
    task.error = error;
  }
}

/**
 * 获取所有任务记录（最新的在前）
 */
export function listTasks(): TaskRecord[] {
  return [...records];
}

/**
 * 获取最近 N 条记录
 */
export function listRecentTasks(count: number): TaskRecord[] {
  return records.slice(0, count);
}

/**
 * 按状态获取任务
 */
export function getTasksByStatus(status: TaskStatus): TaskRecord[] {
  return records.filter(r => r.status === status);
}

/**
 * 清空所有记录
 */
export function clearTasks(): void {
  records.length = 0;
}

/** 超出上限时从尾部裁剪 */
function trimRecords(): void {
  while (records.length > MAX_RECORDS) {
    records.pop();
  }
}
