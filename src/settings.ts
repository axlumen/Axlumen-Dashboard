/**
 * settings.ts — 设置面板
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type GullDockPlugin from './main';
import { DashboardSettings, WidgetConfig } from './types';
import { SETTINGS_DEBOUNCE_MS } from './constants';

export const DEFAULT_SETTINGS: DashboardSettings = {
  brandName: 'GullDock',
  brandSub: '知是行之始，行是知之成。',
  quoteAuthor: '王阳明',
  countdowns: [
    { target: '2026-12-31', label: '距年终' },
  ],
  theme: 'island',
  claudeCodePath: 'claude',
  agentDefaultModel: 'claude-sonnet-4-6',
  vaultPath: '',
  autoRefresh: true,
  wikis: [
    {
      name: 'Tech Wiki',
      icon: '⚡',
      color: '#4D8DFF',
      rootPath: 'tech-wiki',
      indexPage: 'tech-wiki/wiki/index.md',
    },
    {
      name: 'Finance Wiki',
      icon: '📊',
      color: '#34D399',
      rootPath: 'finance-wiki',
      indexPage: 'finance-wiki/wiki/index.md',
    },
    {
      name: 'Personal Wiki',
      icon: '🧠',
      color: '#A78BFA',
      rootPath: 'Axlumen-wiki',
      indexPage: 'Axlumen-wiki/wiki/index.md',
    },
  ],
  quickLinks: [
    { icon: '📝', label: '日志', path: 'tech-wiki/log' },
    { icon: '🔍', label: 'README', path: 'README.md' },
  ],
  commands: [
    { command: '/ingest', description: '摄入新来源到 Wiki' },
    { command: '/query', description: '查询知识库' },
    { command: '/compile', description: '编译重组 Wiki 内容' },
    { command: '/lint', description: '健康检查 Wiki' },
    { command: '/audit', description: '处理审计反馈' },
    { command: '/refresh', description: '刷新控制面板数据' },
  ],
  projects: [
    {
      priority: 'p0',
      tag: 'P0 · AI',
      name: '产业链智能投研 Agent',
      description: '基于 AI 的产业链分析和投资研究自动化工具。',
      trace: 'G0 → M0 → P0',
      path: 'tech-wiki/wiki/concepts/industry-chain-research-agent.md',
      emoji: '🔬',
      gradient: 'linear-gradient(135deg,#0A45D6,#4D8DFF)',
    },
    {
      priority: 'p0',
      tag: 'P0 · 工具',
      name: '记账 APP',
      description: '个人财务管理应用，记录收支、分析消费趋势。',
      trace: 'G0 → M0 → P0',
      path: 'finance-wiki/wiki/concepts/记账APP.md',
      emoji: '💰',
      gradient: 'linear-gradient(135deg,#0F766E,#34D399)',
    },
  ],
  quotes: [
    { text: '知是行之始，行是知之成。', source: '王阳明' },
    { text: '模型会商品化，上下文会差异化。', source: 'AI 时代洞察' },
    { text: '用系统而非意志力，不靠自律，靠系统运转。', source: '个人系统论' },
    { text: '知识的复利效应：每次输入都在为未来积累。', source: 'Zettelkasten 方法论' },
    { text: '结构化经验的人，能更好地调用 AI。', source: '人机协作哲学' },
    { text: '吾日三省吾身：为人谋而不忠乎？与朋友交而不信乎？传不习乎？', source: '论语·学而' },
  ],
  // Phase 2: 侧栏 Widget 开关
  widgets: {
    agentStatus: true,
    quickMemo: true,
  },
  // Banner 配置
  banner: {
    enableQuoteRotation: false,
    bannerMode: 'detailed',
  },
  // 轻量 UI 状态默认值（由 LocalStore 管理）
  uiState: {
    focusState: { pinned: false, autoMode: true, focusIndex: 0 },
    cardCollapse: {},
    cardOrder: [],
    memoDraft: '',
    feedLastRefresh: '',
  },
  // 自动化规则默认值（持久化到 data.json，不用再 localStorage）
  automationRules: [
    {
      id: 'auto-inbox-route',
      name: 'Inbox 自动路由（≥5条触发）',
      enabled: true,
      trigger: { type: 'inbox_threshold', inboxCount: 5 },
      action: { type: 'inbox_auto_route', workflowId: 'inbox-auto-routing' },
      createdAt: 0,
    },
    {
      id: 'auto-vault-lint',
      name: '每日 Vault 健康扫描',
      enabled: true,
      trigger: { type: 'cron', intervalMinutes: 1440 },
      action: { type: 'vault_lint', workflowId: 'vault-lint-full-scan' },
      createdAt: 0,
    },
    {
      id: 'auto-daily-diary',
      name: '打开时生成每日日记',
      enabled: false,
      trigger: { type: 'on_startup' },
      action: { type: 'daily_diary', workflowId: 'daily-diary-summary' },
      createdAt: 0,
    },
  ],
};

export class DashboardSettingTab extends PluginSettingTab {
  plugin: GullDockPlugin;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(app: App, plugin: GullDockPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** 防抖保存：文本输入时延迟写盘 */
  private debouncedSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.plugin.saveSettings();
      this.saveTimer = null;
    }, SETTINGS_DEBOUNCE_MS);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'GullDock 设置' });

    // 品牌设置
    containerEl.createEl('h3', { text: '🎨 品牌' });

    new Setting(containerEl)
      .setName('品牌名称')
      .setDesc('显示在 Hero 区的名称')
      .addText(text => text
        .setPlaceholder('GullDock')
        .setValue(this.plugin.settings.brandName)
        .onChange(value => {
          this.plugin.settings.brandName = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('品牌标语')
      .setDesc('显示在品牌名下方')
      .addText(text => text
        .setPlaceholder('知是行之始，行是知之成。')
        .setValue(this.plugin.settings.brandSub)
        .onChange(value => {
          this.plugin.settings.brandSub = value;
          this.debouncedSave();
        }));

    // 倒计时
    containerEl.createEl('h3', { text: '⏰ 倒计时' });
    containerEl.createEl('p', {
      text: '支持多个倒计时，每行一个。',
      cls: 'setting-item-description',
    });

    this.plugin.settings.countdowns.forEach((cd, i) => {
      new Setting(containerEl)
        .setName(`倒计时 ${i + 1}: ${cd.label}`)
        .setDesc('目标日期 (YYYY-MM-DD)')
        .addText(text => text
          .setPlaceholder('2026-12-31')
          .setValue(cd.target)
          .onChange(value => {
            this.plugin.settings.countdowns[i].target = value;
            this.debouncedSave();
          }))
        .addText(text => text
          .setPlaceholder('标签')
          .setValue(cd.label)
          .onChange(value => {
            this.plugin.settings.countdowns[i].label = value;
            this.debouncedSave();
          }))
        .addButton(btn => btn
          .setIcon('trash')
          .setTooltip('删除')
          .onClick(async () => {
            this.plugin.settings.countdowns = this.plugin.settings.countdowns.filter((_, idx) => idx !== i);
            await this.plugin.saveSettings();
            this.display();
          }));
    });

    new Setting(containerEl)
      .setName('添加倒计时')
      .addButton(btn => btn
        .setButtonText('+ 添加')
        .onClick(async () => {
          this.plugin.settings.countdowns.push({ target: '2026-12-31', label: '新倒计时' });
          await this.plugin.saveSettings();
          this.display();
        }));

    // 主题切换
    containerEl.createEl('h3', { text: '🎨 外观' });

    // Banner 设置
    containerEl.createEl('h4', { text: '📌 Banner 概览栏' });

    new Setting(containerEl)
      .setName('金句轮播')
      .setDesc('在 Banner 中显示金句轮播（默认关闭，优先展示工作摘要）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.banner.enableQuoteRotation)
        .onChange(value => {
          this.plugin.settings.banner.enableQuoteRotation = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('Banner 模式')
      .setDesc('详细模式显示今日概览摘要栏，简洁模式仅显示品牌+状态')
      .addDropdown(dropdown => dropdown
        .addOption('detailed', '📊 详细 — 今日概览摘要栏')
        .addOption('compact', '✨ 简洁 — 品牌 + 状态指示')
        .setValue(this.plugin.settings.banner.bannerMode)
        .onChange(value => {
          this.plugin.settings.banner.bannerMode = value as 'detailed' | 'compact';
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('主题模式')
      .setDesc('Dashboard 视觉主题：Island（动物森友会暖绿）或 Nordic（极简蓝白）')
      .addDropdown(dropdown => dropdown
        .addOption('island', '🏝️ Island — 暖绿森友会')
        .addOption('nordic', '❄️ Nordic — 极简蓝白')
        .setValue(this.plugin.settings.theme)
        .onChange(value => {
          this.plugin.settings.theme = value as 'island' | 'nordic';
          this.plugin.saveSettings();
        }));

    // Claude Code CLI
    containerEl.createEl('h3', { text: '🤖 Claude Code CLI' });

    new Setting(containerEl)
      .setName('CLI 路径')
      .setDesc('claude 可执行文件的路径（通常为 "claude"）')
      .addText(text => text
        .setPlaceholder('claude')
        .setValue(this.plugin.settings.claudeCodePath)
        .onChange(value => {
          this.plugin.settings.claudeCodePath = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('默认模型')
      .setDesc('Agent 任务使用的模型（仅作记录，不影响 CLI 实际调用）')
      .addText(text => text
        .setPlaceholder('claude-sonnet-4-6')
        .setValue(this.plugin.settings.agentDefaultModel)
        .onChange(value => {
          this.plugin.settings.agentDefaultModel = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('Vault 路径')
      .setDesc('Obsidian Vault 的绝对路径（供 Agent CLI 使用，留空则自动检测）')
      .addText(text => text
        .setPlaceholder('/Users/you/Documents/MyVault')
        .setValue(this.plugin.settings.vaultPath)
        .onChange(value => {
          this.plugin.settings.vaultPath = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('自动刷新')
      .setDesc('Vault 文件变动时自动刷新 Dashboard（事件驱动）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoRefresh)
        .onChange(value => {
          this.plugin.settings.autoRefresh = value;
          this.debouncedSave();
        }));

    // 侧栏 Widget 开关
    containerEl.createEl('h3', { text: '🧩 侧栏 Widget' });
    containerEl.createEl('p', {
      text: '控制左侧边栏中显示哪些小部件。',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('Agent 状态')
      .setDesc('显示 Agent 运行状态指示灯和队列信息')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.widgets.agentStatus)
        .onChange(value => {
          this.plugin.settings.widgets.agentStatus = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('快速便签')
      .setDesc('侧栏底部快速写入 Inbox')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.widgets.quickMemo)
        .onChange(value => {
          this.plugin.settings.widgets.quickMemo = value;
          this.debouncedSave();
        }));

    // 数据存储
    containerEl.createEl('h3', { text: '💾 数据存储' });
    containerEl.createEl('p', {
      text: '待办清单数据存储在 _gulldock/todos.json（YAML frontmatter 格式），可被 Obsidian Sync 同步。',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('存储路径')
      .setDesc('待办数据文件路径（相对 Vault 根目录）')
      .addText(text => text
        .setPlaceholder('_gulldock/todos.json')
        .setValue('_gulldock/todos.json')
        .setDisabled(true));

    // Wiki 配置
    containerEl.createEl('h3', { text: '📚 Wiki 配置' });
    containerEl.createEl('p', {
      text: '三个 Wiki 的目录路径和入口页面配置。',
      cls: 'setting-item-description',
    });

    for (let i = 0; i < this.plugin.settings.wikis.length; i++) {
      const wiki = this.plugin.settings.wikis[i];
      containerEl.createEl('h4', { text: `${wiki.icon} ${wiki.name}` });

      new Setting(containerEl)
        .setName('根目录')
        .setDesc('Wiki 的根目录路径')
        .addText(text => text
          .setValue(wiki.rootPath)
          .onChange(value => {
            this.plugin.settings.wikis[i].rootPath = value;
            this.debouncedSave();
          }));

      new Setting(containerEl)
        .setName('入口页面')
        .setDesc('Wiki 的 index 页面路径')
        .addText(text => text
          .setValue(wiki.indexPage)
          .onChange(value => {
            this.plugin.settings.wikis[i].indexPage = value;
            this.debouncedSave();
          }));
    }

    // ===== Apex 新增设置 =====

    // 番茄钟
    containerEl.createEl('h3', { text: '🍅 番茄钟' });

    new Setting(containerEl)
      .setName('启用番茄钟')
      .setDesc('在侧栏显示番茄钟计时器')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.pomodoroEnabled ?? false)
        .onChange(value => {
          this.plugin.settings.pomodoroEnabled = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('工作时长（分钟）')
      .addText(text => text
        .setPlaceholder('25')
        .setValue(String(this.plugin.settings.pomodoroWorkMinutes ?? 25))
        .onChange(value => {
          this.plugin.settings.pomodoroWorkMinutes = parseInt(value) || 25;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('短休息时长（分钟）')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(String(this.plugin.settings.pomodoroShortBreakMinutes ?? 5))
        .onChange(value => {
          this.plugin.settings.pomodoroShortBreakMinutes = parseInt(value) || 5;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('长休息时长（分钟）')
      .addText(text => text
        .setPlaceholder('15')
        .setValue(String(this.plugin.settings.pomodoroLongBreakMinutes ?? 15))
        .onChange(value => {
          this.plugin.settings.pomodoroLongBreakMinutes = parseInt(value) || 15;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('长休息间隔')
      .setDesc('每完成几个番茄后触发长休息')
      .addText(text => text
        .setPlaceholder('4')
        .setValue(String(this.plugin.settings.pomodoroLongBreakInterval ?? 4))
        .onChange(value => {
          this.plugin.settings.pomodoroLongBreakInterval = parseInt(value) || 4;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('自动开始休息')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.pomodoroAutoStartBreak ?? true)
        .onChange(value => {
          this.plugin.settings.pomodoroAutoStartBreak = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('提示音')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.pomodoroSoundEnabled ?? true)
        .onChange(value => {
          this.plugin.settings.pomodoroSoundEnabled = value;
          this.debouncedSave();
        }));

    // 天气
    containerEl.createEl('h3', { text: '🌤️ 天气' });

    new Setting(containerEl)
      .setName('启用天气')
      .setDesc('在侧栏显示天气信息')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.widgetWeatherEnabled ?? false)
        .onChange(value => {
          this.plugin.settings.widgetWeatherEnabled = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('城市')
      .addText(text => text
        .setPlaceholder('Shanghai')
        .setValue(this.plugin.settings.widgetWeatherCity ?? 'Shanghai')
        .onChange(value => {
          this.plugin.settings.widgetWeatherCity = value;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('纬度')
      .addText(text => text
        .setPlaceholder('31.23')
        .setValue(String(this.plugin.settings.widgetWeatherLat ?? 31.23))
        .onChange(value => {
          this.plugin.settings.widgetWeatherLat = parseFloat(value) || 31.23;
          this.debouncedSave();
        }));

    new Setting(containerEl)
      .setName('经度')
      .addText(text => text
        .setPlaceholder('121.47')
        .setValue(String(this.plugin.settings.widgetWeatherLon ?? 121.47))
        .onChange(value => {
          this.plugin.settings.widgetWeatherLon = parseFloat(value) || 121.47;
          this.debouncedSave();
        }));
  }
}