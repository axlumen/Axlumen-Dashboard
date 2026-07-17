var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/services/taskParser.ts
var taskParser_exports = {};
__export(taskParser_exports, {
  parseAllPendingTasks: () => parseAllPendingTasks,
  parseTasksFromDailyNotes: () => parseTasksFromDailyNotes
});
function parseTasksFromContent(content, sourcePath, defaultDate) {
  const tasks = [];
  for (const line of content.split("\n")) {
    const match = line.match(TASK_REGEX);
    if (!match)
      continue;
    const done = match[1].toLowerCase() === "x";
    let text = match[2].trim();
    let priority = "medium";
    if (text.includes("\u{1F534}") || text.includes("!!!") || text.startsWith("P0")) {
      priority = "high";
    } else if (text.includes("\u{1F7E2}") || text.includes("!!!") === false && text.includes("P2")) {
      priority = "low";
    }
    text = text.replace(/^(🔴|🟡|🟢)\s*/, "").replace(/^P[012]\s*[··]?\s*/, "");
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/);
    const dueDate = dateMatch ? dateMatch[1].length === 5 ? `${(/* @__PURE__ */ new Date()).getFullYear()}-${dateMatch[1]}` : dateMatch[1] : defaultDate;
    tasks.push({
      text: dateMatch ? text.replace(/\s*\d{4}-\d{2}-\d{2}|\s*\d{2}-\d{2}$/, "").trim() : text,
      done,
      dueDate,
      source: sourcePath,
      priority
    });
  }
  return tasks;
}
async function parseTasksFromDailyNotes(app, dir = "Daily", daysBack = 7) {
  const allTasks = [];
  const today = /* @__PURE__ */ new Date();
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const candidates = [
      `${dir}/${dateStr}.md`,
      `${dir}/${dateStr.replace(/-/g, "/")}.md`,
      `${dir}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${dateStr}.md`
    ];
    for (const path of candidates) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file instanceof import_obsidian4.TFile) {
        const content = await app.vault.read(file);
        const tasks = parseTasksFromContent(content, path, dateStr);
        allTasks.push(...tasks);
        break;
      }
    }
  }
  return allTasks;
}
async function parseAllPendingTasks(app) {
  const allTasks = [];
  const files = app.vault.getMarkdownFiles();
  for (const file of files) {
    if (file.path.includes("Inbox/") || file.path.includes("archive/"))
      continue;
    const content = await app.vault.read(file);
    const tasks = parseTasksFromContent(content, file.path, file.stat.mtime.toString().slice(0, 10));
    allTasks.push(...tasks.filter((t) => !t.done));
  }
  return allTasks;
}
var import_obsidian4, TASK_REGEX;
var init_taskParser = __esm({
  "src/services/taskParser.ts"() {
    import_obsidian4 = require("obsidian");
    TASK_REGEX = /^-\s\[([ xX])\]\s+(.+)$/;
  }
});

