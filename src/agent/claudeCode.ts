/**
 * claudeCode.ts — Agent 任务队列
 *
 * Obsidian 插件运行在浏览器沙箱里，不能直接 spawn CLI。
 * 所以插件把 Agent 任务写入 vault 的 .gulldock-tasks/ 目录，
 * 由外部脚本（Python/Node/npx）或 Claude Code hooks 消费。
 *
 * 文件结构：
 *   .gulldock-tasks/
 *     queue.json          — 待处理任务队列
 *     results/{taskId}.md — 执行结果（外部脚本回写）
 */

import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { type ServiceResult, ok, err } from '../utils/ServiceResult';

/** Agent 任务类型枚举 */
export type AgentTaskType = 'ingest' | 'query' | 'compile' | 'lint' | 'audit' | 'refresh'
  | 'inbox-auto-routing' | 'deep-research-single' | 'vault-lint-full-scan';

export interface AgentTask {
  type: AgentTaskType;
  prompt: string;
  outputPath?: string;
}

export interface QueueTask {
  id: string;
  type: AgentTaskType;
  prompt: string;
  outputPath?: string;
  createdAt: string;
  status: 'pending';
}

const TASKS_DIR = '.gulldock-tasks';
const QUEUE_FILE = `${TASKS_DIR}/queue.json`;
const RESULTS_DIR = `${TASKS_DIR}/results`;

/**
 * 创建 Agent 任务文件
 *
 * 1. 把任务追加到 queue.json
 * 2. 同时生成一个独立的 .md 文件，方便用户直接在 Claude Code 中打开
 *
 * 外部消费方式（任选一种）：
 * - 运行 `npx @anthropic/claude-code@latest -p --input .gulldock-tasks/queue.json`
 * - 配置 Claude Code hooks 监听 .gulldock-tasks/ 目录变化
 * - 用 cron/job 定时轮询 queue.json
 */
export async function enqueueAgentTask(
  task: AgentTask,
  taskId: string,
  vault: Vault,
): Promise<ServiceResult<QueueTask>> {
  try {
    const queueTask: QueueTask = {
      id: taskId,
      type: task.type,
      prompt: task.prompt,
      outputPath: task.outputPath,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    // ---- 1. 读取现有队列并追加 ----
    let queue: QueueTask[] = [];
    try {
      const queueFile = vault.getAbstractFileByPath(QUEUE_FILE);
      if (queueFile instanceof TFile) {
        const raw = await vault.read(queueFile);
        queue = JSON.parse(raw);
      }
    } catch {
      // 文件不存在或解析失败，初始化为空队列
      queue = [];
    }

    // 过滤掉已完成/已取消的旧任务（保留 pending）
    queue = queue.filter(t => t.status === 'pending');
    queue.push(queueTask);

    // 确保目录存在（Obsidian vault.create 会自动创建父目录）
    await vault.create(QUEUE_FILE, JSON.stringify(queue, null, 2));

    // ---- 2. 生成独立的 prompt .md 文件 ----
    const safeName = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const promptFile = `${TASKS_DIR}/tasks/${safeName}.md`;
    const promptContent = `---
taskId: ${taskId}
type: ${task.type}
createdAt: ${queueTask.createdAt}
status: pending
---

# Agent Task: ${task.type}

> 此文件由 GullDock 自动生成
> 消费方式：在 Claude Code 中打开此文件，或将 prompt 复制到终端执行

## Prompt

${task.prompt}

## 执行指令

\`\`\`bash
# 方式 1：直接在 Claude Code 中执行
claude -p "$(cat ${promptFile})"

# 方式 2：指定文件路径
claude -p --input ${promptFile}
\`\`\`

## 结果回写

执行完成后，将结果保存到：
${`${RESULTS_DIR}/${safeName}.md`}

或更新 queue.json 中此任务的 status 为 "done" 并追加 output 字段。
`;

    try {
      await vault.create(promptFile, promptContent);
    } catch {
      // 文件已存在时忽略
    }

    return ok(queueTask);
  } catch (e) {
    console.error('[CLI_TASK_FAILED] enqueueAgentTask:', e);
    return err('CLI_TASK_FAILED', (e as Error).message || '任务入队失败', true, e as Error);
  }
}

/**
 * 读取待处理队列
 */
export async function readQueue(vault: Vault): Promise<ServiceResult<QueueTask[]>> {
  try {
    const queueFile = vault.getAbstractFileByPath(QUEUE_FILE);
    if (queueFile instanceof TFile) {
      const raw = await vault.read(queueFile);
      return ok(JSON.parse(raw));
    }
    return ok([]);
  } catch (e) {
    console.error('[CLI_READ_FAILED] readQueue:', e);
    return err('CLI_READ_FAILED', (e as Error).message || '读取队列失败', true, e as Error);
  }
}

/**
 * 读取任务结果
 */
export async function readTaskResult(vault: Vault, taskId: string): Promise<ServiceResult<string | null>> {
  try {
    const safeName = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const resultFile = `${RESULTS_DIR}/${safeName}.md`;
    const file = vault.getAbstractFileByPath(resultFile);
    if (file instanceof TFile) {
      return ok(await vault.read(file));
    }
    return ok(null);
  } catch (e) {
    console.error('[CLI_READ_FAILED] readTaskResult:', e);
    return err('CLI_READ_FAILED', (e as Error).message || '读取结果失败', true, e as Error);
  }
}

/**
 * 获取 vault 绝对路径（供外部脚本使用，仅桌面端）
 * 优先使用插件设置中的 vaultPath，其次回退到 Node.js 工作目录
 */
export function getVaultAbsolutePath(app: App): string {
  const pluginSettings = (app as any).plugins?.plugins?.['gulldock']?.settings;
  if (pluginSettings?.vaultPath) return pluginSettings.vaultPath;
  const adapter = app.vault.adapter as any;
  if (typeof adapter?.getBasePath === 'function') return adapter.getBasePath();
  if (typeof process !== 'undefined' && process.cwd) return process.cwd();
  return '.';
}