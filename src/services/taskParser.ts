/**
 * services/taskParser.ts — Daily Note 任务解析
 * 扫描最近 N 天的 Daily Note，解析 Markdown 任务语法
 */

import { App, TFile } from 'obsidian';

export interface ParsedTask {
  text: string;
  done: boolean;
  dueDate: string;       // YYYY-MM-DD（来自 Daily Note 文件名或 frontmatter）
  source: string;        // 来源文件路径
  priority: 'high' | 'medium' | 'low';
}

/** 匹配 Markdown 任务行：- [ ] 或 - [x] 或 - [X] */
const TASK_REGEX = /^-\s\[([ xX])\]\s+(.+)$/;

/**
 * 从单个 Markdown 内容中解析任务行
 */
function parseTasksFromContent(
  content: string,
  sourcePath: string,
  defaultDate: string,
): ParsedTask[] {
  const tasks: ParsedTask[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(TASK_REGEX);
    if (!match) continue;

    const done = match[1].toLowerCase() === 'x';
    let text = match[2].trim();

    // 从任务文本推断优先级（基于 emoji 或标记）
    let priority: ParsedTask['priority'] = 'medium';
    if (text.includes('🔴') || text.includes('!!!') || text.startsWith('P0')) {
      priority = 'high';
    } else if (text.includes('🟢') || text.includes('!!!') === false && text.includes('P2')) {
      priority = 'low';
    }

    // 清理任务文本中的优先级标记
    text = text.replace(/^(🔴|🟡|🟢)\s*/, '').replace(/^P[012]\s*[··]?\s*/, '');

    // 尝试从任务文本提取日期（格式：YYYY-MM-DD 或 MM-DD）
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/);
    const dueDate = dateMatch
      ? (dateMatch[1].length === 5 ? `${new Date().getFullYear()}-${dateMatch[1]}` : dateMatch[1])
      : defaultDate;

    tasks.push({
      text: dateMatch ? text.replace(/\s*\d{4}-\d{2}-\d{2}|\s*\d{2}-\d{2}$/, '').trim() : text,
      done,
      dueDate,
      source: sourcePath,
      priority,
    });
  }

  return tasks;
}

/**
 * 扫描 Daily Note 目录，解析最近 N 天的任务
 *
 * @param app Obsidian App
 * @param dir Daily Note 目录，默认 'Daily'
 * @param daysBack 扫描最近几天，默认 7
 */
export async function parseTasksFromDailyNotes(
  app: App,
  dir: string = 'Daily',
  daysBack: number = 7,
): Promise<ParsedTask[]> {
  const allTasks: ParsedTask[] = [];
  const today = new Date();

  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD

    // 尝试多种 Daily Note 文件名格式
    const candidates = [
      `${dir}/${dateStr}.md`,
      `${dir}/${dateStr.replace(/-/g, '/')}.md`,
      `${dir}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${dateStr}.md`,
    ];

    for (const path of candidates) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        const content = await app.vault.read(file);
        const tasks = parseTasksFromContent(content, path, dateStr);
        allTasks.push(...tasks);
        break; // 找到了就停止尝试该日期的其他格式
      }
    }
  }

  return allTasks;
}

/**
 * 跨全库扫描任务（不限 Daily Note）
 * 扫描所有 .md 文件中的未完成任务
 */
export async function parseAllPendingTasks(app: App): Promise<ParsedTask[]> {
  const allTasks: ParsedTask[] = [];
  const files = app.vault.getMarkdownFiles();

  for (const file of files) {
    // 跳过 Inbox 和 archive 目录
    if (file.path.includes('Inbox/') || file.path.includes('archive/')) continue;

    const content = await app.vault.read(file);
    const tasks = parseTasksFromContent(content, file.path, file.stat.mtime.toString().slice(0, 10));
    allTasks.push(...tasks.filter(t => !t.done));
  }

  return allTasks;
}