// src/utils/dialog.ts
var dialog_exports = {};
__export(dialog_exports, {
  showConfirmDialog: () => showConfirmDialog,
  showInputDialog: () => showInputDialog
});
function showInputDialog(app, title, placeholder, defaultValue = "") {
  return new Promise((resolve) => {
    new InputDialog(app, title, placeholder, defaultValue, resolve).open();
  });
}
function showConfirmDialog(app, title, message) {
  return new Promise((resolve) => {
    new ConfirmDialog(app, title, message, resolve).open();
  });
}
var import_obsidian8, InputDialog, ConfirmDialog;
var init_dialog = __esm({
  "src/utils/dialog.ts"() {
    import_obsidian8 = require("obsidian");
    InputDialog = class extends import_obsidian8.Modal {
      constructor(app, title, placeholder, defaultValue, resolve) {
        super(app);
        this.titleEl.setText(title);
        this.result = defaultValue;
        this.resolve = resolve;
      }
      onOpen() {
        const { contentEl } = this;
        let textComponent;
        new import_obsidian8.Setting(contentEl).addText((text) => {
          textComponent = text;
          text.setPlaceholder(this.result ? "" : "\u8BF7\u8F93\u5165...").setValue(this.result).onChange((v) => {
            this.result = v;
          });
        });
        new import_obsidian8.Setting(contentEl).addButton((btn) => btn.setButtonText("\u786E\u5B9A").setCta().onClick(() => {
          this.close();
          this.resolve(this.result || null);
        })).addButton((btn) => btn.setButtonText("\u53D6\u6D88").onClick(() => {
          this.close();
          this.resolve(null);
        }));
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    ConfirmDialog = class extends import_obsidian8.Modal {
      constructor(app, title, message, resolve) {
        super(app);
        this.titleEl.setText(title);
        this.resolve = resolve;
        this.contentEl.setText(message);
      }
      onOpen() {
        const { contentEl } = this;
        new import_obsidian8.Setting(contentEl).addButton((btn) => btn.setButtonText("\u786E\u5B9A").setCta().onClick(() => {
          this.close();
          this.resolve(true);
        })).addButton((btn) => btn.setButtonText("\u53D6\u6D88").onClick(() => {
          this.close();
          this.resolve(false);
        }));
      }
      onClose() {
        this.contentEl.empty();
      }
    };
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AxlumenDashboardPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian12 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");

// src/constants.ts
var MS_PER_DAY = 864e5;
var MS_PER_MINUTE = 6e4;
var MS_PER_HOUR = 36e5;
var CLOCK_INTERVAL_MS = 3e4;
var TOAST_DURATION_MS = 1500;
var MEMO_FOCUS_DELAY_MS = 200;
var SETTINGS_DEBOUNCE_MS = 300;
var HEALTH_FRESHNESS_THRESHOLDS = [30, 60, 90];
var HEALTH_FRESHNESS_SCORES = [25, 18, 10, 5];
var HEALTH_INDEX_SCORE = 15;
var HEALTH_STRUCTURE_SCORE = 25;
var HEALTH_LOG_SCORE = 20;
var HEATMAP_CELL_SIZE = 12;
var HEATMAP_GAP = 3;
var HEATMAP_LOW_THRESHOLD = 2;
var HEATMAP_HIGH_THRESHOLD = 5;
var AUTO_REFRESH_DEBOUNCE_MS = 500;
var TODOS_FILE_PATH_LEGACY = ".axlumen-todos.json";
var TODOS_FILE_PATH = "_axlumen/todos.json";
var TODOS_DIR = "_axlumen";

// src/settings.ts
var DEFAULT_SETTINGS = {
  brandName: "Axlumen",
  brandSub: "\u77E5\u662F\u884C\u4E4B\u59CB\uFF0C\u884C\u662F\u77E5\u4E4B\u6210\u3002",
  quoteAuthor: "\u738B\u9633\u660E",
  countdowns: [
    { target: "2026-12-31", label: "\u8DDD\u5E74\u7EC8" }
  ],
  theme: "island",
  claudeCodePath: "claude",
  agentDefaultModel: "claude-sonnet-4-6",
  vaultPath: "",
  autoRefresh: true,
  wikis: [
    {
      name: "Tech Wiki",
      icon: "\u26A1",
      color: "#4D8DFF",
      rootPath: "tech-wiki",
      indexPage: "tech-wiki/wiki/index.md"
    },
    {
      name: "Finance Wiki",
      icon: "\u{1F4CA}",
      color: "#34D399",
      rootPath: "finance-wiki",
      indexPage: "finance-wiki/wiki/index.md"
    },
    {
      name: "Axlumen Wiki",
      icon: "\u{1F9E0}",
      color: "#A78BFA",
      rootPath: "Axlumen-wiki",
      indexPage: "Axlumen-wiki/wiki/index.md"
    }
  ],
  quickLinks: [
    { icon: "\u{1F4DD}", label: "\u65E5\u5FD7", path: "tech-wiki/log" },
    { icon: "\u{1F50D}", label: "README", path: "README.md" }
  ],
  commands: [
    { command: "/ingest", description: "\u6444\u5165\u65B0\u6765\u6E90\u5230 Wiki" },
    { command: "/query", description: "\u67E5\u8BE2\u77E5\u8BC6\u5E93" },
    { command: "/compile", description: "\u7F16\u8BD1\u91CD\u7EC4 Wiki \u5185\u5BB9" },
    { command: "/lint", description: "\u5065\u5EB7\u68C0\u67E5 Wiki" },
    { command: "/audit", description: "\u5904\u7406\u5BA1\u8BA1\u53CD\u9988" },
    { command: "/refresh", description: "\u5237\u65B0\u63A7\u5236\u9762\u677F\u6570\u636E" }
  ],
  projects: [
    {
      priority: "p0",
      tag: "P0 \xB7 AI",
      name: "\u4EA7\u4E1A\u94FE\u667A\u80FD\u6295\u7814 Agent",
      description: "\u57FA\u4E8E AI \u7684\u4EA7\u4E1A\u94FE\u5206\u6790\u548C\u6295\u8D44\u7814\u7A76\u81EA\u52A8\u5316\u5DE5\u5177\u3002",
      trace: "G0 \u2192 M0 \u2192 P0",
      path: "tech-wiki/wiki/concepts/industry-chain-research-agent.md",
      emoji: "\u{1F52C}",
      gradient: "linear-gradient(135deg,#0A45D6,#4D8DFF)"
    },
    {
      priority: "p0",
      tag: "P0 \xB7 \u5DE5\u5177",
      name: "\u8BB0\u8D26 APP",
      description: "\u4E2A\u4EBA\u8D22\u52A1\u7BA1\u7406\u5E94\u7528\uFF0C\u8BB0\u5F55\u6536\u652F\u3001\u5206\u6790\u6D88\u8D39\u8D8B\u52BF\u3002",
      trace: "G0 \u2192 M0 \u2192 P0",
      path: "finance-wiki/wiki/concepts/\u8BB0\u8D26APP.md",
      emoji: "\u{1F4B0}",
      gradient: "linear-gradient(135deg,#0F766E,#34D399)"
    }
  ],
  quotes: [
    { text: "\u77E5\u662F\u884C\u4E4B\u59CB\uFF0C\u884C\u662F\u77E5\u4E4B\u6210\u3002", source: "\u738B\u9633\u660E" },
    { text: "\u6A21\u578B\u4F1A\u5546\u54C1\u5316\uFF0C\u4E0A\u4E0B\u6587\u4F1A\u5DEE\u5F02\u5316\u3002", source: "AI \u65F6\u4EE3\u6D1E\u5BDF" },
    { text: "\u7528\u7CFB\u7EDF\u800C\u975E\u610F\u5FD7\u529B\uFF0C\u4E0D\u9760\u81EA\u5F8B\uFF0C\u9760\u7CFB\u7EDF\u8FD0\u8F6C\u3002", source: "\u4E2A\u4EBA\u7CFB\u7EDF\u8BBA" },
    { text: "\u77E5\u8BC6\u7684\u590D\u5229\u6548\u5E94\uFF1A\u6BCF\u6B21\u8F93\u5165\u90FD\u5728\u4E3A\u672A\u6765\u79EF\u7D2F\u3002", source: "Zettelkasten \u65B9\u6CD5\u8BBA" },
    { text: "\u7ED3\u6784\u5316\u7ECF\u9A8C\u7684\u4EBA\uFF0C\u80FD\u66F4\u597D\u5730\u8C03\u7528 AI\u3002", source: "\u4EBA\u673A\u534F\u4F5C\u54F2\u5B66" },
    { text: "\u543E\u65E5\u4E09\u7701\u543E\u8EAB\uFF1A\u4E3A\u4EBA\u8C0B\u800C\u4E0D\u5FE0\u4E4E\uFF1F\u4E0E\u670B\u53CB\u4EA4\u800C\u4E0D\u4FE1\u4E4E\uFF1F\u4F20\u4E0D\u4E60\u4E4E\uFF1F", source: "\u8BBA\u8BED\xB7\u5B66\u800C" }
  ],
  // Phase 2: 侧栏 Widget 开关
  widgets: {
    weekCalendar: true,
    agentStatus: true,
    quickMemo: true
  },
  // Banner 配置
  banner: {
    enableQuoteRotation: false,
    bannerMode: "detailed"
  },
  // 轻量 UI 状态默认值（由 LocalStore 管理）
  uiState: {
    focusState: { pinned: false, autoMode: true, focusIndex: 0 },
    cardCollapse: {},
    cardOrder: [],
    memoDraft: "",
    feedLastRefresh: ""
  },
  // 自动化规则默认值（持久化到 data.json，不用再 localStorage）
  automationRules: [
    {
      id: "auto-inbox-route",
      name: "Inbox \u81EA\u52A8\u8DEF\u7531\uFF08\u22655\u6761\u89E6\u53D1\uFF09",
      enabled: true,
      trigger: { type: "inbox_threshold", inboxCount: 5 },
      action: { type: "inbox_auto_route", workflowId: "inbox-auto-routing" },
      createdAt: 0
    },
    {
      id: "auto-vault-lint",
      name: "\u6BCF\u65E5 Vault \u5065\u5EB7\u626B\u63CF",
      enabled: true,
      trigger: { type: "cron", intervalMinutes: 1440 },
      action: { type: "vault_lint", workflowId: "vault-lint-full-scan" },
      createdAt: 0
    },
    {
      id: "auto-daily-diary",
      name: "\u6253\u5F00\u65F6\u751F\u6210\u6BCF\u65E5\u65E5\u8BB0",
      enabled: false,
      trigger: { type: "on_startup" },
      action: { type: "daily_diary", workflowId: "daily-diary-summary" },
      createdAt: 0
    }
  ]
};
var DashboardSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.saveTimer = null;
    this.plugin = plugin;
  }
  /** 防抖保存：文本输入时延迟写盘 */
  debouncedSave() {
    if (this.saveTimer)
      clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.plugin.saveSettings();
      this.saveTimer = null;
    }, SETTINGS_DEBOUNCE_MS);
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Axlumen Dashboard \u8BBE\u7F6E" });
    containerEl.createEl("h3", { text: "\u{1F3A8} \u54C1\u724C" });
    new import_obsidian.Setting(containerEl).setName("\u54C1\u724C\u540D\u79F0").setDesc("\u663E\u793A\u5728 Hero \u533A\u7684\u540D\u79F0").addText((text) => text.setPlaceholder("Axlumen").setValue(this.plugin.settings.brandName).onChange((value) => {
      this.plugin.settings.brandName = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("\u54C1\u724C\u6807\u8BED").setDesc("\u663E\u793A\u5728\u54C1\u724C\u540D\u4E0B\u65B9").addText((text) => text.setPlaceholder("\u77E5\u662F\u884C\u4E4B\u59CB\uFF0C\u884C\u662F\u77E5\u4E4B\u6210\u3002").setValue(this.plugin.settings.brandSub).onChange((value) => {
      this.plugin.settings.brandSub = value;
      this.debouncedSave();
    }));
    containerEl.createEl("h3", { text: "\u23F0 \u5012\u8BA1\u65F6" });
    containerEl.createEl("p", {
      text: "\u652F\u6301\u591A\u4E2A\u5012\u8BA1\u65F6\uFF0C\u6BCF\u884C\u4E00\u4E2A\u3002",
      cls: "setting-item-description"
    });
    this.plugin.settings.countdowns.forEach((cd, i) => {
      new import_obsidian.Setting(containerEl).setName(`\u5012\u8BA1\u65F6 ${i + 1}: ${cd.label}`).setDesc("\u76EE\u6807\u65E5\u671F (YYYY-MM-DD)").addText((text) => text.setPlaceholder("2026-12-31").setValue(cd.target).onChange((value) => {
        this.plugin.settings.countdowns[i].target = value;
        this.debouncedSave();
      })).addText((text) => text.setPlaceholder("\u6807\u7B7E").setValue(cd.label).onChange((value) => {
        this.plugin.settings.countdowns[i].label = value;
        this.debouncedSave();
      })).addButton((btn) => btn.setIcon("trash").setTooltip("\u5220\u9664").onClick(async () => {
        this.plugin.settings.countdowns = this.plugin.settings.countdowns.filter((_, idx) => idx !== i);
        await this.plugin.saveSettings();
        this.display();
      }));
    });
    new import_obsidian.Setting(containerEl).setName("\u6DFB\u52A0\u5012\u8BA1\u65F6").addButton((btn) => btn.setButtonText("+ \u6DFB\u52A0").onClick(async () => {
      this.plugin.settings.countdowns.push({ target: "2026-12-31", label: "\u65B0\u5012\u8BA1\u65F6" });
      await this.plugin.saveSettings();
      this.display();
    }));
    containerEl.createEl("h3", { text: "\u{1F3A8} \u5916\u89C2" });
    containerEl.createEl("h4", { text: "\u{1F4CC} Banner \u6982\u89C8\u680F" });
    new import_obsidian.Setting(containerEl).setName("\u91D1\u53E5\u8F6E\u64AD").setDesc("\u5728 Banner \u4E2D\u663E\u793A\u91D1\u53E5\u8F6E\u64AD\uFF08\u9ED8\u8BA4\u5173\u95ED\uFF0C\u4F18\u5148\u5C55\u793A\u5DE5\u4F5C\u6458\u8981\uFF09").addToggle((toggle) => toggle.setValue(this.plugin.settings.banner.enableQuoteRotation).onChange((value) => {
      this.plugin.settings.banner.enableQuoteRotation = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("Banner \u6A21\u5F0F").setDesc("\u8BE6\u7EC6\u6A21\u5F0F\u663E\u793A\u4ECA\u65E5\u6982\u89C8\u6458\u8981\u680F\uFF0C\u7B80\u6D01\u6A21\u5F0F\u4EC5\u663E\u793A\u54C1\u724C+\u72B6\u6001").addDropdown((dropdown) => dropdown.addOption("detailed", "\u{1F4CA} \u8BE6\u7EC6 \u2014 \u4ECA\u65E5\u6982\u89C8\u6458\u8981\u680F").addOption("compact", "\u2728 \u7B80\u6D01 \u2014 \u54C1\u724C + \u72B6\u6001\u6307\u793A").setValue(this.plugin.settings.banner.bannerMode).onChange((value) => {
      this.plugin.settings.banner.bannerMode = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("\u4E3B\u9898\u6A21\u5F0F").setDesc("Dashboard \u89C6\u89C9\u4E3B\u9898\uFF1AIsland\uFF08\u52A8\u7269\u68EE\u53CB\u4F1A\u6696\u7EFF\uFF09\u6216 Nordic\uFF08\u6781\u7B80\u84DD\u767D\uFF09").addDropdown((dropdown) => dropdown.addOption("island", "\u{1F3DD}\uFE0F Island \u2014 \u6696\u7EFF\u68EE\u53CB\u4F1A").addOption("nordic", "\u2744\uFE0F Nordic \u2014 \u6781\u7B80\u84DD\u767D").setValue(this.plugin.settings.theme).onChange((value) => {
      this.plugin.settings.theme = value;
      this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "\u{1F916} Claude Code CLI" });
    new import_obsidian.Setting(containerEl).setName("CLI \u8DEF\u5F84").setDesc('claude \u53EF\u6267\u884C\u6587\u4EF6\u7684\u8DEF\u5F84\uFF08\u901A\u5E38\u4E3A "claude"\uFF09').addText((text) => text.setPlaceholder("claude").setValue(this.plugin.settings.claudeCodePath).onChange((value) => {
      this.plugin.settings.claudeCodePath = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("\u9ED8\u8BA4\u6A21\u578B").setDesc("Agent \u4EFB\u52A1\u4F7F\u7528\u7684\u6A21\u578B\uFF08\u4EC5\u4F5C\u8BB0\u5F55\uFF0C\u4E0D\u5F71\u54CD CLI \u5B9E\u9645\u8C03\u7528\uFF09").addText((text) => text.setPlaceholder("claude-sonnet-4-6").setValue(this.plugin.settings.agentDefaultModel).onChange((value) => {
      this.plugin.settings.agentDefaultModel = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("Vault \u8DEF\u5F84").setDesc("Obsidian Vault \u7684\u7EDD\u5BF9\u8DEF\u5F84\uFF08\u4F9B Agent CLI \u4F7F\u7528\uFF0C\u7559\u7A7A\u5219\u81EA\u52A8\u68C0\u6D4B\uFF09").addText((text) => text.setPlaceholder("/Users/you/Documents/MyVault").setValue(this.plugin.settings.vaultPath).onChange((value) => {
      this.plugin.settings.vaultPath = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("\u81EA\u52A8\u5237\u65B0").setDesc("Vault \u6587\u4EF6\u53D8\u52A8\u65F6\u81EA\u52A8\u5237\u65B0 Dashboard\uFF08\u4E8B\u4EF6\u9A71\u52A8\uFF09").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoRefresh).onChange((value) => {
      this.plugin.settings.autoRefresh = value;
      this.debouncedSave();
    }));
    containerEl.createEl("h3", { text: "\u{1F9E9} \u4FA7\u680F Widget" });
    containerEl.createEl("p", {
      text: "\u63A7\u5236\u5DE6\u4FA7\u8FB9\u680F\u4E2D\u663E\u793A\u54EA\u4E9B\u5C0F\u90E8\u4EF6\u3002",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("\u5468\u5386").setDesc("\u663E\u793A\u672C\u5468\u65E5\u5386\uFF0C\u70B9\u51FB\u8DF3\u8F6C Daily Note").addToggle((toggle) => toggle.setValue(this.plugin.settings.widgets.weekCalendar).onChange((value) => {
      this.plugin.settings.widgets.weekCalendar = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("Agent \u72B6\u6001").setDesc("\u663E\u793A Agent \u8FD0\u884C\u72B6\u6001\u6307\u793A\u706F\u548C\u961F\u5217\u4FE1\u606F").addToggle((toggle) => toggle.setValue(this.plugin.settings.widgets.agentStatus).onChange((value) => {
      this.plugin.settings.widgets.agentStatus = value;
      this.debouncedSave();
    }));
    new import_obsidian.Setting(containerEl).setName("\u5FEB\u901F\u4FBF\u7B7E").setDesc("\u4FA7\u680F\u5E95\u90E8\u5FEB\u901F\u5199\u5165 Inbox").addToggle((toggle) => toggle.setValue(this.plugin.settings.widgets.quickMemo).onChange((value) => {
      this.plugin.settings.widgets.quickMemo = value;
      this.debouncedSave();
    }));
    containerEl.createEl("h3", { text: "\u{1F4BE} \u6570\u636E\u5B58\u50A8" });
    containerEl.createEl("p", {
      text: "\u5F85\u529E\u6E05\u5355\u6570\u636E\u5B58\u50A8\u5728 _axlumen/todos.json\uFF08YAML frontmatter \u683C\u5F0F\uFF09\uFF0C\u53EF\u88AB Obsidian Sync \u540C\u6B65\u3002",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("\u5B58\u50A8\u8DEF\u5F84").setDesc("\u5F85\u529E\u6570\u636E\u6587\u4EF6\u8DEF\u5F84\uFF08\u76F8\u5BF9 Vault \u6839\u76EE\u5F55\uFF09").addText((text) => text.setPlaceholder("_axlumen/todos.json").setValue("_axlumen/todos.json").setDisabled(true));
    containerEl.createEl("h3", { text: "\u{1F4DA} Wiki \u914D\u7F6E" });
    containerEl.createEl("p", {
      text: "\u4E09\u4E2A Wiki \u7684\u76EE\u5F55\u8DEF\u5F84\u548C\u5165\u53E3\u9875\u9762\u914D\u7F6E\u3002",
      cls: "setting-item-description"
    });
    for (let i = 0; i < this.plugin.settings.wikis.length; i++) {
      const wiki = this.plugin.settings.wikis[i];
      containerEl.createEl("h4", { text: `${wiki.icon} ${wiki.name}` });
      new import_obsidian.Setting(containerEl).setName("\u6839\u76EE\u5F55").setDesc("Wiki \u7684\u6839\u76EE\u5F55\u8DEF\u5F84").addText((text) => text.setValue(wiki.rootPath).onChange((value) => {
        this.plugin.settings.wikis[i].rootPath = value;
        this.debouncedSave();
      }));
      new import_obsidian.Setting(containerEl).setName("\u5165\u53E3\u9875\u9762").setDesc("Wiki \u7684 index \u9875\u9762\u8DEF\u5F84").addText((text) => text.setValue(wiki.indexPage).onChange((value) => {
        this.plugin.settings.wikis[i].indexPage = value;
        this.debouncedSave();
      }));
    }
  }
};

// src/view.ts
var import_obsidian11 = require("obsidian");

// src/scanner.ts
var import_obsidian2 = require("obsidian");
var TYPE_DIRS = {
  "concepts": "concepts",
  "entities": "entities",
  "sources": "sources",
  "comparisons": "comparisons",
  "synthesis": "synthesis"
};
function collectMarkdownFiles(folder, result) {
  for (const c of folder.children) {
    if (c instanceof import_obsidian2.TFile && c.extension === "md") {
      result.push(c);
    } else if (c instanceof import_obsidian2.TFolder) {
      collectMarkdownFiles(c, result);
    }
  }
}
function scanWiki(vault, wiki) {
  const stats = {
    name: wiki.name,
    icon: wiki.icon,
    color: wiki.color,
    concepts: 0,
    entities: 0,
    sources: 0,
    comparisons: 0,
    synthesis: 0,
    total: 0,
    healthScore: 100,
    rootPath: wiki.rootPath,
    indexPage: wiki.indexPage
  };
  const wikiDir = `${wiki.rootPath}/wiki`;
  const folder = vault.getAbstractFileByPath(wikiDir);
  const allFiles = [];
  if (!folder || !(folder instanceof import_obsidian2.TFolder))
    return { stats, allFiles };
  for (const child of folder.children) {
    if (!(child instanceof import_obsidian2.TFolder))
      continue;
    const dirName = child.name.toLowerCase();
    const statKey = TYPE_DIRS[dirName];
    const dirFiles = [];
    collectMarkdownFiles(child, dirFiles);
    if (statKey)
      stats[statKey] = dirFiles.length;
    allFiles.push(...dirFiles);
  }
  stats.total = stats.concepts + stats.entities + stats.sources + stats.comparisons + stats.synthesis;
  stats.healthScore = calculateHealthScore(vault, wiki, allFiles);
  return { stats, allFiles };
}
function calculateHealthScore(vault, wiki, wikiFiles) {
  let score = 0;
  const indexFile = vault.getAbstractFileByPath(wiki.indexPage);
  if (indexFile instanceof import_obsidian2.TFile)
    score += HEALTH_INDEX_SCORE;
  const wikiDir = wiki.rootPath + "/wiki";
  const wikiFolder = vault.getAbstractFileByPath(wikiDir);
  if (wikiFolder instanceof import_obsidian2.TFolder) {
    const hasContent = wikiFolder.children.some((c) => c instanceof import_obsidian2.TFolder && c.children.length > 0);
    if (hasContent)
      score += HEALTH_INDEX_SCORE;
  }
  const requiredDirs = ["concepts", "entities", "sources"];
  for (const dir of requiredDirs) {
    const path = wikiDir + "/" + dir;
    if (vault.getAbstractFileByPath(path) instanceof import_obsidian2.TFolder) {
      score += HEALTH_STRUCTURE_SCORE / requiredDirs.length;
    }
  }
  if (wikiFiles.length > 0) {
    const daysSinceUpdate = (Date.now() - Math.max(...wikiFiles.map((f) => f.stat.mtime))) / MS_PER_DAY;
    let matched = false;
    for (let i = 0; i < HEALTH_FRESHNESS_THRESHOLDS.length; i++) {
      if (daysSinceUpdate <= HEALTH_FRESHNESS_THRESHOLDS[i]) {
        score += HEALTH_FRESHNESS_SCORES[i];
        matched = true;
        break;
      }
    }
    if (!matched)
      score += HEALTH_FRESHNESS_SCORES[HEALTH_FRESHNESS_SCORES.length - 1];
  }
  const logFolder = vault.getAbstractFileByPath(wiki.rootPath + "/log");
  if (logFolder instanceof import_obsidian2.TFolder && logFolder.children.length > 0) {
    score += HEALTH_LOG_SCORE;
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}
async function scanVault(app, wikis) {
  recentFilesCache = null;
  const wikiStats = [];
  for (const wiki of wikis) {
    const { stats } = scanWiki(app.vault, wiki);
    wikiStats.push(stats);
  }
  const totalNotes = wikiStats.reduce((sum, w) => sum + w.total, 0);
  const totalConcepts = wikiStats.reduce((sum, w) => sum + w.concepts, 0);
  const totalEntities = wikiStats.reduce((sum, w) => sum + w.entities, 0);
  const totalSources = wikiStats.reduce((sum, w) => sum + w.sources, 0);
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toLocaleString("zh-CN"),
    wikis: wikiStats,
    totalNotes,
    totalConcepts,
    totalEntities,
    totalSources,
    focus: []
  };
}
var recentFilesCache = null;
var recentFilesInvalidateTimer = null;
var RECENT_FILES_TTL_MS = 5e3;
var RECENT_FILES_DEBOUNCE_MS = 500;
function getRecentFiles(app, count = 5) {
  const now = Date.now();
  if (recentFilesCache && recentFilesCache.count === count && now - recentFilesCache.timestamp < RECENT_FILES_TTL_MS) {
    return recentFilesCache.files;
  }
  const files = app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, count);
  recentFilesCache = { count, files, timestamp: now };
  return files;
}
function invalidateRecentFilesCache() {
  if (recentFilesInvalidateTimer) {
    clearTimeout(recentFilesInvalidateTimer);
  }
  recentFilesInvalidateTimer = setTimeout(() => {
    recentFilesCache = null;
    recentFilesInvalidateTimer = null;
  }, RECENT_FILES_DEBOUNCE_MS);
}
function getWritingActivity(app, days = 90) {
  const now = /* @__PURE__ */ new Date();
  const files = app.vault.getMarkdownFiles();
  const dayMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }
  for (const file of files) {
    const mtime = new Date(file.stat.mtime);
    const key = mtime.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }
  }
  return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

// src/utils/dom.ts
function el(tag, attrs, ...children) {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") {
        element.className = value;
      } else if (key === "style") {
        element.style.cssText = value;
      } else if (key.startsWith("data-")) {
        element.setAttribute(key, value);
      } else {
        element.setAttribute(key, value);
      }
    }
  }
  for (const child of children) {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }
  return element;
}
function div(cls, ...children) {
  return el("div", cls ? { class: cls } : void 0, ...children);
}
function esc(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function animateCount(element, end, duration = 1100, suffix = "") {
  if (!end) {
    element.textContent = "0" + suffix;
    return;
  }
  const t0 = performance.now();
  function step(t) {
    const k = Math.min(1, (t - t0) / duration);
    const ease = 1 - Math.pow(1 - k, 3);
    element.textContent = Math.round(end * ease) + suffix;
    if (k < 1)
      requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// src/utils/animate.ts
function staggerEntrance(elements, baseDelay = 60) {
  elements.forEach((el3, i) => {
    el3.style.animationDelay = `${i * baseDelay}ms`;
  });
}
function animateProgressBars(container) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll("[data-width]").forEach((el3) => {
        el3.style.width = el3.dataset.width || "0%";
      });
    }, 50);
  });
}

// src/utils/debounce.ts
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer)
      clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };
}

// src/utils/LocalStore.ts
var DEFAULT_DATA = {
  focusState: { pinned: false, autoMode: true, focusIndex: 0 },
  cardCollapse: {},
  cardOrder: [],
  memoDraft: "",
  feedLastRefresh: ""
};
var _data = { ...DEFAULT_DATA };
var _plugin = null;
var _dirty = false;
var _saveTimer = null;
function initLocalStore(plugin) {
  _plugin = plugin;
  const saved = plugin.settings.uiState;
  if (saved) {
    _data = {
      focusState: { ...DEFAULT_DATA.focusState, ...saved.focusState || {} },
      cardCollapse: { ...saved.cardCollapse || {} },
      cardOrder: [...saved.cardOrder || []],
      memoDraft: saved.memoDraft || "",
      feedLastRefresh: saved.feedLastRefresh || ""
    };
  }
}
function markDirty() {
  if (_saveTimer)
    clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => flush(), 300);
}
function flushLocalStore() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  void flush();
}
function flush() {
  if (!_plugin || !_dirty)
    return;
  _dirty = false;
  const settings = _plugin.settings;
  settings.uiState = { ..._data };
  void _plugin.saveSettings();
}
var LocalStore = {
  // ---- 焦点状态 ----
  getFocusState() {
    return { ..._data.focusState };
  },
  setFocusState(state) {
    _data.focusState = { ...state };
    _dirty = true;
    markDirty();
  },
  // ---- 卡片折叠状态 ----
  getCardCollapse() {
    return { ..._data.cardCollapse };
  },
  setCardCollapse(state) {
    _data.cardCollapse = { ...state };
    _dirty = true;
    markDirty();
  },
  // ---- 卡片排序 ----
  getCardOrder(validCardIds) {
    const saved = _data.cardOrder || [];
    const valid = saved.filter((id) => validCardIds.includes(id));
    for (const id of validCardIds) {
      if (!valid.includes(id))
        valid.push(id);
    }
    return valid;
  },
  setCardOrder(order) {
    _data.cardOrder = [...order];
    _dirty = true;
    markDirty();
  },
  // ---- Memo 草稿 ----
  getMemoDraft() {
    return _data.memoDraft || "";
  },
  setMemoDraft(value) {
    _data.memoDraft = value;
    _dirty = true;
    markDirty();
  },
  clearMemoDraft() {
    _data.memoDraft = "";
    _dirty = true;
    markDirty();
  },
  // ---- Feed 最后刷新时间 ----
  getFeedLastRefresh() {
    return _data.feedLastRefresh || "";
  },
  setFeedLastRefresh(value) {
    _data.feedLastRefresh = value;
    _dirty = true;
    markDirty();
  },
  // ---- 清空所有本地状态（调试/重置用） ----
  clearAll() {
    _data = { ...DEFAULT_DATA };
    _dirty = true;
    markDirty();
  }
};

// src/widgets/todos.ts
var import_obsidian5 = require("obsidian");

// src/types.ts
function createRootedDisposable(roots, cleanup) {
  let disposed = false;
  return {
    get disposed() {
      return disposed;
    },
    roots: [...roots],
    dispose() {
      if (disposed)
        return;
      disposed = true;
      try {
        cleanup();
      } catch (e) {
      }
      for (const r of roots)
        r.remove();
    }
  };
}
function isDisposable(v) {
  return !!v && typeof v.dispose === "function" && "disposed" in v;
}

// src/utils/atomicWrite.ts
var import_obsidian3 = require("obsidian");
async function atomicWrite(vault, filePath, data) {
  const tmpPath = filePath + ".tmp";
  const parts = filePath.split("/");
  const dirPath = parts.slice(0, -1).join("/");
  if (dirPath) {
    await ensureDirectory(vault, dirPath);
  }
  const existingTmp = vault.getAbstractFileByPath(tmpPath);
  if (existingTmp instanceof import_obsidian3.TFile) {
    await vault.modify(existingTmp, data);
  } else {
    await vault.create(tmpPath, data);
  }
  const existingTarget = vault.getAbstractFileByPath(filePath);
  if (existingTarget) {
    await vault.delete(existingTarget);
  }
  const tmpFile = vault.getAbstractFileByPath(tmpPath);
  if (tmpFile instanceof import_obsidian3.TFile) {
    await vault.rename(tmpFile, filePath);
  }
}
async function ensureDirectory(vault, dirPath) {
  const existing = vault.getAbstractFileByPath(dirPath);
  if (existing)
    return;
  const parts = dirPath.split("/");
  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join("/");
    await ensureDirectory(vault, parentPath);
  }
  await vault.createFolder(dirPath);
}
async function safeRead(vault, filePath) {
  try {
    const file = vault.getAbstractFileByPath(filePath);
    if (file instanceof import_obsidian3.TFile) {
      return await vault.read(file);
    }
  } catch (e) {
  }
  return null;
}
async function recoverFromTmp(vault, filePath) {
  const tmpPath = filePath + ".tmp";
  const tmpFile = vault.getAbstractFileByPath(tmpPath);
  if (!(tmpFile instanceof import_obsidian3.TFile)) {
    return false;
  }
  try {
    const existingTarget = vault.getAbstractFileByPath(filePath);
    if (existingTarget) {
      await vault.delete(existingTarget);
    }
    await vault.rename(tmpFile, filePath);
    console.log(`[AtomicWrite] Recovered ${filePath} from .tmp`);
    return true;
  } catch (e) {
    console.error(`[AtomicWrite] Failed to recover ${filePath}:`, e);
    return false;
  }
}
async function createBackup(vault, filePath) {
  const bakPath = filePath + ".bak";
  const file = vault.getAbstractFileByPath(filePath);
  if (!(file instanceof import_obsidian3.TFile))
    return;
  try {
    const content = await vault.read(file);
    const existingBak = vault.getAbstractFileByPath(bakPath);
    if (existingBak instanceof import_obsidian3.TFile) {
      await vault.modify(existingBak, content);
    } else {
      await vault.create(bakPath, content);
    }
  } catch (e) {
    console.warn(`[AtomicWrite] Failed to create backup for ${filePath}:`, e);
  }
}
async function restoreFromBackup(vault, filePath) {
  const bakPath = filePath + ".bak";
  const bakFile = vault.getAbstractFileByPath(bakPath);
  if (!(bakFile instanceof import_obsidian3.TFile)) {
    return false;
  }
  try {
    const content = await vault.read(bakFile);
    JSON.parse(content);
    const existingTarget = vault.getAbstractFileByPath(filePath);
    if (existingTarget instanceof import_obsidian3.TFile) {
      await vault.modify(existingTarget, content);
    } else {
      await vault.create(filePath, content);
    }
    console.log(`[AtomicWrite] Restored ${filePath} from backup`);
    return true;
  } catch (e) {
    console.error(`[AtomicWrite] Failed to restore from backup:`, e);
    return false;
  }
}

// src/utils/WriteLock.ts
var WriteLock = class {
  /**
   * @param name 锁名称（用于日志调试）
   */
  constructor(name = "default") {
    this._disposed = false;
    this._queue = [];
    this._running = false;
    this._name = name;
  }
  get disposed() {
    return this._disposed;
  }
  /**
   * 获取写锁并执行写入操作
   *
   * 如果当前有其他写入操作正在进行，会等待其完成后再执行。
   * 返回的 release 函数在写入完成后自动调用（不需要手动调用）。
   *
   * @param fn 要执行的写入操作
   * @returns Promise，写入完成后 resolve
   */
  async acquire(fn) {
    if (this._disposed) {
      throw new Error(`[WriteLock:${this._name}] Lock is disposed`);
    }
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._processQueue();
    });
  }
  async _processQueue() {
    if (this._running || this._queue.length === 0)
      return;
    this._running = true;
    while (this._queue.length > 0 && !this._disposed) {
      const entry = this._queue.shift();
      try {
        await entry.fn();
        entry.resolve();
      } catch (e) {
        entry.reject(e instanceof Error ? e : new Error(String(e)));
      }
    }
    this._running = false;
  }
  /**
   * Disposable — 清空队列，拒绝所有等待中的操作
   */
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    for (const entry of this._queue) {
      entry.reject(new Error(`[WriteLock:${this._name}] Lock disposed`));
    }
    this._queue = [];
  }
};
var locks = /* @__PURE__ */ new Map();
function getWriteLock(resource) {
  let lock = locks.get(resource);
  if (!lock) {
    lock = new WriteLock(resource);
    locks.set(resource, lock);
  }
  return lock;
}
function releaseAllWriteLocks() {
  for (const lock of locks.values()) {
    lock.dispose();
  }
  locks.clear();
}

// src/widgets/todos.ts
var busy = false;
async function createTodosPanel(app, createSection) {
  const cleaners = [];
  const timers = /* @__PURE__ */ new Set();
  const section = createSection("\u4ECA\u65E5\u5F85\u529E", "#FBBF24", "");
  const registerCleanup = (fn) => {
    cleaners.push(fn);
  };
  const safeTimeout = (fn, ms) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const manualTodos = await loadTodos(app);
  const parsedTasks = await loadParsedTasks(app);
  const unify = unifyTasks(manualTodos, parsedTasks);
  const progress = div("ax-todo-progress");
  updateProgressHTML(progress, unify);
  section.appendChild(progress);
  const inputRow = div("ax-todo-input-row");
  const input = el("input", {
    type: "text",
    placeholder: "\u6DFB\u52A0\u65B0\u4EFB\u52A1...",
    class: "ax-todo-input",
    id: "ax-todo-input"
  });
  const addBtn = el("button", { class: "ax-todo-add", id: "ax-todo-add" }, "+");
  const onAddClick = () => addTodo(app, input, section);
  const onInputKey = (e) => {
    if (e.key === "Enter")
      addTodo(app, input, section);
  };
  addBtn.addEventListener("click", onAddClick);
  input.addEventListener("keydown", onInputKey);
  registerCleanup(() => addBtn.removeEventListener("click", onAddClick));
  registerCleanup(() => input.removeEventListener("keydown", onInputKey));
  inputRow.appendChild(input);
  inputRow.appendChild(addBtn);
  section.appendChild(inputRow);
  const list = div("ax-todo-list", "");
  list.id = "ax-todo-list";
  section.appendChild(list);
  renderTodoList(app, list, unify, progress, { registerCleanup, safeTimeout });
  const handle = createRootedDisposable([section], () => {
    for (const id of timers)
      window.clearTimeout(id);
    timers.clear();
    for (const fn of cleaners) {
      try {
        fn();
      } catch (e) {
      }
    }
    section.empty();
  });
  return { section, handle };
}
async function migrateTodosIfNeeded(app) {
  const newFile = app.vault.getAbstractFileByPath(TODOS_FILE_PATH);
  if (newFile instanceof import_obsidian5.TFile)
    return;
  const legacyFile = app.vault.getAbstractFileByPath(TODOS_FILE_PATH_LEGACY);
  if (!(legacyFile instanceof import_obsidian5.TFile))
    return;
  try {
    const raw = await app.vault.read(legacyFile);
    const todos = JSON.parse(raw);
    const content = formatTodosYaml(todos);
    await atomicWrite(app.vault, TODOS_FILE_PATH, content);
    await app.vault.delete(legacyFile);
    console.log(`[Todos] Migrated ${todos.length} todos from legacy path`);
  } catch (e) {
    console.error("[Todos] Migration failed:", e);
  }
}
function formatTodosYaml(todos) {
  const frontmatter = [
    "---",
    "version: 1",
    `count: ${todos.length}`,
    "---",
    ""
  ].join("\n");
  return frontmatter + JSON.stringify(todos, null, 2);
}
function parseTodosContent(raw) {
  if (raw.startsWith("---")) {
    const parts = raw.split("---");
    if (parts.length >= 3) {
      const body = parts.slice(2).join("---").trim();
      if (body) {
        return JSON.parse(body);
      }
    }
  }
  return JSON.parse(raw);
}
async function loadTodos(app) {
  try {
    await migrateTodosIfNeeded(app);
    const file = app.vault.getAbstractFileByPath(TODOS_FILE_PATH);
    if (file instanceof import_obsidian5.TFile) {
      const data = await app.vault.read(file);
      return parseTodosContent(data);
    }
    return [];
  } catch (e) {
    return [];
  }
}
async function saveTodos(app, todos) {
  const lock = getWriteLock("todos");
  await lock.acquire(async () => {
    try {
      const content = formatTodosYaml(todos);
      const existing = app.vault.getAbstractFileByPath(TODOS_FILE_PATH);
      if (existing instanceof import_obsidian5.TFile) {
        await app.vault.modify(existing, content);
      } else {
        const dir = app.vault.getAbstractFileByPath(TODOS_DIR);
        if (!dir) {
          await app.vault.createFolder(TODOS_DIR);
        }
        await app.vault.create(TODOS_FILE_PATH, content);
      }
    } catch (e) {
      console.error("\u4FDD\u5B58\u5F85\u529E\u5931\u8D25:", e);
    }
  });
}
async function loadParsedTasks(app) {
  try {
    const { parseTasksFromDailyNotes: parseTasksFromDailyNotes2 } = await Promise.resolve().then(() => (init_taskParser(), taskParser_exports));
    return await parseTasksFromDailyNotes2(app);
  } catch (e) {
    return [];
  }
}
function unifyTasks(manual, parsed) {
  const result = [];
  for (const m of manual) {
    result.push({
      id: m.id,
      text: m.text,
      state: m.state || (m.done ? "done" : "todo"),
      priority: "medium",
      dueDate: new Date(m.createdAt).toISOString().slice(0, 10),
      source: "manual"
    });
  }
  for (const p of parsed) {
    const hasLink = /\[\[.*?\]\]/.test(p.text);
    result.push({
      id: `parsed_${p.source}_${p.text.slice(0, 20)}`,
      text: p.text,
      state: p.done ? "done" : "todo",
      priority: p.priority,
      dueDate: p.dueDate,
      source: "parsed",
      sourcePath: p.source,
      hasLink
    });
  }
  return result;
}
function updateProgressHTML(progress, tasks) {
  const doneCount = tasks.filter((t) => t.state === "done").length;
  const pct = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
  progress.innerHTML = `
    <div class="ax-todo-stats ax-task-progress-bar">
      <span id="ax-todo-count">${doneCount} done / ${tasks.length} total</span>
      <span id="ax-todo-pct">${pct}%</span>
    </div>
    <div class="ax-bar"><i id="ax-todo-bar" data-width="${pct}%"></i></div>
  `;
}
function nextState(current) {
  if (current === "todo")
    return "doing";
  if (current === "doing")
    return "done";
  return "todo";
}
function checkClass(state) {
  if (state === "done")
    return "ax-task-check ax-check-done";
  if (state === "doing")
    return "ax-task-check ax-check-doing";
  return "ax-task-check";
}
function renderTodoList(app, listEl, tasks, progressEl, hooks) {
  listEl.empty();
  tasks.forEach((task, i) => {
    const item = div(`ax-task ${task.state === "done" ? "ax-task-done" : ""} ${task.state === "doing" ? "ax-task-doing" : ""}`);
    item.setAttribute("draggable", "true");
    item.dataset.index = String(i);
    const check = el("span", { class: checkClass(task.state) });
    if (task.state === "done")
      check.textContent = "\u2713";
    const onCheckClick = async (e) => {
      e.stopPropagation();
      await cycleTaskState(app, tasks, i, listEl, progressEl);
    };
    check.addEventListener("click", onCheckClick);
    hooks.registerCleanup(() => check.removeEventListener("click", onCheckClick));
    const text = el("span", { class: "ax-task-text" }, task.text);
    const meta = div("ax-task-meta");
    const prio = el("span", { class: `ax-priority ax-priority-${task.priority}` }, task.priority);
    meta.appendChild(prio);
    if (task.hasLink) {
      const link = el("span", { class: "ax-task-link", title: "\u5173\u8054\u7B14\u8BB0" }, "\u{1F517}");
      const onLinkClick = (e) => {
        e.stopPropagation();
        const match = task.text.match(/\[\[(.+?)\]\]/);
        if (match)
          app.workspace.openLinkText(match[1], "", "tab");
      };
      link.addEventListener("click", onLinkClick);
      hooks.registerCleanup(() => link.removeEventListener("click", onLinkClick));
      meta.appendChild(link);
    }
    if (task.source === "parsed") {
      const tag = el("span", { class: "ax-todo-source" }, "\u{1F4C5}");
      tag.title = `\u6765\u81EA: ${task.sourcePath}`;
      meta.appendChild(tag);
    }
    if (task.dueDate) {
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const isOverdue = task.dueDate < today && task.state !== "done";
      const dateTag = el("span", {
        class: `ax-todo-date ${isOverdue ? "ax-todo-overdue" : ""}`
      }, task.dueDate.slice(5));
      meta.appendChild(dateTag);
    }
    item.appendChild(check);
    item.appendChild(text);
    item.appendChild(meta);
    const onItemClick = async () => {
      await cycleTaskState(app, tasks, i, listEl, progressEl);
    };
    item.addEventListener("click", onItemClick);
    hooks.registerCleanup(() => item.removeEventListener("click", onItemClick));
    setupDragReorder(item, tasks, i, app, listEl, progressEl, hooks);
    listEl.appendChild(item);
  });
  if (tasks.length === 0) {
    listEl.appendChild(el("div", { class: "ax-empty" }, "\u6682\u65E0\u4EFB\u52A1"));
  }
}
async function cycleTaskState(app, tasks, index, listEl, progressEl) {
  if (busy)
    return;
  busy = true;
  try {
    const task = tasks[index];
    if (task.source === "manual") {
      const manual = await loadTodos(app);
      const target = manual.find((m) => m.id === task.id);
      if (target) {
        target.state = nextState(task.state);
        target.done = target.state === "done";
      }
      await saveTodos(app, manual);
    }
    tasks[index].state = nextState(tasks[index].state);
    renderTodoList(app, listEl, tasks, progressEl, { registerCleanup: () => {
    }, safeTimeout: window.setTimeout.bind(window) });
    updateTodoProgress(progressEl, tasks);
  } finally {
    busy = false;
  }
}
function setupDragReorder(item, tasks, index, app, listEl, progressEl, hooks) {
  const onDragStart = (e) => {
    item.addClass("ax-task-dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
  };
  const onDragEnd = () => {
    item.removeClass("ax-task-dragging");
    listEl.querySelectorAll(".ax-task-drag-over").forEach((el3) => el3.removeClass("ax-task-drag-over"));
  };
  const onDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = "move";
    item.addClass("ax-task-drag-over");
  };
  const onDragLeave = () => {
    item.removeClass("ax-task-drag-over");
  };
  const onDrop = async (e) => {
    var _a;
    e.preventDefault();
    item.removeClass("ax-task-drag-over");
    const fromIdx = parseInt(((_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain")) || "-1", 10);
    if (fromIdx < 0 || fromIdx === index)
      return;
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(index, 0, moved);
    renderTodoList(app, listEl, tasks, progressEl, { registerCleanup: () => {
    }, safeTimeout: window.setTimeout.bind(window) });
    updateTodoProgress(progressEl, tasks);
  };
  item.addEventListener("dragstart", onDragStart);
  item.addEventListener("dragend", onDragEnd);
  item.addEventListener("dragover", onDragOver);
  item.addEventListener("dragleave", onDragLeave);
  item.addEventListener("drop", onDrop);
  hooks.registerCleanup(() => {
    item.removeEventListener("dragstart", onDragStart);
    item.removeEventListener("dragend", onDragEnd);
    item.removeEventListener("dragover", onDragOver);
    item.removeEventListener("dragleave", onDragLeave);
    item.removeEventListener("drop", onDrop);
  });
}
function updateTodoProgress(progressEl, tasks) {
  const done = tasks.filter((t) => t.state === "done").length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const countEl = progressEl.querySelector("#ax-todo-count");
  const pctEl = progressEl.querySelector("#ax-todo-pct");
  const barEl = progressEl.querySelector("#ax-todo-bar");
  if (countEl)
    countEl.textContent = `${done} done / ${tasks.length} total`;
  if (pctEl)
    pctEl.textContent = `${pct}%`;
  if (barEl)
    barEl.style.width = `${pct}%`;
}
async function addTodo(app, input, section) {
  const text = input.value.trim();
  if (!text || busy)
    return;
  busy = true;
  try {
    const todos = await loadTodos(app);
    todos.push({ id: Date.now().toString(), text, tag: "", done: false, state: "todo", createdAt: Date.now() });
    await saveTodos(app, todos);
    input.value = "";
    const listEl = section.querySelector("#ax-todo-list");
    const progressEl = section.querySelector(".ax-todo-progress");
    if (listEl && progressEl) {
      const parsed = await loadParsedTasks(app);
      const unified = unifyTasks(todos, parsed);
      renderTodoList(app, listEl, unified, progressEl, { registerCleanup: () => {
      }, safeTimeout: window.setTimeout.bind(window) });
      updateProgressHTML(progressEl, unified);
    }
  } finally {
    busy = false;
  }
}

// src/widgets/countdown.ts
function createCountdownPanel(settings, saveSettings, showToast, createSection) {
  const section = createSection("\u5012\u8BA1\u65F6", "#FB7185", "");
  const cleaners = [];
  const inputRow = div("ax-cd-input-row");
  const labelInput = el("input", {
    type: "text",
    placeholder: "\u6807\u7B7E\uFF08\u5982\uFF1A\u8DDD\u5E74\u7EC8\uFF09",
    class: "ax-cd-input ax-cd-label"
  });
  const dateInput = el("input", {
    type: "date",
    class: "ax-cd-input ax-cd-date"
  });
  const addBtn = el("button", { class: "ax-todo-add" }, "+");
  const onAddClick = () => addCountdown(settings, saveSettings, showToast, labelInput, dateInput, section);
  const onLabelKey = (e) => {
    if (e.key === "Enter")
      addCountdown(settings, saveSettings, showToast, labelInput, dateInput, section);
  };
  addBtn.addEventListener("click", onAddClick);
  labelInput.addEventListener("keydown", onLabelKey);
  cleaners.push(
    () => addBtn.removeEventListener("click", onAddClick),
    () => labelInput.removeEventListener("keydown", onLabelKey)
  );
  inputRow.appendChild(labelInput);
  inputRow.appendChild(dateInput);
  inputRow.appendChild(addBtn);
  section.appendChild(inputRow);
  const list = div("ax-cd-list");
  list.id = "ax-cd-list";
  section.appendChild(list);
  renderCountdownList(settings, saveSettings, list);
  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners)
      fn();
    section.empty();
  });
  return { section, handle };
}
function renderCountdownList(settings, saveSettings, listEl) {
  const countdowns = settings.countdowns;
  listEl.empty();
  if (countdowns.length === 0) {
    listEl.appendChild(el("div", { class: "ax-empty" }, "\u6682\u65E0\u5012\u8BA1\u65F6"));
    return;
  }
  countdowns.forEach((cd, i) => {
    const target = new Date(cd.target);
    const now = /* @__PURE__ */ new Date();
    const days = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY));
    const item = div("ax-countdown");
    item.innerHTML = `
      <div class="ax-cd-main">
        <b>${days}</b>
        <span>${cd.label}</span>
      </div>
      <div class="ax-cd-meta">
        <span class="ax-cd-date">${cd.target}</span>
        <button class="ax-cd-del" data-idx="${i}">&times;</button>
      </div>
    `;
    const delBtn = item.querySelector(".ax-cd-del");
    delBtn == null ? void 0 : delBtn.addEventListener("click", async () => {
      settings.countdowns.splice(i, 1);
      await saveSettings();
      renderCountdownList(settings, saveSettings, listEl);
    });
    listEl.appendChild(item);
  });
}
async function addCountdown(settings, saveSettings, showToast, labelInput, dateInput, section) {
  const label = labelInput.value.trim();
  const target = dateInput.value;
  if (!label || !target) {
    showToast("\u8BF7\u586B\u5199\u6807\u7B7E\u548C\u65E5\u671F");
    return;
  }
  settings.countdowns.push({ target, label });
  await saveSettings();
  labelInput.value = "";
  dateInput.value = "";
  const listEl = section.querySelector("#ax-cd-list");
  if (listEl)
    renderCountdownList(settings, saveSettings, listEl);
  showToast(`\u5DF2\u6DFB\u52A0\u5012\u8BA1\u65F6\uFF1A${label}`);
}

// src/widgets/heatmap.ts
var HEATMAP_DAYS = 90;
var DIMENSIONS = [
  { key: "notes", label: "Notes Created", colorVarPrefix: "ax-heatmap", tooltipUnit: "notes" },
  { key: "words", label: "Words Written", colorVarPrefix: "ax-heatmap-words", tooltipUnit: "words" },
  { key: "tasks", label: "Tasks Completed", colorVarPrefix: "ax-heatmap-tasks", tooltipUnit: "tasks" },
  { key: "agentRuns", label: "Agent Runs", colorVarPrefix: "ax-heatmap-agent", tooltipUnit: "runs" }
];
function resolveColor(varName) {
  const el3 = document.querySelector(".axlumen-dashboard");
  if (!el3)
    return "#333";
  return getComputedStyle(el3).getPropertyValue(varName).trim() || "#333";
}
function buildColorMap(prefix) {
  return {
    empty: resolveColor(`--${prefix}-empty`),
    l1: resolveColor(`--${prefix}-L1`),
    l2: resolveColor(`--${prefix}-L2`),
    l3: resolveColor(`--${prefix}-L3`)
  };
}
function getColor(count, colors) {
  if (count <= 0)
    return colors.empty;
  if (count <= HEATMAP_LOW_THRESHOLD)
    return colors.l1;
  if (count <= HEATMAP_HIGH_THRESHOLD)
    return colors.l2;
  return colors.l3;
}
function groupByWeeks(activity) {
  const weeks = [];
  let currentWeek = [];
  let firstMonth = -1;
  let firstDate = "";
  if (activity.length > 0) {
    const firstDateObj = new Date(activity[0].date);
    const dayOfWeek = (firstDateObj.getDay() + 6) % 7;
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push({ date: "", count: -1 });
    }
  }
  for (const day of activity) {
    if (currentWeek.length === 0 || currentWeek.length > 0 && !currentWeek[0].date) {
      firstMonth = day.date ? new Date(day.date).getMonth() : -1;
      firstDate = day.date;
    }
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push({ week: currentWeek, firstMonth, firstDate });
      currentWeek = [];
      firstMonth = -1;
      firstDate = "";
    }
  }
  if (currentWeek.length > 0) {
    weeks.push({ week: currentWeek, firstMonth, firstDate });
  }
  return weeks;
}
function createHeatmapPanel(app, createSection, healthData) {
  const section = createSection("\u5199\u4F5C\u70ED\u529B\u56FE", "#34D399", `\u8FD1 ${HEATMAP_DAYS} \u5929`);
  section.addClass("ax-heatmap-section");
  const cleaners = [];
  let currentDim = "notes";
  const toolbar = div("ax-heatmap-toolbar");
  const select = el("select", { class: "ax-heatmap-dim-select" });
  DIMENSIONS.forEach((dim) => {
    const opt = el("option", { value: dim.key }, dim.label);
    select.appendChild(opt);
  });
  const onSelectChange = () => {
    currentDim = select.value;
    renderCanvas();
  };
  select.addEventListener("change", onSelectChange);
  cleaners.push(() => select.removeEventListener("change", onSelectChange));
  toolbar.appendChild(select);
  section.appendChild(toolbar);
  const container = div("ax-heatmap-container");
  section.appendChild(container);
  const notesActivity = getWritingActivity(app, HEATMAP_DAYS);
  const multiDim = healthData == null ? void 0 : healthData.dailyActivityMultiDim;
  function getActivityForDim(dim) {
    if (multiDim && multiDim[dim] && multiDim[dim].length > 0) {
      return multiDim[dim];
    }
    return notesActivity;
  }
  let canvas = null;
  let ctx = null;
  let currentActivity = [];
  let currentDimConfig = DIMENSIONS[0];
  let cellPositions = [];
  const tooltip = div("ax-heatmap-tooltip");
  tooltip.style.cssText = "display:none;position:fixed;z-index:9999;pointer-events:none;";
  document.body.appendChild(tooltip);
  cleaners.push(() => tooltip.remove());
  function renderCanvas() {
    container.empty();
    currentActivity = getActivityForDim(currentDim);
    currentDimConfig = DIMENSIONS.find((d) => d.key === currentDim);
    const activeDays = currentActivity.filter((d) => d.count > 0).length;
    const totalCount = currentActivity.reduce((sum, d) => sum + d.count, 0);
    const avgPerDay = activeDays > 0 ? Math.round(totalCount / activeDays) : 0;
    const statsRow = div("ax-heatmap-stats");
    statsRow.innerHTML = `<span><b>${activeDays}</b> \u6D3B\u8DC3\u5929</span><span><b>${totalCount.toLocaleString()}</b> ${currentDimConfig.tooltipUnit}</span><span><b>${avgPerDay.toLocaleString()}</b> \u65E5\u5747</span>`;
    container.appendChild(statsRow);
    const weekGroups = groupByWeeks(currentActivity);
    const cs = HEATMAP_CELL_SIZE;
    const gp = HEATMAP_GAP;
    const labelOffsetX = 22;
    const monthLabelHeight = 14;
    const canvasWidth = weekGroups.length * (cs + gp) + labelOffsetX + 10;
    const canvasHeight = 7 * (cs + gp) + monthLabelHeight + 4;
    canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.className = "ax-heatmap-canvas";
    canvas.style.cssText = "display:block;max-width:100%;height:auto;cursor:pointer;";
    ctx = canvas.getContext("2d");
    if (!ctx)
      return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = canvasWidth + "px";
    canvas.style.height = canvasHeight + "px";
    ctx.scale(dpr, dpr);
    const colors = buildColorMap(currentDimConfig.colorVarPrefix);
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    const dayLabels = ["\u4E00", "\u4E09", "\u4E94"];
    const dayLabelRows = [0, 2, 4];
    ctx.fillStyle = resolveColor("--ax-faint");
    ctx.font = "9px " + getComputedStyle(canvas).fontFamily;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < dayLabels.length; i++) {
      const y = dayLabelRows[i] * (cs + gp) + cs / 2 + monthLabelHeight;
      ctx.fillText(dayLabels[i], labelOffsetX - 4, y);
    }
    cellPositions = [];
    let lastMonth = -1;
    const monthNames = ["1\u6708", "2\u6708", "3\u6708", "4\u6708", "5\u6708", "6\u6708", "7\u6708", "8\u6708", "9\u6708", "10\u6708", "11\u6708", "12\u6708"];
    for (let wi = 0; wi < weekGroups.length; wi++) {
      const { week, firstMonth: wMonth } = weekGroups[wi];
      for (let di = 0; di < week.length; di++) {
        const day = week[di];
        if (day.count < 0)
          continue;
        const x = wi * (cs + gp) + labelOffsetX;
        const y = di * (cs + gp) + monthLabelHeight;
        if (di === 0 && day.date) {
          const month = new Date(day.date).getMonth();
          if (month !== lastMonth) {
            ctx.fillStyle = resolveColor("--ax-faint");
            ctx.font = "9px " + getComputedStyle(canvas).fontFamily;
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText(monthNames[month], x, monthLabelHeight - 2);
            lastMonth = month;
          }
        }
        ctx.fillStyle = getColor(day.count, colors);
        ctx.beginPath();
        ctx.roundRect(x, y, cs, cs, 2);
        ctx.fill();
        cellPositions.push({
          x,
          y,
          w: cs,
          h: cs,
          date: day.date,
          count: day.count
        });
      }
    }
    const onCanvasMouseMove = (e) => {
      if (!canvas)
        return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      let hit = false;
      for (const cell of cellPositions) {
        if (mx >= cell.x && mx <= cell.x + cell.w && my >= cell.y && my <= cell.y + cell.h) {
          const tooltipText = cell.date + ": " + cell.count + " " + currentDimConfig.tooltipUnit;
          tooltip.textContent = tooltipText;
          tooltip.style.display = "block";
          tooltip.style.left = e.clientX + 10 + "px";
          tooltip.style.top = e.clientY - 30 + "px";
          hit = true;
          break;
        }
      }
      if (!hit) {
        tooltip.style.display = "none";
      }
    };
    const onCanvasMouseLeave = () => {
      tooltip.style.display = "none";
    };
    canvas.addEventListener("mousemove", onCanvasMouseMove);
    canvas.addEventListener("mouseleave", onCanvasMouseLeave);
    cleaners.push(() => {
      canvas == null ? void 0 : canvas.removeEventListener("mousemove", onCanvasMouseMove);
      canvas == null ? void 0 : canvas.removeEventListener("mouseleave", onCanvasMouseLeave);
    });
    const grid = div("ax-heatmap-grid");
    grid.appendChild(canvas);
    container.appendChild(grid);
    const legend = div("ax-heatmap-legend");
    legend.innerHTML = `<span>\u5C11</span><div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-empty)"></div><div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-L1)"></div><div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-L2)"></div><div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-L3)"></div><span>\u591A</span>`;
    container.appendChild(legend);
  }
  renderCanvas();
  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners)
      fn();
    section.empty();
  });
  return { section, handle };
}

// src/widgets/weekCalendar.ts
function dayOffsetDate(offset) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function countNotesForDate(app, dateStr) {
  try {
    const files = app.vault.getMarkdownFiles();
    return files.filter((f) => {
      const m = new Date(f.stat.mtime);
      return m.toISOString().slice(0, 10) === dateStr;
    }).length;
  } catch (e) {
    return 0;
  }
}
function densityLevel(count) {
  if (count === 0)
    return 0;
  if (count <= 2)
    return 1;
  if (count <= 5)
    return 2;
  return 3;
}
function openDailyNote(app, offset) {
  const dateStr = dayOffsetDate(offset);
  const candidates = [
    `${dateStr}.md`,
    `daily/${dateStr}.md`,
    `Daily/${dateStr}.md`,
    `\u65E5\u8BB0/${dateStr}.md`
  ];
  for (const path of candidates) {
    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      app.workspace.openLinkText(path, "", "tab");
      return;
    }
  }
  const today = /* @__PURE__ */ new Date();
  const label = `${today.getFullYear()}\u5E74${today.getMonth() + 1}\u6708${today.getDate()}\u65E5`;
  app.workspace.openLinkText(`${dateStr} ${label}`, "", "tab").catch(() => {
  });
}
function createWeekCalendarWidget(app, createSection) {
  const section = createSection("\u672C\u5468", "#22D3EE", "");
  section.style.setProperty("--ax-accent", "#22D3EE");
  const cleaners = [];
  const registerCleanup = (fn) => {
    cleaners.push(fn);
  };
  const grid = div("ax-wc-grid");
  const weekDays = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"];
  const today = /* @__PURE__ */ new Date();
  const todayDow = today.getDay();
  const mondayOffset = -(todayDow === 0 ? 6 : todayDow - 1);
  for (let i = 0; i < 7; i++) {
    const offset = mondayOffset + i;
    const dateStr = dayOffsetDate(offset);
    const noteCount = countNotesForDate(app, dateStr);
    const level = densityLevel(noteCount);
    const isToday = offset === 0;
    const cell = div("ax-wc-cell");
    if (isToday)
      cell.addClass("ax-wc-today");
    const dayLabel = el("span", { class: "ax-wc-day-label" }, weekDays[i]);
    cell.appendChild(dayLabel);
    const dateNum = el("span", { class: "ax-wc-date-num" }, String(new Date(dateStr).getDate()));
    cell.appendChild(dateNum);
    const dots = div("ax-wc-dots");
    if (level === 1) {
      dots.appendChild(div("ax-wc-dot ax-wc-dot-1"));
    } else if (level === 2) {
      for (let n = 0; n < 2; n++)
        dots.appendChild(div("ax-wc-dot ax-wc-dot-2"));
    } else if (level >= 3) {
      for (let n = 0; n < 3; n++)
        dots.appendChild(div("ax-wc-dot ax-wc-dot-3"));
    } else {
      dots.appendChild(div("ax-wc-dot ax-wc-dot-empty"));
    }
    cell.appendChild(dots);
    cell.title = `${dateStr} \xB7 ${noteCount} \u7BC7\u7B14\u8BB0`;
    const onCellClick = () => openDailyNote(app, offset);
    cell.addEventListener("click", onCellClick);
    registerCleanup(() => cell.removeEventListener("click", onCellClick));
    grid.appendChild(cell);
  }
  section.appendChild(grid);
  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners) {
      try {
        fn();
      } catch (e) {
      }
    }
    section.empty();
  });
  return { section, handle };
}

