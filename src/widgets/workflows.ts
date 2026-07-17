/**
 * widgets/workflows.ts — Agent 工作流面板（+ Disposable handle）
 *
 * 关键改动：
 * - onProgress/onComplete 反注册函数入 handle.cleanup
 * - createWorkflowCard 内 runner.onDispose 不再用匿名闭包，改用具名 off 注册
 */

import { App, Notice, TFile } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { createModal, createModalActions } from '../utils/modal';
import { AutomationRule, RuleConfig } from '../services/AutomationEngine';
import { MEMO_FOCUS_DELAY_MS } from '../constants';
import {
  AgentRunner, AgentTask, AgentTaskStatus, WorkflowTemplate,
} from '../agent/AgentRunner';
import { type WidgetHandle, createRootedDisposable } from '../types';

const STATUS_ICONS: Record<string, string> = {
  running: '⏳',
  completed: '✅',
  stopped: '⏹',
  failed: '❌',
};

/** 自动化规则存储抽象 */
export interface RulesStore {
  getRules(): RuleConfig[];
  saveRules(rules: RuleConfig[]): void;
}

export async function createWorkflowsPanel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
  runner?: AgentRunner,
  rulesStore?: RulesStore,
): Promise<{ section: HTMLElement; handle: WidgetHandle }> {
  const localRunner = runner || new AgentRunner(app);
  const section = createSection('Agent Workflows', '#8B5CF6', '');
  section.style.setProperty('--ax-accent', '#8B5CF6');
  section.addClass('ax-workflows-section');

  const cleaners: Array<() => void> = [];
  const registerCleanup = (fn: () => void) => { cleaners.push(fn); };

  // P3: 顶部按钮行 [History] [Templates] [Refresh]
  const toolbar = div('ax-wf-toolbar');
  const historyBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '🕘 History');
  const templatesBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '📄 Templates');
  const refreshBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '🔄');
  const automationBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '⚡ Rules');
  toolbar.appendChild(historyBtn);
  toolbar.appendChild(templatesBtn);
  toolbar.appendChild(automationBtn);
  toolbar.appendChild(refreshBtn);
  section.appendChild(toolbar);

  const container = div('ax-wf-container');
  section.appendChild(container);

  async function loadAndRender() {
    container.empty();
    container.appendChild(div('ax-wf-loading', '加载工作流模板...'));

    const templates = await localRunner.scanWorkflows();
    container.empty();

    if (templates.length === 0) {
      const empty = div('ax-wf-empty');
      empty.innerHTML = '暂无工作流模板<br><small>在 vault/dashboard/workflows/ 放置 .md 模板文件后刷新</small>';
      container.appendChild(empty);
      return;
    }

    const groups = new Map<string, WorkflowTemplate[]>();
    for (const tpl of templates) {
      const cat = tpl.category || '未分类';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(tpl);
    }

    for (const [category, tpls] of groups) {
      const groupEl = div('ax-wf-group');
      const groupHeader = div('ax-wf-group-header');
      groupHeader.innerHTML =
        '<span class="ax-wf-group-toggle">▾</span>' +
        '<span class="ax-wf-group-icon">' + esc(getCategoryIcon(category)) + '</span>' +
        '<span class="ax-wf-group-name">' + esc(category) + '</span>' +
        '<span class="ax-wf-group-count">' + tpls.length + '</span>';

      const groupBody = div('ax-wf-group-body');
      for (const tpl of tpls) {
        const { card, cleanup } = createWorkflowCard(app, tpl, localRunner);
        groupBody.appendChild(card);
        registerCleanup(cleanup);
      }

      const onHeaderClick = () => {
        const collapsed = groupBody.hasClass('ax-wf-group-body--collapsed');
        groupBody.toggleClass('ax-wf-group-body--collapsed', !collapsed);
        groupHeader.querySelector('.ax-wf-group-toggle')!.textContent = collapsed ? '▾' : '▸';
      };
      groupHeader.addEventListener('click', onHeaderClick);
      registerCleanup(() => groupHeader.removeEventListener('click', onHeaderClick));

      groupEl.appendChild(groupHeader);
      groupEl.appendChild(groupBody);
      container.appendChild(groupEl);
    }
  }

  const onHistoryClick = async () => {
    const history = await localRunner.getHistory(10);
    showHistoryModal(app, history, localRunner);
  };
  historyBtn.addEventListener('click', onHistoryClick);
  registerCleanup(() => historyBtn.removeEventListener('click', onHistoryClick));

  const onTemplatesClick = async () => {
    await showTemplateManager(app, localRunner, loadAndRender);
  };
  templatesBtn.addEventListener('click', onTemplatesClick);
  registerCleanup(() => templatesBtn.removeEventListener('click', onTemplatesClick));

  const onRefreshClick = () => { void loadAndRender(); };
  refreshBtn.addEventListener('click', onRefreshClick);
  registerCleanup(() => refreshBtn.removeEventListener('click', onRefreshClick));

  const onAutomationClick = () => {
    showAutomationModal(app, rulesStore);
  };
  automationBtn.addEventListener('click', onAutomationClick);
  registerCleanup(() => automationBtn.removeEventListener('click', onAutomationClick));

  // 注册 runner 回调——反注册函数入 cleaners
  const offProgress = localRunner.onProgress((_taskId, _line) => { /* 由 active task bar 订阅 */ });
  const offComplete = localRunner.onComplete((_taskId, _success, _output) => { void loadAndRender(); });
  registerCleanup(offProgress);
  registerCleanup(offComplete);

  await loadAndRender();

  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners) {
      try { fn(); } catch { /* ignore */ }
    }
    section.empty();
  });

  return { section, handle };
}

