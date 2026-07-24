/**
 * AgentRunner.ts — 工作流执行引擎
 *
 * 扫描 dashboard/workflows/*.md 模板，解析 frontmatter，
 * 通过 child_process.spawn 调用 claude -p 执行任务。
 * 运行日志写入 dashboard/logs/，完成记录写入 dashboard/cache/agent-runs.json。
 *
 * 改造后：
 * - 实现 Disposable，dispose 时停定时器、清回调、清 pending CLI 进程
 * - 增加 onStatusChange(callback) 返回 off 函数
 * - 禁止直接持有 View/DOM 引用，所有对外通信通过 callback
 */

import { App, TFile, TFolder } from 'obsidian';
import { Disposable } from '../types';
import type { PrivacySanitizer } from '../services/PrivacySanitizer';

// ==================== 类型定义 ====================

export type AgentTaskStatus = 'running' | 'completed' | 'failed' | 'stopped';

export interface AgentTask {
  id: string;
  workflowId: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: AgentTaskStatus;
  log: string;
  outputPath: string;
  progress?: number;
  error?: string;
  /** Token 统计 */
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface WorkflowTemplate {
  id: string;
  category: string;
  name: string;
  description: string;
  prompt: string;
  defaultOutput?: string;
  /** L2 路由 purpose（≤100 字，截断安全） */
  purpose?: string;
  /** 逗号分隔的触发关键词 */
  trigger?: string;
  /** 逗号分隔的禁用条件 */
  disableWhen?: string;
  /** 风险等级 */
  riskLevel?: 'low' | 'medium' | 'high';
}

export type ProgressCallback = (taskId: string, logLine: string, progress?: number) => void;
export type CompleteCallback = (taskId: string, success: boolean, outputPath: string) => void;
export type StatusChangeCallback = (taskId: string, status: AgentTaskStatus, task: AgentTask) => void;

// ==================== Mock 内置预设工作流 ====================

export const MOCK_WORKFLOWS: WorkflowTemplate[] = [
  {
    id: 'inbox-auto-routing',
    category: 'Inbox Processing',
    name: 'Inbox Auto-Routing',
    description: '自动归档收件箱、批量打标签',
    prompt: `你是 Vault 归档助手。扫描 Inbox 目录：\n1. 读取每个 .md 文件的 frontmatter 和标题\n2. 根据标签/路径规则归档到对应 Wiki\n3. 为缺失标签的文件补全 type/xxx 标签\n4. 输出归档报告`,
    defaultOutput: 'dashboard/outputs/inbox-routing-{{date}}.md',
  },
  {
    id: 'deep-research-single',
    category: 'Deep Research',
    name: 'Deep Research Single Topic',
    description: '全网资料调研输出结构化报告',
    prompt: `你是深度研究助手。给定的研究主题，请：\n1. 搜集该主题的核心概念、关键人物、发展历史\n2. 整理正反两面观点与争议\n3. 输出结构化报告（摘要 → 正文 → 来源）\n4. 标注需要进一步研究的子问题`,
    defaultOutput: 'dashboard/outputs/research-{{topic}}-{{date}}.md',
  },
  {
    id: 'vault-lint-full-scan',
    category: 'Vault Maintenance',
    name: 'Vault Lint Full Scan',
    description: '检测断链、缺失元数据、孤立笔记',
    prompt: `你是 Vault 健康检查器。全盘扫描：\n1. 找出所有断链（[[wikilink]] 指向不存在的文件）\n2. 找出缺少 frontmatter 或 status 标签的笔记\n3. 找出孤立的笔记（无入链也无出链）\n4. 按优先级输出修复建议`,
    defaultOutput: 'dashboard/outputs/vault-lint-{{date}}.md',
  },
  {
    id: 'daily-diary-summary',
    category: 'Writing Draft',
    name: 'Daily Diary Summary',
    description: '汇总当日任务与笔记生成日记',
    prompt: `你是日记生成助手。今日汇总：\n1. 读取今日 tasks 完成情况\n2. 读取今日编辑过的笔记标题\n3. 生成包含「完成/进行中/明日计划」的日记草稿\n4. 标注关键洞察与待跟进事项`,
    defaultOutput: 'diary/{{date}}.md',
  },
  {
    id: 'tag-classification-batch',
    category: 'Vault Maintenance',
    name: 'Tag Classification Batch',
    description: '批量统一标签规范',
    prompt: `你是标签治理助手。批量处理：\n1. 扫描所有笔记的 tags 字段\n2. 找出大小写不一致、同义重复、过时标签\n3. 按 tag-taxonomy.md 规则统一重命名\n4. 输出变更日志`,
    defaultOutput: 'dashboard/outputs/tag-cleanup-{{date}}.md',
  },
  {
    id: 'rss-content-digest',
    category: 'Inbox Processing',
    name: 'RSS Content Digest',
    description: '聚合 RSS 信息流精简摘要',
    prompt: `你是 RSS 摘要助手。给定 RSS 源列表：\n1. 抓取最新条目（标题+链接+摘要）\n2. 按主题聚类、去重\n3. 输出「今日必读」精选 3-5 条，每条 < 80 字\n4. 标注与 Vault 已有知识的关联`,
    defaultOutput: 'dashboard/outputs/rss-digest-{{date}}.md',
  },
  {
    id: 'github-intake',
    category: 'GitHub Intake',
    name: 'GitHub Project Intake',
    description: '评估 GitHub 项目，决定是否入库',
    purpose: 'Evaluate GitHub project, generate decision card, extract knowledge',
    trigger: 'github, repo, project, ingest, evaluate',
    riskLevel: 'medium',
    prompt: `你是 GullDock 的 GitHub 项目评估员。给定 GitHub URL:\n\n## 步骤 1：获取项目信息\n使用 gh CLI 或 webfetch 获取 README、Stars、Forks、License、最后提交时间\n\n## 步骤 2：快速否决\n- 已归档或 12 个月无提交 → REJECT\n- License 限制性过强 → 标记\n\n## 步骤 3：30 秒定位\n回答：这个项目是 [什么] 为 [谁] 提供 [什么] 的工具\n\n## 步骤 4：证据表\n| 评判维度 | 得分 (1-5) | 证据 |\n|----------|-----------|------|\n| 与 Vault 相关性 | | |\n| 文档质量 | | |\n| 活跃度 | | |\n| 知识密度 | | |\n\n## 步骤 5：决策\n入库（活跃）/ 入库（冷库）/ 拒绝\n\n## 步骤 6：知识提取\n提取 2-5 个可复用原则作为 Wiki 页`,
    defaultOutput: 'dashboard/outputs/github-intake-{{date}}.md',
  },
];

// ==================== 路径常量 ====================

const WORKFLOWS_DIR = 'dashboard/workflows';
const LOGS_DIR = 'dashboard/logs';
const CACHE_DIR = 'dashboard/cache';
const RUNS_FILE = `${CACHE_DIR}/agent-runs.json`;

// ==================== 超时常量 ====================

const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟超时（真实 AI 任务需要更长时间）

// ==================== 正则：简单 frontmatter 解析 =================---

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(FM_REGEX);
  if (!match) return {};
  const body = match[1];
  const result: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

// ==================== AgentRunner 类（实现 Disposable） ====================

export class AgentRunner implements Disposable {
  private app: App;
  private activeTasks: Map<string, AgentTask> = new Map();
  private progressCallbacks: Set<ProgressCallback> = new Set();
  private completeCallbacks: Set<CompleteCallback> = new Set();
  private statusChangeCallbacks: Set<StatusChangeCallback> = new Set();
  private tickInterval: number | null = null;
  private mockMode: boolean = false;
  private tickCallbacks: Set<() => void> = new Set();
  private DisposeListeners: Array<() => void> = [];
  private queue: Array<{ workflowId: string; params?: Record<string, string>; source: string }> = [];
  private maxConcurrent: number = 1;
  private mockIntervals: Set<number> = new Set();
  private pendingSpawns: Set<ReturnType<NonNullable<typeof import('child_process')>['spawn']>> = new Set();
  private _disposed = false;