// src/agent/taskStore.ts
var records = [];
function listRecentTasks(count) {
  return records.slice(0, count);
}
function getTasksByStatus(status) {
  return records.filter((r) => r.status === status);
}

// src/agent/claudeCode.ts
var import_obsidian6 = require("obsidian");

// src/utils/ServiceResult.ts
function ok(value) {
  return { ok: true, value };
}
function err(code, message, recoverable = true, cause) {
  return { ok: false, error: { code, message, recoverable, cause } };
}
function renderErrorState(error, onRetry) {
  if (error.recoverable && onRetry) {
    const container = div("ax-widget-error ax-widget-error--recoverable");
    const msg = el("span", { class: "ax-widget-error-msg" }, error.message || "\u52A0\u8F7D\u5931\u8D25");
    const retryBtn = el("button", {
      class: "ax-btn ax-btn-ghost ax-btn-sm",
      type: "button"
    }, "\u70B9\u51FB\u91CD\u8BD5");
    retryBtn.addEventListener("click", onRetry);
    container.appendChild(msg);
    container.appendChild(retryBtn);
    return container;
  }
  const placeholder = div("ax-widget-error ax-widget-error--fatal");
  placeholder.innerHTML = '<div class="ax-widget-error-icon">\u26A0</div><div class="ax-widget-error-text">\u6A21\u5757\u6682\u65F6\u4E0D\u53EF\u7528</div><div class="ax-widget-error-code">' + (error.code || "") + "</div>";
  return placeholder;
}

// src/agent/claudeCode.ts
var TASKS_DIR = ".axlumen-tasks";
var QUEUE_FILE = `${TASKS_DIR}/queue.json`;
var RESULTS_DIR = `${TASKS_DIR}/results`;
async function readQueue(vault) {
  try {
    const queueFile = vault.getAbstractFileByPath(QUEUE_FILE);
    if (queueFile instanceof import_obsidian6.TFile) {
      const raw = await vault.read(queueFile);
      return ok(JSON.parse(raw));
    }
    return ok([]);
  } catch (e) {
    console.error("[CLI_READ_FAILED] readQueue:", e);
    return err("CLI_READ_FAILED", e.message || "\u8BFB\u53D6\u961F\u5217\u5931\u8D25", true, e);
  }
}

// src/widgets/agentStatus.ts
function shortTime(ts) {
  if (!ts)
    return "--";
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function relativeTime(ts) {
  if (!ts)
    return "--";
  const diff = Date.now() - ts;
  if (diff < MS_PER_MINUTE)
    return "\u521A\u521A";
  if (diff < MS_PER_HOUR)
    return Math.floor(diff / MS_PER_MINUTE) + " \u5206\u949F\u524D";
  if (diff < MS_PER_DAY)
    return Math.floor(diff / MS_PER_HOUR) + " \u5C0F\u65F6\u524D";
  return shortTime(ts);
}
async function createAgentStatusWidget(app, createSection) {
  const section = createSection("Agent", "#10B981", "");
  section.style.setProperty("--ax-accent", "#10B981");
  const allTasks = listRecentTasks(10);
  const runningTasks = getTasksByStatus("running");
  const isRunning = runningTasks.length > 0;
  const lastTask = allTasks.length > 0 ? allTasks[0] : null;
  const lastRunTime = lastTask ? lastTask.startedAt : 0;
  let queueCount = 0;
  try {
    const queueResult = await readQueue(app.vault);
    if (queueResult.ok) {
      queueCount = queueResult.value.filter((t) => t.status === "pending").length;
    }
  } catch (e) {
  }
  const statusRow = div("ax-agent-status-row");
  statusRow.innerHTML = '<div class="ax-agent-led' + (isRunning ? " ax-agent-led--running" : " ax-agent-led--idle") + '"></div><span class="ax-agent-state-text">' + (isRunning ? "\u8FD0\u884C\u4E2D" : "\u7A7A\u95F2") + "</span>" + (queueCount > 0 ? '<span class="ax-agent-queue-badge">' + queueCount + "</span>" : "");
  section.appendChild(statusRow);
  if (isRunning) {
    const progressBar = div("ax-agent-progress");
    progressBar.innerHTML = '<div class="ax-agent-progress-bar"></div>';
    section.appendChild(progressBar);
  }
  const meta = div("ax-agent-meta");
  meta.innerHTML = '<span class="ax-agent-meta-label">LAST RUN</span><span class="ax-agent-meta-time">' + (isRunning ? "\u8FDB\u884C\u4E2D..." : relativeTime(lastRunTime)) + "</span>";
  section.appendChild(meta);
  const runningCount = runningTasks.length;
  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const errCount = allTasks.filter((t) => t.status === "error").length;
  const stats = div("ax-agent-stats");
  stats.innerHTML = '<div class="ax-agent-stat"><b>' + runningCount + '</b><span>\u8FD0\u884C</span></div><div class="ax-agent-stat"><b>' + doneCount + '</b><span>\u5B8C\u6210</span></div><div class="ax-agent-stat"><b>' + errCount + "</b><span>\u5931\u8D25</span></div>";
  section.appendChild(stats);
  const handle = createRootedDisposable([section], () => {
    section.empty();
  });
  return { section, handle };
}

// src/widgets/feeds.ts
function mockGitHubFeed() {
  return [
    { source: "github", icon: "\u2B50", iconColor: "#FBBF24", title: "anthropics/claude-code", description: "AI-powered coding assistant for the terminal", meta: "\u25B4 12.4k", time: "2h ago" },
    { source: "github", icon: "\u2B50", iconColor: "#FBBF24", title: "obsidianmd/obsidian-api", description: "Type definitions for the Obsidian API", meta: "\u25B4 3.2k", time: "5h ago" },
    { source: "github", icon: "\u2B50", iconColor: "#FBBF24", title: "koekeishiya/yabai", description: "A tiling window manager for macOS", meta: "\u25B4 8.7k", time: "8h ago" },
    { source: "github", icon: "\u2B50", iconColor: "#FBBF24", title: "sindresorhus/awesome", description: "Awesome lists about all kinds of interesting topics", meta: "\u25B4 42.1k", time: "1d ago" }
  ];
}
function mockRssFeed() {
  return [
    { source: "rss", icon: "\u{1F4E1}", iconColor: "#22D3EE", title: "Building a Second Brain \u2014 A Practical Framework", description: "Forte Labs", meta: "RSS", time: "1h ago" },
    { source: "rss", icon: "\u{1F4E1}", iconColor: "#22D3EE", title: "AI agents that actually ship software", description: "Latent Space", meta: "RSS", time: "3h ago" },
    { source: "rss", icon: "\u{1F4E1}", iconColor: "#22D3EE", title: "The Zettelkasten Method: How to take smart notes", description: "Being Punctual", meta: "RSS", time: "6h ago" },
    { source: "rss", icon: "\u{1F4E1}", iconColor: "#22D3EE", title: "Deep Research: What agents do in 2026", description: "Import AI", meta: "RSS", time: "1d ago" }
  ];
}
function mergeFeeds(items) {
  return items.sort((a, b) => {
    const parseTime = (t) => {
      if (t.includes("\u521A\u521A"))
        return 0;
      if (t.includes("min"))
        return parseInt(t, 10);
      if (t.includes("h ago"))
        return parseInt(t, 10) * 60;
      if (t.includes("d ago"))
        return parseInt(t, 10) * 1440;
      return 9999;
    };
    return parseTime(a.time) - parseTime(b.time);
  });
}
function getLastRefreshTime() {
  return LocalStore.getFeedLastRefresh();
}
function saveRefreshTime() {
  const now = /* @__PURE__ */ new Date();
  LocalStore.setFeedLastRefresh(
    String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")
  );
}
function fetchFeedItems(tab) {
  try {
    let items = [];
    if (tab === "all") {
      items = mergeFeeds([...mockGitHubFeed(), ...mockRssFeed()]);
    } else if (tab === "github") {
      items = mockGitHubFeed();
    } else if (tab === "rss") {
      items = mockRssFeed();
    }
    return ok(items);
  } catch (e) {
    return err("FEED_FETCH_FAILED", "\u83B7\u53D6\u4FE1\u606F\u6D41\u5931\u8D25", true, e);
  }
}
function createFeedsPanel(app, createSection) {
  const section = createSection("\u4FE1\u606F\u6D41", "#6366F1", "");
  section.style.setProperty("--ax-accent", "#6366F1");
  section.addClass("ax-feeds-section");
  const cleaners = [];
  const timeouts = /* @__PURE__ */ new Set();
  const safeTimeout = (fn, ms) => {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      fn();
    }, ms);
    timeouts.add(id);
    return id;
  };
  const registerCleanup = (fn) => {
    cleaners.push(fn);
  };
  const tabBar = div("ax-feed-tabs");
  const tabs = [
    { id: "all", label: "All" },
    { id: "github", label: "GitHub" },
    { id: "rss", label: "RSS" }
  ];
  let activeTab = "all";
  const tabMap = /* @__PURE__ */ new Map();
  tabs.forEach((t) => {
    const tab = el("button", {
      class: "ax-feed-tab" + (t.id === activeTab ? " ax-feed-tab--active" : ""),
      type: "button",
      "data-tab": t.id
    }, t.label);
    tabMap.set(t.id, tab);
    tabBar.appendChild(tab);
  });
  section.appendChild(tabBar);
  const list = div("ax-feed-list");
  section.appendChild(list);
  const footer = div("ax-feed-footer");
  const lastRefresh = getLastRefreshTime();
  footer.innerHTML = '<span class="ax-feed-last-refresh">\u4E0A\u6B21\u5237\u65B0: ' + (lastRefresh || "--:--") + "</span>";
  const refreshBtn = el("button", { class: "ax-feed-refresh-btn", type: "button" }, "Refresh feeds");
  footer.appendChild(refreshBtn);
  section.appendChild(footer);
  function renderList() {
    list.empty();
    const result = fetchFeedItems(activeTab);
    if (!result.ok) {
      console.error("[FEEDS_WIDGET]", result.error.code, result.error.message);
      list.appendChild(renderErrorState(result.error, () => renderList()));
      return;
    }
    const items = result.value;
    items.forEach((item) => {
      const row = div("ax-feed-item");
      row.innerHTML = '<span class="ax-feed-icon" style="color:' + item.iconColor + '">' + item.icon + '</span><span class="ax-feed-body"><span class="ax-feed-title">' + esc(item.title) + '</span><span class="ax-feed-desc">' + esc(item.description) + '</span></span><span class="ax-feed-meta">' + esc(item.meta) + " \xB7 " + esc(item.time) + "</span>";
      if (item.url) {
        row.style.cursor = "pointer";
        const onRowClick = () => {
          if (item.url)
            window.open(item.url, "_blank");
        };
        row.addEventListener("click", onRowClick);
        registerCleanup(() => row.removeEventListener("click", onRowClick));
      }
      list.appendChild(row);
    });
    if (items.length === 0) {
      list.appendChild(el("div", { class: "ax-empty" }, "\u6682\u65E0\u4FE1\u606F"));
    }
  }
  function switchTab(tabId) {
    activeTab = tabId;
    tabMap.forEach((el3, id) => {
      el3.toggleClass("ax-feed-tab--active", id === tabId);
    });
    renderList();
  }
  tabs.forEach((t) => {
    const tab = tabMap.get(t.id);
    if (tab) {
      const onTabClick = () => switchTab(t.id);
      tab.addEventListener("click", onTabClick);
      registerCleanup(() => tab.removeEventListener("click", onTabClick));
    }
  });
  const onRefreshClick = () => {
    refreshBtn.addClass("is-loading");
    refreshBtn.textContent = "Refreshing...";
    safeTimeout(() => {
      saveRefreshTime();
      renderList();
      const lr = footer.querySelector(".ax-feed-last-refresh");
      if (lr)
        lr.textContent = "\u4E0A\u6B21\u5237\u65B0: " + (getLastRefreshTime() || "--:--");
      refreshBtn.removeClass("is-loading");
      refreshBtn.textContent = "Refresh feeds";
    }, 600);
  };
  refreshBtn.addEventListener("click", onRefreshClick);
  registerCleanup(() => refreshBtn.removeEventListener("click", onRefreshClick));
  renderList();
  const handle = createRootedDisposable([section], () => {
    for (const id of timeouts)
      window.clearTimeout(id);
    timeouts.clear();
    for (const fn of cleaners) {
      try {
        fn();
      } catch (e) {
      }
    }
    section.empty();
  });
  return { section, handle };
}

// src/widgets/workflows.ts
var import_obsidian9 = require("obsidian");

// src/utils/modal.ts
function createModal(config) {
  const overlay = el("div", { class: "ax-modal-overlay" });
  const modal = el("div", { class: "ax-modal" + (config.wide ? " ax-modal--wide" : "") });
  const titleEl = el("h3", { class: "ax-modal-title" }, config.title);
  modal.appendChild(titleEl);
  if (config.content) {
    modal.appendChild(config.content);
  }
  if (config.actions) {
    modal.appendChild(config.actions);
  }
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const close = () => {
    var _a;
    overlay.remove();
    (_a = config.onClose) == null ? void 0 : _a.call(config);
    document.removeEventListener("keydown", handleEsc);
  };
  const handleEsc = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", handleEsc);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      close();
    }
  });
  return { overlay, close };
}
function createModalActions(close, extra) {
  const actions = div("ax-modal-actions");
  const closeBtn = el("button", { class: "ax-btn ax-btn-ghost", type: "button" }, "\u5173\u95ED");
  closeBtn.addEventListener("click", close);
  if (extra)
    actions.appendChild(extra);
  actions.appendChild(closeBtn);
  return actions;
}