function getCategoryIcon(category: string): string {
  const map: Record<string, string> = {
    'Inbox Processing': '📥',
    'Deep Research': '🔬',
    'Vault Maintenance': '🔧',
    'Writing Draft': '✍️',
  };
  return map[category] || '⚙️';
}

// ==================== 工作流卡片 ====================

function createWorkflowCard(app: App, tpl: WorkflowTemplate, runner: AgentRunner): { card: HTMLElement; cleanup: () => void } {
  const card = div('ax-wf-card');
  const cleaners: Array<() => void> = [];

  const header = div('ax-wf-card-header');
  const nameRow = div('ax-wf-card-name-row');

  const icon = div('ax-wf-card-icon');
  icon.textContent = getCategoryIcon(tpl.category);

  const name = div('ax-wf-card-name');
  name.textContent = tpl.name;
  name.title = '点击查看完整提示词';

  const expandIndicator = div('ax-wf-card-expand-indicator', '▸');

  nameRow.appendChild(icon);
  nameRow.appendChild(name);
  nameRow.appendChild(expandIndicator);
  header.appendChild(nameRow);

  let promptPreview: HTMLElement | null = null;
  const onHeaderClick = () => {
    if (promptPreview) {
      promptPreview.remove();
      promptPreview = null;
      expandIndicator.textContent = '▸';
      expandIndicator.removeClass('ax-wf-card-expand-indicator--open');
    } else {
      promptPreview = createPromptPreview(app, tpl);
      card.appendChild(promptPreview);
      expandIndicator.textContent = '▾';
      expandIndicator.addClass('ax-wf-card-expand-indicator--open');
    }
  };
  header.addEventListener('click', onHeaderClick);
  cleaners.push(() => header.removeEventListener('click', onHeaderClick));

  card.appendChild(header);

  if (tpl.description) {
    const desc = div('ax-wf-card-desc');
    desc.textContent = tpl.description;
    card.appendChild(desc);
  }

  const actions = div('ax-wf-card-actions');
  const runBtn = el('button', { class: 'ax-btn ax-btn-primary ax-btn-sm', type: 'button' }, '▶ Run');
  const copyBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '📋 Copy Prompt');
  actions.appendChild(runBtn);
  actions.appendChild(copyBtn);
  card.appendChild(actions);

  const statusArea = div('ax-wf-card-status');
  statusArea.style.display = 'none';
  card.appendChild(statusArea);

  let currentTaskId: string | null = null;

  const offComplete = runner.onComplete((taskId, success, outputPath) => {
    if (taskId !== currentTaskId) return;
    if (success) {
      showCompletedState(statusArea, { id: taskId, startTime: Date.now(), endTime: Date.now() } as AgentTask, outputPath || '', app);
    } else {
      showStoppedState(statusArea, { id: taskId, startTime: Date.now() } as AgentTask);
    }
    runBtn.disabled = false;
    runBtn.removeClass('ax-btn--disabled');
    card.removeClass('ax-wf-card--running');
  });
  cleaners.push(offComplete);

  const offProgress = runner.onProgress((taskId, line) => {
    if (taskId !== currentTaskId) return;
    appendLogLine(statusArea, line);
  });
  cleaners.push(offProgress);

  const onRunClick = async () => {
    runBtn.disabled = true;
    runBtn.addClass('ax-btn--disabled');
    card.addClass('ax-wf-card--running');
    statusArea.style.display = 'none';
    statusArea.empty();

    try {
      const task = await runner.run(tpl.id);
      currentTaskId = task.id;
      showRunningState(statusArea, task);
    } catch (err: any) {
      showFailedState(statusArea, { id: '', error: err?.message || String(err) } as AgentTask, () => {
        statusArea.empty();
        statusArea.style.display = 'none';
        runBtn.click();
      });
      runBtn.disabled = false;
      runBtn.removeClass('ax-btn--disabled');
      card.removeClass('ax-wf-card--running');
    }
  };
  runBtn.addEventListener('click', onRunClick);
  cleaners.push(() => runBtn.removeEventListener('click', onRunClick));

  const onCopyClick = async () => {
    await copyToClipboard(tpl.prompt);
    showCopyFeedback(copyBtn);
  };
  copyBtn.addEventListener('click', onCopyClick);
  cleaners.push(() => copyBtn.removeEventListener('click', onCopyClick));

  return {
    card,
    cleanup: () => {
      for (const fn of cleaners) {
        try { fn(); } catch { /* ignore */ }
      }
    },
  };
}