  private privacySanitizer: PrivacySanitizer | null = null;

  constructor(app: App) {
    this.app = app;
  }

  /** 注入隐私脱敏器 */
  setPrivacySanitizer(sanitizer: PrivacySanitizer): void {
    this.privacySanitizer = sanitizer;
  }

  /** 获取各 workflow 上次运行时间戳 */
  getRunHistoryTimestamps(): Record<string, number> {
    const timestamps: Record<string, number> = {};
    // 从 activeTasks 中提取
    for (const task of this.activeTasks.values()) {
      if (task.endTime && !timestamps[task.workflowId]) {
        timestamps[task.workflowId] = task.endTime;
      }
    }
    // TODO: 从 agent-runs.json 中读取历史记录
    return timestamps;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  // ---------- 生命周期 ----------

  /** 启动 tick 定时器：每秒发射 elapsed 更新事件 */
  startTicking(): void {
    if (this.tickInterval) return;
    this.tickInterval = window.setInterval(() => {
      if (this.activeTasks.size === 0) {
        this.stopTicking();
        return;
      }
      this.emitTick();
    }, 1000);
  }

  onTick(cb: () => void): () => void {
    this.tickCallbacks.add(cb);
    return () => { this.tickCallbacks.delete(cb); };
  }

  private emitTick(): void {
    for (const cb of this.tickCallbacks) cb();
  }

  stopTicking(): void {
    if (this.tickInterval) {
      window.clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * 完全停止：停定时器 + 清回调 + 清 pending CLI + 清事件监听。
   * 幂等——多次调用仅第一次生效。
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.stopTicking();
    for (const h of this.mockIntervals) window.clearInterval(h);
    this.mockIntervals.clear();
    // 终止所有 pending CLI 进程
    for (const proc of this.pendingSpawns) {
      try { proc.kill(); } catch { /* ignore */ }
    }
    this.pendingSpawns.clear();
    this.progressCallbacks.clear();
    this.completeCallbacks.clear();
    this.statusChangeCallbacks.clear();
    this.tickCallbacks.clear();
    for (const off of this.DisposeListeners) off();
    this.DisposeListeners = [];
    this.activeTasks.clear();
  }

  /** 切换 mock 模式（后续对接 CLI 时翻转） */
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
  }

  // ==================== P5: 自动化调度 ====================

  scheduleAutoTask(workflowId: string, params?: Record<string, string>, source: string = 'auto'): void {
    this.queue.push({ workflowId, params, source });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.activeTasks.size >= this.maxConcurrent || this.queue.length === 0) return;
    const next = this.queue.shift()!;
    const task = await this.run(next.workflowId, next.params);
    (task as any)._source = next.source;
  }