// src/agent/AgentRunner.ts
var import_obsidian7 = require("obsidian");
var MOCK_WORKFLOWS = [
  {
    id: "inbox-auto-routing",
    category: "Inbox Processing",
    name: "Inbox Auto-Routing",
    description: "\u81EA\u52A8\u5F52\u6863\u6536\u4EF6\u7BB1\u3001\u6279\u91CF\u6253\u6807\u7B7E",
    prompt: `\u4F60\u662F Vault \u5F52\u6863\u52A9\u624B\u3002\u626B\u63CF Inbox \u76EE\u5F55\uFF1A
1. \u8BFB\u53D6\u6BCF\u4E2A .md \u6587\u4EF6\u7684 frontmatter \u548C\u6807\u9898
2. \u6839\u636E\u6807\u7B7E/\u8DEF\u5F84\u89C4\u5219\u5F52\u6863\u5230\u5BF9\u5E94 Wiki
3. \u4E3A\u7F3A\u5931\u6807\u7B7E\u7684\u6587\u4EF6\u8865\u5168 type/xxx \u6807\u7B7E
4. \u8F93\u51FA\u5F52\u6863\u62A5\u544A`,
    defaultOutput: "dashboard/outputs/inbox-routing-{{date}}.md"
  },
  {
    id: "deep-research-single",
    category: "Deep Research",
    name: "Deep Research Single Topic",
    description: "\u5168\u7F51\u8D44\u6599\u8C03\u7814\u8F93\u51FA\u7ED3\u6784\u5316\u62A5\u544A",
    prompt: `\u4F60\u662F\u6DF1\u5EA6\u7814\u7A76\u52A9\u624B\u3002\u7ED9\u5B9A\u7684\u7814\u7A76\u4E3B\u9898\uFF0C\u8BF7\uFF1A
1. \u641C\u96C6\u8BE5\u4E3B\u9898\u7684\u6838\u5FC3\u6982\u5FF5\u3001\u5173\u952E\u4EBA\u7269\u3001\u53D1\u5C55\u5386\u53F2
2. \u6574\u7406\u6B63\u53CD\u4E24\u9762\u89C2\u70B9\u4E0E\u4E89\u8BAE
3. \u8F93\u51FA\u7ED3\u6784\u5316\u62A5\u544A\uFF08\u6458\u8981 \u2192 \u6B63\u6587 \u2192 \u6765\u6E90\uFF09
4. \u6807\u6CE8\u9700\u8981\u8FDB\u4E00\u6B65\u7814\u7A76\u7684\u5B50\u95EE\u9898`,
    defaultOutput: "dashboard/outputs/research-{{topic}}-{{date}}.md"
  },
  {
    id: "vault-lint-full-scan",
    category: "Vault Maintenance",
    name: "Vault Lint Full Scan",
    description: "\u68C0\u6D4B\u65AD\u94FE\u3001\u7F3A\u5931\u5143\u6570\u636E\u3001\u5B64\u7ACB\u7B14\u8BB0",
    prompt: `\u4F60\u662F Vault \u5065\u5EB7\u68C0\u67E5\u5668\u3002\u5168\u76D8\u626B\u63CF\uFF1A
1. \u627E\u51FA\u6240\u6709\u65AD\u94FE\uFF08[[wikilink]] \u6307\u5411\u4E0D\u5B58\u5728\u7684\u6587\u4EF6\uFF09
2. \u627E\u51FA\u7F3A\u5C11 frontmatter \u6216 status \u6807\u7B7E\u7684\u7B14\u8BB0
3. \u627E\u51FA\u5B64\u7ACB\u7684\u7B14\u8BB0\uFF08\u65E0\u5165\u94FE\u4E5F\u65E0\u51FA\u94FE\uFF09
4. \u6309\u4F18\u5148\u7EA7\u8F93\u51FA\u4FEE\u590D\u5EFA\u8BAE`,
    defaultOutput: "dashboard/outputs/vault-lint-{{date}}.md"
  },
  {
    id: "daily-diary-summary",
    category: "Writing Draft",
    name: "Daily Diary Summary",
    description: "\u6C47\u603B\u5F53\u65E5\u4EFB\u52A1\u4E0E\u7B14\u8BB0\u751F\u6210\u65E5\u8BB0",
    prompt: `\u4F60\u662F\u65E5\u8BB0\u751F\u6210\u52A9\u624B\u3002\u4ECA\u65E5\u6C47\u603B\uFF1A
1. \u8BFB\u53D6\u4ECA\u65E5 tasks \u5B8C\u6210\u60C5\u51B5
2. \u8BFB\u53D6\u4ECA\u65E5\u7F16\u8F91\u8FC7\u7684\u7B14\u8BB0\u6807\u9898
3. \u751F\u6210\u5305\u542B\u300C\u5B8C\u6210/\u8FDB\u884C\u4E2D/\u660E\u65E5\u8BA1\u5212\u300D\u7684\u65E5\u8BB0\u8349\u7A3F
4. \u6807\u6CE8\u5173\u952E\u6D1E\u5BDF\u4E0E\u5F85\u8DDF\u8FDB\u4E8B\u9879`,
    defaultOutput: "diary/{{date}}.md"
  },
  {
    id: "tag-classification-batch",
    category: "Vault Maintenance",
    name: "Tag Classification Batch",
    description: "\u6279\u91CF\u7EDF\u4E00\u6807\u7B7E\u89C4\u8303",
    prompt: `\u4F60\u662F\u6807\u7B7E\u6CBB\u7406\u52A9\u624B\u3002\u6279\u91CF\u5904\u7406\uFF1A
1. \u626B\u63CF\u6240\u6709\u7B14\u8BB0\u7684 tags \u5B57\u6BB5
2. \u627E\u51FA\u5927\u5C0F\u5199\u4E0D\u4E00\u81F4\u3001\u540C\u4E49\u91CD\u590D\u3001\u8FC7\u65F6\u6807\u7B7E
3. \u6309 tag-taxonomy.md \u89C4\u5219\u7EDF\u4E00\u91CD\u547D\u540D
4. \u8F93\u51FA\u53D8\u66F4\u65E5\u5FD7`,
    defaultOutput: "dashboard/outputs/tag-cleanup-{{date}}.md"
  },
  {
    id: "rss-content-digest",
    category: "Inbox Processing",
    name: "RSS Content Digest",
    description: "\u805A\u5408 RSS \u4FE1\u606F\u6D41\u7CBE\u7B80\u6458\u8981",
    prompt: `\u4F60\u662F RSS \u6458\u8981\u52A9\u624B\u3002\u7ED9\u5B9A RSS \u6E90\u5217\u8868\uFF1A
1. \u6293\u53D6\u6700\u65B0\u6761\u76EE\uFF08\u6807\u9898+\u94FE\u63A5+\u6458\u8981\uFF09
2. \u6309\u4E3B\u9898\u805A\u7C7B\u3001\u53BB\u91CD
3. \u8F93\u51FA\u300C\u4ECA\u65E5\u5FC5\u8BFB\u300D\u7CBE\u9009 3-5 \u6761\uFF0C\u6BCF\u6761 < 80 \u5B57
4. \u6807\u6CE8\u4E0E Vault \u5DF2\u6709\u77E5\u8BC6\u7684\u5173\u8054`,
    defaultOutput: "dashboard/outputs/rss-digest-{{date}}.md"
  }
];
var WORKFLOWS_DIR = "dashboard/workflows";
var LOGS_DIR = "dashboard/logs";
var CACHE_DIR = "dashboard/cache";
var RUNS_FILE = `${CACHE_DIR}/agent-runs.json`;
var FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
function parseFrontmatter(content) {
  const match = content.match(FM_REGEX);
  if (!match)
    return {};
  const body = match[1];
  const result = {};
  for (const line of body.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}
var AgentRunner = class {
  constructor(app) {
    this.activeTasks = /* @__PURE__ */ new Map();
    this.progressCallbacks = /* @__PURE__ */ new Set();
    this.completeCallbacks = /* @__PURE__ */ new Set();
    this.statusChangeCallbacks = /* @__PURE__ */ new Set();
    this.tickInterval = null;
    this.mockMode = true;
    this.tickCallbacks = /* @__PURE__ */ new Set();
    this.DisposeListeners = [];
    this.queue = [];
    this.maxConcurrent = 1;
    this.mockIntervals = /* @__PURE__ */ new Set();
    this.pendingSpawns = /* @__PURE__ */ new Set();
    this._disposed = false;
    this.app = app;
  }
  get disposed() {
    return this._disposed;
  }
  // ---------- 生命周期 ----------
  /** 启动 tick 定时器：每秒发射 elapsed 更新事件 */
  startTicking() {
    if (this.tickInterval)
      return;
    this.tickInterval = window.setInterval(() => {
      if (this.activeTasks.size === 0) {
        this.stopTicking();
        return;
      }
      this.emitTick();
    }, 1e3);
  }
  onTick(cb) {
    this.tickCallbacks.add(cb);
    return () => {
      this.tickCallbacks.delete(cb);
    };
  }
  emitTick() {
    for (const cb of this.tickCallbacks)
      cb();
  }
  stopTicking() {
    if (this.tickInterval) {
      window.clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
  /**
   * 完全停止：停定时器 + 清回调 + 清 pending CLI + 清事件监听。
   * 幂等——多次调用仅第一次生效。
   */
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    this.stopTicking();
    for (const h of this.mockIntervals)
      window.clearInterval(h);
    this.mockIntervals.clear();
    for (const proc of this.pendingSpawns) {
      try {
        proc.kill();
      } catch (e) {
      }
    }
    this.pendingSpawns.clear();
    this.progressCallbacks.clear();
    this.completeCallbacks.clear();
    this.statusChangeCallbacks.clear();
    this.tickCallbacks.clear();
    for (const off of this.DisposeListeners)
      off();
    this.DisposeListeners = [];
    this.activeTasks.clear();
  }
  /** 切换 mock 模式（后续对接 CLI 时翻转） */
  setMockMode(enabled) {
    this.mockMode = enabled;
  }
  // ==================== P5: 自动化调度 ====================
  scheduleAutoTask(workflowId, params, source = "auto") {
    this.queue.push({ workflowId, params, source });
    this.processQueue();
  }
  async processQueue() {
    if (this.activeTasks.size >= this.maxConcurrent || this.queue.length === 0)
      return;
    const next = this.queue.shift();
    const task = await this.run(next.workflowId, next.params);
    task._source = next.source;
  }
  handleTaskCompleteForQueue() {
    this.processQueue();
  }
  // ---------- 回调注册（Set 去重 + 返回反注册函数） ----------
  onProgress(cb) {
    this.progressCallbacks.add(cb);
    return () => {
      this.progressCallbacks.delete(cb);
    };
  }
  onComplete(cb) {
    this.completeCallbacks.add(cb);
    return () => {
      this.completeCallbacks.delete(cb);
    };
  }
  /**
   * 注册任意清理函数（事件监听器等），dispose 时统一调用
   */
  onDispose(fn) {
    this.DisposeListeners.push(fn);
  }
  /**
   * 任务状态变更回调（running/completed/failed/stopped）。
   * 返回 off 函数用于反注册。
   */
  onStatusChange(cb) {
    this.statusChangeCallbacks.add(cb);
    return () => {
      this.statusChangeCallbacks.delete(cb);
    };
  }
  // ---------- 任务执行 ----------
  async run(workflowId, params) {
    const tpl = await this.getWorkflow(workflowId);
    if (!tpl) {
      throw new Error(`\u5DE5\u4F5C\u6D41\u6A21\u677F\u4E0D\u5B58\u5728: ${workflowId}`);
    }
    const taskId = `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const outputPath = tpl.defaultOutput || `dashboard/outputs/${workflowId}-${taskId}.md`;
    const prompt = this.interpolatePrompt(tpl.prompt, params);
    const task = {
      id: taskId,
      workflowId,
      name: tpl.name,
      startTime: Date.now(),
      status: "running",
      log: "",
      outputPath
    };
    this.activeTasks.set(taskId, task);
    this.startTicking();
    if (this.mockMode) {
      this.executeMockTask(task, prompt);
    } else {
      this.executeTask(task, prompt).catch(() => {
      });
    }
    return task;
  }
  executeMockTask(task, prompt) {
    const mockLogs = [
      "[init] \u52A0\u8F7D\u5DE5\u4F5C\u6D41\u6A21\u677F...",
      "[scan] \u626B\u63CF\u76EE\u6807\u76EE\u5F55...",
      "[analyze] \u5206\u6790\u5185\u5BB9\u7ED3\u6784...",
      "[process] \u6267\u884C\u5904\u7406\u903B\u8F91...",
      "[generate] \u751F\u6210\u8F93\u51FA\u6587\u4EF6...",
      "[done] \u5B8C\u6210"
    ];
    let step = 0;
    const totalSteps = mockLogs.length;
    const interval = window.setInterval(() => {
      this.mockIntervals.add(interval);
      if (task.status !== "running") {
        window.clearInterval(interval);
        this.mockIntervals.delete(interval);
        return;
      }
      if (step < totalSteps) {
        const line = mockLogs[step];
        task.log += line + "\n";
        task.progress = Math.round((step + 1) / totalSteps * 100);
        this.emitProgress(task.id, line, task.progress);
        step++;
      } else {
        window.clearInterval(interval);
        this.mockIntervals.delete(interval);
        task.status = "completed";
        task.endTime = Date.now();
        task.progress = 100;
        this.activeTasks.delete(task.id);
        this.appendLog(task, `
[DONE] \u5B8C\u6210 \xB7 \u8017\u65F6 ${((task.endTime - task.startTime) / 1e3).toFixed(1)}s`);
        this.emitComplete(task.id, true, task.outputPath);
        this.emitStatusChange(task.id, "completed", task);
        this.persistRuns();
        this.handleTaskCompleteForQueue();
      }
    }, 800);
  }
  stopCurrentTask() {
    for (const [id, task] of this.activeTasks) {
      if (task.status === "running") {
        task.status = "stopped";
        task.endTime = Date.now();
        this.appendLog(task, "\n[STOPPED] \u7528\u6237\u7EC8\u6B62\u4EFB\u52A1");
        this.activeTasks.delete(id);
        this.emitComplete(id, false, task.outputPath);
        this.emitStatusChange(id, "stopped", task);
      }
    }
    this.persistRuns();
  }
  getQueuedCount() {
    return 0;
  }
  /**
   * 内部：spawn 执行 claude -p
   * 进程引用记入 pendingSpawns，dispose 时统一 kill
   */
  async executeTask(task, prompt) {
    var _a, _b, _c, _d, _e, _f;
    const vault = this.app.vault;
    const logPath = `${LOGS_DIR}/${task.id}.log`;
    try {
      await this.ensureDir(LOGS_DIR);
      await this.ensureDir(CACHE_DIR);
      const outputDir = task.outputPath.substring(0, task.outputPath.lastIndexOf("/"));
      if (outputDir)
        await this.ensureDir(outputDir);
      await vault.create(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] Starting: ${task.name}

`);
      const nodeRequire = this.getNodeRequire("child_process");
      if (!nodeRequire || !nodeRequire.spawn) {
        this.failTask(task, "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301 Node.js spawn\uFF0CAgent CLI \u8C03\u7528\u5DF2\u7981\u7528");
        return;
      }
      const spawn = nodeRequire.spawn;
      const pluginSettings = (_c = (_b = (_a = this.app.plugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["axlumen-dashboard"]) == null ? void 0 : _c.settings;
      let vaultPath = (pluginSettings == null ? void 0 : pluginSettings.vaultPath) || "";
      if (!vaultPath) {
        const adapter = this.app.vault.adapter;
        if (typeof (adapter == null ? void 0 : adapter.getBasePath) === "function") {
          vaultPath = adapter.getBasePath();
        }
      }
      if (!vaultPath && typeof process !== "undefined" && process.cwd) {
        vaultPath = process.cwd();
      }
      if (!vaultPath)
        vaultPath = ".";
      const args = ["-p", prompt];
      const settings = (_f = (_e = (_d = this.app.plugins) == null ? void 0 : _d.plugins) == null ? void 0 : _e["axlumen-dashboard"]) == null ? void 0 : _f.settings;
      const claudePath = (settings == null ? void 0 : settings.claudeCodePath) || "claude";
      this.appendLog(task, `> ${claudePath} -p "...(prompt, ${prompt.length} chars)"
`);
      const env = {};
      if (typeof process !== "undefined" && process.env) {
        Object.assign(env, process.env);
      }
      env.PYTHONIOENCODING = "utf-8";
      const proc = spawn(claudePath, args, {
        cwd: vaultPath,
        env
      });
      this.pendingSpawns.add(proc);
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (data) => {
        const text = data.toString("utf-8");
        stdout += text;
        this.appendLog(task, text);
        this.emitProgress(task.id, text);
      });
      proc.stderr.on("data", (data) => {
        const text = data.toString("utf-8");
        stderr += text;
        this.appendLog(task, `[stderr] ${text}`);
      });
      proc.on("close", async (code) => {
        this.pendingSpawns.delete(proc);
        const duration = ((Date.now() - task.startTime) / 1e3).toFixed(1);
        if (code === 0) {
          task.status = "completed";
          task.endTime = Date.now();
          try {
            const outputContent = `---
taskId: ${task.id}
workflowId: ${task.workflowId}
completedAt: ${(/* @__PURE__ */ new Date()).toISOString()}
duration: ${duration}s
---

${stdout}`;
            await vault.create(task.outputPath, outputContent);
          } catch (e) {
          }
          this.appendLog(task, `
[DONE] \u5B8C\u6210 \xB7 \u8017\u65F6 ${duration}s`);
          this.emitComplete(task.id, true, task.outputPath);
          this.emitStatusChange(task.id, "completed", task);
        } else {
          task.status = "failed";
          task.endTime = Date.now();
          task.error = `Exit code: ${code}${stderr ? " \u2014 " + stderr.slice(0, 200) : ""}`;
          this.appendLog(task, `
[FAIL] code=${code} \xB7 ${task.error}`);
          this.emitComplete(task.id, false, task.outputPath);
          this.emitStatusChange(task.id, "failed", task);
        }
        this.activeTasks.delete(task.id);
        await this.persistRuns();
        this.handleTaskCompleteForQueue();
      });
      proc.on("error", async (err2) => {
        this.pendingSpawns.delete(proc);
        this.failTask(task, err2.message);
        await this.persistRuns();
        this.handleTaskCompleteForQueue();
      });
    } catch (err2) {
      this.failTask(task, (err2 == null ? void 0 : err2.message) || String(err2));
      this.handleTaskCompleteForQueue();
    }
  }
  appendLog(task, text) {
    task.log += text;
  }
  failTask(task, error) {
    task.status = "failed";
    task.endTime = Date.now();
    task.error = error;
    this.appendLog(task, `
[ERROR] ${error}`);
    this.activeTasks.delete(task.id);
    this.emitComplete(task.id, false, task.outputPath);
    this.emitStatusChange(task.id, "failed", task);
  }
  emitProgress(taskId, line, progress) {
    const task = this.activeTasks.get(taskId);
    for (const cb of this.progressCallbacks) {
      cb(taskId, line, progress != null ? progress : task == null ? void 0 : task.progress);
    }
  }
  emitComplete(taskId, success, outputPath) {
    for (const cb of this.completeCallbacks) {
      cb(taskId, success, outputPath);
    }
  }
  emitStatusChange(taskId, status, task) {
    for (const cb of this.statusChangeCallbacks) {
      cb(taskId, status, task);
    }
  }
  // ---------- 查询接口 ----------
  getActiveTasks() {
    return Array.from(this.activeTasks.values());
  }
  async getHistory(limit = 10) {
    try {
      const file = this.app.vault.getAbstractFileByPath(RUNS_FILE);
      if (file instanceof import_obsidian7.TFile) {
        const raw = await this.app.vault.read(file);
        const all = JSON.parse(raw);
        return all.slice(0, limit);
      }
    } catch (e) {
      console.warn("[Axlumen] \u8BFB\u53D6\u8FD0\u884C\u5386\u53F2\u5931\u8D25:", e.message);
    }
    return [];
  }
  async persistRuns() {
    const vault = this.app.vault;
    try {
      const file = vault.getAbstractFileByPath(RUNS_FILE);
      let history = [];
      if (file instanceof import_obsidian7.TFile) {
        const raw = await vault.read(file);
        history = JSON.parse(raw);
      }
      const allTasks = [...history];
      for (const task of this.activeTasks.values()) {
        const existing = allTasks.findIndex((t) => t.id === task.id);
        if (existing >= 0) {
          allTasks[existing] = { ...task };
        } else {
          allTasks.unshift({ ...task });
        }
      }
      const trimmed = allTasks.slice(0, 50);
      await vault.create(RUNS_FILE, JSON.stringify(trimmed, null, 2));
      for (const task of trimmed) {
        if (task.status !== "running" && task.log) {
          const logPath = `${LOGS_DIR}/${task.id}.log`;
          try {
            await vault.create(logPath, task.log);
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
  }
  // ---------- 工作流模板管理 ----------
  async scanWorkflows() {
    const templates = [];
    templates.push(...MOCK_WORKFLOWS);
    try {
      const vault = this.app.vault;
      const files = vault.getMarkdownFiles();
      for (const file of files) {
        if (!file.path.startsWith(WORKFLOWS_DIR + "/"))
          continue;
        const content = await vault.read(file);
        const fm = parseFrontmatter(content);
        const body = content.replace(FM_REGEX, "$2").trim();
        const id = file.basename;
        const existingIdx = templates.findIndex((t) => t.id === id);
        const tpl = {
          id,
          category: fm.category || "Custom",
          name: fm.name || id,
          description: fm.description || "",
          prompt: fm.prompt || body,
          defaultOutput: fm.defaultOutput
        };
        if (existingIdx >= 0) {
          templates[existingIdx] = tpl;
        } else {
          templates.push(tpl);
        }
      }
    } catch (e) {
    }
    return templates;
  }
  async getWorkflow(id) {
    const all = await this.scanWorkflows();
    return all.find((t) => t.id === id) || null;
  }
  async createTemplate(id, category, name) {
    const vault = this.app.vault;
    await this.ensureDir(WORKFLOWS_DIR);
    const path = `${WORKFLOWS_DIR}/${id}.md`;
    const content = `---
category: "${category}"
name: "${name}"
description: ""
prompt: "\u5728\u8FD9\u91CC\u5199\u5165\u63D0\u793A\u8BCD..."
defaultOutput: "dashboard/outputs/${id}-output.md"
---

# ${name}

\uFF08\u53EF\u9009\uFF1A\u6A21\u677F\u7528\u9014\u8BF4\u660E\uFF09
`;
    await vault.create(path, content);
  }
  async updateTemplate(id, content) {
    const vault = this.app.vault;
    const path = `${WORKFLOWS_DIR}/${id}.md`;
    const file = vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian7.TFile) {
      await vault.modify(file, content);
    }
  }
  async deleteTemplate(id) {
    const vault = this.app.vault;
    const path = `${WORKFLOWS_DIR}/${id}.md`;
    const file = vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian7.TFile) {
      await vault.delete(file);
    }
  }
  // ---------- 工具方法 ----------
  interpolatePrompt(template, params) {
    if (!params)
      return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] || `{{${key}}}`);
  }
  async ensureDir(_path) {
  }
  getNodeRequire(moduleName) {
    try {
      if (typeof window !== "undefined" && window.require) {
        return window.require(moduleName);
      }
    } catch (e) {
    }
    return {};
  }
};

// src/widgets/workflows.ts
var STATUS_ICONS = {
  running: "\u23F3",
  completed: "\u2705",
  stopped: "\u23F9",
  failed: "\u274C"
};
async function createWorkflowsPanel(app, createSection, runner, rulesStore) {
  const localRunner = runner || new AgentRunner(app);
  const section = createSection("Agent Workflows", "#8B5CF6", "");
  section.style.setProperty("--ax-accent", "#8B5CF6");
  section.addClass("ax-workflows-section");
  const cleaners = [];
  const registerCleanup = (fn) => {
    cleaners.push(fn);
  };
  const toolbar = div("ax-wf-toolbar");
  const historyBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F558} History");
  const templatesBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F4C4} Templates");
  const refreshBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F504}");
  const automationBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u26A1 Rules");
  toolbar.appendChild(historyBtn);
  toolbar.appendChild(templatesBtn);
  toolbar.appendChild(automationBtn);
  toolbar.appendChild(refreshBtn);
  section.appendChild(toolbar);
  const container = div("ax-wf-container");
  section.appendChild(container);
  async function loadAndRender2() {
    container.empty();
    container.appendChild(div("ax-wf-loading", "\u52A0\u8F7D\u5DE5\u4F5C\u6D41\u6A21\u677F..."));
    const templates = await localRunner.scanWorkflows();
    container.empty();
    if (templates.length === 0) {
      const empty = div("ax-wf-empty");
      empty.innerHTML = "\u6682\u65E0\u5DE5\u4F5C\u6D41\u6A21\u677F<br><small>\u5728 vault/dashboard/workflows/ \u653E\u7F6E .md \u6A21\u677F\u6587\u4EF6\u540E\u5237\u65B0</small>";
      container.appendChild(empty);
      return;
    }
    const groups = /* @__PURE__ */ new Map();
    for (const tpl of templates) {
      const cat = tpl.category || "\u672A\u5206\u7C7B";
      if (!groups.has(cat))
        groups.set(cat, []);
      groups.get(cat).push(tpl);
    }
    for (const [category, tpls] of groups) {
      const groupEl = div("ax-wf-group");
      const groupHeader = div("ax-wf-group-header");
      groupHeader.innerHTML = '<span class="ax-wf-group-toggle">\u25BE</span><span class="ax-wf-group-icon">' + esc(getCategoryIcon(category)) + '</span><span class="ax-wf-group-name">' + esc(category) + '</span><span class="ax-wf-group-count">' + tpls.length + "</span>";
      const groupBody = div("ax-wf-group-body");
      for (const tpl of tpls) {
        const { card, cleanup } = createWorkflowCard(app, tpl, localRunner);
        groupBody.appendChild(card);
        registerCleanup(cleanup);
      }
      const onHeaderClick = () => {
        const collapsed = groupBody.hasClass("ax-wf-group-body--collapsed");
        groupBody.toggleClass("ax-wf-group-body--collapsed", !collapsed);
        groupHeader.querySelector(".ax-wf-group-toggle").textContent = collapsed ? "\u25BE" : "\u25B8";
      };
      groupHeader.addEventListener("click", onHeaderClick);
      registerCleanup(() => groupHeader.removeEventListener("click", onHeaderClick));
      groupEl.appendChild(groupHeader);
      groupEl.appendChild(groupBody);
      container.appendChild(groupEl);
    }
  }
  const onHistoryClick = async () => {
    const history = await localRunner.getHistory(10);
    showHistoryModal(app, history, localRunner);
  };
  historyBtn.addEventListener("click", onHistoryClick);
  registerCleanup(() => historyBtn.removeEventListener("click", onHistoryClick));
  const onTemplatesClick = async () => {
    await showTemplateManager(app, localRunner, loadAndRender2);
  };
  templatesBtn.addEventListener("click", onTemplatesClick);
  registerCleanup(() => templatesBtn.removeEventListener("click", onTemplatesClick));
  const onRefreshClick = () => {
    void loadAndRender2();
  };
  refreshBtn.addEventListener("click", onRefreshClick);
  registerCleanup(() => refreshBtn.removeEventListener("click", onRefreshClick));
  const onAutomationClick = () => {
    showAutomationModal(app, rulesStore);
  };
  automationBtn.addEventListener("click", onAutomationClick);
  registerCleanup(() => automationBtn.removeEventListener("click", onAutomationClick));
  const offProgress = localRunner.onProgress((_taskId, _line) => {
  });
  const offComplete = localRunner.onComplete((_taskId, _success, _output) => {
    void loadAndRender2();
  });
  registerCleanup(offProgress);
  registerCleanup(offComplete);
  await loadAndRender2();
  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners) {
      try {
        fn();
      } catch (e) {
      }
    }
    section.empty();
  });
  return { section, handle };
}
function getCategoryIcon(category) {
  const map = {
    "Inbox Processing": "\u{1F4E5}",
    "Deep Research": "\u{1F52C}",
    "Vault Maintenance": "\u{1F527}",
    "Writing Draft": "\u270D\uFE0F"
  };
  return map[category] || "\u2699\uFE0F";
}
function createWorkflowCard(app, tpl, runner) {
  const card = div("ax-wf-card");
  const cleaners = [];
  const header = div("ax-wf-card-header");
  const nameRow = div("ax-wf-card-name-row");
  const icon2 = div("ax-wf-card-icon");
  icon2.textContent = getCategoryIcon(tpl.category);
  const name = div("ax-wf-card-name");
  name.textContent = tpl.name;
  name.title = "\u70B9\u51FB\u67E5\u770B\u5B8C\u6574\u63D0\u793A\u8BCD";
  const expandIndicator = div("ax-wf-card-expand-indicator", "\u25B8");
  nameRow.appendChild(icon2);
  nameRow.appendChild(name);
  nameRow.appendChild(expandIndicator);
  header.appendChild(nameRow);
  let promptPreview = null;
  const onHeaderClick = () => {
    if (promptPreview) {
      promptPreview.remove();
      promptPreview = null;
      expandIndicator.textContent = "\u25B8";
      expandIndicator.removeClass("ax-wf-card-expand-indicator--open");
    } else {
      promptPreview = createPromptPreview(app, tpl);
      card.appendChild(promptPreview);
      expandIndicator.textContent = "\u25BE";
      expandIndicator.addClass("ax-wf-card-expand-indicator--open");
    }
  };
  header.addEventListener("click", onHeaderClick);
  cleaners.push(() => header.removeEventListener("click", onHeaderClick));
  card.appendChild(header);
  if (tpl.description) {
    const desc = div("ax-wf-card-desc");
    desc.textContent = tpl.description;
    card.appendChild(desc);
  }
  const actions = div("ax-wf-card-actions");
  const runBtn = el("button", { class: "ax-btn ax-btn-primary ax-btn-sm", type: "button" }, "\u25B6 Run");
  const copyBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F4CB} Copy Prompt");
  actions.appendChild(runBtn);
  actions.appendChild(copyBtn);
  card.appendChild(actions);
  const statusArea = div("ax-wf-card-status");
  statusArea.style.display = "none";
  card.appendChild(statusArea);
  let currentTaskId = null;
  const offComplete = runner.onComplete((taskId, success, outputPath) => {
    if (taskId !== currentTaskId)
      return;
    if (success) {
      showCompletedState(statusArea, { id: taskId, startTime: Date.now(), endTime: Date.now() }, outputPath || "", app);
    } else {
      showStoppedState(statusArea, { id: taskId, startTime: Date.now() });
    }
    runBtn.disabled = false;
    runBtn.removeClass("ax-btn--disabled");
    card.removeClass("ax-wf-card--running");
  });
  cleaners.push(offComplete);
  const offProgress = runner.onProgress((taskId, line) => {
    if (taskId !== currentTaskId)
      return;
    appendLogLine(statusArea, line);
  });
  cleaners.push(offProgress);
  const onRunClick = async () => {
    runBtn.disabled = true;
    runBtn.addClass("ax-btn--disabled");
    card.addClass("ax-wf-card--running");
    statusArea.style.display = "none";
    statusArea.empty();
    try {
      const task = await runner.run(tpl.id);
      currentTaskId = task.id;
      showRunningState(statusArea, task);
    } catch (err2) {
      showFailedState(statusArea, { id: "", error: (err2 == null ? void 0 : err2.message) || String(err2) }, () => {
        statusArea.empty();
        statusArea.style.display = "none";
        runBtn.click();
      });
      runBtn.disabled = false;
      runBtn.removeClass("ax-btn--disabled");
      card.removeClass("ax-wf-card--running");
    }
  };
  runBtn.addEventListener("click", onRunClick);
  cleaners.push(() => runBtn.removeEventListener("click", onRunClick));
  const onCopyClick = async () => {
    await copyToClipboard(tpl.prompt);
    showCopyFeedback(copyBtn);
  };
  copyBtn.addEventListener("click", onCopyClick);
  cleaners.push(() => copyBtn.removeEventListener("click", onCopyClick));
  return {
    card,
    cleanup: () => {
      for (const fn of cleaners) {
        try {
          fn();
        } catch (e) {
        }
      }
    }
  };
}
function createPromptPreview(app, tpl) {
  const preview = div("ax-wf-prompt-preview");
  const header = div("ax-wf-prompt-header");
  header.innerHTML = '<span class="ax-wf-prompt-title">\u63D0\u793A\u8BCD\u9884\u89C8</span>';
  const copyAllBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F4CB} Copy full prompt");
  copyAllBtn.addEventListener("click", async () => {
    await copyToClipboard(tpl.prompt);
    showCopyFeedback(copyAllBtn);
  });
  header.appendChild(copyAllBtn);
  preview.appendChild(header);
  const codeBlock = div("ax-wf-prompt-code");
  codeBlock.textContent = tpl.prompt;
  preview.appendChild(codeBlock);
  return preview;
}
function showCopyFeedback(btn) {
  const orig = btn.textContent;
  btn.textContent = "\u2705 Copied!";
  window.setTimeout(() => {
    btn.textContent = orig;
  }, 1500);
}
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}
function showRunningState(statusArea, task) {
  statusArea.empty();
  statusArea.style.display = "block";
  statusArea.addClass("ax-wf-card-status--running");
  const progress = div("ax-wf-progress");
  progress.innerHTML = '<div class="ax-wf-progress-bar ax-wf-progress-bar--indeterminate"></div>';
  statusArea.appendChild(progress);
  const label = div("ax-wf-status-label", "\u23F3 Running...");
  statusArea.appendChild(label);
  const log = div("ax-wf-log");
  log.dataset.taskId = task.id;
  statusArea.appendChild(log);
}
function showCompletedState(statusArea, task, outputPath, app) {
  statusArea.empty();
  statusArea.removeClass("ax-wf-card-status--running");
  statusArea.addClass("ax-wf-card-status--completed");
  const duration = task.durationStr || (task.endTime ? ((task.endTime - task.startTime) / 1e3).toFixed(1) + "s" : "?");
  const label = div("ax-wf-status-label", "\u2705 Completed \xB7 \u8017\u65F6" + duration + "s");
  statusArea.appendChild(label);
  const viewLink = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F4C2} View Output");
  viewLink.addEventListener("click", () => {
    app.workspace.openLinkText(outputPath, "", "tab");
  });
  statusArea.appendChild(viewLink);
}
function showStoppedState(statusArea, task) {
  statusArea.empty();
  statusArea.removeClass("ax-wf-card-status--running");
  statusArea.addClass("ax-wf-card-status--stopped");
  const duration = task.endTime ? ((task.endTime - task.startTime) / 1e3).toFixed(1) : "?";
  const label = div("ax-wf-status-label", "\u23F9 Stopped \xB7 ran " + duration + "s");
  statusArea.appendChild(label);
}
function showFailedState(statusArea, task, onRetry) {
  statusArea.empty();
  statusArea.removeClass("ax-wf-card-status--running");
  statusArea.addClass("ax-wf-card-status--failed");
  const label = div("ax-wf-status-label", "\u274C Failed");
  statusArea.appendChild(label);
  if (task.error) {
    const errEl = div("ax-wf-error-msg");
    errEl.textContent = task.error;
    statusArea.appendChild(errEl);
  }
  const retryBtn = el("button", { class: "ax-btn ax-btn-primary ax-btn-sm", type: "button" }, "\u{1F504} Retry");
  retryBtn.addEventListener("click", onRetry);
  statusArea.appendChild(retryBtn);
}
function appendLogLine(statusArea, line) {
  const log = statusArea.querySelector(".ax-wf-log");
  if (!log)
    return;
  const lineEl = document.createElement("div");
  lineEl.className = "ax-wf-log-line";
  lineEl.textContent = line;
  log.appendChild(lineEl);
  log.scrollTop = log.scrollHeight;
}
function showHistoryModal(app, history, runner) {
  const recent = history.slice(0, 10);
  const list = div("ax-wf-history-list");
  if (recent.length === 0) {
    list.appendChild(div("ax-wf-empty", "\u6682\u65E0\u8FD0\u884C\u8BB0\u5F55"));
  } else {
    recent.forEach((task) => {
      const item = div("ax-wf-history-item ax-wf-history-item--" + task.status);
      const statusIcon = STATUS_ICONS[task.status] || "\u274C";
      const time = new Date(task.startTime).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
      const duration = task.endTime ? ((task.endTime - task.startTime) / 1e3).toFixed(1) + "s" : "";
      item.innerHTML = '<span class="ax-wf-history-icon">' + statusIcon + '</span><span class="ax-wf-history-name">' + esc(task.name) + '</span><span class="ax-wf-history-time">' + esc(time) + "</span>" + (duration ? '<span class="ax-wf-history-dur">' + esc(duration) + "</span>" : "") + '<span class="ax-wf-history-output">' + esc(task.outputPath) + "</span>";
      const actions = div("ax-wf-history-actions");
      const reRunBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F504} Re-run");
      reRunBtn.addEventListener("click", () => {
        runner.run(task.workflowId);
        close();
      });
      const openLogsBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F4DC} Logs");
      openLogsBtn.addEventListener("click", () => showLogViewer(app, task));
      actions.appendChild(reRunBtn);
      actions.appendChild(openLogsBtn);
      item.appendChild(actions);
      if (task.status === "completed" && task.outputPath) {
        const outputEl = item.querySelector(".ax-wf-history-output");
        outputEl.style.cursor = "pointer";
        outputEl.style.textDecoration = "underline";
        outputEl.addEventListener("click", () => {
          app.workspace.openLinkText(task.outputPath, "", "tab");
          close();
        });
      }
      list.appendChild(item);
    });
  }
  let close = () => {
  };
  const result = createModal({
    title: "Agent \u8FD0\u884C\u5386\u53F2",
    content: list,
    actions: createModalActions(() => close()),
    wide: true
  });
  close = result.close;
}
function showLogViewer(_app, task) {
  const logContent = div("ax-wf-log-viewer");
  logContent.textContent = task.log || "(\u65E0\u65E5\u5FD7)";
  let close = () => {
  };
  const result = createModal({
    title: "\u{1F4DC} \u65E5\u5FD7: " + esc(task.name),
    content: logContent,
    actions: createModalActions(() => close()),
    wide: true
  });
  close = result.close;
}
async function showAutomationModal(_app, store) {
  const list = div("ax-auto-rule-list");
  function getRules() {
    return (store == null ? void 0 : store.getRules()) || [];
  }
  function persist(rules) {
    store == null ? void 0 : store.saveRules(rules);
  }
  function loadList() {
    list.empty();
    const rules = getRules();
    if (rules.length === 0) {
      list.appendChild(div("ax-empty", "\u6682\u65E0\u81EA\u52A8\u5316\u89C4\u5219"));
      return;
    }
    rules.forEach((rule) => {
      const item = div("ax-auto-rule-item");
      item.innerHTML = '<span class="ax-auto-rule-name">' + esc(rule.name) + '</span><span class="ax-auto-rule-trigger">' + esc(formatTrigger(rule)) + "</span>";
      const toggle = el("input", { type: "checkbox", class: "ax-auto-rule-toggle" });
      toggle.checked = rule.enabled;
      toggle.addEventListener("change", () => {
        rule.enabled = toggle.checked;
        persist(getRules());
      });
      const delBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F5D1}");
      delBtn.addEventListener("click", () => {
        const rules2 = getRules();
        const idx = rules2.findIndex((r) => r.id === rule.id);
        if (idx >= 0)
          rules2.splice(idx, 1);
        persist(rules2);
        loadList();
      });
      const actions = div("ax-auto-rule-actions");
      actions.appendChild(toggle);
      actions.appendChild(delBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }
  function formatTrigger(rule) {
    var _a, _b;
    const t = rule.trigger;
    if (t.type === "schedule") {
      const params = t.params;
      if (params.mode === "every" && params.intervalMs) {
        const minutes = Math.round(params.intervalMs / 6e4);
        if (minutes >= 1440)
          return "\u6BCF " + Math.round(minutes / 1440) + " \u5929";
        return "\u6BCF " + minutes + " \u5206\u949F";
      }
      if (params.mode === "at") {
        const hour = (_a = params.hour) != null ? _a : 0;
        const minute = (_b = params.minute) != null ? _b : 0;
        return "\u6BCF\u5929 " + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
      }
    }
    if (t.type === "inbox_threshold") {
      const threshold = t.params.threshold || 5;
      return "Inbox \u2265 " + threshold + " \u6761";
    }
    if (t.type === "on_startup")
      return "\u6253\u5F00 Dashboard";
    if (t.type === "event")
      return "Vault \u6587\u4EF6\u53D8\u5316";
    return t.type;
  }
  const newBtn = el("button", { class: "ax-btn ax-btn-primary ax-btn-sm", type: "button" }, "\uFF0B \u65B0\u5EFA\u89C4\u5219");
  newBtn.addEventListener("click", async () => {
    const { showInputDialog: showInputDialog2 } = await Promise.resolve().then(() => (init_dialog(), dialog_exports));
    const name = await showInputDialog2(_app, "\u65B0\u5EFA\u81EA\u52A8\u5316\u89C4\u5219", "\u89C4\u5219\u540D\u79F0");
    if (!name)
      return;
    const triggerType = await showInputDialog2(_app, "\u89E6\u53D1\u7C7B\u578B", "schedule / inbox_threshold / on_startup / event", "schedule");
    if (!triggerType)
      return;
    const actionType = await showInputDialog2(_app, "\u52A8\u4F5C\u7C7B\u578B", "pull_rss / pull_github / inbox_auto_route / vault_lint / daily_diary", "vault_lint");
    if (!actionType)
      return;
    let triggerConfig;
    if (triggerType === "schedule") {
      const mode = await showInputDialog2(_app, "\u5B9A\u65F6\u6A21\u5F0F", "every (\u56FA\u5B9A\u95F4\u9694) / at (\u6BCF\u5929\u5B9A\u65F6)", "every");
      if (!mode)
        return;
      if (mode === "every") {
        const min = await showInputDialog2(_app, "\u5B9A\u65F6\u95F4\u9694", "\u5206\u949F", "1440");
        const intervalMs = parseInt(min || "1440", 10) * 6e4;
        triggerConfig = { type: "schedule", params: { mode: "every", intervalMs } };
      } else {
        const hourStr = await showInputDialog2(_app, "\u6267\u884C\u65F6\u95F4\uFF08\u5C0F\u65F6\uFF09", "0-23", "9");
        const minuteStr = await showInputDialog2(_app, "\u6267\u884C\u65F6\u95F4\uFF08\u5206\u949F\uFF09", "0-59", "0");
        triggerConfig = {
          type: "schedule",
          params: { mode: "at", hour: parseInt(hourStr || "9", 10), minute: parseInt(minuteStr || "0", 10) }
        };
      }
    } else if (triggerType === "inbox_threshold") {
      const cnt = await showInputDialog2(_app, "Inbox \u9608\u503C", "\u6761\u6570", "5");
      triggerConfig = { type: "inbox_threshold", params: { threshold: parseInt(cnt || "5", 10) } };
    } else if (triggerType === "on_startup") {
      triggerConfig = { type: "on_startup", params: {} };
    } else if (triggerType === "event") {
      triggerConfig = { type: "event", params: { debounceMs: 500 } };
    } else {
      triggerConfig = { type: triggerType, params: {} };
    }
    const rule = {
      id: "rule-" + Date.now().toString(36),
      name,
      enabled: true,
      trigger: triggerConfig,
      actionName: actionType,
      createdAt: Date.now()
    };
    const existing = getRules();
    existing.push(rule);
    persist(existing);
    loadList();
  });
  const actionsBar = div("ax-auto-rule-header");
  actionsBar.appendChild(newBtn);
  let close = () => {
  };
  const result = createModal({
    title: "\u26A1 \u81EA\u52A8\u5316\u89C4\u5219",
    content: list,
    actions: createModalActions(() => close(), actionsBar),
    wide: true
  });
  close = result.close;
  loadList();
}
async function showTemplateManager(app, runner, onUpdate) {
  const list = div("ax-wf-tpl-list");
  async function loadList() {
    list.empty();
    const templates = await runner.scanWorkflows();
    if (templates.length === 0) {
      list.appendChild(div("ax-wf-empty", "\u6682\u65E0\u6A21\u677F"));
      return;
    }
    templates.forEach((tpl) => {
      const item = div("ax-wf-tpl-item");
      item.innerHTML = '<span class="ax-wf-tpl-name">' + esc(tpl.name) + '</span><span class="ax-wf-tpl-cat">' + esc(tpl.category) + "</span>";
      const editBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u270F\uFE0F");
      const delBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "\u{1F5D1}");
      editBtn.addEventListener("click", async () => {
        await editTemplate(app, runner, tpl.id, onUpdate);
      });
      delBtn.addEventListener("click", async () => {
        const { showConfirmDialog: showConfirmDialog2 } = await Promise.resolve().then(() => (init_dialog(), dialog_exports));
        const ok2 = await showConfirmDialog2(app, "\u5220\u9664\u6A21\u677F", '\u786E\u5B9A\u5220\u9664\u6A21\u677F "' + tpl.name + '"\uFF1F');
        if (ok2) {
          await runner.deleteTemplate(tpl.id);
          await loadList();
          await onUpdate();
        }
      });
      const actions = div("ax-wf-tpl-actions");
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }
  const newBtn = el("button", { class: "ax-btn ax-btn-primary ax-btn-sm", type: "button" }, "\uFF0B \u65B0\u5EFA\u6A21\u677F");
  newBtn.addEventListener("click", async () => {
    const { showInputDialog: showInputDialog2 } = await Promise.resolve().then(() => (init_dialog(), dialog_exports));
    const id = await showInputDialog2(app, "\u65B0\u5EFA\u6A21\u677F", "\u6A21\u677F ID\uFF08\u5982 my-workflow\uFF09");
    if (!id)
      return;
    const name = await showInputDialog2(app, "\u6A21\u677F\u540D\u79F0", "\u5982 \u6DF1\u5EA6\u7814\u7A76") || id;
    const category = await showInputDialog2(app, "\u5206\u7C7B", "\u5982 Research") || "Custom";
    await runner.createTemplate(id, category, name);
    await loadList();
    await onUpdate();
  });
  let close = () => {
  };
  const result = createModal({
    title: "\u{1F4C4} \u6A21\u677F\u7BA1\u7406",
    content: list,
    actions: createModalActions(() => close()),
    wide: true
  });
  close = result.close;
  await loadList();
}
async function editTemplate(app, runner, id, onUpdate) {
  const vault = app.vault;
  const path = "dashboard/workflows/" + id + ".md";
  const file = vault.getAbstractFileByPath(path);
  if (!file || !(file instanceof import_obsidian9.TFile))
    return;
  const content = await vault.read(file);
  const textarea = el("textarea", {
    class: "ax-wf-editor",
    spellcheck: "false"
  }, content);
  const saveBtn = el("button", { class: "ax-btn ax-btn-primary", type: "button" }, "\u{1F4BE} \u4FDD\u5B58");
  let close = () => {
  };
  const result = createModal({
    title: "\u270F\uFE0F \u7F16\u8F91: " + id,
    content: textarea,
    actions: createModalActions(() => close(), saveBtn),
    wide: true
  });
  close = result.close;
  saveBtn.addEventListener("click", async () => {
    await runner.updateTemplate(id, textarea.value);
    close();
    await onUpdate();
    new import_obsidian9.Notice("\u2705 \u6A21\u677F\u5DF2\u4FDD\u5B58");
  });
  window.setTimeout(() => textarea.focus(), MEMO_FOCUS_DELAY_MS);
}

// src/widgets/activeTaskBar.ts
var MAX_LOG_LINES = 200;
var AUTO_HIDE_DELAY = 3e3;
function createActiveTaskBar(runner, openLink) {
  const bar = div("ax-task-bar");
  bar.style.display = "none";
  const offs = [];
  offs.push(runner.onProgress((taskId, line, progress) => {
    updateBar(bar, runner, openLink);
    appendLog(bar, taskId, line, progress);
  }));
  offs.push(runner.onTick(() => {
    if (bar.style.display !== "none") {
      updateBar(bar, runner, openLink);
    }
  }));
  offs.push(runner.onComplete((taskId, success, _outputPath) => {
    updateBar(bar, runner, openLink);
    if (!success) {
      appendLog(bar, taskId, "[stopped] \u4EFB\u52A1\u5DF2\u7EC8\u6B62", void 0, "ax-task-bar-log-line--warn");
    }
    window.setTimeout(() => {
      const active = runner.getActiveTasks();
      if (active.length === 0) {
        hideBar(bar);
      }
    }, AUTO_HIDE_DELAY);
  }));
  const handle = createRootedDisposable([bar], () => {
    for (const off of offs)
      off();
    bar.empty();
  });
  return { bar, handle };
}
function updateBar(bar, runner, _openLink) {
  const tasks = runner.getActiveTasks();
  if (tasks.length === 0) {
    hideBar(bar);
    return;
  }
  showBar(bar);
  bar.empty();
  const summary = div("ax-task-bar-summary");
  const dot = div("ax-task-bar-dot");
  if (tasks.length === 1) {
    const task = tasks[0];
    const elapsed = elapsedStr(task.startTime);
    const pct = task.progress != null ? ` \xB7 ${task.progress}%` : "";
    summary.innerHTML = '<span class="ax-task-bar-label">Agent Running</span><span class="ax-task-bar-name">' + esc(task.name) + '</span><span class="ax-task-bar-elapsed">' + elapsed + pct + "</span>";
  } else {
    summary.innerHTML = '<span class="ax-task-bar-label">Agent Running</span><span class="ax-task-bar-name">Running: ' + tasks.length + "</span>";
  }
  const queued = runner.getQueuedCount();
  if (queued > 0) {
    const queueInfo = div("ax-task-bar-queue", "Running:" + tasks.length + " \xB7 Queued:" + queued);
    summary.appendChild(queueInfo);
  }
  const rightActions = div("ax-task-bar-actions");
  const detailsBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm ax-task-bar-details-btn", type: "button" }, "Details");
  detailsBtn.addEventListener("click", () => toggleLogPanel(bar));
  const stopBtn = el("button", { class: "ax-btn ax-btn-danger ax-btn-sm ax-task-bar-stop-btn", type: "button" }, "Stop");
  stopBtn.addEventListener("click", () => {
    runner.stopCurrentTask();
    updateBar(bar, runner, _openLink);
  });
  rightActions.appendChild(detailsBtn);
  rightActions.appendChild(stopBtn);
  summary.appendChild(rightActions);
  bar.appendChild(dot);
  bar.appendChild(summary);
  const progress = div("ax-task-bar-progress");
  const firstTask = tasks[0];
  if (firstTask.progress != null && firstTask.progress > 0) {
    progress.innerHTML = '<div class="ax-task-bar-progress-fill" style="width:' + firstTask.progress + '%"></div>';
  } else {
    progress.innerHTML = '<div class="ax-task-bar-progress-fill ax-task-bar-progress-fill--indeterminate"></div>';
  }
  bar.appendChild(progress);
  const logPanel = div("ax-task-bar-log-panel");
  logPanel.style.display = "none";
  bar.appendChild(logPanel);
  tasks.forEach((task) => {
    const taskLog = div("ax-task-bar-task-log");
    taskLog.dataset.taskId = task.id;
    const taskLabel = div("ax-task-bar-task-label", esc(task.name));
    taskLog.appendChild(taskLabel);
    logPanel.appendChild(taskLog);
  });
}
function appendLog(bar, taskId, line, _progress, extraClass) {
  const taskLog = bar.querySelector('.ax-task-bar-task-log[data-task-id="' + taskId + '"]');
  if (!taskLog)
    return;
  const lineEl = document.createElement("div");
  lineEl.className = "ax-task-bar-log-line" + (extraClass ? " " + extraClass : "");
  lineEl.textContent = line;
  taskLog.appendChild(lineEl);
  const panel = bar.querySelector(".ax-task-bar-log-panel");
  if (panel)
    panel.scrollTop = panel.scrollHeight;
  const lines = taskLog.querySelectorAll(".ax-task-bar-log-line");
  if (lines.length > MAX_LOG_LINES) {
    lines[0].remove();
  }
}
function toggleLogPanel(bar) {
  const panel = bar.querySelector(".ax-task-bar-log-panel");
  const btn = bar.querySelector(".ax-task-bar-details-btn");
  if (!panel || !btn)
    return;
  const isHidden = panel.style.display === "none";
  panel.style.display = isHidden ? "block" : "none";
  btn.textContent = isHidden ? "Hide" : "Details";
}
function showBar(bar) {
  if (bar.style.display !== "none")
    return;
  bar.style.display = "flex";
  bar.removeClass("ax-task-bar--hiding");
  bar.addClass("ax-task-bar--visible");
}
function hideBar(bar) {
  if (bar.style.display === "none")
    return;
  bar.addClass("ax-task-bar--hiding");
  bar.removeClass("ax-task-bar--visible");
  window.setTimeout(() => {
    bar.style.display = "none";
    bar.empty();
  }, 300);
}
function elapsedStr(startTime) {
  const sec = Math.floor((Date.now() - startTime) / 1e3);
  if (sec < 60)
    return sec + "s";
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return min + "m" + s + "s";
}

// src/services/VaultScanner.ts
var import_obsidian10 = require("obsidian");
var CACHE_DIR2 = "dashboard/cache";
var HEALTH_FILE = `${CACHE_DIR2}/vault-health.json`;
var CHUNK_SIZE = 50;
var DEBOUNCE_MS = 500;
function generateMockHealthData() {
  const now = /* @__PURE__ */ new Date();
  const notes = 247;
  const tags = 89;
  const links = 1234;
  const brokenLinks = 12;
  const orphanNotes = 18;
  const tagCoverage = 78;
  const folderDistribution = [
    { name: "tech-wiki/concepts", count: 62 },
    { name: "tech-wiki/entities", count: 41 },
    { name: "finance-wiki/concepts", count: 38 },
    { name: "finance-wiki/sources", count: 25 },
    { name: "Axlumen-wiki/synthesis", count: 19 },
    { name: "Daily", count: 45 },
    { name: "Inbox", count: 8 },
    { name: "Other", count: 9 }
  ];
  const dailyActivityMultiDim = {
    notes: generateDailySeries(now, 90, 3, 1.5),
    words: generateDailySeries(now, 90, 3500, 1200),
    tasks: generateDailySeries(now, 90, 5, 3),
    agentRuns: generateDailySeries(now, 90, 2, 1.5)
  };
  const inboxFiles = [
    { path: "Inbox/2026-07-10-meeting-notes.md", basename: "2026-07-10-meeting-notes", mtime: Date.now() - 4 * MS_PER_DAY, daysOld: 4, status: "inbox", title: "\u4F1A\u8BAE\u8BB0\u5F55\uFF1A\u4EA7\u4E1A\u94FE\u6295\u7814\u8BA8\u8BBA" },
    { path: "Inbox/2026-07-12-ai-paper.md", basename: "2026-07-12-ai-paper", mtime: Date.now() - 2 * MS_PER_DAY, daysOld: 2, status: "inbox", title: "AI Agent \u6700\u65B0\u8BBA\u6587\u9605\u8BFB\u7B14\u8BB0" },
    { path: "Inbox/2026-07-08-trading-idea.md", basename: "2026-07-08-trading-idea", mtime: Date.now() - 6 * MS_PER_DAY, daysOld: 6, status: "inbox", title: "\u4EA4\u6613\u7B56\u7565\u521D\u6B65\u60F3\u6CD5" },
    { path: "Inbox/2026-07-13-quick-thought.md", basename: "2026-07-13-quick-thought", mtime: Date.now() - 1 * MS_PER_DAY, daysOld: 1, status: "inbox", title: "\u5173\u4E8E\u77E5\u8BC6\u7BA1\u7406\u7684\u601D\u8003\u7247\u6BB5" },
    { path: "Inbox/2026-07-05-book-notes.md", basename: "2026-07-05-book-notes", mtime: Date.now() - 9 * MS_PER_DAY, daysOld: 9, status: "inbox", title: "\u300A\u53CD\u8106\u5F31\u300B\u8BFB\u4E66\u7B14\u8BB0" }
  ];
  return {
    totalNotes: notes,
    totalTags: tags,
    totalLinks: links,
    brokenLinks,
    orphanNotes,
    tagCoverage,
    folderDistribution,
    dailyActivityMultiDim,
    inboxFiles,
    lastScanned: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    healthScore: 82,
    weeklyDelta: 4
  };
}
function generateDailySeries(now, days, mean, stddev) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.3 : 1;
    const noise = (Math.random() - 0.5) * 2 * stddev;
    const count = Math.max(0, Math.round((mean + noise) * weekendFactor));
    result.push({ date: key, count });
  }
  return result;
}
var VaultScanner = class {
  constructor(app) {
    this._disposed = false;
    this.scanning = false;
    // 内存缓存
    this.cache = null;
    this.cacheValid = true;
    // Dirty 追踪
    this.dirtyFiles = /* @__PURE__ */ new Set();
    this.hasModifyEvent = false;
    // Vault 事件监听
    this.eventRefs = [];
    this.app = app;
    this.markDirtyDebounced = debounce(() => {
      this.cacheValid = false;
    }, DEBOUNCE_MS);
    this.registerVaultEvents();
  }
  get disposed() {
    return this._disposed;
  }
  get isScanning() {
    return this.scanning;
  }
  /** 是否有有效的内存缓存 */
  get hasCache() {
    return this.cache !== null && this.cacheValid;
  }
  // ==================== 事件监听 ====================
  registerVaultEvents() {
    const vault = this.app.vault;
    const onCreate = vault.on("create", (file) => {
      if (file instanceof import_obsidian10.TFile && file.extension === "md") {
        this.dirtyFiles.add(file.path);
        this.cacheValid = false;
        invalidateRecentFilesCache();
      }
    });
    const onModify = vault.on("modify", (file) => {
      if (file instanceof import_obsidian10.TFile && file.extension === "md") {
        this.dirtyFiles.add(file.path);
        this.hasModifyEvent = true;
        this.markDirtyDebounced();
        invalidateRecentFilesCache();
      }
    });
    const onDelete = vault.on("delete", (file) => {
      if (file instanceof import_obsidian10.TFile && file.extension === "md") {
        this.dirtyFiles.add(file.path);
        this.cacheValid = false;
        invalidateRecentFilesCache();
      }
    });
    this.eventRefs.push(onCreate, onModify, onDelete);
  }
  unregisterVaultEvents() {
    for (const ref of this.eventRefs) {
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];
  }
  // ==================== 扫描方法 ====================
  /**
   * 增量扫描：只处理 dirty 文件
   * 如果没有 dirty 文件，直接返回缓存
   */
  async scanIncremental() {
    if (this._disposed) {
      return err("SCANNER_DISPOSED", "VaultScanner \u5DF2\u88AB\u91CA\u653E", false);
    }
    try {
      if (this.cache && this.cacheValid && this.dirtyFiles.size === 0) {
        return ok(this.cache);
      }
      if (this.dirtyFiles.size > 0 && this.cache) {
        return this.incrementalUpdate();
      }
      return this.scanFull();
    } catch (e) {
      console.error("[VAULT_SCAN_FAILED] scanIncremental:", e);
      return err("VAULT_SCAN_FAILED", e.message || "\u589E\u91CF\u626B\u63CF\u5931\u8D25", true, e);
    }
  }
  /**
   * 全量扫描：分片执行，每片 CHUNK_SIZE 个文件
   * 使用 setTimeout(0) 让出主线程，避免阻塞 UI
   *
   * @param onProgress 进度回调，报告百分比 (0-100)
   */
  async scanFull(onProgress) {
    if (this._disposed) {
      return err("SCANNER_DISPOSED", "VaultScanner \u5DF2\u88AB\u91CA\u653E", false);
    }
    if (this.scanning) {
      if (this.cache)
        return ok(this.cache);
      return err("SCAN_IN_PROGRESS", "\u626B\u63CF\u6B63\u5728\u8FDB\u884C\u4E2D", true);
    }
    this.scanning = true;
    this.dirtyFiles.clear();
    this.hasModifyEvent = false;
    try {
      onProgress == null ? void 0 : onProgress(0, "\u6536\u96C6\u6587\u4EF6\u5217\u8868...");
      const allFiles = this.app.vault.getMarkdownFiles();
      const totalFiles = allFiles.length;
      if (totalFiles === 0) {
        const mock = generateMockHealthData();
        this.cache = mock;
        this.cacheValid = true;
        await this.writeCache(mock);
        onProgress == null ? void 0 : onProgress(100, "\u5B8C\u6210");
        return ok(mock);
      }
      onProgress == null ? void 0 : onProgress(5, `\u626B\u63CF ${totalFiles} \u4E2A\u6587\u4EF6...`);
      const chunks = [];
      for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
        chunks.push(allFiles.slice(i, i + CHUNK_SIZE));
      }
      const stats = {
        totalNotes: 0,
        totalTags: /* @__PURE__ */ new Set(),
        totalLinks: 0,
        brokenLinks: 0,
        orphanNotes: 0,
        inboxFiles: [],
        folderCounts: /* @__PURE__ */ new Map(),
        dailyActivity: /* @__PURE__ */ new Map()
      };
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        for (const file of chunk) {
          this.processFile(file, stats);
        }
        const pct = Math.round(5 + chunkIdx / chunks.length * 90);
        onProgress == null ? void 0 : onProgress(pct, `\u5904\u7406 ${Math.min((chunkIdx + 1) * CHUNK_SIZE, totalFiles)}/${totalFiles}...`);
        if (chunkIdx < chunks.length - 1) {
          await this.yieldToMain();
        }
      }
      onProgress == null ? void 0 : onProgress(95, "\u751F\u6210\u62A5\u544A...");
      const folderDistribution = Array.from(stats.folderCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20);
      const dailyActivityMultiDim = {
        notes: this.mapToDayActivity(stats.dailyActivity),
        words: generateDailySeries(/* @__PURE__ */ new Date(), 90, 3500, 1200),
        tasks: generateDailySeries(/* @__PURE__ */ new Date(), 90, 5, 3),
        agentRuns: generateDailySeries(/* @__PURE__ */ new Date(), 90, 2, 1.5)
      };
      const now = /* @__PURE__ */ new Date();
      const data = {
        totalNotes: stats.totalNotes,
        totalTags: stats.totalTags.size,
        totalLinks: stats.totalLinks,
        brokenLinks: stats.brokenLinks,
        orphanNotes: stats.orphanNotes,
        tagCoverage: stats.totalNotes > 0 ? Math.round(stats.totalTags.size / stats.totalNotes * 100) : 0,
        folderDistribution,
        dailyActivityMultiDim,
        inboxFiles: stats.inboxFiles,
        lastScanned: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        healthScore: this.calculateHealthScore(stats),
        weeklyDelta: Math.floor(Math.random() * 10) - 3
      };
      this.cache = data;
      this.cacheValid = true;
      await this.writeCache(data);
      onProgress == null ? void 0 : onProgress(100, "\u5B8C\u6210");
      this.dispatchScanFinishEvent();
      return ok(data);
    } catch (e) {
      console.error("[VAULT_SCAN_FAILED] scanFull:", e);
      return err("VAULT_SCAN_FAILED", e.message || "\u5168\u91CF\u626B\u63CF\u5931\u8D25", true, e);
    } finally {
      this.scanning = false;
    }
  }
  /**
   * 强制重新扫描（Rescan 按钮调用）
   */
  async forceScan(onProgress) {
    this.cacheValid = false;
    this.dirtyFiles.clear();
    return this.scanFull(onProgress);
  }
  // ==================== 增量更新 ====================
  async incrementalUpdate() {
    if (!this.cache) {
      return this.scanFull();
    }
    this.scanning = true;
    try {
      const dirtyPaths = Array.from(this.dirtyFiles);
      this.dirtyFiles.clear();
      for (const path of dirtyPaths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian10.TFile) {
          this.cacheValid = false;
          break;
        }
        this.cacheValid = false;
        break;
      }
      if (!this.cacheValid) {
        return this.scanFull();
      }
      return ok(this.cache);
    } catch (e) {
      console.error("[VAULT_SCAN_FAILED] incrementalUpdate:", e);
      return err("VAULT_SCAN_FAILED", e.message || "\u589E\u91CF\u66F4\u65B0\u5931\u8D25", true, e);
    } finally {
      this.scanning = false;
    }
  }
  // ==================== 文件处理 ====================
  processFile(file, stats) {
    stats.totalNotes++;
    const parts = file.path.split("/");
    if (parts.length > 1) {
      const folder = parts.slice(0, -1).join("/");
      stats.folderCounts.set(folder, (stats.folderCounts.get(folder) || 0) + 1);
    }
    const mtime = new Date(file.stat.mtime);
    const dayKey = mtime.toISOString().slice(0, 10);
    stats.dailyActivity.set(dayKey, (stats.dailyActivity.get(dayKey) || 0) + 1);
    if (file.path.startsWith("Inbox/") || file.path.startsWith("inbox/")) {
      const content = this.app.vault.cachedRead(file);
      const status = this.extractStatus(file);
      const title = file.basename;
      const daysOld = Math.floor((Date.now() - file.stat.mtime) / MS_PER_DAY);
      stats.inboxFiles.push({
        path: file.path,
        basename: file.basename,
        mtime: file.stat.mtime,
        daysOld,
        status,
        title
      });
    }
  }
  extractStatus(file) {
    const cache = this.app.metadataCache.getFileCache(file);
    if (cache == null ? void 0 : cache.frontmatter) {
      return cache.frontmatter.status || "inbox";
    }
    return "inbox";
  }
  mapToDayActivity(dailyMap) {
    return Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  }
  calculateHealthScore(stats) {
    let score = 50;
    score += Math.min(20, Math.floor(stats.totalNotes / 10));
    if (stats.totalNotes > 0) {
      const tagRatio = stats.totalTags.size / stats.totalNotes;
      score += Math.round(tagRatio * 15);
    }
    if (stats.totalLinks > 0) {
      const brokenRatio = stats.brokenLinks / stats.totalLinks;
      score -= Math.round(brokenRatio * 20);
    }
    score -= Math.min(10, Math.floor(stats.orphanNotes / 5));
    return Math.max(0, Math.min(100, score));
  }
  // ==================== 主线程让出 ====================
  yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  // ==================== 缓存读写 ====================
  async readCache() {
    try {
      const file = this.app.vault.getAbstractFileByPath(HEALTH_FILE);
      if (file instanceof import_obsidian10.TFile) {
        const raw = await this.app.vault.read(file);
        return JSON.parse(raw);
      }
    } catch (e) {
    }
    return null;
  }
  async writeCache(data) {
    try {
      const content = JSON.stringify(data, null, 2);
      const file = this.app.vault.getAbstractFileByPath(HEALTH_FILE);
      if (file instanceof import_obsidian10.TFile) {
        await this.app.vault.modify(file, content);
      } else {
        const dir = this.app.vault.getAbstractFileByPath(CACHE_DIR2);
        if (!dir) {
          await this.app.vault.createFolder(CACHE_DIR2);
        }
        await this.app.vault.create(HEALTH_FILE, content);
      }
    } catch (e) {
    }
  }
  dispatchScanFinishEvent() {
    document.dispatchEvent(new CustomEvent("vault-scan-finish"));
  }
  // ==================== 焦点数据筛选 ====================
  /** 根据焦点目录/标签筛选健康数据（返回深拷贝，UI 可安全使用） */
  getFocusRelatedData(allData, focusPath, focusTag) {
    if (!focusPath && !focusTag)
      return allData;
    const data = { ...allData };
    if (focusPath) {
      data.inboxFiles = allData.inboxFiles.filter(
        (f) => f.path.startsWith(focusPath) || f.path.includes(focusPath)
      );
    }
    if (focusTag) {
      data.inboxFiles = data.inboxFiles.filter(
        (f) => f.path.includes(focusTag) || f.title.includes(focusTag)
      );
    }
    if (focusPath) {
      data.folderDistribution = allData.folderDistribution.filter(
        (d) => d.name.includes(focusPath)
      );
    }
    return data;
  }
  // ==================== Disposable ====================
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    this.unregisterVaultEvents();
    this.cache = null;
    this.dirtyFiles.clear();
  }
};