function createPromptPreview(app: App, tpl: WorkflowTemplate): HTMLElement {
  const preview = div('ax-wf-prompt-preview');

  const header = div('ax-wf-prompt-header');
  header.innerHTML = '<span class="ax-wf-prompt-title">提示词预览</span>';

  const copyAllBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '📋 Copy full prompt');
  copyAllBtn.addEventListener('click', async () => {
    await copyToClipboard(tpl.prompt);
    showCopyFeedback(copyAllBtn);
  });
  header.appendChild(copyAllBtn);
  preview.appendChild(header);

  const codeBlock = div('ax-wf-prompt-code');
  codeBlock.textContent = tpl.prompt;
  preview.appendChild(codeBlock);

  return preview;
}

function showCopyFeedback(btn: HTMLButtonElement): void {
  const orig = btn.textContent;
  btn.textContent = '✅ Copied!';
  window.setTimeout(() => { btn.textContent = orig; }, 1500);
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function showRunningState(statusArea: HTMLElement, task: AgentTask): void {
  statusArea.empty();
  statusArea.style.display = 'block';
  statusArea.addClass('ax-wf-card-status--running');

  const progress = div('ax-wf-progress');
  progress.innerHTML = '<div class="ax-wf-progress-bar ax-wf-progress-bar--indeterminate"></div>';
  statusArea.appendChild(progress);

  const label = div('ax-wf-status-label', '⏳ Running...');
  statusArea.appendChild(label);

  const log = div('ax-wf-log');
  log.dataset.taskId = task.id;
  statusArea.appendChild(log);
}

function showCompletedState(statusArea: HTMLElement, task: AgentTask, outputPath: string, app: App): void {
  statusArea.empty();
  statusArea.removeClass('ax-wf-card-status--running');
  statusArea.addClass('ax-wf-card-status--completed');

  const duration = (task as any).durationStr || (task.endTime ? ((task.endTime - task.startTime) / 1000).toFixed(1) + 's' : '?');
  const label = div('ax-wf-status-label', '✅ Completed · 耗时' + duration + 's');
  statusArea.appendChild(label);

  const viewLink = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '📂 View Output');
  viewLink.addEventListener('click', () => {
    app.workspace.openLinkText(outputPath, '', 'tab');
  });
  statusArea.appendChild(viewLink);
}