  private handleTaskCompleteForQueue(): void {
    this.processQueue();
  }

  // ---------- 回调注册（Set 去重 + 返回反注册函数） ----------

  onProgress(cb: ProgressCallback): () => void {
    this.progressCallbacks.add(cb);
    return () => { this.progressCallbacks.delete(cb); };
  }

  onComplete(cb: CompleteCallback): () => void {
    this.completeCallbacks.add(cb);
    return () => { this.completeCallbacks.delete(cb); };
  }

  /**
   * 注册任意清理函数（事件监听器等），dispose 时统一调用
   */
  onDispose(fn: () => void): void {
    this.DisposeListeners.push(fn);
  }

  /**
   * 任务状态变更回调（running/completed/failed/stopped）。
   * 返回 off 函数用于反注册。
   */
  onStatusChange(cb: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.add(cb);
    return () => { this.statusChangeCallbacks.delete(cb); };
  }

  // ---------- 任务执行 ----------

  async run(workflowId: string, params?: Record<string, string>): Promise<AgentTask> {
    const tpl = await this.getWorkflow(workflowId);
    if (!tpl) {
      throw new Error(`工作流模板不存在: ${workflowId}`);
    }

    const taskId = `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const outputPath = tpl.defaultOutput || `dashboard/outputs/${workflowId}-${taskId}.md`;
    const prompt = this.interpolatePrompt(tpl.prompt, params);

    const task: AgentTask = {
      id: taskId,
      workflowId,
      name: tpl.name,
      startTime: Date.now(),
      status: 'running',
      log: '',
      outputPath,
    };

    this.activeTasks.set(taskId, task);
    this.startTicking();

    if (this.mockMode) {
      this.executeMockTask(task, prompt);
    } else {
      this.executeTask(task, prompt).catch(() => { /* 错误已在内部 emitComplete */ });
    }

    return task;
  }

  /**
   * 根据用户输入自动路由到最佳 workflow 并执行。
   * 返回 null 如果没有匹配的 workflow。
   */
  async routeAndRun(userInput: string, params?: Record<string, string>): Promise<AgentTask | null> {
    // 动态导入避免循环依赖
    const { RoutingEngine } = await import('./RoutingEngine');
    const engine = new RoutingEngine(this.app, this);
    const route = await engine.route(userInput);
    if (!route) return null;
    return this.run(route.id, params);
  }

  private executeMockTask(task: AgentTask, prompt: string): void {
    const mockLogs = [
      '[init] 加载工作流模板...',
      '[scan] 扫描目标目录...',
      '[analyze] 分析内容结构...',
      '[process] 执行处理逻辑...',
      '[generate] 生成输出文件...',
      '[done] 完成',
    ];
    let step = 0;
    const totalSteps = mockLogs.length;

    const interval = window.setInterval(() => {
      this.mockIntervals.add(interval as unknown as number);
      if (task.status !== 'running') {
        window.clearInterval(interval);
        this.mockIntervals.delete(interval as unknown as number);
        return;
      }
      if (step < totalSteps) {
        const line = mockLogs[step];
        task.log += line + '\n';
        task.progress = Math.round(((step + 1) / totalSteps) * 100);
        this.emitProgress(task.id, line, task.progress);
        step++;
      } else {
        window.clearInterval(interval);
        this.mockIntervals.delete(interval as unknown as number);
        task.status = 'completed';
        task.endTime = Date.now();
        task.progress = 100;
        this.activeTasks.delete(task.id);
        this.appendLog(task, `\n[DONE] 完成 · 耗时 ${((task.endTime - task.startTime) / 1000).toFixed(1)}s`);
        this.emitComplete(task.id, true, task.outputPath);
        this.emitStatusChange(task.id, 'completed', task);
        this.persistRuns();
        this.handleTaskCompleteForQueue();
      }
    }, 800);
  }

  stopCurrentTask(): void {
    for (const [id, task] of this.activeTasks) {
      if (task.status === 'running') {
        task.status = 'stopped';
        task.endTime = Date.now();
        this.appendLog(task, '\n[STOPPED] 用户终止任务');
        this.activeTasks.delete(id);
        this.emitComplete(id, false, task.outputPath);
        this.emitStatusChange(id, 'stopped', task);
      }
    }
    this.persistRuns();
  }

  getQueuedCount(): number {
    return 0;
  }

  /**
   * 内部：spawn 执行 claude -p
   * 进程引用记入 pendingSpawns，dispose 时统一 kill
   */
  private async executeTask(task: AgentTask, prompt: string): Promise<void> {
    const vault = this.app.vault;
    const logPath = `${LOGS_DIR}/${task.id}.log`;

    try {
      await this.ensureDir(LOGS_DIR);
      await this.ensureDir(CACHE_DIR);
      const outputDir = task.outputPath.substring(0, task.outputPath.lastIndexOf('/'));
      if (outputDir) await this.ensureDir(outputDir);

      await vault.create(logPath, `[${new Date().toISOString()}] Starting: ${task.name}\n\n`);

      const nodeRequire = this.getNodeRequire('child_process');
      if (!nodeRequire || !nodeRequire.spawn) {
        // Sandbox fallback: 写入 vault 文件队列，由外部脚本消费
        await this.fallbackToVaultQueue(task, prompt);
        return;
      }
      const spawn = nodeRequire.spawn;

      const pluginSettings = (this.app as any).plugins?.plugins?.['gulldock']?.settings;
      let vaultPath: string = pluginSettings?.vaultPath || '';
      if (!vaultPath) {
        const adapter = this.app.vault.adapter as any;
        if (typeof adapter?.getBasePath === 'function') {
          vaultPath = adapter.getBasePath();
        }
      }
      if (!vaultPath && typeof process !== 'undefined' && process.cwd) {
        vaultPath = process.cwd();
      }
      if (!vaultPath) vaultPath = '.';

      const args = ['-p', prompt];
      const settings = (this.app as any).plugins?.plugins?.['gulldock']?.settings;
      const claudePath = settings?.claudeCodePath || 'claude';

      this.appendLog(task, `> ${claudePath} -p "...(prompt, ${prompt.length} chars)"\n`);

      const env: Record<string, string | undefined> = {};
      if (typeof process !== 'undefined' && process.env) {
        Object.assign(env, process.env);
      }
      env.PYTHONIOENCODING = 'utf-8';

      const proc = spawn(claudePath, args, {
        cwd: vaultPath,
        env,
      });
      this.pendingSpawns.add(proc as any);

      // 超时机制：60 秒后强制终止进程
      const timeoutId = setTimeout(() => {
        if (this.pendingSpawns.has(proc as any)) {
          this.appendLog(task, `\n[TIMEOUT] 任务执行超时 (${TASK_TIMEOUT_MS / 1000}s)，正在终止...`);
          try {
            proc.kill();
          } catch { /* ignore */ }
          this.failTask(task, `任务执行超时 (${TASK_TIMEOUT_MS / 1000}s)`);
          this.persistRuns();
          this.handleTaskCompleteForQueue();
        }
      }, TASK_TIMEOUT_MS);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        stdout += text;
        this.appendLog(task, text);
        this.emitProgress(task.id, text);
        // 解析 token 统计
        this.parseTokenUsage(task, text);
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        stderr += text;
        this.appendLog(task, `[stderr] ${text}`);
      });

      proc.on('close', async (code: number) => {
        clearTimeout(timeoutId);
        this.pendingSpawns.delete(proc as any);
        const duration = ((Date.now() - task.startTime) / 1000).toFixed(1);

        if (code === 0) {
          task.status = 'completed';
          task.endTime = Date.now();
          try {
            let outputContent = `---\ntaskId: ${task.id}\nworkflowId: ${task.workflowId}\ncompletedAt: ${new Date().toISOString()}\nduration: ${duration}s\n---\n\n${stdout}`;

            // 隐私脱敏检查
            if (this.privacySanitizer) {
              const report = this.privacySanitizer.sanitize(outputContent);
              if (report.findings.length > 0) {
                this.appendLog(task, `\n[PRIVACY] 发现 ${report.findings.length} 处敏感信息，已脱敏`);
                if (report.sanitizedContent) {
                  outputContent = report.sanitizedContent;
                }
                if (report.blocked) {
                  this.appendLog(task, `\n[PRIVACY] 检测到阻断级敏感信息，输出已脱敏`);
                }
              }
            }

            await vault.create(task.outputPath, outputContent);
          } catch { /* 输出目录可能已存在 */ }
          this.appendLog(task, `\n[DONE] 完成 · 耗时 ${duration}s`);
          this.emitComplete(task.id, true, task.outputPath);
          this.emitStatusChange(task.id, 'completed', task);
        } else {
          task.status = 'failed';
          task.endTime = Date.now();
          task.error = `Exit code: ${code}${stderr ? ' — ' + stderr.slice(0, 200) : ''}`;
          this.appendLog(task, `\n[FAIL] code=${code} · ${task.error}`);
          this.emitComplete(task.id, false, task.outputPath);
          this.emitStatusChange(task.id, 'failed', task);
        }

        this.activeTasks.delete(task.id);
        await this.persistRuns();
        this.handleTaskCompleteForQueue();
      });

      proc.on('error', async (err: Error) => {
        clearTimeout(timeoutId);
        this.pendingSpawns.delete(proc as any);
        this.failTask(task, err.message);
        await this.persistRuns();
        this.handleTaskCompleteForQueue();
      });

    } catch (err: any) {
      this.failTask(task, err?.message || String(err));
      this.handleTaskCompleteForQueue();
    }
  }

  private appendLog(task: AgentTask, text: string): void {
    task.log += text;
  }

  /** 解析 stdout 中的 token 使用统计 */
  private parseTokenUsage(task: AgentTask, text: string): void {
    // 匹配常见格式: "tokens: 1234", "input_tokens: 1000, output_tokens: 234"
    const tokenMatch = text.match(/tokens?:\s*(\d+)/i);
    if (tokenMatch) {
      const tokens = parseInt(tokenMatch[1]);
      if (!task.totalTokens) task.totalTokens = 0;
      task.totalTokens += tokens;
    }
    const inputMatch = text.match(/input[_\s]tokens?:\s*(\d+)/i);
    if (inputMatch) {
      task.inputTokens = (task.inputTokens || 0) + parseInt(inputMatch[1]);
    }
    const outputMatch = text.match(/output[_\s]tokens?:\s*(\d+)/i);
    if (outputMatch) {
      task.outputTokens = (task.outputTokens || 0) + parseInt(outputMatch[1]);
    }
  }

  /** 获取 token 统计摘要 */
  getTokenStats(): { totalInput: number; totalOutput: number; totalAll: number; taskCount: number } {
    let totalInput = 0;
    let totalOutput = 0;
    let totalAll = 0;
    let taskCount = 0;

    // 已完成的任务
    for (const [, task] of this.activeTasks) {
      totalInput += task.inputTokens || 0;
      totalOutput += task.outputTokens || 0;
      totalAll += task.totalTokens || 0;
      taskCount++;
    }

    return { totalInput, totalOutput, totalAll, taskCount };
  }

  /**
   * Sandbox fallback: 把任务写入 vault 文件队列，触发自定义事件通知外部脚本。
   * 当 child_process.spawn 不可用时（Obsidian 浏览器沙箱），使用此路径。
   */
  private async fallbackToVaultQueue(task: AgentTask, prompt: string): Promise<void> {
    const vault = this.app.vault;
    const tasksDir = '.gulldock-tasks';
    const queueFile = `${tasksDir}/queue.json`;
    const resultsDir = `${tasksDir}/results`;

    try {
      await this.ensureDir(tasksDir);
      await this.ensureDir(resultsDir);

      // 读取现有队列
      let queue: Array<Record<string, unknown>> = [];
      try {
        const queueF = vault.getAbstractFileByPath(queueFile);
        if (queueF instanceof TFile) {
          queue = JSON.parse(await vault.read(queueF));
        }
      } catch { /* 初始化空队列 */ }

      // 追加新任务
      const entry = {
        id: task.id,
        type: task.workflowId,
        prompt,
        outputPath: task.outputPath,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      queue = queue.filter((t: any) => t.status === 'pending');
      queue.push(entry);
      await vault.create(queueFile, JSON.stringify(queue, null, 2));

      // 生成独立 prompt 文件
      const safeName = task.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const promptFile = `${tasksDir}/tasks/${safeName}.md`;
      const promptContent = `---\ntaskId: ${task.id}\ntype: ${task.workflowId}\ncreatedAt: ${entry.createdAt}\nstatus: pending\n---\n\n# Agent Task: ${task.workflowId}\n\n## Prompt\n\n${prompt}\n\n## 执行指令\n\n\`\`\`bash\nclaude -p "$(cat ${promptFile})"\n\`\`\`\n\n## 结果回写\n\n执行完成后，将结果保存到：\n${resultsDir}/${safeName}.md\n`;
      try {
        await vault.create(promptFile, promptContent);
      } catch { /* 文件已存在 */ }

      // 更新任务状态为等待外部消费
      task.status = 'completed';
      task.endTime = Date.now();
      task.log += `[FALLBACK] CLI 不可用，已写入 vault 文件队列 (${queueFile})\n`;
      task.log += `[FALLBACK] 等待外部脚本消费: claude -p --input ${promptFile}\n`;
      this.appendLog(task, `\n[DONE] 任务已入队 · 等待外部执行`);
      this.emitComplete(task.id, true, task.outputPath);
      this.emitStatusChange(task.id, 'completed', task);
      this.activeTasks.delete(task.id);
      await this.persistRuns();
      this.handleTaskCompleteForQueue();

      // 触发自定义事件，通知外部脚本
      try {
        document.dispatchEvent(new CustomEvent('gulldock-agent-enqueue', {
          detail: { taskId: task.id, queueFile },
        }));
      } catch { /* ignore */ }

    } catch (err: any) {
      this.failTask(task, `队列入队失败: ${err?.message || String(err)}`);
    }
  }