// src/widgets/vaultHealth.ts
function createVaultHealthPanel(app, createSection) {
  const section = createSection("Vault Health Overview", "#3fb8af", "");
  section.style.setProperty("--ax-accent", "#3fb8af");
  section.addClass("ax-vh-section");
  const cleaners = [];
  const timeouts = /* @__PURE__ */ new Set();
  const safeTimeout = (fn, ms) => {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      fn();
    }, ms);
    timeouts.add(id);
    return id;
  };
  const registerCleanup = (fn) => {
    cleaners.push(fn);
  };
  const content = div("ax-vh-content");
  section.appendChild(content);
  const scanner = new VaultScanner(app);
  loadAndRender(content, scanner, registerCleanup, safeTimeout);
  const handle = createRootedDisposable([section], () => {
    for (const id of timeouts)
      window.clearTimeout(id);
    timeouts.clear();
    for (const fn of cleaners) {
      try {
        fn();
      } catch (e) {
      }
    }
    section.empty();
  });
  return { section, handle };
}
async function loadAndRender(content, scanner, registerCleanup, safeTimeout) {
  content.empty();
  const progressContainer = div("ax-vh-scan-progress");
  const progressBar = div("ax-vh-scan-progress-bar");
  const progressText = div("ax-vh-scan-progress-text", "\u626B\u63CF Vault \u6570\u636E...");
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);
  content.appendChild(progressContainer);
  const result = await scanner.scanFull((pct, message) => {
    progressBar.style.width = pct + "%";
    if (message)
      progressText.textContent = message;
  });
  content.empty();
  if (result.ok) {
    content.appendChild(renderPanel(content, result.value, scanner, registerCleanup, safeTimeout));
  } else {
    console.error("[VAULT_HEALTH_WIDGET] scanFull failed:", result.error.code);
    content.appendChild(div("ax-vh-error", "\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF0C\u70B9\u51FB\u91CD\u8BD5"));
    const retryBtn = el("button", { class: "ax-btn ax-btn-ghost", type: "button" }, "\u91CD\u8BD5");
    const onRetry = () => loadAndRender(content, scanner, registerCleanup, safeTimeout);
    retryBtn.addEventListener("click", onRetry);
    registerCleanup(() => retryBtn.removeEventListener("click", onRetry));
    content.appendChild(retryBtn);
  }
}
function renderPanel(content, data, scanner, registerCleanup, safeTimeout) {
  const panel = div("ax-vh-panel");
  const header = div("ax-vh-header");
  const title = div("ax-vh-title", "VAULT HEALTH OVERVIEW");
  const right = div("ax-vh-header-right");
  const lastScanned = div("ax-vh-last-scanned", "Last scanned: " + (data.lastScanned || "--:--"));
  let scanning = false;
  const rescanBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm ax-vh-rescan-btn", type: "button" }, "Rescan");
  const onRescanClick = async () => {
    if (scanning)
      return;
    scanning = true;
    rescanBtn.disabled = true;
    rescanBtn.addClass("is-loading");
    rescanBtn.textContent = "Scanning...";
    const progressBar = div("ax-vh-scan-progress");
    const progressFill = div("ax-vh-scan-progress-fill");
    progressBar.appendChild(progressFill);
    header.appendChild(progressBar);
    try {
      const forceResult = await scanner.forceScan((pct) => {
        progressFill.style.width = pct + "%";
      });
      if (forceResult.ok) {
        const newPanel = renderPanel(content, forceResult.value, scanner, registerCleanup, safeTimeout);
        content.empty();
        content.appendChild(newPanel);
      }
    } finally {
      progressBar.remove();
      scanning = false;
      rescanBtn.disabled = false;
      rescanBtn.removeClass("is-loading");
      rescanBtn.textContent = "Rescan";
    }
  };
  rescanBtn.addEventListener("click", onRescanClick);
  registerCleanup(() => rescanBtn.removeEventListener("click", onRescanClick));
  right.appendChild(lastScanned);
  right.appendChild(rescanBtn);
  header.appendChild(title);
  header.appendChild(right);
  panel.appendChild(header);
  const body = div("ax-vh-body");
  body.appendChild(renderLeftRing(data));
  body.appendChild(renderRightMetrics(data));
  panel.appendChild(body);
  panel.appendChild(renderGlobalStats(data));
  return panel;
}
function renderLeftRing(data) {
  const left = div("ax-vh-left");
  const score = data.healthScore;
  const deg = Math.round(score / 100 * 360);
  const ring = div("ax-vh-ring");
  ring.style.background = `conic-gradient(var(--ax-accent, #3fb8af) ${deg}deg, var(--ax-line, #1e293b) ${deg}deg)`;
  const inner = div("ax-vh-ring-inner");
  const scoreNum = div("ax-vh-ring-score", String(score));
  const scoreLabel = div("ax-vh-ring-label", "HEALTH");
  inner.appendChild(scoreNum);
  inner.appendChild(scoreLabel);
  ring.appendChild(inner);
  left.appendChild(ring);
  const delta = data.weeklyDelta;
  const trend = div("ax-vh-trend " + (delta >= 0 ? "ax-vh-trend--up" : "ax-vh-trend--down"));
  trend.textContent = (delta >= 0 ? "+" : "") + delta + " this week";
  left.appendChild(trend);
  return left;
}
function renderRightMetrics(data) {
  const right = div("ax-vh-metrics");
  right.appendChild(createMetricCard({
    title: "Link Health",
    value: data.brokenLinks,
    total: data.totalLinks,
    unit: "broken",
    visual: "bar",
    visualValue: data.totalLinks > 0 ? Math.round((1 - data.brokenLinks / data.totalLinks) * 100) : 100,
    risk: data.brokenLinks > 10 ? `${data.brokenLinks} \u65AD\u94FE\u9700\u4FEE\u590D` : "\u6B63\u5E38",
    riskLevel: data.brokenLinks > 10 ? "high" : data.brokenLinks > 5 ? "medium" : "low"
  }));
  right.appendChild(createMetricCard({
    title: "Tag Coverage",
    value: data.tagCoverage,
    total: 100,
    unit: "%",
    visual: "bar",
    visualValue: data.tagCoverage,
    risk: data.tagCoverage < 60 ? "\u8986\u76D6\u7387\u504F\u4F4E" : "\u826F\u597D",
    riskLevel: data.tagCoverage < 60 ? "medium" : "low"
  }));
  right.appendChild(createMetricCard({
    title: "Orphan Notes",
    value: data.orphanNotes,
    total: data.totalNotes,
    unit: "notes",
    visual: "bar",
    visualValue: data.totalNotes > 0 ? Math.round((1 - data.orphanNotes / data.totalNotes) * 100) : 100,
    risk: data.orphanNotes > 15 ? "\u5B64\u7ACB\u7B14\u8BB0\u8FC7\u591A" : "\u6B63\u5E38",
    riskLevel: data.orphanNotes > 15 ? "high" : data.orphanNotes > 8 ? "medium" : "low"
  }));
  right.appendChild(createMetricCard({
    title: "Frontmatter",
    value: 72,
    total: 100,
    unit: "%",
    visual: "bar",
    visualValue: 72,
    risk: "\u90E8\u5206\u7B14\u8BB0\u7F3A\u5C11\u5143\u6570\u636E",
    riskLevel: "medium"
  }));
  right.appendChild(createMetricCard({
    title: "Folder Balance",
    value: data.folderDistribution.length,
    total: 0,
    unit: "dirs",
    visual: "bars",
    visualValue: 0,
    risk: "\u5206\u5E03\u8F83\u5747\u5300",
    riskLevel: "low",
    extraData: data.folderDistribution
  }));
  right.appendChild(createMetricCard({
    title: "Weekly Activity",
    value: 12,
    total: 0,
    unit: "notes",
    visual: "delta",
    visualValue: 12,
    risk: "+3 vs \u4E0A\u5468",
    riskLevel: "low",
    delta: 3
  }));
  return right;
}
function createMetricCard(cfg) {
  const card = div("ax-vh-metric ax-vh-metric--" + cfg.riskLevel);
  const title = div("ax-vh-metric-title", cfg.title);
  card.appendChild(title);
  const valueRow = div("ax-vh-metric-value-row");
  const valueEl = div("ax-vh-metric-value", String(cfg.value));
  const unitEl = div("ax-vh-metric-unit", cfg.unit);
  valueRow.appendChild(valueEl);
  valueRow.appendChild(unitEl);
  card.appendChild(valueRow);
  if (cfg.visual === "bar") {
    const bar = div("ax-vh-metric-bar");
    const fill = div("ax-vh-metric-bar-fill");
    fill.style.width = cfg.visualValue + "%";
    if (cfg.riskLevel === "high")
      fill.addClass("ax-vh-metric-bar-fill--danger");
    else if (cfg.riskLevel === "medium")
      fill.addClass("ax-vh-metric-bar-fill--warn");
    bar.appendChild(fill);
    card.appendChild(bar);
  } else if (cfg.visual === "bars" && cfg.extraData) {
    const bars = div("ax-vh-metric-bars");
    const maxVal = Math.max(1, ...cfg.extraData.map((d) => d.count));
    cfg.extraData.slice(0, 6).forEach((d) => {
      const row = div("ax-vh-metric-bars-row");
      const label = div("ax-vh-metric-bars-label", d.name.split("/").pop() || d.name);
      const track = div("ax-vh-metric-bars-track");
      const fill = div("ax-vh-metric-bars-fill");
      fill.style.width = Math.round(d.count / maxVal * 100) + "%";
      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      bars.appendChild(row);
    });
    card.appendChild(bars);
  } else if (cfg.visual === "delta") {
    const deltaEl = div("ax-vh-metric-delta " + ((cfg.delta || 0) >= 0 ? "ax-vh-metric-delta--up" : "ax-vh-metric-delta--down"));
    deltaEl.textContent = ((cfg.delta || 0) >= 0 ? "\u25B2 +" : "\u25BC ") + Math.abs(cfg.delta || 0);
    card.appendChild(deltaEl);
  }
  const risk = div("ax-vh-metric-risk", cfg.risk);
  card.appendChild(risk);
  return card;
}
function renderGlobalStats(data) {
  const stats = div("ax-vh-global-stats");
  stats.innerHTML = '<span class="ax-vh-stat"><b>' + data.totalNotes + '</b> \u603B\u7B14\u8BB0</span><span class="ax-vh-stat-sep">\xB7</span><span class="ax-vh-stat"><b>' + data.totalTags + '</b> \u6807\u7B7E</span><span class="ax-vh-stat-sep">\xB7</span><span class="ax-vh-stat"><b>' + data.totalLinks + '</b> \u5185\u94FE</span><span class="ax-vh-stat-sep">\xB7</span><span class="ax-vh-stat"><b>' + data.dailyActivityMultiDim.notes.filter((d) => d.count > 0).length + "</b> \u6D3B\u8DC3\u5929</span>";
  return stats;
}