function showStoppedState(statusArea: HTMLElement, task: AgentTask): void {
  statusArea.empty();
  statusArea.removeClass('ax-wf-card-status--running');
  statusArea.addClass('ax-wf-card-status--stopped');

  const duration = task.endTime ? ((task.endTime - task.startTime) / 1000).toFixed(1) : '?';
  const label = div('ax-wf-status-label', '⏹ Stopped · ran ' + duration + 's');
  statusArea.appendChild(label);
}

function showFailedState(statusArea: HTMLElement, task: AgentTask, onRetry: () => void): void {
  statusArea.empty();
  statusArea.removeClass('ax-wf-card-status--running');
  statusArea.addClass('ax-wf-card-status--failed');

  const label = div('ax-wf-status-label', '❌ Failed');
  statusArea.appendChild(label);

  if (task.error) {
    const errEl = div('ax-wf-error-msg');
    errEl.textContent = task.error;
    statusArea.appendChild(errEl);
  }

  const retryBtn = el('button', { class: 'ax-btn ax-btn-primary ax-btn-sm', type: 'button' }, '🔄 Retry');
  retryBtn.addEventListener('click', onRetry);
  statusArea.appendChild(retryBtn);
}

function appendLogLine(statusArea: HTMLElement, line: string): void {
  const log = statusArea.querySelector('.ax-wf-log') as HTMLElement;
  if (!log) return;
  const lineEl = document.createElement('div');
  lineEl.className = 'ax-wf-log-line';
  lineEl.textContent = line;
  log.appendChild(lineEl);
  log.scrollTop = log.scrollHeight;
}

// ==================== History 弹窗 ====================

function showHistoryModal(app: App, history: AgentTask[], runner: AgentRunner): void {
  const recent = history.slice(0, 10);
  const list = div('ax-wf-history-list');

  if (recent.length === 0) {
    list.appendChild(div('ax-wf-empty', '暂无运行记录'));
  } else {
    recent.forEach(task => {
      const item = div('ax-wf-history-item ax-wf-history-item--' + task.status);

      const statusIcon = STATUS_ICONS[task.status] || '❌';

      const time = new Date(task.startTime).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      const duration = task.endTime ? ((task.endTime - task.startTime) / 1000).toFixed(1) + 's' : '';

      item.innerHTML =
        '<span class="ax-wf-history-icon">' + statusIcon + '</span>' +
        '<span class="ax-wf-history-name">' + esc(task.name) + '</span>' +
        '<span class="ax-wf-history-time">' + esc(time) + '</span>' +
        (duration ? '<span class="ax-wf-history-dur">' + esc(duration) + '</span>' : '') +
        '<span class="ax-wf-history-output">' + esc(task.outputPath) + '</span>';

      const actions = div('ax-wf-history-actions');
      const reRunBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '🔄 Re-run');
      reRunBtn.addEventListener('click', () => {
        runner.run(task.workflowId);
        close();
      });
      const openLogsBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '📜 Logs');
      openLogsBtn.addEventListener('click', () => showLogViewer(app, task));
      actions.appendChild(reRunBtn);
      actions.appendChild(openLogsBtn);
      item.appendChild(actions);

      if (task.status === 'completed' && task.outputPath) {
        const outputEl = item.querySelector('.ax-wf-history-output') as HTMLElement;
        outputEl.style.cursor = 'pointer';
        outputEl.style.textDecoration = 'underline';
        outputEl.addEventListener('click', () => {
          app.workspace.openLinkText(task.outputPath, '', 'tab');
          close();
        });
      }

      list.appendChild(item);
    });
  }

  let close = () => {};
  const result = createModal({
    title: 'Agent 运行历史',
    content: list,
    actions: createModalActions(() => close()),
    wide: true,
  });
  close = result.close;
}

function showLogViewer(_app: App, task: AgentTask): void {
  const logContent = div('ax-wf-log-viewer');
  logContent.textContent = task.log || '(无日志)';

  let close = () => {};
  const result = createModal({
    title: '📜 日志: ' + esc(task.name),
    content: logContent,
    actions: createModalActions(() => close()),
    wide: true,
  });
  close = result.close;
}

// ==================== P5: 自动化规则配置弹窗 ====================