  private failTask(task: AgentTask, error: string): void {
    task.status = 'failed';
    task.endTime = Date.now();
    task.error = error;
    this.appendLog(task, `\n[ERROR] ${error}`);
    this.activeTasks.delete(task.id);
    this.emitComplete(task.id, false, task.outputPath);
    this.emitStatusChange(task.id, 'failed', task);
  }

  private emitProgress(taskId: string, line: string, progress?: number): void {
    const task = this.activeTasks.get(taskId);
    for (const cb of this.progressCallbacks) {
      cb(taskId, line, progress ?? task?.progress);
    }
  }

  private emitComplete(taskId: string, success: boolean, outputPath: string): void {
    for (const cb of this.completeCallbacks) {
      cb(taskId, success, outputPath);
    }
  }

  private emitStatusChange(taskId: string, status: AgentTaskStatus, task: AgentTask): void {
    for (const cb of this.statusChangeCallbacks) {
      cb(taskId, status, task);
    }
  }

  // ---------- 查询接口 ----------

  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  async getHistory(limit: number = 10): Promise<AgentTask[]> {
    try {
      const file = this.app.vault.getAbstractFileByPath(RUNS_FILE);
      if (file instanceof TFile) {
        const raw = await this.app.vault.read(file);
        const all: AgentTask[] = JSON.parse(raw);
        return all.slice(0, limit);
      }
    } catch (e) {
      console.warn('[GullDock] 读取运行历史失败:', (e as Error).message);
    }
    return [];
  }