// src/widgets/inboxRouter.ts
function createInboxRouterPanel(app, createSection, openPath, items, callbacks) {
  const section = createSection("Inbox Intelligent Router", "#8B5CF6", "");
  section.style.setProperty("--ax-accent", "#8B5CF6");
  section.addClass("ax-ir-section");
  const cleaners = [];
  const timeouts = /* @__PURE__ */ new Set();
  const safeTimeout = (fn, ms) => {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      fn();
    }, ms);
    timeouts.add(id);
    return id;
  };
  const registerCleanup = (fn) => {
    cleaners.push(fn);
  };
  const toolbar = div("ax-ir-toolbar");
  const countBadge = div("ax-ir-count", String(items.length) + " unprocessed items");
  toolbar.appendChild(countBadge);
  if (items.length > 0) {
    const routeAllBtn = el("button", { class: "ax-btn ax-btn-primary ax-btn-sm", type: "button" }, "\u{1F4E5} Route All Batch");
    const onRouteAllClick = () => {
      routeAllBtn.disabled = true;
      routeAllBtn.textContent = "\u8DEF\u7531\u4E2D...";
      if (callbacks == null ? void 0 : callbacks.onRouteAll) {
        callbacks.onRouteAll(items);
      }
      safeTimeout(() => {
        routeAllBtn.disabled = false;
        routeAllBtn.textContent = "\u{1F4E5} Route All Batch";
      }, 2e3);
    };
    routeAllBtn.addEventListener("click", onRouteAllClick);
    registerCleanup(() => routeAllBtn.removeEventListener("click", onRouteAllClick));
    toolbar.appendChild(routeAllBtn);
  }
  section.appendChild(toolbar);
  const list = div("ax-ir-list");
  if (items.length === 0) {
    const empty = div("ax-ir-empty", "Inbox is clear, no pending files \u2728");
    list.appendChild(empty);
  } else {
    items.forEach((item) => {
      const row = div("ax-ir-item");
      const left = div("ax-ir-left");
      const title = el("a", { href: "#", class: "ax-ir-title", "data-path": item.path }, item.title);
      const onTitleClick = (e) => {
        e.preventDefault();
        openPath(item.path);
      };
      title.addEventListener("click", onTitleClick);
      registerCleanup(() => title.removeEventListener("click", onTitleClick));
      left.appendChild(title);
      const aging = div("ax-ir-aging " + getAgingClass(item.daysOld));
      aging.textContent = item.daysOld + "d";
      left.appendChild(aging);
      row.appendChild(left);
      const right = div("ax-ir-right");
      const routeBtn = el("button", { class: "ax-btn ax-btn-ghost ax-btn-sm", type: "button" }, "Auto-Route");
      const onRouteClick = () => {
        routeBtn.disabled = true;
        routeBtn.textContent = "\u23F3 Routing...";
        if (callbacks == null ? void 0 : callbacks.onRouteSingle) {
          callbacks.onRouteSingle(item);
        }
        safeTimeout(() => {
          routeBtn.textContent = "\u2705 Done";
        }, 1500);
      };
      routeBtn.addEventListener("click", onRouteClick);
      registerCleanup(() => routeBtn.removeEventListener("click", onRouteClick));
      right.appendChild(routeBtn);
      row.appendChild(right);
      const onRowClick = (e) => {
        if (e.target === routeBtn)
          return;
        openPath(item.path);
      };
      row.addEventListener("click", onRowClick);
      registerCleanup(() => row.removeEventListener("click", onRowClick));
      list.appendChild(row);
    });
  }
  section.appendChild(list);
  const handle = createRootedDisposable([section], () => {
    for (const id of timeouts)
      window.clearTimeout(id);
    timeouts.clear();
    for (const fn of cleaners) {
      try {
        fn();
      } catch (e) {
      }
    }
    section.empty();
  });
  return { section, handle };
}
function getAgingClass(days) {
  if (days >= 7)
    return "ax-ir-aging--danger";
  if (days >= 3)
    return "ax-ir-aging--warn";
  return "ax-ir-aging--ok";
}

// src/utils/CompositeDisposable.ts
var CompositeDisposable = class {
  constructor() {
    this._disposables = [];
    this._disposed = false;
  }
  get disposed() {
    return this._disposed;
  }
  /** 批量注册 disposable。已 disposed 时调用为空操作。 */
  add(...disposables) {
    if (this._disposed)
      return;
    for (const d of disposables) {
      if (!d)
        continue;
      if (!isDisposable(d)) {
        console.warn("[CompositeDisposable] \u8DF3\u8FC7\u975E Disposable \u53C2\u6570:", d);
        continue;
      }
      if (this._disposables.includes(d))
        continue;
      this._disposables.push(d);
    }
  }
  /** LIFO 顺序清理。已 disposed 实例跳过幂等。（幂等：多次调用仅第一次生效） */
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    const snapshot = this._disposables;
    this._disposables = [];
    for (let i = snapshot.length - 1; i >= 0; i--) {
      const d = snapshot[i];
      if (!d || d.disposed)
        continue;
      try {
        d.dispose();
      } catch (e) {
        console.warn("[CompositeDisposable] dispose \u56DE\u8C03\u5F02\u5E38:", e);
      }
    }
  }
};

// src/services/triggers/ScheduleTrigger.ts
var SCHEDULE_TRIGGER_TYPE = "schedule";
var ScheduleTrigger = class _ScheduleTrigger {
  constructor(params) {
    this.type = SCHEDULE_TRIGGER_TYPE;
    this._disposed = false;
    this._timer = null;
    this._intervalTimer = null;
    this._action = null;
    this._params = params;
  }
  get disposed() {
    return this._disposed;
  }
  start(action) {
    if (this._disposed)
      return;
    this.stop();
    this._action = action;
    if (this._params.mode === "every" && this._params.intervalMs) {
      this._startInterval(this._params.intervalMs);
    } else if (this._params.mode === "at" && this._params.hour != null && this._params.minute != null) {
      this._startDaily(this._params.hour, this._params.minute);
    }
  }
  stop() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._intervalTimer) {
      clearInterval(this._intervalTimer);
      this._intervalTimer = null;
    }
    this._action = null;
  }
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    this.stop();
  }
  serialize() {
    return {
      type: SCHEDULE_TRIGGER_TYPE,
      params: { ...this._params }
    };
  }
  // ---------- 内部实现 ----------
  _startInterval(ms) {
    this._intervalTimer = setInterval(() => {
      var _a;
      (_a = this._action) == null ? void 0 : _a.call(this);
    }, ms);
  }
  _startDaily(hour, minute) {
    const scheduleNext = () => {
      if (this._disposed || !this._action)
        return;
      const now = /* @__PURE__ */ new Date();
      const target = /* @__PURE__ */ new Date();
      target.setHours(hour, minute, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      const delay = target.getTime() - now.getTime();
      this._timer = setTimeout(() => {
        var _a;
        (_a = this._action) == null ? void 0 : _a.call(this);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }
  // ---------- 工厂方法 ----------
  /** 创建固定间隔触发器 */
  static every(intervalMs) {
    return new _ScheduleTrigger({ mode: "every", intervalMs });
  }
  /** 创建每天定时触发器 */
  static at(hour, minute) {
    return new _ScheduleTrigger({ mode: "at", hour, minute });
  }
  /** 从 TriggerConfig 反序列化 */
  static fromConfig(config) {
    const params = config.params;
    return new _ScheduleTrigger(params);
  }
};

// src/services/triggers/InboxThresholdTrigger.ts
var INBOX_THRESHOLD_TRIGGER_TYPE = "inbox_threshold";
var InboxThresholdTrigger = class _InboxThresholdTrigger {
  constructor(app, params) {
    this.type = INBOX_THRESHOLD_TRIGGER_TYPE;
    this._disposed = false;
    this._timer = null;
    this._action = null;
    /** 防重复触发：上次触发时间 */
    this._lastTriggeredAt = 0;
    /** 防重复冷却期：5 分钟 */
    this._cooldownMs = 3e5;
    this._app = app;
    this._params = params;
  }
  get disposed() {
    return this._disposed;
  }
  start(action) {
    if (this._disposed)
      return;
    this.stop();
    this._action = action;
    const pollMs = this._params.pollIntervalMs || 6e4;
    this._checkAndTrigger();
    this._timer = setInterval(() => {
      this._checkAndTrigger();
    }, pollMs);
  }
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._action = null;
  }
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    this.stop();
  }
  serialize() {
    return {
      type: INBOX_THRESHOLD_TRIGGER_TYPE,
      params: { ...this._params }
    };
  }
  // ---------- 内部实现 ----------
  _checkAndTrigger() {
    var _a, _b;
    if (!this._action)
      return;
    const inboxPath = this._params.inboxPath || "Inbox";
    const folder = this._app.vault.getAbstractFileByPath(inboxPath);
    if (!folder || !("children" in folder))
      return;
    const count = (_b = (_a = folder.children) == null ? void 0 : _a.length) != null ? _b : 0;
    if (count >= this._params.threshold) {
      const now = Date.now();
      if (now - this._lastTriggeredAt < this._cooldownMs)
        return;
      this._lastTriggeredAt = now;
      this._action();
    }
  }
  // ---------- 工厂方法 ----------
  /** 从 TriggerConfig 反序列化 */
  static fromConfig(app, config) {
    const params = config.params;
    return new _InboxThresholdTrigger(app, params);
  }
};

// src/services/triggers/OnStartupTrigger.ts
var ON_STARTUP_TRIGGER_TYPE = "on_startup";
var OnStartupTrigger = class _OnStartupTrigger {
  constructor() {
    this.type = ON_STARTUP_TRIGGER_TYPE;
    this._disposed = false;
    this._action = null;
    /** 幂等标记：是否已执行过 */
    this._executed = false;
  }
  get disposed() {
    return this._disposed;
  }
  start(action) {
    if (this._disposed)
      return;
    this._action = action;
    if (!this._executed) {
      this._executed = true;
      this._action();
    }
  }
  stop() {
    this._action = null;
  }
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    this.stop();
  }
  serialize() {
    return {
      type: ON_STARTUP_TRIGGER_TYPE,
      params: {}
    };
  }
  // ---------- 工厂方法 ----------
  /** 从 TriggerConfig 反序列化 */
  static fromConfig(_config) {
    return new _OnStartupTrigger();
  }
};

// src/services/triggers/EventTrigger.ts
var EVENT_TRIGGER_TYPE = "event";
var EventTrigger = class _EventTrigger {
  constructor(app, params = {}) {
    this.type = EVENT_TRIGGER_TYPE;
    this._disposed = false;
    this._action = null;
    this._debounceTimer = null;
    this._registeredRefs = [];
    this._app = app;
    this._params = params;
  }
  get disposed() {
    return this._disposed;
  }
  start(action) {
    if (this._disposed)
      return;
    this.stop();
    this._action = action;
    const eventTypes = this._params.eventTypes && this._params.eventTypes.length > 0 ? this._params.eventTypes : ["modify", "create", "delete"];
    const vault = this._app.vault;
    for (const eventType of eventTypes) {
      if (eventType === "all") {
        for (const t of ["modify", "create", "delete"]) {
          this._registerEvent(vault, t);
        }
      } else {
        this._registerEvent(vault, eventType);
      }
    }
  }
  stop() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    for (const { type, handler } of this._registeredRefs) {
      try {
        this._app.vault.off(type, handler);
      } catch (e) {
      }
    }
    this._registeredRefs = [];
    this._action = null;
  }
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    this.stop();
  }
  serialize() {
    return {
      type: EVENT_TRIGGER_TYPE,
      params: { ...this._params }
    };
  }
  // ---------- 内部实现 ----------
  _registerEvent(vault, eventType) {
    const handler = () => {
      this._debouncedTrigger();
    };
    const ref = vault.on(eventType, handler);
    this._registeredRefs.push({ ref, type: eventType, handler });
  }
  _debouncedTrigger() {
    var _a;
    if (!this._action)
      return;
    const debounceMs = (_a = this._params.debounceMs) != null ? _a : 500;
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      var _a2;
      this._debounceTimer = null;
      (_a2 = this._action) == null ? void 0 : _a2.call(this);
    }, debounceMs);
  }
  // ---------- 工厂方法 ----------
  /** 从 TriggerConfig 反序列化 */
  static fromConfig(app, config) {
    const params = config.params;
    return new _EventTrigger(app, params);
  }
};

// src/services/triggers/index.ts
function createTriggerFromConfig(app, config) {
  switch (config.type) {
    case SCHEDULE_TRIGGER_TYPE:
      return ScheduleTrigger.fromConfig(config);
    case INBOX_THRESHOLD_TRIGGER_TYPE:
      return InboxThresholdTrigger.fromConfig(app, config);
    case ON_STARTUP_TRIGGER_TYPE:
      return OnStartupTrigger.fromConfig(config);
    case EVENT_TRIGGER_TYPE:
      return EventTrigger.fromConfig(app, config);
    default:
      throw new Error(`[TriggerFactory] Unknown trigger type: ${config.type}`);
  }
}

// src/services/AutomationEngine.ts
var AutomationEngine = class {
  /**
   * @param app Obsidian App 实例
   * @param runner AgentRunner 实例
   * @param saveCallback 持久化回调 — 由 plugin 传入 `() => this.saveSettings()`
   */
  constructor(app, runner, saveCallback) {
    this.rules = [];
    this.triggers = /* @__PURE__ */ new Map();
    this.composite = new CompositeDisposable();
    this.actionExecutor = null;
    this.app = app;
    this.runner = runner;
    this.saveCallback = saveCallback;
  }
  // ==================== 规则 CRUD ====================
  /** 加载规则（从持久化数据反序列化） */
  loadRules(rules) {
    if (!rules) {
      this.rules = [];
      return [];
    }
    this.rules = rules.map((r) => this._normalizeRule(r));
    return this.rules;
  }
  /** 获取所有规则 */
  getRules() {
    return [...this.rules];
  }
  /** 获取旧版格式规则（兼容 workflows.ts UI） */
  getLegacyRules() {
    return this.rules.map((r) => this._toLegacyRule(r));
  }
  /** 添加规则，返回 ruleId */
  addRule(config) {
    const id = "rule-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    const rule = {
      ...config,
      id,
      createdAt: Date.now()
    };
    this.rules.push(rule);
    this._save();
    if (rule.enabled) {
      this._startTrigger(rule);
    }
    return id;
  }
  /** 移除规则 */
  removeRule(ruleId) {
    this._stopTrigger(ruleId);
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    this._save();
  }
  /** 启用规则 */
  enableRule(ruleId) {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule || rule.enabled)
      return;
    rule.enabled = true;
    this._save();
    this._startTrigger(rule);
  }
  /** 禁用规则 */
  disableRule(ruleId) {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule || !rule.enabled)
      return;
    rule.enabled = false;
    this._save();
    this._stopTrigger(ruleId);
  }
  /** 手动执行规则 */
  async runRule(ruleId, source = "manual") {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule)
      return err("RULE_NOT_FOUND", `\u89C4\u5219 ${ruleId} \u4E0D\u5B58\u5728`, false);
    return this._executeRule(rule, source);
  }
  // ==================== 生命周期 ====================
  /** 启动所有启用的规则 */
  startAll() {
    for (const rule of this.rules) {
      if (rule.enabled) {
        this._startTrigger(rule);
      }
    }
  }
  /** 停止所有规则 */
  stopAll() {
    for (const ruleId of this.triggers.keys()) {
      this._stopTrigger(ruleId);
    }
  }
  /** 设置动作执行器 */
  setActionExecutor(executor) {
    this.actionExecutor = executor;
  }
  /** Disposable — 停止所有 trigger 并清理 */
  dispose() {
    this.stopAll();
    this.composite.dispose();
    this.rules = [];
  }
  // ==================== 兼容旧版 API ====================
  /** 旧版：启动所有 cron 规则（兼容 view.ts） */
  startAllCron() {
    this.startAll();
  }
  /** 旧版：检查 Inbox 阈值（兼容 view.ts vault-scan-finish 事件） */
  checkInboxThreshold(inboxCount) {
    for (const rule of this.rules) {
      if (!rule.enabled)
        continue;
      if (rule.trigger.type === "inbox_threshold") {
        const threshold = rule.trigger.params.threshold || 5;
        if (inboxCount >= threshold) {
          this._executeRule(rule, "auto-threshold");
        }
      }
    }
  }
  /** 旧版：执行 startup 规则（兼容 view.ts） */
  executeStartupRules() {
    for (const rule of this.rules) {
      if (!rule.enabled)
        continue;
      if (rule.trigger.type === "on_startup") {
        this._executeRule(rule, "auto-startup");
      }
    }
  }
  /** 旧版：执行单条规则（兼容 workflows.ts） */
  async runRuleLegacy(rule, source) {
    const normalized = this._normalizeRule(rule);
    return this._executeRule(normalized, source);
  }
  // ==================== 内部方法 ====================
  /** 启动单个 trigger */
  _startTrigger(rule) {
    this._stopTrigger(rule.id);
    try {
      const trigger = createTriggerFromConfig(this.app, rule.trigger);
      this.triggers.set(rule.id, trigger);
      this.composite.add(trigger);
      trigger.start(() => this._executeRule(rule, `auto-${rule.trigger.type}`));
    } catch (e) {
      console.error("[AutomationEngine] Failed to start trigger:", e);
    }
  }
  /** 停止单个 trigger */
  _stopTrigger(ruleId) {
    const trigger = this.triggers.get(ruleId);
    if (trigger) {
      trigger.stop();
      this.triggers.delete(ruleId);
    }
  }
  /** 执行规则 */
  async _executeRule(rule, source) {
    if (rule.lastRun && Date.now() - rule.lastRun < 3e5)
      return ok(void 0);
    rule.lastRun = Date.now();
    this._save();
    if (this.actionExecutor) {
      return this.actionExecutor(rule, source);
    }
    const workflowId = rule.workflowId;
    if (!workflowId)
      return ok(void 0);
    try {
      await this.runner.scheduleAutoTask(workflowId, void 0, source);
      return ok(void 0);
    } catch (e) {
      console.error("[AUTOMATION_FAILED] executeRule:", e);
      return err("AUTOMATION_FAILED", e.message || "\u89C4\u5219\u6267\u884C\u5931\u8D25", true, e);
    }
  }
  /** 持久化 */
  _save() {
    this.saveCallback();
  }
  // ==================== 格式转换 ====================
  /** 标准化旧版 AutomationRule 为 RuleConfig */
  _normalizeRule(rule) {
    if ("trigger" in rule && typeof rule.trigger === "object" && "type" in rule.trigger && "params" in rule.trigger) {
      return rule;
    }
    const legacy = rule;
    const triggerConfig = this._convertLegacyTrigger(legacy.trigger);
    return {
      id: legacy.id,
      name: legacy.name,
      enabled: legacy.enabled,
      trigger: triggerConfig,
      actionName: legacy.action.type,
      workflowId: legacy.action.workflowId,
      lastRun: legacy.lastRun,
      createdAt: legacy.createdAt
    };
  }
  /** 转换旧版 trigger 格式为 TriggerConfig */
  _convertLegacyTrigger(trigger) {
    switch (trigger.type) {
      case "cron":
        return {
          type: "schedule",
          params: { mode: "every", intervalMs: (trigger.intervalMinutes || 60) * 6e4 }
        };
      case "inbox_threshold":
        return {
          type: "inbox_threshold",
          params: { threshold: trigger.inboxCount || 5 }
        };
      case "on_startup":
        return {
          type: "on_startup",
          params: {}
        };
      default:
        return {
          type: "schedule",
          params: { mode: "every", intervalMs: 36e5 }
        };
    }
  }
  /** 转换 RuleConfig 为旧版 AutomationRule（兼容 UI） */
  _toLegacyRule(rule) {
    let triggerType = "cron";
    let intervalMinutes;
    let inboxCount;
    if (rule.trigger.type === "schedule") {
      const params = rule.trigger.params;
      if (params.mode === "every" && params.intervalMs) {
        triggerType = "cron";
        intervalMinutes = Math.round(params.intervalMs / 6e4);
      } else if (params.mode === "at") {
        triggerType = "cron";
        intervalMinutes = 1440;
      }
    } else if (rule.trigger.type === "inbox_threshold") {
      triggerType = "inbox_threshold";
      inboxCount = rule.trigger.params.threshold;
    } else if (rule.trigger.type === "on_startup") {
      triggerType = "on_startup";
    } else if (rule.trigger.type === "event") {
      triggerType = "event";
    }
    return {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      trigger: { type: triggerType, intervalMinutes, inboxCount },
      action: { type: rule.actionName, workflowId: rule.workflowId },
      lastRun: rule.lastRun,
      createdAt: rule.createdAt
    };
  }
};

// src/utils/LazyRenderer.ts
var LazyRenderer = class {
  /**
   * @param root  IntersectionObserver 的 root 元素（Kanban 滚动容器）。
   *             传 null 则使用 viewport。
   */
  constructor(root = null) {
    this._disposed = false;
    this._observer = null;
    this._pending = /* @__PURE__ */ new Map();
    this._root = null;
    this._root = root;
    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting)
            continue;
          const target = entry.target;
          const record = this._pending.get(target);
          if (!record || record.rendered) {
            this._observer.unobserve(target);
            continue;
          }
          record.rendered = true;
          this._observer.unobserve(target);
          this._pending.delete(target);
          try {
            record.renderFn();
          } catch (e) {
            console.error("[LazyRenderer] render error:", e);
          }
        }
      },
      {
        root: this._root,
        rootMargin: "200px 0px",
        threshold: 0
      }
    );
  }
  get disposed() {
    return this._disposed;
  }
  /**
   * 注册待渲染节点。
   * @param el       需要懒渲染的 DOM 元素（内容区容器）
   * @param renderFn 实际渲染逻辑（只执行一次）
   */
  register(el3, renderFn) {
    if (this._disposed || !this._observer)
      return;
    const existing = this._pending.get(el3);
    if (existing == null ? void 0 : existing.rendered)
      return;
    this._pending.set(el3, { el: el3, renderFn, rendered: false });
    this._observer.observe(el3);
  }
  /**
   * 手动触发渲染（首屏卡片）。
   * 元素被 unobserve 并从 pending 中移除。
   */
  forceRender(el3) {
    const record = this._pending.get(el3);
    if (!record || record.rendered)
      return;
    record.rendered = true;
    if (this._observer)
      this._observer.unobserve(el3);
    this._pending.delete(el3);
    try {
      record.renderFn();
    } catch (e) {
      console.error("[LazyRenderer] forceRender error:", e);
    }
  }
  /**
   * 取消某个元素的懒渲染注册（折叠时调用）。
   * 如果尚未渲染，从 pending 中移除并 unobserve。
   * 返回是否成功取消（尚未渲染时返回 true）。
   */
  unregister(el3) {
    const record = this._pending.get(el3);
    if (!record)
      return false;
    if (record.rendered)
      return false;
    if (this._observer)
      this._observer.unobserve(el3);
    this._pending.delete(el3);
    return true;
  }
  /** Disposable — 断开 observer、清空 pending */
  dispose() {
    if (this._disposed)
      return;
    this._disposed = true;
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._pending.clear();
  }
};

