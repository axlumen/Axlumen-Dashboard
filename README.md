# Axlumen Dashboard v2.0

个人高密度工作台 Obsidian 插件 — 三 Wiki 统计、Kanban 卡片、Agent 状态监控、多源信息流、自动化任务路由。

![Obsidian](https://img.shields.io/badge/Obsidian-1.5.0+-7C3AED?logo=obsidian&logoColor=white)
![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Desktop Only](https://img.shields.io/badge/desktop-only-orange)
![License](https://img.shields.io/badge/license-MIT-green)

> 个人工作台，不是营销页面。效率 > 美观。

---

## 界面布局

```text
┌─────────────────────────────────────────────────┐
│  Banner (品牌 + 焦点 + 实时脉冲 + 金句轮播)       │
├──────┬──────────────────────────────────────────┤
│ Side │  内容区 (Kanban 滚动)                     │
│ bar  │  待办 · 热力图 · 工作流 · Vault 健康 · Feeds │
│      │  活跃项目 · 最近编辑 · Inbox Router        │
│      │  周历 · Agent 状态                         │
├──────┴──────────────────────────────────────────┤
│  底部状态栏 (Inbox 计数 + Agent 显示)              │
└─────────────────────────────────────────────────┘
```

三页面切换：**总览 / 全库视图 / 知识图谱**

---

## 核心模块

### 📊 Kanban 卡片（总览页）

| 卡片 | 说明 |
|------|------|
| KPI | Inbox 计数、任务完成率、Vault 评分、本月笔记数、今日完成数、过期数 |
| Todos | 待办清单 + 进度条，持久到 `.axlumen-todos.json` |
| Heatmap | 90 天写作热力图（类 GitHub 贡献图） |
| Workflows | 自动化任务路由（Agent Runner） |
| Vault Health | 全局索引覆盖率 · 目录结构 · 内容新鲜度 · 日志完整性（满分 100） |
| Feeds | 多源信息聚合 |
| Projects | 活跃项目卡片 |
| Recent | 最近编辑文件 |
| Inbox Router | 智能 inbox 分类 |
| Week Calendar | 当前周视图 |
| Agent Status | Agent 完成状态叠加层 |

每个卡片支持：**折叠 + 拖拽排序 + 持久化布局**

### 🤖 Agent 系统

- **AgentRunner** — 共享单例，贯穿插件运行期
- **Claude Code CLI 直连** — 内置 `claudeCode.ts` 队列调度
- **TaskStore** — Agent 任务持久化
- **P5 自动化引擎** — 定时 / 阈值规则 + `on_startup` 触发
- **工作流命令** — `Agent: Run Deep Research`、`Agent: Run Inbox Auto-Routing`、`Agent: Trigger Full Vault Lint`

### 🔧 服务层

| 文件 | 职责 |
|------|------|
| `agent/AgentRunner.ts` | 共享 Agent 运行器 |
| `agent/claudeCode.ts` | Claude Code CLI 调度 |
| `agent/taskStore.ts` | 任务持久化存储 |
| `services/VaultScanner.ts` | Vault 全量扫描 + 统计 |
| `services/AutomationEngine.ts` | 自动化规则引擎 |
| `services/PluginIntegrations.ts` | Templater / Dataview / Calendar 等第三方插件集成 |

### 🧰 Widgets 组件

| Widget | 说明 |
|--------|------|
| `todos` | 待办清单面板 |
| `countdown` | 多倒计时 |
| `heatmap` | 写作热力图 |
| `inbox` | Inbox 扫描 + 入库 ingest prompt |
| `inboxRouter` | Inbox AI 自动路由 |
| `feeds` | 多源信息流 |
| `workflows` | 自动化路由规则 UI |
| `vaultHealth` | 健康度评分面板 |
| `weekCalendar` | 周历组件 |
| `agentStatus` | Agent 状态叠加层 |
| `activeTaskBar` | 活跃任务进度条 |

### 📝 Prompt 模板 (`src/prompts.ts`)

| Prompt 函数 | 用途 | 使用场景 |
|-------------|------|----------|
| `buildIngestPrompt(content)` | 一键入库：清洗 raw → 编译 Wiki 页面 | Inbox Auto-Routing 工作流、Quick Capture 入库 |
| `buildQueryPrompt(content)` | 一键查询：基于知识库回答用户问题 | Deep Research 工作流、命令面板查询 |

Prompt 工作流：
- **Inbox Auto-Routing** — 调用 `buildIngestPrompt`，将 Inbox 中的 raw 文件清洗并分类到 tech-wiki / finance-wiki / Axlumen-wiki
- **Deep Research** — 调用 `buildQueryPrompt`，基于三 Wiki 内容回答研究问题
- **Full Vault Lint** — 独立 prompt（硬编码在 AgentRunner 工作流模板中），检查 Wiki 结构完整性

用户自定义：Prompt 模板定义在 `src/prompts.ts` 中，修改源码即可自定义。工作流模板文件位于 Vault 的 `dashboard/workflows/` 目录，可通过插件 UI 编辑。

---

## 安装

```bash
# 从源码构建
git clone <repo-url> .obsidian/plugins/axlumen-dashboard
cd axlumen-dashboard
npm install
npm run build
# 然后到 Obsidian 设置 → 第三方插件 → 启用 Axlumen Dashboard

# 开发模式（热更新）
npm run dev
```

产出品三件套：`main.js`、`manifest.json`、`styles.css`

---

## 命令面板 (`Ctrl/Cmd + P`)

| 命令 | 功能 |
|------|------|
| `打开 Axlumen Dashboard` | 打开主视图 |
| `刷新 Dashboard 数据` | 强制重新扫描 |
| `Agent: Run Deep Research` | 启动深度研究工作流 |
| `Agent: Run Inbox Auto-Routing` | 启动 Inbox AI 路由 |
| `Agent: Trigger Full Vault Lint` | 触发全库-lint |
| `Quick Capture To Inbox` | 快速入箱 |
| `Dashboard: Clear All Cache` | 清理所有缓存 |

底部状态栏微件实时显示 Inbox 未处理数；点击状态栏可打开面板。

---

## 配置

插件设置面板（`设置 → 社区插件 → Axlumen Dashboard · 设置`）：

| 配置项 | 说明 |
|--------|------|
| 品牌名称 / 标语 | Banner Hero 区显示 |
| 倒计时 | 多组，每组可设日期 + 标签 |
| Wiki 配置 | 每个 Wiki 的根目录 + 入口页面路径 |
| Hoppscotch 风格 | Toggle 切换 REST Client 模式 |
| Agent Runner | `CLAUDE_CODE_HEADLESS` 路径、并发数 |
| 自动化规则 | 支持 `schedule` / `inbox-threshold` / `on-startup` / `event-driven` 触发 |

活跃项目通过 `data.json` 配置。

---

## 目录结构

```text
src/
├── main.ts                       # 插件入口、生命周期、共享单例
├── view.ts                       # 主视图 (Banner + Sidebar + Kanban)
├── scanner.ts                    # Vault 扫描器（兼容层，委托 VaultScanner）
├── settings.ts                   # 设置面板
├── types.ts                      # 类型定义
├── constants.ts                  # 全局常量
├── prompts.ts                    # Prompt 模板（Ingest / Query / Lint）
├── utils/
│   ├── dom.ts                    # DOM 工具 (el / div / esc / animateCount)
│   ├── animate.ts                # 入场动效
│   ├── debounce.ts               # 防抖
│   ├── dialog.ts, modal.ts       # 弹窗系统
│   └── LocalStore.ts             # 本地轻量 UI 状态存储
├── agent/
│   ├── AgentRunner.ts            # 共享 Agent 运行器
│   ├── claudeCode.ts             # Claude Code CLI 队列调度
│   └── taskStore.ts              # Agent 任务持久化
├── services/
│   ├── VaultScanner.ts           # Vault 全量扫描服务
│   ├── AutomationEngine.ts       # 自动化规则引擎
│   ├── PluginIntegrations.ts     # 第三方插件集成
│   └── taskParser.ts             # 任务解析服务
└── widgets/
    ├── todos.ts                  # 待办清单
    ├── countdown.ts              # 倒计时
    ├── heatmap.ts                # 热力图
    ├── inbox.ts                  # Inbox + ingest prompt
    ├── inboxRouter.ts            # Inbox AI 路由
    ├── feeds.ts                  # 信息流
    ├── workflows.ts              # 自动化路由 UI
    ├── vaultHealth.ts            # Vault 健康度
    ├── weekCalendar.ts           # 周历
    ├── agentStatus.ts            # Agent 状态
    └── activeTaskBar.ts          # 活跃任务进度条
```

---

## Development

### 环境要求

- Node.js >= 18
- npm

### 本地开发

```bash
# 安装依赖
npm install

# 启动 watch 模式（esbuild 实时编译）
npm run dev
```

`npm run dev` 启动 esbuild 的 `watch` 模式：修改 `src/` 下任意 `.ts` 文件后，esbuild 自动重新打包 `main.js`（带 inline sourcemap）。

**热更新流程**：将项目目录直接放在 Vault 的 `.obsidian/plugins/axlumen-dashboard/` 下，或在 Obsidian 中按 `Ctrl/Cmd + R` 刷新即可加载最新代码。

### 代码规范

- TypeScript（`noImplicitAny` + `strictNullChecks`）
- esbuild 打包，`target: es2018`，`format: cjs`
- 无第三方运行时依赖，仅 `obsidian` 作为 external

### 构建

```bash
# 生产构建（minify，无 sourcemap）
npm run build
```

构建产出三件套：
- `main.js` — 插件入口（esbuild bundle）
- `manifest.json` — Obsidian 插件清单
- `styles.css` — 样式表

发布时将这三个文件复制到 Obsidian Vault 的 `.obsidian/plugins/axlumen-dashboard/` 目录。

---

## FAQ / Troubleshooting

**Q: Claude Code CLI 如何配置？**

A: 在插件设置中填入 `claude` 可执行文件的完整路径（如 `/usr/local/bin/claude` 或 Windows 下的完整路径）。默认值为 `claude`（假设已在 PATH 中）。如果 Agent 命令报错，检查路径是否正确以及 CLI 是否已安装。

**Q: 大 Vault（10,000+ 笔记）性能如何？**

A: VaultScanner 采用增量扫描策略：首次全量扫描后，后续仅处理变更文件（通过 vault 事件监听 create/modify/delete）。热力图等 Widget 使用懒渲染（IntersectionObserver），只在进入可视区域时才渲染。首次打开可能有 1-2 秒延迟，后续秒开。

**Q: 与 Dataview / Templater 冲突吗？**

A: 不冲突。插件通过 `PluginIntegrations.ts` 适配层检测第三方插件是否安装，所有联动均为可选。Dataview 集成用于读取 frontmatter 数据，Templater 集成用于填充模板——两者均在未安装时自动隐藏相关功能，不会报错。

**Q: 支持移动端吗？**

A: 不支持。`manifest.json` 已声明 `isDesktopOnly: true`，插件依赖桌面端 API（Ribbon 图标、CLI 调用等）。移动端 Obsidian 无法加载此插件。

**Q: 待办数据存在哪里？**

A: 待办数据存储在 Vault 内的 `_axlumen/todos.json`（YAML frontmatter 格式），可被 Obsidian Sync 同步到其他设备。旧路径 `.axlumen-todos.json` 已自动迁移。

**Q: 自动化规则如何工作？**

A: 规则引擎支持四种触发方式：定时（cron）、Inbox 阈值、插件启动时、Vault 事件驱动。规则通过 `data.json` 持久化，可在插件设置的自动化规则面板中管理。

---

## 兼容性

- **平台**：Desktop only (Ribbon 图标依赖桌面端 API，manifest 已声明 `isDesktopOnly: true`)
- **Obsidian**：>= 1.5.0
- **依赖**：仅 `@types/node`、`esbuild`、`typescript`、`obsidian`（无第三方运行时依赖）

---

## License

MIT