  async persistRuns(): Promise<void> {
    const vault = this.app.vault;
    try {
      const file = vault.getAbstractFileByPath(RUNS_FILE);
      let history: AgentTask[] = [];
      if (file instanceof TFile) {
        const raw = await vault.read(file);
        history = JSON.parse(raw);
      }

      const allTasks = [...history];
      for (const task of this.activeTasks.values()) {
        const existing = allTasks.findIndex(t => t.id === task.id);
        if (existing >= 0) {
          allTasks[existing] = { ...task };
        } else {
          allTasks.unshift({ ...task });
        }
      }

      const trimmed = allTasks.slice(0, 50);
      await vault.create(RUNS_FILE, JSON.stringify(trimmed, null, 2));

      for (const task of trimmed) {
        if (task.status !== 'running' && task.log) {
          const logPath = `${LOGS_DIR}/${task.id}.log`;
          try {
            await vault.create(logPath, task.log);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // ---------- 工作流模板管理 ----------

  async scanWorkflows(): Promise<WorkflowTemplate[]> {
    const templates: WorkflowTemplate[] = [];

    templates.push(...MOCK_WORKFLOWS);

    try {
      const vault = this.app.vault;
      const files = vault.getMarkdownFiles();
      for (const file of files) {
        if (!file.path.startsWith(WORKFLOWS_DIR + '/')) continue;
        const content = await vault.read(file);
        const fm = parseFrontmatter(content);
        const body = content.replace(FM_REGEX, '$2').trim();

        const id = file.basename;
        const existingIdx = templates.findIndex(t => t.id === id);
        const tpl: WorkflowTemplate = {
          id,
          category: fm.category || 'Custom',
          name: fm.name || id,
          description: fm.description || '',
          prompt: fm.prompt || body,
          defaultOutput: fm.defaultOutput,
          purpose: fm.purpose || fm.description?.slice(0, 100) || '',
          trigger: fm.trigger || '',
          disableWhen: fm.disableWhen || '',
          riskLevel: (fm.riskLevel as WorkflowTemplate['riskLevel']) || 'low',
        };
        if (existingIdx >= 0) {
          templates[existingIdx] = tpl;
        } else {
          templates.push(tpl);
        }
      }
    } catch {
      // ignore
    }

    return templates;
  }

  async getWorkflow(id: string): Promise<WorkflowTemplate | null> {
    const all = await this.scanWorkflows();
    return all.find(t => t.id === id) || null;
  }

  async createTemplate(id: string, category: string, name: string): Promise<void> {
    const vault = this.app.vault;
    await this.ensureDir(WORKFLOWS_DIR);
    const path = `${WORKFLOWS_DIR}/${id}.md`;
    const content = `---
category: "${category}"
name: "${name}"
description: ""
prompt: "在这里写入提示词..."
defaultOutput: "dashboard/outputs/${id}-output.md"
---

# ${name}

（可选：模板用途说明）
`;
    await vault.create(path, content);
  }

  async updateTemplate(id: string, content: string): Promise<void> {
    const vault = this.app.vault;
    const path = `${WORKFLOWS_DIR}/${id}.md`;
    const file = vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await vault.modify(file, content);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    const vault = this.app.vault;
    const path = `${WORKFLOWS_DIR}/${id}.md`;
    const file = vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await vault.delete(file);
    }
  }

  // ---------- 工具方法 ----------

  private interpolatePrompt(template: string, params?: Record<string, string>): string {
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] || `{{${key}}}`);
  }

  private async ensureDir(dirPath: string): Promise<void> {
    const vault = this.app.vault;
    const parts = dirPath.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? current + '/' + part : part;
      const existing = vault.getAbstractFileByPath(current);
      if (!existing) {
        await vault.createFolder(current);
      } else if (!(existing instanceof TFolder)) {
        break; // path conflict — stop
      }
    }
  }

  private getNodeRequire(moduleName: string): any {
    try {
      if (typeof window !== 'undefined' && (window as any).require) {
        return (window as any).require(moduleName);
      }
    } catch {
      // ignore
    }
    return {};
  }
}