// src/view.ts
var ICON_PATHS = {
  "grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  "map": '<path d="M9 3l-2 2-2-2v12l2 2 2-2 2 2 2-2V3l-2 2-2-2z"/><path d="M9 3v12M13 5v12"/>',
  "graph": '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8l6 8M18 8l-6 8M8 6h8"/>'
};
function icon(name, size = 14) {
  const d = ICON_PATHS[name] || ICON_PATHS["grid"];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
var CARD_IDS = [
  "kpi",
  "todos",
  "heatmap",
  "vaultHealth",
  "feeds",
  "projects",
  "recent"
];
var VIEW_TYPE_DASHBOARD = "axlumen-dashboard-view";
var _DashboardView = class _DashboardView extends import_obsidian11.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.stats = null;
    this.clockInterval = null;
    this.currentPage = "overview";
    // Event-driven
    this.vaultEvents = null;
    this.debouncedRefresh = null;
    // KPI data
    this.inboxCount = 0;
    this.taskCompletionPct = 0;
    this.worstHealthScore = 100;
    // KPI subtitle data
    this.healthDelta = 0;
    this.oldestInboxDays = 0;
    this.tasksToday = 0;
    this.tasksOverdue = 0;
    this.notesThisMonth = 0;
    this.lastSyncTime = "";
    // Banner daily summary data
    this.bannerTodoDone = 0;
    this.bannerTodoTotal = 0;
    this.bannerInboxCount = 0;
    this.bannerAgentRunning = 0;
    this.bannerAgentTotal = 0;
    this.bannerHealthScore = 100;
    this.bannerStatusLevel = "green";
    this.bannerSummaryEl = null;
    this.bannerLiveEl = null;
    // Sidebar / Banner state
    this.sidebarPinned = false;
    this.sidebarExpanded = false;
    this.bannerCollapsed = false;
    // Agent Runner (shared singleton)
    this.agentRunner = null;
    // v2.1: handles for active workflows and live subscribers
    // activeTaskBarHandle is created once per render; tracked for runner unsubscriptions
    this.activeTaskBarHandle = null;
    /**
     * CompositeDisposable — manages view-scoped resources:
     *   - Widget handles (register addEventListener / setTimeout / runner subscriptions)
     *   - Auto-disposed on view unload / refresh
     *
     * Refresh flow: composite.dispose() in cleanup() → render() creates a new CompositeDisposable.
     */
    this.composite = new CompositeDisposable();
    // Vault Scanner
    this.vaultScanner = null;
    this.vaultHealthData = null;
    // Automation Engine
    this.automationEngine = null;
    // Focus system
    this.focusPinned = false;
    this.focusAutoMode = true;
    this.focusProjects = [];
    this.currentFocusIndex = -1;
    // Quick Actions
    this.quickActions = [];
    // Quote rotation
    this.bannerQuoteIndex = 0;
    this.quoteRotationTimer = null;
    // Page definitions
    this.pages = [
      { id: "overview", icon: "grid", label: "\u603B\u89C8" },
      { id: "vault", icon: "map", label: "\u5168\u5E93\u89C6\u56FE" },
      { id: "graph", icon: "graph", label: "\u77E5\u8BC6\u56FE\u8C31" }
    ];
    // Lazy renderer for Kanban cards
    this.lazyRenderer = null;
    // DOM event cleanup tracking
    this._domCleanup = [];
    this.handleVaultChange = () => {
      var _a;
      (_a = this.debouncedRefresh) == null ? void 0 : _a.call(this);
    };
    this.handleVaultScanFinish = () => {
      if (this.vaultScanner) {
        this.vaultScanner.scanIncremental().then((result) => {
          var _a;
          if (result.ok) {
            this.vaultHealthData = result.value;
            (_a = this.automationEngine) == null ? void 0 : _a.checkInboxThreshold(result.value.inboxFiles.length);
            this.flashLiveIndicator();
            this.refreshBanner();
          }
        }).catch(() => {
        });
      }
    };
    this.handleAgentFinish = () => {
      this.flashLiveIndicator();
      this.refreshBanner();
    };
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_DASHBOARD;
  }
  getDisplayText() {
    return "Axlumen Dashboard";
  }
  getIcon() {
    return "layout-dashboard";
  }
  // ==================== Lifecycle ====================
  async onOpen() {
    this.containerEl.empty();
    this.containerEl.addClass("axlumen-dashboard");
    this.composite = new CompositeDisposable();
    this.agentRunner = this.plugin.agentRunner;
    this.vaultScanner = this.plugin.vaultScanner;
    this.automationEngine = new AutomationEngine(
      this.app,
      this.agentRunner,
      () => {
        const engine = this.automationEngine;
        if (engine) {
          this.plugin.settings.automationRules = engine.getRules();
          void this.plugin.saveSettings();
        }
      }
    );
    this.automationEngine.loadRules(this.plugin.settings.automationRules);
    this.automationEngine.startAll();
    this.loadFocusState();
    this.debouncedRefresh = debounce(() => {
      this.stats = null;
      this.refresh();
    }, AUTO_REFRESH_DEBOUNCE_MS);
    this.registerVaultEvents();
    this.registerVaultScanListener();
    this.registerStorageEventListener();
    await this.render();
  }
  async onClose() {
    this.cleanup();
  }
  cleanup() {
    var _a, _b;
    (_a = this.lazyRenderer) == null ? void 0 : _a.dispose();
    this.lazyRenderer = null;
    this.composite.dispose();
    this.composite = new CompositeDisposable();
    if (this.clockInterval) {
      window.clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    if (this.quoteRotationTimer) {
      window.clearInterval(this.quoteRotationTimer);
      this.quoteRotationTimer = null;
    }
    (_b = this.automationEngine) == null ? void 0 : _b.dispose();
    this.automationEngine = null;
    this.unregisterVaultEvents();
    this.cleanupDomEvents();
    this.activeTaskBarHandle = null;
    this.containerEl.empty();
  }
  /** Clean up manually-tracked DOM listeners */
  cleanupDomEvents() {
    for (const h of this._domCleanup)
      h();
    this._domCleanup = [];
  }
  /** Register a DOM event that auto-cleans on view unload */
  regDom(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._domCleanup.push(
      () => target.removeEventListener(type, handler, options)
    );
  }
  // ==================== Event System ====================
  registerVaultEvents() {
    if (!this.plugin.settings.autoRefresh)
      return;
    const vault = this.app.vault;
    this.vaultEvents = vault;
    this.registerEvent(vault.on("modify", this.handleVaultChange));
    this.registerEvent(vault.on("create", this.handleVaultChange));
    this.registerEvent(vault.on("delete", this.handleVaultChange));
  }
  unregisterVaultEvents() {
    this.vaultEvents = null;
  }
  /** Listen for vault-scan-finish custom event */
  registerVaultScanListener() {
    this.registerDomEvent(
      document,
      "vault-scan-finish",
      this.handleVaultScanFinish
    );
  }
  /** Listen for agent-finish custom event */
  registerStorageEventListener() {
    this.registerDomEvent(
      document,
      "dashboard-agent-finish",
      this.handleAgentFinish
    );
  }
  /** Banner status pulse highlight */
  flashLiveIndicator() {
    this.refreshBanner();
  }
  // ==================== Focus State Persistence ====================
  loadFocusState() {
    const state = LocalStore.getFocusState();
    this.focusPinned = state.pinned;
    this.focusAutoMode = state.autoMode;
    this.currentFocusIndex = state.focusIndex;
  }
  saveFocusState() {
    LocalStore.setFocusState({
      pinned: this.focusPinned,
      autoMode: this.focusAutoMode,
      focusIndex: this.currentFocusIndex
    });
  }
  initFocusData() {
    const settingProjects = this.plugin.settings.projects.map(
      (p) => ({
        name: p.name,
        path: p.path,
        stage: p.priority || "",
        nextAction: p.description || ""
      })
    );
    this.focusProjects = settingProjects.length > 0 ? settingProjects : [
      { name: "Axlumen Dashboard", path: "projects/axlumen-dashboard", stage: "Phase 1", nextAction: "\u5B8C\u6210 Dashboard \u6539\u9020" },
      { name: "\u77E5\u8BC6\u5E93\u91CD\u6784", path: "projects/knowledge-restructure", stage: "\u89C4\u5212\u9636\u6BB5", nextAction: "\u786E\u5B9A Wiki \u5206\u7C7B\u4F53\u7CFB" },
      { name: "\u5B89\u5168\u5BA1\u8BA1\u5DE5\u5177", path: "projects/security-audit", stage: "\u8C03\u7814\u9636\u6BB5", nextAction: "\u8BC4\u4F30\u5DE5\u5177\u94FE" }
    ];
    if (this.focusAutoMode && !this.focusPinned) {
      this.currentFocusIndex = 0;
    }
  }
  // ==================== Quick Actions ====================
  initQuickActions() {
    const cmds = [
      { name: "New Diary", type: "file", target: "diary/new", icon: "\u{1F4DD}" },
      { name: "Deep Research", type: "command", target: "editor:open", icon: "\u{1F52C}" },
      { name: "Pull RSS", type: "command", target: "rss:sync", icon: "\u{1F4E1}" },
      { name: "GitHub Feeds", type: "command", target: "github:refresh", icon: "\u2B50" },
      { name: "Inbox Ingest", type: "command", target: "inbox:archive", icon: "\u{1F4E5}" },
      { name: "Vault Lint", type: "command", target: "vault:health", icon: "\u{1F3E5}" }
    ];
    this.quickActions = cmds.map((c, i) => ({ ...c, id: "qa-" + i }));
  }
  executeQuickAction(qa) {
    var _a;
    if (qa.type === "file") {
      this.openPath(qa.target);
    } else {
      const cmd = (_a = this.app.commands.commands) == null ? void 0 : _a[qa.target];
      if (cmd) {
        try {
          this.app.commands.executeCommandById(qa.target);
        } catch (e) {
          this.showToast("\u6267\u884C\u547D\u4EE4\u5931\u8D25: " + qa.name);
        }
      } else {
        this.showToast("Command: " + qa.name + " (mock \u2014 wire up in settings)");
      }
    }
  }
  // ==================== Refresh / Page Switch ====================
  async refresh() {
    this.stats = null;
    this.composite.dispose();
    this.composite = new CompositeDisposable();
    this.cleanupDomEvents();
    this.containerEl.empty();
    await this.render();
  }
  switchPage(pageId) {
    this.currentPage = pageId;
    this.containerEl.querySelectorAll(".ax-sidebar-nav-item[data-page]").forEach((btn) => {
      btn.toggleClass("ax-sidebar-nav-active", btn.getAttribute("data-page") === pageId);
    });
    this.containerEl.querySelectorAll(".ax-page").forEach((page) => {
      const isTarget = page.getAttribute("data-page") === pageId;
      page.toggleClass("ax-page-hidden", !isTarget);
      page.toggleClass("ax-page-active", isTarget);
    });
  }
  // ==================== MAIN RENDER ====================
  async render() {
    const settings = this.plugin.settings;
    const container = this.containerEl;
    const [stats] = await Promise.all([
      this.stats || scanVault(this.app, settings.wikis),
      this.computeKpiData()
    ]);
    if (!this.stats)
      this.stats = stats;
    if (!this.vaultHealthData && this.vaultScanner) {
      try {
        const scanResult = await this.vaultScanner.scanFull((pct, msg) => {
          this.updateScanProgress(pct, msg);
        });
        if (scanResult.ok)
          this.vaultHealthData = scanResult.value;
        this.clearScanProgress();
      } catch (e) {
      }
    }
    const app = div("ax-app");
    app.addClass("apex-dashboard-root");
    app.setAttribute("data-theme", settings.theme);
    app.addClass("axlumen-theme-" + settings.theme);
    this.initFocusData();
    app.appendChild(this.createBanner());
    const mainLayout = div("ax-main-layout");
    const sidebar = div("ax-sidebar");
    if (this.sidebarPinned)
      sidebar.addClass("ax-sidebar--pinned");
    else if (this.sidebarExpanded)
      sidebar.addClass("ax-sidebar--expanded");
    else
      sidebar.addClass("ax-sidebar--collapsed");
    await this.renderWidgetSidebar(sidebar);
    mainLayout.appendChild(sidebar);
    const slimIndicator = div("ax-sidebar-slim-indicator");
    mainLayout.appendChild(slimIndicator);
    const content = div("ax-kanban-wrapper");
    const pageOverview = div("ax-page");
    pageOverview.setAttribute("data-page", "overview");
    const kanban = div("ax-kanban");
    this.lazyRenderer = new LazyRenderer(kanban);
    const order = this.getCardOrder();
    const FIRST_SCREEN_COUNT = 4;
    for (let i = 0; i < order.length; i++) {
      const cardId = order[i];
      try {
        const card = this.createCardById(cardId);
        if (card) {
          kanban.appendChild(card);
          if (i < FIRST_SCREEN_COUNT) {
            const contentEl = card.querySelector(".ax-card-lazy-content");
            if (contentEl)
              this.lazyRenderer.forceRender(contentEl);
          }
        }
      } catch (e) {
        console.error("[DASHBOARD]", "WIDGET_RENDER_FAILED", cardId, e);
        kanban.appendChild(renderErrorState({
          code: "WIDGET_RENDER_FAILED",
          message: cardId + " \u52A0\u8F7D\u5931\u8D25",
          recoverable: false
        }));
      }
    }
    kanban.appendChild(this.createFooter());
    pageOverview.appendChild(kanban);
    content.appendChild(pageOverview);
    const pageVault = div("ax-page");
    pageVault.setAttribute("data-page", "vault");
    pageVault.appendChild(this.createVaultSection());
    pageVault.appendChild(this.createFooter());
    content.appendChild(pageVault);
    const pageGraph = div("ax-page");
    pageGraph.setAttribute("data-page", "graph");
    pageGraph.appendChild(this.createGraphSection());
    pageGraph.appendChild(this.createFooter());
    content.appendChild(pageGraph);
    mainLayout.appendChild(content);
    app.appendChild(mainLayout);
    container.appendChild(app);
    container.appendChild(el("div", { class: "ax-toast" }));
    this.switchPage(this.currentPage);
    this.startClock();
    this.setupSidebarBehavior(sidebar, slimIndicator);
    this.setupQuoteRotation();
    this.refreshBanner();
    requestAnimationFrame(() => {
      setTimeout(() => {
        const cards = container.querySelectorAll(
          ".ax-panel, .ax-card, .ax-section-row"
        );
        staggerEntrance(Array.from(cards), 60);
        animateProgressBars(container);
      }, 50);
    });
  }
  // ==================== Widget Sidebar ====================
  async renderWidgetSidebar(sidebar) {
    var _a, _b;
    const scroll = div("ax-sidebar-scroll");
    const widgets = this.plugin.settings.widgets;
    this.initQuickActions();
    scroll.appendChild(this.createSidebarQuickActions());
    scroll.appendChild(div("ax-sidebar-divider"));
    try {
      const { bar, handle: activeTaskBarHandle } = createActiveTaskBar(
        this.plugin.agentRunner,
        (path) => this.openPath(path)
      );
      this.activeTaskBarHandle = activeTaskBarHandle;
      this.composite.add(activeTaskBarHandle);
      scroll.appendChild(bar);
    } catch (e) {
      console.error("[DASHBOARD]", "TASK_BAR_FAILED", e);
      scroll.appendChild(renderErrorState({
        code: "TASK_BAR_FAILED",
        message: "\u4EFB\u52A1\u680F\u52A0\u8F7D\u5931\u8D25",
        recoverable: false
      }));
    }
    scroll.appendChild(div("ax-sidebar-divider"));
    scroll.appendChild(this.createSidebarKpiBar());
    scroll.appendChild(div("ax-sidebar-divider"));
    scroll.appendChild(this.createSidebarNav());
    scroll.appendChild(div("ax-sidebar-divider"));
    if (widgets.weekCalendar) {
      try {
        const { section: cal, handle: calHandle } = createWeekCalendarWidget(
          this.app,
          this.createPanelSection.bind(this)
        );
        cal.style.maxHeight = "140px";
        cal.style.overflow = "hidden";
        scroll.appendChild(cal);
        this.composite.add(calHandle);
      } catch (e) {
        console.error("[DASHBOARD]", "WEEK_CALENDAR_FAILED", e);
      }
      scroll.appendChild(div("ax-sidebar-divider"));
    }
    try {
      scroll.appendChild(await this.createCombinedAgentPanel());
    } catch (e) {
      console.error("[DASHBOARD]", "AGENT_PANEL_FAILED", e);
      scroll.appendChild(renderErrorState({
        code: "AGENT_PANEL_FAILED",
        message: "Agent \u9762\u677F\u52A0\u8F7D\u5931\u8D25",
        recoverable: false
      }));
    }
    scroll.appendChild(div("ax-sidebar-divider"));
    try {
      const inboxFiles = (_b = (_a = this.vaultHealthData) == null ? void 0 : _a.inboxFiles) != null ? _b : [];
      const { section: irSection, handle: irHandle } = createInboxRouterPanel(
        this.app,
        this.createPanelSection.bind(this),
        (path) => this.openPath(path),
        inboxFiles,
        {
          onRouteSingle: (_item) => {
            this.triggerAgentInboxRoute();
          },
          onRouteAll: (_items) => {
            this.triggerAgentInboxRoute();
          }
        }
      );
      scroll.appendChild(irSection);
      this.composite.add(irHandle);
    } catch (e) {
      console.error("[DASHBOARD]", "INBOX_ROUTER_FAILED", e);
    }
    scroll.appendChild(div("ax-sidebar-divider"));
    try {
      const { section: cdSection, handle: cdHandle } = createCountdownPanel(
        this.plugin.settings,
        () => this.plugin.saveSettings(),
        (msg) => this.showToast(msg),
        this.createPanelSection.bind(this)
      );
      scroll.appendChild(cdSection);
    } catch (e) {
      console.error("[DASHBOARD]", "COUNTDOWN_FAILED", e);
    }
    scroll.appendChild(div("ax-sidebar-divider"));
    if (widgets.quickMemo) {
      scroll.appendChild(this.createQuickMemoWidget());
    }
    sidebar.appendChild(scroll);
    const pinBtn = el("button", { class: "ax-sidebar-pin-btn", type: "button" });
    pinBtn.innerHTML = this.sidebarPinned ? "\u{1F4CC}" : "\u{1F4CD}";
    pinBtn.title = this.sidebarPinned ? "\u53D6\u6D88\u56FA\u5B9A\u4FA7\u680F" : "\u56FA\u5B9A\u4FA7\u680F";
    this.regDom(pinBtn, "click", (e) => {
      e.stopPropagation();
      this.sidebarPinned = !this.sidebarPinned;
      if (this.sidebarPinned) {
        sidebar.addClass("ax-sidebar--pinned");
        sidebar.removeClass("ax-sidebar--expanded ax-sidebar--collapsed");
        this.sidebarExpanded = false;
      } else {
        sidebar.removeClass("ax-sidebar--pinned");
        sidebar.addClass("ax-sidebar--collapsed");
        this.sidebarExpanded = false;
      }
      pinBtn.innerHTML = this.sidebarPinned ? "\u{1F4CC}" : "\u{1F4CD}";
    });
    sidebar.appendChild(pinBtn);
  }
  // ---------- Sidebar sub-components ----------
  /** v2.1 [2] — Compact Quick Actions in sidebar */
  createSidebarQuickActions() {
    const section = this.createPanelSection("Quick Actions", "#38BDF8", "");
    const grid = div("ax-sqa-grid");
    this.quickActions.forEach((qa) => {
      const btn = el("button", {
        class: "ax-sqa-btn",
        type: "button",
        title: qa.name
      });
      btn.innerHTML = '<span class="ax-sqa-icon">' + esc(qa.icon || "") + '</span><span class="ax-sqa-label">' + esc(qa.name) + "</span>";
      this.regDom(btn, "click", () => {
        btn.addClass("is-active");
        setTimeout(() => btn.removeClass("is-active"), 600);
        this.executeQuickAction(qa);
      });
      grid.appendChild(btn);
    });
    section.appendChild(grid);
    return section;
  }
  /** v2.1 [6] — Combined Agent Status + Workflows panel */
  async createCombinedAgentPanel() {
    const panel = this.createPanelSection("Agent & Workflows", "#818CF8", "");
    const { section: agentEl, handle: agentHandle } = await createAgentStatusWidget(
      this.app,
      this.createPanelSection.bind(this)
    );
    panel.appendChild(agentEl);
    this.composite.add(agentHandle);
    panel.appendChild(div("ax-panel-divider"));
    const rulesStore = {
      getRules: () => this.plugin.settings.automationRules || [],
      saveRules: (rules) => {
        this.plugin.settings.automationRules = rules;
        void this.plugin.saveSettings();
      }
    };
    const { section: workflowsEl, handle: workflowsHandle } = await createWorkflowsPanel(
      this.app,
      this.createPanelSection.bind(this),
      this.agentRunner || void 0,
      rulesStore
    );
    panel.appendChild(workflowsEl);
    this.composite.add(workflowsHandle);
    return panel;
  }
  /** Quick Memo — textarea + save to Inbox */
  createQuickMemoWidget() {
    const section = this.createPanelSection("Quick Memo", "#F472B6", "");
    section.style.setProperty("--ax-accent", "#F472B6");
    const memoArea = el("textarea", {
      class: "ax-memo ax-memo--compact",
      placeholder: "\u5FEB\u901F\u8BB0\u5F55... [[wikilink]]"
    });
    const actions = div("ax-memo-actions");
    const saveBtn = el(
      "button",
      { class: "ax-btn ax-btn-primary ax-btn-sm" },
      "\u{1F4BE} \u4FDD\u5B58\u5230 Inbox"
    );
    this.regDom(saveBtn, "click", async () => {
      const text = memoArea.value.trim();
      if (!text) {
        this.showToast("\u5148\u5199\u70B9\u4E1C\u897F");
        return;
      }
      try {
        const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const fileName = `Inbox/${today}-${Date.now().toString(36)}.md`;
        const content = `---
created: ${today}
status: inbox
---

${text}
`;
        await this.app.vault.create(fileName, content);
        memoArea.value = "";
        this.showToast("\u5DF2\u4FDD\u5B58\u5230 Inbox");
      } catch (e) {
        this.showToast("\u4FDD\u5B58\u5931\u8D25: " + e.message);
      }
    });
    actions.appendChild(saveBtn);
    section.appendChild(memoArea);
    section.appendChild(actions);
    return section;
  }
  // ==================== Card Collapse + Drag/Drop ====================
  getCardCollapseState() {
    return LocalStore.getCardCollapse();
  }
  saveCardCollapseState(state) {
    LocalStore.setCardCollapse(state);
  }
  getCardOrder() {
    return LocalStore.getCardOrder(CARD_IDS);
  }
  saveCardOrder(order) {
    LocalStore.setCardOrder(order);
  }
  /**
   * v2.1 [4] — 'workflows' case removed (Sidebar only)
   *
   * 创建卡片外壳 + 注册懒渲染。
   * 卡片外壳（标题栏 + 折叠按钮）立即插入 DOM，
   * 内容渲染函数注册到 LazyRenderer，滚动到可视区域时才执行。
   */
  createCardById(cardId) {
    const TITLES = {
      kpi: "\u6027\u80FD\u6307\u6807",
      todos: "\u4ECA\u65E5\u5F85\u529E",
      heatmap: "\u5199\u4F5C\u70ED\u529B\u56FE",
      vaultHealth: "Vault Health Overview",
      feeds: "\u4FE1\u606F\u6D41",
      projects: "\u6D3B\u8DC3\u9879\u76EE",
      recent: "\u6700\u8FD1\u7F16\u8F91"
    };
    const title = TITLES[cardId];
    if (!title)
      return null;
    const { section: shell, cards: contentArea } = this.createSectionScaffold("ax-section-" + cardId, title);
    shell.setAttribute("data-card-id", cardId);
    contentArea.addClass("ax-card-lazy-content");
    const renderFn = () => {
      try {
        let inner = null;
        switch (cardId) {
          case "kpi":
            inner = this.createKpiContent();
            break;
          case "todos":
            inner = this.createTodosContent();
            break;
          case "heatmap":
            inner = this.createHeatmapContent();
            break;
          case "vaultHealth":
            inner = this.createVaultHealthContent();
            break;
          case "feeds":
            inner = this.createFeedsContent();
            break;
          case "projects":
            inner = this.createProjectsContent();
            break;
          case "recent":
            inner = this.createRecentFilesContent();
            break;
        }
        if (inner) {
          contentArea.appendChild(inner);
          shell.removeClass("ax-card--skeleton");
        }
      } catch (e) {
        console.error("[WIDGET_RENDER_FAILED] createCardById(" + cardId + "):", e);
        contentArea.appendChild(this.createErrorFallback(cardId));
      }
    };
    const collapseState = this.getCardCollapseState();
    if (!collapseState[cardId] && this.lazyRenderer) {
      this.lazyRenderer.register(contentArea, renderFn);
    }
    this.enhanceCardWithCollapseAndDrag(shell, cardId, contentArea, renderFn);
    const isCollapsed = collapseState[cardId] || false;
    if (!isCollapsed)
      shell.addClass("ax-card--skeleton");
    return shell;
  }
  /** 不可恢复的 Widget 错误占位 */
  createErrorFallback(cardId) {
    const el3 = document.createElement("div");
    el3.className = "ax-section-row ax-widget-error ax-widget-error--fatal";
    el3.innerHTML = '<div class="ax-widget-error-icon">\u26A0</div><div class="ax-widget-error-text">\u6A21\u5757\u6682\u65F6\u4E0D\u53EF\u7528</div><div class="ax-widget-error-code">' + cardId + "</div>";
    return el3;
  }
  enhanceCardWithCollapseAndDrag(card, cardId, contentArea, renderFn) {
    const collapseState = this.getCardCollapseState();
    const isCollapsed = collapseState[cardId] || false;
    const header = card.querySelector(".ax-section-header") || card.querySelector(".ax-section-title");
    if (!header)
      return;
    if (isCollapsed)
      card.addClass("ax-card--collapsed");
    const dragHandle = div("ax-card-drag-handle");
    dragHandle.innerHTML = '<span class="ax-drag-grip"></span>';
    dragHandle.title = "\u62D6\u62FD\u6392\u5E8F";
    card.insertBefore(dragHandle, card.firstChild);
    const collapseBtn = el("button", {
      class: "ax-card-collapse-btn",
      type: "button",
      title: isCollapsed ? "\u5C55\u5F00" : "\u6298\u53E0"
    });
    collapseBtn.innerHTML = isCollapsed ? "\u25B8" : "\u25BE";
    const actions = header.querySelector(".ax-section-header-actions");
    if (actions)
      actions.appendChild(collapseBtn);
    else
      header.appendChild(collapseBtn);
    this.regDom(collapseBtn, "click", (e) => {
      e.stopPropagation();
      const collapsed = card.hasClass("ax-card--collapsed");
      card.toggleClass("ax-card--collapsed", !collapsed);
      collapseBtn.innerHTML = collapsed ? "\u25BE" : "\u25B8";
      collapseBtn.title = collapsed ? "\u6298\u53E0" : "\u5C55\u5F00";
      const state = this.getCardCollapseState();
      state[cardId] = !collapsed;
      this.saveCardCollapseState(state);
      if (contentArea && renderFn && this.lazyRenderer) {
        if (!collapsed) {
          setTimeout(() => {
            this.lazyRenderer.register(contentArea, renderFn);
            card.removeClass("ax-card--skeleton");
          }, 0);
        } else {
          this.lazyRenderer.unregister(contentArea);
        }
      }
    });
    this.setupCardDragAndDrop(card, dragHandle, cardId);
  }
  setupCardDragAndDrop(card, handle, cardId) {
    handle.setAttribute("draggable", "true");
    this.regDom(handle, "dragstart", (e) => {
      card.addClass("ax-card--dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cardId);
      }
    });
    this.regDom(handle, "dragend", () => {
      var _a;
      card.removeClass("ax-card--dragging");
      (_a = card.parentElement) == null ? void 0 : _a.querySelectorAll(".ax-card--drop-target").forEach((el3) => el3.removeClass("ax-card--drop-target"));
    });
    this.regDom(card, "dragover", (e) => {
      if (!card.hasClass("ax-card--dragging")) {
        e.preventDefault();
        card.addClass("ax-card--drop-target");
      }
    });
    this.regDom(card, "dragleave", () => {
      card.removeClass("ax-card--drop-target");
    });
    this.regDom(card, "drop", (e) => {
      var _a;
      e.preventDefault();
      card.removeClass("ax-card--drop-target");
      const fromId = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/plain");
      if (!fromId || fromId === cardId)
        return;
      const order = this.getCardOrder();
      const fromIdx = order.indexOf(fromId);
      const toIdx = order.indexOf(cardId);
      if (fromIdx < 0 || toIdx < 0)
        return;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, fromId);
      this.saveCardOrder(order);
      this.refresh();
    });
  }
  // ==================== Banner (with integrated Focus + Daily Summary) ====================
  /** v2.2 — Banner: Brand + Focus + Daily Summary + Status Indicator */
  createBanner() {
    var _a, _b;
    const settings = this.plugin.settings;
    const bannerMode = ((_a = settings.banner) == null ? void 0 : _a.bannerMode) || "detailed";
    const banner = div("ax-banner");
    if (this.bannerCollapsed)
      banner.addClass("ax-banner--collapsed");
    if (bannerMode === "compact")
      banner.addClass("ax-banner--compact");
    const bgLayer = div("ax-banner-bg");
    banner.appendChild(bgLayer);
    const overlay = div("ax-banner-overlay");
    const topRow = div("ax-banner-top-row");
    const brand = div("ax-banner-brand");
    const brandMark = div("ax-header-mark");
    brandMark.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 8L7 10L11 6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const brandText = div("ax-banner-brand-text");
    brandText.innerHTML = '<div class="ax-header-title">' + esc(settings.brandName) + '</div><div class="ax-header-sub">AGENTIC VAULT</div>';
    brand.appendChild(brandMark);
    brand.appendChild(brandText);
    topRow.appendChild(brand);
    topRow.appendChild(this.createBannerFocusCompact());
    this.bannerLiveEl = this.createStatusIndicator();
    topRow.appendChild(this.bannerLiveEl);
    overlay.appendChild(topRow);
    if (bannerMode === "detailed") {
      this.bannerSummaryEl = this.createDailySummaryBar();
      overlay.appendChild(this.bannerSummaryEl);
    }
    if ((_b = settings.banner) == null ? void 0 : _b.enableQuoteRotation) {
      const quotes = settings.quotes;
      if (quotes && quotes.length > 0) {
        this.bannerQuoteIndex = 0;
        const quoteSection = div("ax-banner-quote-section");
        const quoteText = div("ax-banner-quote");
        quoteText.textContent = quotes[0].text;
        const quoteAuthor = div("ax-banner-author");
        quoteAuthor.textContent = "\u2014 " + quotes[0].source;
        quoteSection.appendChild(quoteText);
        quoteSection.appendChild(quoteAuthor);
        overlay.appendChild(quoteSection);
      }
    }
    banner.appendChild(overlay);
    const pinBtn = el("button", { class: "ax-banner-pin-btn", type: "button" });
    pinBtn.innerHTML = this.bannerCollapsed ? "\u25B8" : "\u25BE";
    this.regDom(pinBtn, "click", (e) => {
      e.stopPropagation();
      this.bannerCollapsed = !this.bannerCollapsed;
      banner.toggleClass("ax-banner--collapsed", this.bannerCollapsed);
      pinBtn.innerHTML = this.bannerCollapsed ? "\u25B8" : "\u25BE";
    });
    banner.appendChild(pinBtn);
    return banner;
  }
  /** Status indicator pill with color-coded health */
  createStatusIndicator() {
    const live = div("ax-banner-live");
    this.updateBannerStatus();
    return live;
  }
  /** Update status indicator color based on data */
  updateBannerStatus() {
    if (!this.bannerLiveEl)
      return;
    const hasOverdue = this.tasksOverdue > 0;
    const inboxHigh = this.bannerInboxCount >= 10;
    const hasTodayDue = this.tasksToday > 0;
    const agentError = this.bannerAgentRunning > 0 && this.bannerAgentTotal > this.bannerAgentRunning + 5;
    let level = "green";
    if (hasOverdue || agentError) {
      level = "red";
    } else if (hasTodayDue || inboxHigh) {
      level = "yellow";
    }
    const prevLevel = this.bannerStatusLevel;
    this.bannerStatusLevel = level;
    this.bannerLiveEl.removeClass("ax-banner-live--green");
    this.bannerLiveEl.removeClass("ax-banner-live--yellow");
    this.bannerLiveEl.removeClass("ax-banner-live--red");
    this.bannerLiveEl.addClass("ax-banner-live--" + level);
    const statusTexts = [];
    if (hasOverdue)
      statusTexts.push(this.tasksOverdue + " \u8FC7\u671F");
    if (inboxHigh)
      statusTexts.push("Inbox " + this.bannerInboxCount);
    if (hasTodayDue && !hasOverdue)
      statusTexts.push(this.tasksToday + " \u5F85\u529E");
    if (this.bannerAgentRunning > 0)
      statusTexts.push(this.bannerAgentRunning + " Agent");
    const statusText = statusTexts.length > 0 ? statusTexts.join(" \xB7 ") : "\u6B63\u5E38";
    this.bannerLiveEl.innerHTML = "<i></i>" + esc(statusText);
    if (prevLevel !== level) {
      this.bannerLiveEl.addClass("ax-banner-live--flash");
      setTimeout(() => {
        var _a;
        (_a = this.bannerLiveEl) == null ? void 0 : _a.removeClass("ax-banner-live--flash");
      }, 600);
    }
  }
  /** Daily summary bar with key metrics */
  createDailySummaryBar() {
    const summary = div("ax-banner-summary");
    const todoItem = div("ax-banner-summary-item");
    todoItem.innerHTML = '<span class="ax-banner-summary-icon">\u{1F4CB}</span><span class="ax-banner-summary-label">\u5F85\u529E</span><span class="ax-banner-summary-value" id="ax-banner-todo">' + this.bannerTodoDone + "/" + this.bannerTodoTotal + " \u5DF2\u5B8C\u6210</span>";
    summary.appendChild(todoItem);
    const inboxItem = div("ax-banner-summary-item");
    inboxItem.innerHTML = '<span class="ax-banner-summary-icon">\u{1F4E5}</span><span class="ax-banner-summary-label">Inbox</span><span class="ax-banner-summary-value" id="ax-banner-inbox">' + this.bannerInboxCount + " \u6761\u672A\u5904\u7406</span>";
    summary.appendChild(inboxItem);
    const agentItem = div("ax-banner-summary-item");
    agentItem.innerHTML = '<span class="ax-banner-summary-icon">\u{1F916}</span><span class="ax-banner-summary-label">Agent</span><span class="ax-banner-summary-value" id="ax-banner-agent">' + this.bannerAgentRunning + "/" + this.bannerAgentTotal + " \u8FD0\u884C\u4E2D</span>";
    summary.appendChild(agentItem);
    const healthItem = div("ax-banner-summary-item");
    healthItem.innerHTML = '<span class="ax-banner-summary-icon">\u{1F49A}</span><span class="ax-banner-summary-label">\u5065\u5EB7\u5EA6</span><span class="ax-banner-summary-value" id="ax-banner-health">' + this.bannerHealthScore + "/100</span>";
    summary.appendChild(healthItem);
    return summary;
  }
  /** Refresh banner summary data from cached widget data (no re-scan) */
  refreshBanner() {
    var _a;
    this.gatherBannerData();
    const todoEl = this.containerEl.querySelector("#ax-banner-todo");
    if (todoEl) {
      todoEl.textContent = this.bannerTodoDone + "/" + this.bannerTodoTotal + " \u5DF2\u5B8C\u6210";
    }
    const inboxEl = this.containerEl.querySelector("#ax-banner-inbox");
    if (inboxEl) {
      inboxEl.textContent = this.bannerInboxCount + " \u6761\u672A\u5904\u7406";
      (_a = inboxEl.parentElement) == null ? void 0 : _a.toggleClass("ax-banner-summary-item--warn", this.bannerInboxCount >= 10);
    }
    const agentEl = this.containerEl.querySelector("#ax-banner-agent");
    if (agentEl) {
      agentEl.textContent = this.bannerAgentRunning + "/" + this.bannerAgentTotal + " \u8FD0\u884C\u4E2D";
    }
    const healthEl = this.containerEl.querySelector("#ax-banner-health");
    if (healthEl) {
      healthEl.textContent = this.bannerHealthScore + "/100";
    }
    this.updateBannerStatus();
  }
  /** Gather banner data from existing cached sources (no scans) */
  gatherBannerData() {
    var _a;
    this.bannerTodoDone = this.tasksToday;
    this.bannerTodoTotal = this.tasksToday + this.tasksOverdue;
    if (this.bannerTodoTotal === 0) {
      const taskFiles = this.app.vault.getMarkdownFiles().filter(
        (f) => f.path.includes("task") || f.path.includes("Task") || f.path.includes("todo") || f.path.includes("Todo")
      );
      this.bannerTodoTotal = Math.min(taskFiles.length, 50);
    }
    this.bannerInboxCount = this.inboxCount;
    const running = getTasksByStatus("running");
    const allRecent = listRecentTasks(20);
    this.bannerAgentRunning = running.length;
    this.bannerAgentTotal = allRecent.length || running.length;
    this.bannerHealthScore = this.vaultHealthData ? Math.round((_a = this.vaultHealthData.healthScore) != null ? _a : 85) : this.worstHealthScore || 85;
  }
  /** v2.1 [1] — Compact focus selector embedded in banner top row */
  createBannerFocusCompact() {
    const focus = div("ax-banner-focus");
    if (this.currentFocusIndex >= 0 && this.focusProjects.length > 0) {
      const fp = this.focusProjects[this.currentFocusIndex];
      const info = div("ax-banner-focus-info");
      const label = div("ax-banner-focus-label", "CURRENT FOCUS");
      const title = div("ax-banner-focus-title", fp.name);
      title.title = fp.stage + " \xB7 " + fp.nextAction;
      info.appendChild(label);
      info.appendChild(title);
      focus.appendChild(info);
      const controls = div("ax-banner-focus-controls");
      const select = el("select", {
        class: "ax-banner-focus-select"
      });
      this.focusProjects.forEach((p, i) => {
        select.appendChild(el("option", { value: String(i) }, p.name));
      });
      select.value = String(this.currentFocusIndex);
      this.regDom(select, "change", () => {
        this.currentFocusIndex = parseInt(select.value, 10);
        this.focusPinned = true;
        this.saveFocusState();
        const newFp = this.focusProjects[this.currentFocusIndex];
        title.textContent = newFp.name;
        title.title = newFp.stage + " \xB7 " + newFp.nextAction;
      });
      controls.appendChild(select);
      const jumpBtn = el("button", {
        class: "ax-banner-focus-btn",
        type: "button"
      }, "\u2913");
      jumpBtn.title = "\u8DF3\u8F6C\u5230\u7B14\u8BB0";
      this.regDom(jumpBtn, "click", () => {
        if (this.currentFocusIndex >= 0) {
          this.openPath(this.focusProjects[this.currentFocusIndex].path);
        }
      });
      controls.appendChild(jumpBtn);
      const aiBtn = el("button", {
        class: "ax-banner-focus-btn",
        type: "button",
        title: "AI \u6DF1\u5EA6\u8C03\u7814"
      }, "\u{1F52C}");
      this.regDom(aiBtn, "click", () => {
        if (this.agentRunner && this.currentFocusIndex >= 0) {
          const f = this.focusProjects[this.currentFocusIndex];
          this.agentRunner.run("deep-research-single", { topic: f.name });
          this.showToast("\u5DF2\u542F\u52A8\u6DF1\u5EA6\u8C03\u7814: " + f.name);
        }
      });
      controls.appendChild(aiBtn);
      const mode = el(
        "span",
        { class: "ax-banner-focus-mode" },
        this.focusPinned ? "\u{1F4CC}" : "\u2728"
      );
      mode.title = this.focusPinned ? "\u624B\u52A8\u56FA\u5B9A\u7126\u70B9" : "\u81EA\u52A8\u63A8\u8350\u7126\u70B9";
      controls.appendChild(mode);
      focus.appendChild(controls);
    } else {
      focus.appendChild(div("ax-banner-focus-empty", "No active focus"));
    }
    return focus;
  }
  /** Quote rotation with fade transition (only if enabled in settings) */
  setupQuoteRotation() {
    var _a;
    if (this.quoteRotationTimer) {
      window.clearInterval(this.quoteRotationTimer);
      this.quoteRotationTimer = null;
    }
    if (!((_a = this.plugin.settings.banner) == null ? void 0 : _a.enableQuoteRotation))
      return;
    const quotes = this.plugin.settings.quotes;
    if (quotes.length <= 1)
      return;
    const quoteEl = this.containerEl.querySelector(".ax-banner-quote");
    const authorEl = this.containerEl.querySelector(".ax-banner-author");
    if (!quoteEl || !authorEl)
      return;
    this.quoteRotationTimer = this.registerInterval(window.setInterval(() => {
      this.bannerQuoteIndex = (this.bannerQuoteIndex + 1) % quotes.length;
      const next = quotes[this.bannerQuoteIndex];
      quoteEl.addClass("ax-banner-quote--fading");
      authorEl.addClass("ax-banner-author--fading");
      window.setTimeout(() => {
        quoteEl.textContent = next.text;
        authorEl.textContent = "\u2014 " + next.source;
        quoteEl.removeClass("ax-banner-quote--fading");
        authorEl.removeClass("ax-banner-author--fading");
      }, 300);
    }, _DashboardView.QUOTE_ROTATION_MS));
  }
  // ==================== Sidebar Components ====================
  /** KPI subtitle data (computed) */
  get kpiSubTexts() {
    return {
      healthClass: this.healthDelta > 0 ? "ax-kpi-up" : this.healthDelta < 0 ? "ax-kpi-down" : "ax-kpi-neutral",
      healthText: this.healthDelta !== 0 ? (this.healthDelta > 0 ? "+" : "") + this.healthDelta + " wk" : "\u6301\u5E73",
      inboxSub: this.inboxCount > 0 ? this.oldestInboxDays + "d oldest" : "clear",
      taskSub: this.tasksToday + " now" + (this.tasksOverdue > 0 ? " \xB7 " + this.tasksOverdue + " overdue" : ""),
      notesSub: this.notesThisMonth > 0 ? "+" + this.notesThisMonth + " mo" : "\u2014"
    };
  }
  /** Sidebar KPI compact bar */
  createSidebarKpiBar() {
    var _a;
    const { healthClass, healthText, inboxSub, taskSub, notesSub } = this.kpiSubTexts;
    const bar = div("ax-sidebar-kpi-bar");
    bar.innerHTML = '<div class="ax-sidebar-kpi-row"><b data-count="' + (((_a = this.stats) == null ? void 0 : _a.totalNotes) || 0) + '">0</b><span>Notes</span><small class="ax-kpi-neutral">' + esc(notesSub) + '</small></div><div class="ax-sidebar-kpi-row"><b data-count="' + this.inboxCount + '">0</b><span>Inbox</span><small class="' + (this.inboxCount > 0 ? "ax-kpi-down" : "ax-kpi-up") + '">' + esc(inboxSub) + '</small></div><div class="ax-sidebar-kpi-row"><b data-count="' + this.taskCompletionPct + '" data-suffix="%">0</b><span>Task</span><small class="ax-kpi-neutral">' + esc(taskSub) + '</small></div><div class="ax-sidebar-kpi-row"><b data-count="' + this.worstHealthScore + '" data-suffix="%">0</b><span>Health</span><small class="' + healthClass + '">' + esc(healthText) + '</small></div><div class="ax-sidebar-sync"><span class="ax-sync-label">SYNC</span><span class="ax-sync-time">' + esc(this.lastSyncTime || "--:--") + "</span></div>";
    const refreshBtn = el("button", { class: "ax-sidebar-refresh", type: "button" });
    refreshBtn.innerHTML = '<span class="ax-refresh-icon"></span>';
    refreshBtn.title = "\u624B\u52A8\u5168\u91CF\u5237\u65B0";
    this.regDom(refreshBtn, "click", () => {
      refreshBtn.addClass("is-loading");
      setTimeout(() => {
        this.refresh();
        refreshBtn.removeClass("is-loading");
      }, 600);
    });
    bar.appendChild(refreshBtn);
    requestAnimationFrame(() => {
      bar.querySelectorAll("[data-count]").forEach((b) => {
        animateCount(b, parseInt(b.dataset.count || "0"), 900, b.dataset.suffix || "");
      });
    });
    return bar;
  }
  /** Sidebar tab navigation */
  createSidebarNav() {
    const nav = div("ax-sidebar-nav");
    this.pages.forEach((page) => {
      const item = el("button", {
        class: "ax-sidebar-nav-item" + (page.id === this.currentPage ? " ax-sidebar-nav-active" : ""),
        "data-page": page.id
      });
      item.innerHTML = '<span class="ax-sidebar-nav-icon">' + icon(page.icon) + '</span><span class="ax-sidebar-nav-label">' + esc(page.label) + "</span>";
      this.regDom(item, "click", () => this.switchPage(page.id));
      nav.appendChild(item);
    });
    return nav;
  }
  /** Sidebar hover-expand + outside-click-collapse behaviour */
  setupSidebarBehavior(sidebar, slimIndicator) {
    const expandOnHover = (e) => {
      if (this.sidebarPinned)
        return;
      if (!sidebar.hasClass("ax-sidebar--collapsed"))
        return;
      e.preventDefault();
      sidebar.removeClass("ax-sidebar--collapsed");
      sidebar.addClass("ax-sidebar--expanded");
      this.sidebarExpanded = true;
    };
    this.regDom(sidebar, "mouseenter", expandOnHover);
    this.regDom(slimIndicator, "mouseenter", expandOnHover);
    const outsideHandler = (e) => {
      if (this.sidebarPinned)
        return;
      if (!this.sidebarExpanded)
        return;
      if (sidebar.contains(e.target))
        return;
      sidebar.removeClass("ax-sidebar--expanded");
      sidebar.addClass("ax-sidebar--collapsed");
      this.sidebarExpanded = false;
    };
    this.regDom(this.containerEl, "click", outsideHandler);
  }
  // ==================== Kanban Sections ====================
  /** KPI Hero Section */
  createKpiSection() {
    var _a, _b;
    const sectionEl = div("ax-section-row ax-section-kpi");
    const hdc = this.healthDelta > 0 ? "ax-kpi-up" : this.healthDelta < 0 ? "ax-kpi-down" : "ax-kpi-neutral";
    const hdt = this.healthDelta ? (this.healthDelta > 0 ? "+" : "") + this.healthDelta + " this week" : "no change";
    const isub = this.inboxCount > 0 ? this.oldestInboxDays + "d oldest" : "all clear";
    const tsub = this.tasksToday + " today" + (this.tasksOverdue > 0 ? ", " + this.tasksOverdue + " overdue" : "");
    const nsub = this.notesThisMonth > 0 ? "+" + this.notesThisMonth + " this month" : "\u2014";
    const header = div("ax-section-header");
    header.innerHTML = '<div class="ax-section-title-wrap"><h3 class="ax-section-title">\u6027\u80FD\u6307\u6807</h3></div><div class="ax-section-header-actions"><span class="ax-live"><i></i>LIVE</span><button class="ax-section-refresh-btn" title="\u5237\u65B0"><span class="ax-refresh-icon"></span></button></div>';
    sectionEl.appendChild(header);
    const kpiGrid = div("ax-kpi-grid");
    kpiGrid.innerHTML = '<div class="ax-kpi-card"><b data-count="' + (((_a = this.stats) == null ? void 0 : _a.totalNotes) || 0) + '">0</b><span class="ax-kpi-label">Notes</span><small class="ax-kpi-sub ax-kpi-neutral">' + esc(nsub) + '</small></div><div class="ax-kpi-card"><b data-count="' + (((_b = this.stats) == null ? void 0 : _b.totalConcepts) || 0) + '">0</b><span class="ax-kpi-label">Concepts</span><small class="ax-kpi-sub ax-kpi-neutral">wiki pages</small></div><div class="ax-kpi-card"><b data-count="' + this.inboxCount + '">0</b><span class="ax-kpi-label">Inbox</span><small class="ax-kpi-sub ' + (this.inboxCount > 0 ? "ax-kpi-down" : "ax-kpi-up") + '">' + esc(isub) + '</small></div><div class="ax-kpi-card"><b data-count="' + this.taskCompletionPct + '" data-suffix="%">0</b><span class="ax-kpi-label">Task Flow</span><small class="ax-kpi-sub ax-kpi-neutral">' + esc(tsub) + '</small></div><div class="ax-kpi-card"><b data-count="' + this.worstHealthScore + '" data-suffix="%">0</b><span class="ax-kpi-label">Health</span><small class="ax-kpi-sub ' + hdc + '">' + esc(hdt) + "</small></div>";
    sectionEl.appendChild(kpiGrid);
    const clockRow = div("ax-kpi-clock-row");
    clockRow.innerHTML = '<div class="ax-clock-compact"><span class="ax-clock-time" id="ax-time">00<em>:</em>00</span><span class="ax-clock-date" id="ax-date"></span></div><div class="ax-header-sync"><span class="ax-sync-label">Last sync</span><span class="ax-sync-time">' + esc(this.lastSyncTime || "--:--") + "</span></div>";
    sectionEl.appendChild(clockRow);
    requestAnimationFrame(() => {
      kpiGrid.querySelectorAll("[data-count]").forEach((b) => {
        animateCount(b, parseInt(b.dataset.count || "0"), 1100, b.dataset.suffix || "");
      });
    });
    const kpiRefreshBtn = header.querySelector(".ax-section-refresh-btn");
    if (kpiRefreshBtn) {
      const btn = kpiRefreshBtn;
      this.regDom(btn, "click", () => {
        btn.addClass("is-loading");
        setTimeout(() => {
          this.refresh();
        }, 600);
      });
    }
    return sectionEl;
  }
  /** Todos Section */
  createTodosSectionSync() {
    const { section: sectionEl, cards: cardsContainer } = this.createSectionScaffold("ax-section-todos", "\u4ECA\u65E5\u5F85\u529E");
    const todoPlaceholder = div("ax-panel");
    cardsContainer.appendChild(todoPlaceholder);
    createTodosPanel(this.app, this.createPanelSection.bind(this)).then((todos) => {
      if (todoPlaceholder.parentNode) {
        todoPlaceholder.parentNode.replaceChild(todos.section, todoPlaceholder);
      }
      if (todos.handle)
        this.composite.add(todos.handle);
    });
    return sectionEl;
  }
  /** Heatmap Section */
  createHeatmapSectionSync() {
    const { section: sectionEl, cards: cardsContainer } = this.createSectionScaffold("ax-section-heatmap", "\u5199\u4F5C\u70ED\u529B\u56FE");
    const { section: hmSection, handle: hmHandle } = createHeatmapPanel(this.app, this.createPanelSection.bind(this), this.vaultHealthData);
    cardsContainer.appendChild(hmSection);
    this.composite.add(hmHandle);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }
  /** Vault Health Section */
  createVaultHealthSection() {
    const { section: sectionEl, cards: cardsContainer } = this.createSectionScaffold("ax-section-vault-health", "Vault Health Overview");
    cardsContainer.addClass("ax-vh-cards-container");
    if (!this.vaultScanner)
      this.vaultScanner = new VaultScanner(this.app);
    const { section: panel, handle: vhHandle } = createVaultHealthPanel(this.app, this.createPanelSection.bind(this));
    cardsContainer.appendChild(panel);
    this.composite.add(vhHandle);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }
  /** Feeds Section */
  createFeedsSection() {
    const sectionEl = div("ax-section-row ax-section-feeds");
    const { section: feedsSection, handle: feedsHandle } = createFeedsPanel(this.app, this.createPanelSection.bind(this));
    sectionEl.appendChild(feedsSection);
    this.composite.add(feedsHandle);
    return sectionEl;
  }
  /** Active Projects Section */
  createProjectsSectionSync() {
    const { section: sectionEl, cards: cardsContainer } = this.createSectionScaffold("ax-section-projects", "\u6D3B\u8DC3\u9879\u76EE");
    const grid = div("ax-project-grid");
    this.plugin.settings.projects.forEach((proj) => {
      const card = el("a", { href: "#", class: "ax-project", "data-path": proj.path });
      card.innerHTML = '<div class="ax-project-cover" style="background:' + esc(proj.gradient) + '"><em>' + esc(proj.emoji) + '</em></div><span class="ax-tag ax-tag-' + esc(proj.priority) + '">' + esc(proj.tag) + "</span><h3>" + esc(proj.name) + "</h3><p>" + esc(proj.description) + '</p><div class="ax-trace">' + esc(proj.trace) + "</div>";
      this.regDom(card, "click", (e) => {
        e.preventDefault();
        this.openPath(proj.path);
      });
      grid.appendChild(card);
    });
    cardsContainer.appendChild(grid);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }
  // ==================== Lazy Content Methods ====================
  // These methods return ONLY the content element (no shell/header).
  // Used by createCardById for lazy rendering.
  /** KPI content (grid + clock) — lazy */
  createKpiContent() {
    var _a, _b;
    const container = div("ax-kpi-lazy-content");
    const hdc = this.healthDelta > 0 ? "ax-kpi-up" : this.healthDelta < 0 ? "ax-kpi-down" : "ax-kpi-neutral";
    const hdt = this.healthDelta ? (this.healthDelta > 0 ? "+" : "") + this.healthDelta + " this week" : "no change";
    const isub = this.inboxCount > 0 ? this.oldestInboxDays + "d oldest" : "all clear";
    const tsub = this.tasksToday + " today" + (this.tasksOverdue > 0 ? ", " + this.tasksOverdue + " overdue" : "");
    const nsub = this.notesThisMonth > 0 ? "+" + this.notesThisMonth + " this month" : "\u2014";
    const kpiGrid = div("ax-kpi-grid");
    kpiGrid.innerHTML = '<div class="ax-kpi-card"><b data-count="' + (((_a = this.stats) == null ? void 0 : _a.totalNotes) || 0) + '">0</b><span class="ax-kpi-label">Notes</span><small class="ax-kpi-sub ax-kpi-neutral">' + esc(nsub) + '</small></div><div class="ax-kpi-card"><b data-count="' + (((_b = this.stats) == null ? void 0 : _b.totalConcepts) || 0) + '">0</b><span class="ax-kpi-label">Concepts</span><small class="ax-kpi-sub ax-kpi-neutral">wiki pages</small></div><div class="ax-kpi-card"><b data-count="' + this.inboxCount + '">0</b><span class="ax-kpi-label">Inbox</span><small class="ax-kpi-sub ' + (this.inboxCount > 0 ? "ax-kpi-down" : "ax-kpi-up") + '">' + esc(isub) + '</small></div><div class="ax-kpi-card"><b data-count="' + this.taskCompletionPct + '" data-suffix="%">0</b><span class="ax-kpi-label">Task Flow</span><small class="ax-kpi-sub ax-kpi-neutral">' + esc(tsub) + '</small></div><div class="ax-kpi-card"><b data-count="' + this.worstHealthScore + '" data-suffix="%">0</b><span class="ax-kpi-label">Health</span><small class="ax-kpi-sub ' + hdc + '">' + esc(hdt) + "</small></div>";
    container.appendChild(kpiGrid);
    const clockRow = div("ax-kpi-clock-row");
    clockRow.innerHTML = '<div class="ax-clock-compact"><span class="ax-clock-time" id="ax-time-lazy">00<em>:</em>00</span><span class="ax-clock-date" id="ax-date-lazy"></span></div><div class="ax-header-sync"><span class="ax-sync-label">Last sync</span><span class="ax-sync-time">' + esc(this.lastSyncTime || "--:--") + "</span></div>";
    container.appendChild(clockRow);
    requestAnimationFrame(() => {
      kpiGrid.querySelectorAll("[data-count]").forEach((b) => {
        animateCount(b, parseInt(b.dataset.count || "0"), 1100, b.dataset.suffix || "");
      });
    });
    return container;
  }
  /** Todos content — lazy */
  createTodosContent() {
    const container = div("ax-todos-lazy-content");
    const todoPlaceholder = div("ax-panel");
    container.appendChild(todoPlaceholder);
    createTodosPanel(this.app, this.createPanelSection.bind(this)).then((todos) => {
      if (todoPlaceholder.parentNode) {
        todoPlaceholder.parentNode.replaceChild(todos.section, todoPlaceholder);
      }
      if (todos.handle)
        this.composite.add(todos.handle);
    });
    return container;
  }
  /** Heatmap content — lazy, Canvas-based */
  createHeatmapContent() {
    const container = div("ax-heatmap-lazy-content");
    const { section: hmSection, handle: hmHandle } = createHeatmapPanel(this.app, this.createPanelSection.bind(this), this.vaultHealthData);
    container.appendChild(hmSection);
    this.composite.add(hmHandle);
    return container;
  }
  /** Vault Health content — lazy */
  createVaultHealthContent() {
    const container = div("ax-vh-lazy-content");
    container.addClass("ax-vh-cards-container");
    if (!this.vaultScanner)
      this.vaultScanner = new VaultScanner(this.app);
    const { section: panel, handle: vhHandle } = createVaultHealthPanel(this.app, this.createPanelSection.bind(this));
    container.appendChild(panel);
    this.composite.add(vhHandle);
    return container;
  }
  /** Feeds content — lazy */
  createFeedsContent() {
    const container = div("ax-feeds-lazy-content");
    const { section: feedsSection, handle: feedsHandle } = createFeedsPanel(this.app, this.createPanelSection.bind(this));
    container.appendChild(feedsSection);
    this.composite.add(feedsHandle);
    return container;
  }
  /** Projects content — lazy */
  createProjectsContent() {
    const container = div("ax-projects-lazy-content");
    const grid = div("ax-project-grid");
    this.plugin.settings.projects.forEach((proj) => {
      const card = el("a", { href: "#", class: "ax-project", "data-path": proj.path });
      card.innerHTML = '<div class="ax-project-cover" style="background:' + esc(proj.gradient) + '"><em>' + esc(proj.emoji) + '</em></div><span class="ax-tag ax-tag-' + esc(proj.priority) + '">' + esc(proj.tag) + "</span><h3>" + esc(proj.name) + "</h3><p>" + esc(proj.description) + '</p><div class="ax-trace">' + esc(proj.trace) + "</div>";
      this.regDom(card, "click", (e) => {
        e.preventDefault();
        this.openPath(proj.path);
      });
      grid.appendChild(card);
    });
    container.appendChild(grid);
    return container;
  }
  /** Recent files content — lazy */
  createRecentFilesContent() {
    const container = div("ax-recent-lazy-content");
    const list = div("ax-recent-list");
    const files = getRecentFiles(this.app, 8);
    files.forEach((file) => {
      const item = el("a", { href: "#", class: "ax-recent-item", "data-path": file.path });
      const date = new Date(file.stat.mtime);
      const dateStr = date.getMonth() + 1 + "/" + date.getDate() + " " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
      item.innerHTML = '<span class="ax-recent-name">' + esc(file.basename) + '</span><span class="ax-recent-date">' + esc(dateStr) + "</span>";
      this.regDom(item, "click", (e) => {
        e.preventDefault();
        this.openPath(file.path);
      });
      list.appendChild(item);
    });
    container.appendChild(list);
    return container;
  }
  /** Recent Files Section */
  createRecentFilesSection() {
    const { section: sectionEl, cards: cardsContainer } = this.createSectionScaffold("ax-section-recent", "\u6700\u8FD1\u7F16\u8F91");
    const list = div("ax-recent-list");
    const files = getRecentFiles(this.app, 8);
    files.forEach((file) => {
      const item = el("a", { href: "#", class: "ax-recent-item", "data-path": file.path });
      const date = new Date(file.stat.mtime);
      const dateStr = date.getMonth() + 1 + "/" + date.getDate() + " " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
      item.innerHTML = '<span class="ax-recent-name">' + esc(file.basename) + '</span><span class="ax-recent-date">' + esc(dateStr) + "</span>";
      this.regDom(item, "click", (e) => {
        e.preventDefault();
        this.openPath(file.path);
      });
      list.appendChild(item);
    });
    cardsContainer.appendChild(list);
    sectionEl.appendChild(cardsContainer);
    return sectionEl;
  }
  // ==================== Full-Page Sections ====================
  /** Vault overview page */
  createVaultSection() {
    var _a;
    const sectionEl = div("ax-section-row ax-section-vault");
    const distSection = this.createPanelSection(
      "\u77E5\u8BC6\u5E93\u5206\u5E03",
      "#34D399",
      "\u5171 " + (((_a = this.stats) == null ? void 0 : _a.totalNotes) || 0) + " \u7BC7"
    );
    const bars = div("ax-barchart");
    if (this.stats) {
      const maxVal = Math.max(1, ...this.stats.wikis.map((w) => w.total));
      this.stats.wikis.forEach((wiki) => {
        const row = el("div", { class: "ax-barrow", "data-path": wiki.indexPage });
        row.innerHTML = '<span class="ax-bt">' + esc(wiki.icon) + " " + esc(wiki.name) + '</span><span class="ax-bwrap"><i style="--bc1:' + esc(wiki.color) + ";--bc2:" + esc(this.lightenColor(wiki.color)) + '" data-width="' + (wiki.total / maxVal * 100).toFixed(1) + '%"></i></span><span class="ax-bn">' + wiki.total + "</span>";
        this.regDom(row, "click", () => this.openPath(wiki.indexPage));
        row.style.cursor = "pointer";
        bars.appendChild(row);
      });
    }
    distSection.appendChild(bars);
    sectionEl.appendChild(distSection);
    const healthSection = this.createPanelSection("Wiki \u5065\u5EB7\u5EA6", "#A78BFA", "");
    const content = div("ax-health");
    if (this.stats) {
      this.stats.wikis.forEach((wiki) => {
        const row = div("ax-health-row");
        row.innerHTML = '<span class="ax-health-icon">' + esc(wiki.icon) + '</span><span class="ax-health-name">' + esc(wiki.name) + '</span><span class="ax-health-score" style="color:' + esc(wiki.color) + '">' + wiki.healthScore + "%</span>";
        content.appendChild(row);
      });
    }
    healthSection.appendChild(content);
    sectionEl.appendChild(healthSection);
    return sectionEl;
  }
  /** Graph page */
  createGraphSection() {
    var _a, _b, _c;
    const sectionEl = div("ax-section-row ax-section-graph");
    const totalLinks = (_b = (_a = this.stats) == null ? void 0 : _a.totalLinks) != null ? _b : 0;
    const panel = this.createPanelSection(
      "\u77E5\u8BC6\u56FE\u8C31",
      "#F59E0B",
      (((_c = this.stats) == null ? void 0 : _c.totalNotes) || 0) + " \u4E2A\u8282\u70B9 \xB7 " + totalLinks + " \u6761\u8FDE\u63A5"
    );
    const graphContainer = div("ax-graph-container");
    graphContainer.style.cssText = "min-height:400px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.85rem;";
    graphContainer.textContent = "Knowledge graph visualization \u2014 integrate with Obsidian graph view or external renderer";
    panel.appendChild(graphContainer);
    sectionEl.appendChild(panel);
    return sectionEl;
  }
  // ==================== Shared Scaffolding ====================
  /** Create a section row with header and content area */
  createSectionScaffold(className, title) {
    const section = div("ax-section-row " + className);
    const header = div("ax-section-header");
    header.innerHTML = '<div class="ax-section-title-wrap"><h3 class="ax-section-title">' + esc(title) + '</h3></div><div class="ax-section-header-actions"></div>';
    section.appendChild(header);
    const cards = div("ax-section-cards");
    section.appendChild(cards);
    return { section, cards };
  }
  /** Create a styled panel container (used by widget factories) */
  createPanelSection(title, color, subtitle) {
    const panel = div("ax-panel");
    panel.style.setProperty("--ax-accent", color);
    const header = div("ax-panel-header");
    header.innerHTML = '<h4 class="ax-panel-title">' + esc(title) + "</h4>" + (subtitle ? '<span class="ax-panel-sub">' + esc(subtitle) + "</span>" : "");
    panel.appendChild(header);
    return panel;
  }
  createFooter() {
    const footer = div("ax-footer");
    footer.innerHTML = '<span class="ax-footer-text">Axlumen Dashboard \xB7 Agent-First Vault Intelligence</span>';
    return footer;
  }
  // ==================== Utilities ====================
  startClock() {
    if (this.clockInterval)
      window.clearInterval(this.clockInterval);
    const update = () => {
      const now = /* @__PURE__ */ new Date();
      const timeEl = this.containerEl.querySelector("#ax-time");
      const dateEl = this.containerEl.querySelector("#ax-date");
      if (timeEl) {
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        timeEl.innerHTML = h + "<em>:</em>" + m;
      }
      if (dateEl) {
        const days = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];
        dateEl.textContent = now.getMonth() + 1 + "/" + now.getDate() + " \u5468" + days[now.getDay()];
      }
    };
    update();
    this.clockInterval = window.setInterval(update, CLOCK_INTERVAL_MS);
  }
  showToast(msg) {
    const toast = this.containerEl.querySelector(".ax-toast");
    if (!toast)
      return;
    toast.textContent = msg;
    toast.addClass("ax-toast--visible");
    setTimeout(() => toast.removeClass("ax-toast--visible"), TOAST_DURATION_MS);
  }
  openPath(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) {
      this.app.workspace.openLinkText(path, "", false);
    } else {
      this.showToast("\u672A\u627E\u5230: " + path);
    }
  }
  openGlobalSearch() {
    this.app.commands.executeCommandById("global-search:open");
  }
  lightenColor(hex) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16 & 255) + 40);
    const g = Math.min(255, (num >> 8 & 255) + 40);
    const b = Math.min(255, (num & 255) + 40);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  // ==================== Scan Progress ====================
  updateScanProgress(pct, message) {
    let progressEl = this.containerEl.querySelector(".ax-scan-progress");
    if (!progressEl) {
      progressEl = div("ax-scan-progress");
      progressEl.innerHTML = '<div class="ax-scan-progress-bar"></div><span class="ax-scan-progress-text"></span>';
      const live = this.containerEl.querySelector(".ax-banner-live");
      if (live && live.parentNode) {
        live.parentNode.insertBefore(progressEl, live.nextSibling);
      } else {
        const banner = this.containerEl.querySelector(".ax-banner");
        if (banner)
          banner.appendChild(progressEl);
      }
    }
    const bar = progressEl.querySelector(".ax-scan-progress-bar");
    const text = progressEl.querySelector(".ax-scan-progress-text");
    if (bar)
      bar.style.width = pct + "%";
    if (text && message)
      text.textContent = message;
  }
  clearScanProgress() {
    const progressEl = this.containerEl.querySelector(".ax-scan-progress");
    if (progressEl) {
      progressEl.remove();
    }
  }
  // ==================== KPI Data Computation ====================
  async computeKpiData() {
    var _a;
    const inboxFiles = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith("Inbox/") || f.path.startsWith("inbox/")
    );
    this.inboxCount = inboxFiles.length;
    if (inboxFiles.length > 0) {
      const oldest = Math.min(...inboxFiles.map((f) => f.stat.ctime));
      this.oldestInboxDays = Math.floor((Date.now() - oldest) / MS_PER_DAY);
    } else {
      this.oldestInboxDays = 0;
    }
    let totalTasks = 0;
    let completedTasks = 0;
    const taskFiles = this.app.vault.getMarkdownFiles().filter(
      (f) => f.path.includes("task") || f.path.includes("Task") || f.path.includes("todo") || f.path.includes("Todo")
    );
    for (const file of taskFiles.slice(0, 50)) {
      const content = await this.app.vault.cachedRead(file);
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (/^- $$[ x]$$/.test(trimmed)) {
          totalTasks++;
          if (/^- $$x$$/.test(trimmed))
            completedTasks++;
        }
      }
    }
    this.taskCompletionPct = totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0;
    this.tasksToday = completedTasks;
    this.tasksOverdue = 0;
    this.worstHealthScore = this.vaultHealthData ? Math.round((_a = this.vaultHealthData.healthScore) != null ? _a : 85) : 85;
    this.healthDelta = 0;
    const now = /* @__PURE__ */ new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    this.notesThisMonth = this.app.vault.getMarkdownFiles().filter((f) => f.stat.ctime >= monthStart).length;
    this.lastSyncTime = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  }
  // ==================== Agent Actions ====================
  triggerAgentInboxRoute() {
    if (!this.agentRunner) {
      this.showToast("Agent \u672A\u5C31\u7EEA");
      return;
    }
    this.showToast("\u542F\u52A8 Inbox \u8DEF\u7531...");
    this.agentRunner.run("inbox-route", {}).then(() => this.showToast("Inbox \u8DEF\u7531\u5B8C\u6210")).catch(() => this.showToast("Inbox \u8DEF\u7531\u5931\u8D25"));
  }
};
_DashboardView.QUOTE_ROTATION_MS = 6e4;
var DashboardView = _DashboardView;

