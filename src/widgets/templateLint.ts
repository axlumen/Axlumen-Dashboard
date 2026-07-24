/**
 * templateLint.ts — Workflow 模板截断安全检查
 *
 * 提供批量 lint 和 UI 渲染功能。
 */

import { App } from 'obsidian';
import { TruncationGuard, TruncationReport } from '../services/TruncationGuard';
import type { AgentRunner, WorkflowTemplate } from '../agent/AgentRunner';
import { el, div } from '../utils/dom';

export interface LintResult {
  templateId: string;
  templateName: string;
  report: TruncationReport;
}

/**
 * 对所有 workflow 模板执行截断安全检查。
 */
export async function lintAllTemplates(runner: AgentRunner): Promise<LintResult[]> {
  const templates = await runner.scanWorkflows();
  const results: LintResult[] = [];

  for (const tpl of templates) {
    const report = TruncationGuard.validateTemplate({
      purpose: tpl.purpose,
      description: tpl.description,
      prompt: tpl.prompt,
      disableWhen: tpl.disableWhen,
      defaultOutput: tpl.defaultOutput,
    });
    results.push({
      templateId: tpl.id,
      templateName: tpl.name,
      report,
    });
  }

  return results;
}

/**
 * 渲染 lint 结果为 DOM 元素。
 */
export function renderLintResults(results: LintResult[]): HTMLElement {
  const container = div('ax-lint-results');

  const errors = results.filter(r => !r.report.valid);
  const warnings = results.filter(r => r.report.valid && r.report.violations.length > 0);
  const clean = results.filter(r => r.report.violations.length === 0);

  // 摘要头
  const summary = div('ax-lint-summary');
  summary.innerHTML =
    `<span class="ax-lint-count ax-lint-count--ok">${clean.length} 通过</span>` +
    `<span class="ax-lint-count ax-lint-count--warn">${warnings.length} 警告</span>` +
    `<span class="ax-lint-count ax-lint-count--err">${errors.length} 错误</span>`;
  container.appendChild(summary);

  // 有问题的模板
  for (const result of results) {
    if (result.report.violations.length === 0) continue;

    const card = div('ax-lint-card');
    const hasError = !result.report.valid;

    const header = el('div', { class: 'ax-lint-card-header' }, '');
    header.innerHTML =
      `<span class="ax-lint-badge ax-lint-badge--${hasError ? 'err' : 'warn'}">${hasError ? 'ERROR' : 'WARN'}</span>` +
      `<span class="ax-lint-template-name">${result.templateName}</span>` +
      `<span class="ax-lint-template-id">(${result.templateId})</span>`;
    card.appendChild(header);

    const violationsList = el('ul', { class: 'ax-lint-violations' }, '');
    for (const v of result.report.violations) {
      const li = el('li', { class: `ax-lint-violation ax-lint-violation--${v.severity}` }, '');
      li.innerHTML = `<code>${v.rule}</code> [${v.field}] ${v.message}`;
      violationsList.appendChild(li);
    }
    card.appendChild(violationsList);

    container.appendChild(card);
  }

  if (results.length === 0) {
    container.appendChild(el('div', { class: 'ax-lint-empty' }, '没有找到 workflow 模板'));
  }

  return container;
}