async function showAutomationModal(_app: App, store?: RulesStore): Promise<void> {
  const list = div('ax-auto-rule-list');

  function getRules(): RuleConfig[] {
    return store?.getRules() || [];
  }
  function persist(rules: RuleConfig[]): void {
    store?.saveRules(rules);
  }

  function loadList(): void {
    list.empty();
    const rules = getRules();

    if (rules.length === 0) {
      list.appendChild(div('ax-empty', '暂无自动化规则'));
      return;
    }

    rules.forEach(rule => {
      const item = div('ax-auto-rule-item');
      item.innerHTML =
        '<span class="ax-auto-rule-name">' + esc(rule.name) + '</span>' +
        '<span class="ax-auto-rule-trigger">' + esc(formatTrigger(rule)) + '</span>';

      const toggle = el('input', { type: 'checkbox', class: 'ax-auto-rule-toggle' }) as HTMLInputElement;
      toggle.checked = rule.enabled;
      toggle.addEventListener('change', () => {
        rule.enabled = toggle.checked;
        persist(getRules());
      });

      const delBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '🗑');
      delBtn.addEventListener('click', () => {
        const rules2 = getRules();
        const idx = rules2.findIndex(r => r.id === rule.id);
        if (idx >= 0) rules2.splice(idx, 1);
        persist(rules2);
        loadList();
      });

      const actions = div('ax-auto-rule-actions');
      actions.appendChild(toggle);
      actions.appendChild(delBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  function formatTrigger(rule: RuleConfig): string {
    const t = rule.trigger;
    if (t.type === 'schedule') {
      const params = t.params as { mode: string; intervalMs?: number };
      if (params.mode === 'every' && params.intervalMs) {
        const minutes = Math.round(params.intervalMs / 60_000);
        if (minutes >= 1440) return '每 ' + Math.round(minutes / 1440) + ' 天';
        return '每 ' + minutes + ' 分钟';
      }
      if (params.mode === 'at') {
        const hour = (params as any).hour ?? 0;
        const minute = (params as any).minute ?? 0;
        return '每天 ' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
      }
    }
    if (t.type === 'inbox_threshold') {
      const threshold = (t.params as { threshold: number }).threshold || 5;
      return 'Inbox ≥ ' + threshold + ' 条';
    }
    if (t.type === 'on_startup') return '打开 Dashboard';
    if (t.type === 'event') return 'Vault 文件变化';
    return t.type;
  }

  const newBtn = el('button', { class: 'ax-btn ax-btn-primary ax-btn-sm', type: 'button' }, '＋ 新建规则');
  newBtn.addEventListener('click', async () => {
    const { showInputDialog } = await import('../utils/dialog');

    const name = await showInputDialog(_app, '新建自动化规则', '规则名称');
    if (!name) return;

    const triggerType = await showInputDialog(_app, '触发类型', 'schedule / inbox_threshold / on_startup / event', 'schedule');
    if (!triggerType) return;

    const actionType = await showInputDialog(_app, '动作类型', 'pull_rss / pull_github / inbox_auto_route / vault_lint / daily_diary', 'vault_lint');
    if (!actionType) return;

    let triggerConfig: import('../services/triggers').TriggerConfig;

    if (triggerType === 'schedule') {
      const mode = await showInputDialog(_app, '定时模式', 'every (固定间隔) / at (每天定时)', 'every');
      if (!mode) return;

      if (mode === 'every') {
        const min = await showInputDialog(_app, '定时间隔', '分钟', '1440');
        const intervalMs = parseInt(min || '1440', 10) * 60_000;
        triggerConfig = { type: 'schedule', params: { mode: 'every', intervalMs } };
      } else {
        const hourStr = await showInputDialog(_app, '执行时间（小时）', '0-23', '9');
        const minuteStr = await showInputDialog(_app, '执行时间（分钟）', '0-59', '0');
        triggerConfig = {
          type: 'schedule',
          params: { mode: 'at', hour: parseInt(hourStr || '9', 10), minute: parseInt(minuteStr || '0', 10) },
        };
      }
    } else if (triggerType === 'inbox_threshold') {
      const cnt = await showInputDialog(_app, 'Inbox 阈值', '条数', '5');
      triggerConfig = { type: 'inbox_threshold', params: { threshold: parseInt(cnt || '5', 10) } };
    } else if (triggerType === 'on_startup') {
      triggerConfig = { type: 'on_startup', params: {} };
    } else if (triggerType === 'event') {
      triggerConfig = { type: 'event', params: { debounceMs: 500 } };
    } else {
      triggerConfig = { type: triggerType, params: {} };
    }

    const rule: RuleConfig = {
      id: 'rule-' + Date.now().toString(36),
      name,
      enabled: true,
      trigger: triggerConfig,
      actionName: actionType as any,
      createdAt: Date.now(),
    };

    const existing = getRules();
    existing.push(rule);
    persist(existing);
    loadList();
  });

  const actionsBar = div('ax-auto-rule-header');
  actionsBar.appendChild(newBtn);

  let close = () => {};
  const result = createModal({
    title: '⚡ 自动化规则',
    content: list,
    actions: createModalActions(() => close(), actionsBar),
    wide: true,
  });
  close = result.close;

  loadList();
}

// ==================== 模板管理弹窗 ====================

async function showTemplateManager(app: App, runner: AgentRunner, onUpdate: () => void): Promise<void> {
  const list = div('ax-wf-tpl-list');

  async function loadList() {
    list.empty();
    const templates = await runner.scanWorkflows();
    if (templates.length === 0) {
      list.appendChild(div('ax-wf-empty', '暂无模板'));
      return;
    }
    templates.forEach(tpl => {
      const item = div('ax-wf-tpl-item');
      item.innerHTML =
        '<span class="ax-wf-tpl-name">' + esc(tpl.name) + '</span>' +
        '<span class="ax-wf-tpl-cat">' + esc(tpl.category) + '</span>';

      const editBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '✏️');
      const delBtn = el('button', { class: 'ax-btn ax-btn-ghost ax-btn-sm', type: 'button' }, '🗑');

      editBtn.addEventListener('click', async () => {
        await editTemplate(app, runner, tpl.id, onUpdate);
      });

      delBtn.addEventListener('click', async () => {
        const { showConfirmDialog } = await import('../utils/dialog');
        const ok = await showConfirmDialog(app, '删除模板', '确定删除模板 "' + tpl.name + '"？');
        if (ok) {
          await runner.deleteTemplate(tpl.id);
          await loadList();
          await onUpdate();
        }
      });

      const actions = div('ax-wf-tpl-actions');
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  const newBtn = el('button', { class: 'ax-btn ax-btn-primary ax-btn-sm', type: 'button' }, '＋ 新建模板');
  newBtn.addEventListener('click', async () => {
    const { showInputDialog } = await import('../utils/dialog');
    const id = await showInputDialog(app, '新建模板', '模板 ID（如 my-workflow）');
    if (!id) return;
    const name = (await showInputDialog(app, '模板名称', '如 深度研究')) || id;
    const category = (await showInputDialog(app, '分类', '如 Research')) || 'Custom';
    await runner.createTemplate(id, category, name);
    await loadList();
    await onUpdate();
  });

  let close = () => {};
  const result = createModal({
    title: '📄 模板管理',
    content: list,
    actions: createModalActions(() => close()),
    wide: true,
  });
  close = result.close;

  await loadList();
}

async function editTemplate(app: App, runner: AgentRunner, id: string, onUpdate: () => void): Promise<void> {
  const vault = app.vault;
  const path = 'dashboard/workflows/' + id + '.md';
  const file = vault.getAbstractFileByPath(path);
  if (!file || !(file instanceof TFile)) return;

  const content = await vault.read(file);
  const textarea = el('textarea', {
    class: 'ax-wf-editor',
    spellcheck: 'false',
  }, content) as HTMLTextAreaElement;

  const saveBtn = el('button', { class: 'ax-btn ax-btn-primary', type: 'button' }, '💾 保存');
  let close = () => {};
  const result = createModal({
    title: '✏️ 编辑: ' + id,
    content: textarea,
    actions: createModalActions(() => close(), saveBtn),
    wide: true,
  });
  close = result.close;

  saveBtn.addEventListener('click', async () => {
    await runner.updateTemplate(id, textarea.value);
    close();
    await onUpdate();
    new Notice('✅ 模板已保存');
  });

  window.setTimeout(() => textarea.focus(), MEMO_FOCUS_DELAY_MS);
}