// src/main.ts
function deepMerge(defaults, saved) {
  const result = Array.isArray(defaults) ? [...defaults] : { ...defaults };
  for (const key of Object.keys(saved)) {
    const sv = saved[key];
    if (sv === void 0)
      continue;
    const dv = defaults[key];
    if (dv !== null && sv !== null && typeof dv === "object" && typeof sv === "object" && !Array.isArray(dv) && !Array.isArray(sv)) {
      result[key] = deepMerge(dv, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}
var AxlumenDashboardPlugin = class extends import_obsidian12.Plugin {
  constructor() {
    super(...arguments);
    this.statusBarEl = null;
    this._agentRunner = null;
    this._vaultScanner = null;
  }
  /** 共享单例 AgentRunner（贯穿整个插件生命周期） */
  get agentRunner() {
    if (!this._agentRunner)
      this._agentRunner = new AgentRunner(this.app);
    return this._agentRunner;
  }
  /** 共享单例 VaultScanner */
  get vaultScanner() {
    if (!this._vaultScanner)
      this._vaultScanner = new VaultScanner(this.app);
    return this._vaultScanner;
  }
  async onload() {
    await this.loadSettings();
    initLocalStore(this);
    this.agentRunner;
    this.vaultScanner;
    this.registerView(
      VIEW_TYPE_DASHBOARD,
      (leaf) => new DashboardView(leaf, this)
    );
    this.addRibbonIcon("layout-dashboard", "Axlumen Dashboard", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-dashboard",
      name: "\u6253\u5F00 Axlumen Dashboard",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "refresh-dashboard",
      name: "\u5237\u65B0 Dashboard \u6570\u636E",
      callback: () => this.refreshAllDashboards()
    });
    this.addSettingTab(new DashboardSettingTab(this.app, this));
    this.addCommand({
      id: "run-deep-research",
      name: "Agent: Run Deep Research",
      callback: () => this.runWorkflow("deep-research-single")
    });
    this.addCommand({
      id: "run-inbox-routing",
      name: "Agent: Run Inbox Auto-Routing",
      callback: () => this.runWorkflow("inbox-auto-routing")
    });
    this.addCommand({
      id: "run-vault-lint",
      name: "Agent: Trigger Full Vault Lint",
      callback: () => this.runWorkflow("vault-lint-full-scan")
    });
    this.addCommand({
      id: "quick-capture-inbox",
      name: "Quick Capture To Inbox",
      callback: () => this.quickCaptureToInbox()
    });
    this.addCommand({
      id: "clear-all-cache",
      name: "Dashboard: Clear All Cache",
      callback: () => this.clearAllCache()
    });
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("axlumen-status-bar");
    this.updateStatusBar();
    if (this.statusBarEl) {
      this.registerDomEvent(this.statusBarEl, "click", () => {
        this.activateView();
      });
    }
  }
  onunload() {
    var _a;
    (_a = this._agentRunner) == null ? void 0 : _a.dispose();
    flushLocalStore();
    releaseAllWriteLocks();
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    for (const leaf of leaves) {
      if (leaf.view instanceof DashboardView) {
        leaf.view.cleanup();
      }
    }
  }
  async loadSettings() {
    await recoverFromTmp(this.app.vault, "data.json");
    let saved = null;
    try {
      const raw = await safeRead(this.app.vault, "data.json");
      if (raw) {
        saved = JSON.parse(raw);
      }
    } catch (e) {
      console.error("[Axlumen] data.json \u635F\u574F\uFF0C\u5C1D\u8BD5\u4ECE\u5907\u4EFD\u6062\u590D:", e);
    }
    if (!saved) {
      try {
        const restored = await restoreFromBackup(this.app.vault, "data.json");
        if (restored) {
          const raw = await safeRead(this.app.vault, "data.json");
          if (raw) {
            saved = JSON.parse(raw);
          }
        }
      } catch (e) {
        console.error("[Axlumen] .bak \u4E5F\u635F\u574F\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u914D\u7F6E:", e);
      }
    }
    this.settings = saved ? deepMerge(DEFAULT_SETTINGS, saved) : { ...DEFAULT_SETTINGS };
  }
  async saveSettings() {
    const lock = getWriteLock("data.json");
    await lock.acquire(async () => {
      await atomicWrite(this.app.vault, "data.json", JSON.stringify(this.settings, null, 2));
      await createBackup(this.app.vault, "data.json");
    });
    this.refreshAllDashboards();
  }
  /** 刷新所有打开的 Dashboard 视图 */
  refreshAllDashboards() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    for (const leaf of leaves) {
      if (leaf.view instanceof DashboardView) {
        leaf.view.refresh();
      }
    }
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf("tab");
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_DASHBOARD,
          active: true
        });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  // ==================== P6: 命令处理辅助方法 ====================
  runWorkflow(workflowId) {
    this.agentRunner.run(workflowId).catch(() => {
    });
    this.activateView();
  }
  async quickCaptureToInboxPromise() {
    try {
      const now = /* @__PURE__ */ new Date();
      const today = now.toISOString().slice(0, 10);
      const fileName = `Inbox/${today}-quick-capture-${Date.now().toString(36)}.md`;
      const content = `---
created: ${today}
status: inbox
---

`;
      await this.app.vault.create(fileName, content);
      await this.app.workspace.openLinkText(fileName, "", "tab");
    } catch (e) {
      console.warn("[Axlumen] Quick Capture \u5931\u8D25:", e.message);
    }
  }
  quickCaptureToInbox() {
    this.quickCaptureToInboxPromise().catch(() => {
    });
  }
  async clearAllCachePromise() {
    const cacheFiles = [
      "dashboard/cache/agent-runs.json",
      "dashboard/cache/vault-health.json",
      "dashboard/cache/feeds-cache.json"
    ];
    await Promise.all(cacheFiles.map(async (path) => {
      try {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file)
          await this.app.vault.delete(file);
      } catch (e) {
      }
    }));
  }
  clearAllCache() {
    this.clearAllCachePromise().then(() => {
      this.refreshAllDashboards();
      this.updateStatusBar();
    }).catch(() => {
    });
  }
  // ==================== P6: 状态栏更新 ====================
  updateStatusBar() {
    if (!this.statusBarEl)
      return;
    this.statusBarEl.empty();
    const dot = this.statusBarEl.createDiv({ cls: "axlumen-sb-dot axlumen-sb-dot--idle" });
    dot.title = "Axlumen Dashboard";
    this.vaultScanner.scanFullVault().then((result) => {
      var _a;
      if (result.ok) {
        const count = ((_a = result.value.inboxFiles) == null ? void 0 : _a.length) || 0;
        if (count > 0) {
          const badge = this.statusBarEl.createSpan({ cls: "axlumen-sb-badge", text: String(count) });
          badge.title = count + " unprocessed inbox items";
        }
      }
    }).catch(() => {
    });
    this.statusBarEl.addClass("axlumen-sb-clickable");
  }
};
