# Axlumen Dashboard 布局重构设计规格

## [S1] 项目概述

### 目标
将 Axlumen Dashboard 的布局从当前的 Kanban 风格重构为复刻 Apex Dashboard 的视觉排版样式，同时保留 Axlumen 独有的 AI Agent 集成、Vault 分析、Inbox 系统和 Feeds 功能。

### 范围
- 仅支持桌面端（不支持移动端）
- 复刻 Apex Dashboard 的网格布局、侧边栏结构和交互方式
- 保留 Axlumen 的 4 个核心特色功能
- Banner 区域保持现有设计不变

---

## [S2] 整体架构

### 页面结构
```
┌─────────────────────────────────────────────────────────────────┐
│                        Banner 区域 (保持现有设计)                │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│    Sidebar   │                    Main Content                  │
│   (240px)    │              (网格布局，自适应宽度)               │
│              │                                                  │
├──────────────┼──────────────────────────────────────────────────┤
│ - Nav        │  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ - Quick Act  │  │ Card 1  │ │ Card 2  │ │ Card 3  │            │
│ - Pomodoro   │  └─────────┘ └─────────┘ └─────────┘            │
│ - Weather    │  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ - Heatmap    │  │ Card 4  │ │ Card 5  │ │ Card 6  │            │
│ - Countdown  │  └─────────┘ └─────────┘ └─────────┘            │
│ - Agent      │                                                  │
│ - Inbox      │                                                  │
│ - Feeds      │                                                  │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## [S3] 网格布局系统

### 布局规则
- 使用 CSS Grid 实现响应式网格
- 卡片支持 1x1、2x1、1x2、2x2 四种尺寸
- 默认列数：3 列（可根据窗口宽度调整为 2 或 4 列）
- 卡片间距：16px
- 卡片可拖拽调整位置和大小

### 卡片尺寸映射
```css
.ax-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 16px;
}

.ax-card[data-span="2"] {
  grid-column: span 2;
}

.ax-card[data-height="2"] {
  grid-row: span 2;
}
```

---

## [S4] 侧边栏设计

### 结构
```
┌────────────────────────────┐
│  Brand + Theme Toggle      │
├────────────────────────────┤
│  Navigation (Tabs)         │
│  - 总览                     │
│  - 任务                     │
│  - 日历                     │
├────────────────────────────┤
│  Quick Actions             │
│  - 新建日记                 │
│  - 深度调研                 │
│  - 刷新 RSS                │
├────────────────────────────┤
│  Pomodoro Timer            │
│  [开始] [暂停] [停止]       │
├────────────────────────────┤
│  Weather Widget            │
│  🌤️ 25°C 晴               │
├────────────────────────────┤
│  Heatmap Widget            │
│  [贡献热力图]               │
├────────────────────────────┤
│  Countdown Widget          │
│  ⏰ 距离 deadline 还有 3 天 │
├────────────────────────────┤
│  Agent & Workflows         │
│  - Agent 状态               │
│  - Workflow 列表            │
├────────────────────────────┤
│  Inbox Router              │
│  - 待处理文件               │
├────────────────────────────┤
│  Feeds                     │
│  - RSS 订阅源               │
└────────────────────────────┘
```

### 交互
- 侧边栏可固定（Pin）或自动收起
- 鼠标悬停时展开，移出后收起（可配置）
- 宽度固定 240px，不可拖拽调整

---

## [S5] Banner 区域

### 保持现有设计
- 品牌标识（Brand Name + Tagline）
- 引用轮播（Quote Rotation）
- 主题切换按钮
- 折叠/展开功能

### 不变更
- 不移除每日摘要（Daily Summary）
- 不移除状态指示器（Status Indicator）
- 不移除焦点选择器（Focus Selector）

---

## [S6] 交互系统

### 拖拽排序
- 卡片支持拖拽调整顺序
- 拖拽时显示占位符
- 松手后自动保存布局

### 折叠展开
- 每个 Section 支持折叠/展开
- 折叠状态持久化到 LocalStorage
- 折叠动画使用 CSS transition

### 卡片操作
- 悬停显示操作按钮（编辑、删除、调整大小）
- 右键菜单支持更多操作
- 双击卡片标题可重命名

---

## [S7] 卡片类型系统

### 标准卡片（复刻 Apex）
| 卡片类型 | 说明 | 布局 |
|---------|------|------|
| Memo | 快速笔记，支持 wikilink | 文本区域 |
| Todo | 任务列表，支持拖拽排序 | 列表 + 进度条 |
| Projects | 项目卡片，支持封面图 | 网格/列表 |
| Notes | 文档列表，紧凑布局 | 列表 |

### Axlumen 特色卡片
| 卡片类型 | 说明 | 布局 |
|---------|------|------|
| Agent Status | Agent 运行状态 | 状态面板 |
| Workflows | 自动化工作流 | 列表 |
| Inbox | 收件箱待处理文件 | 列表 |
| Feeds | RSS 信息流 | 列表 |
| Vault Health | Vault 健康度分析 | 统计 + 图表 |

---

## [S8] 侧边栏组件

### 保留的组件
| 组件 | 说明 |
|------|------|
| Weather | 天气信息，Open-Meteo API |
| Heatmap | GitHub 风格贡献热力图 |
| Pomodoro | 番茄钟计时器 |
| Countdown | 倒计时组件 |

### 移除的组件
| 组件 | 原因 |
|------|------|
| Reading Tracker | 用户不需要 |

### Axlumen 特色组件（保留在侧边栏）
| 组件 | 说明 |
|------|------|
| Agent & Workflows | Agent 状态 + 工作流列表 |
| Inbox Router | 收件箱路由 |
| Feeds | RSS 订阅源 |

---

## [S9] 主题系统

### 保留 Axlumen 主题
- 保持现有的 2 个主题（Island、Nordic）
- 不采用 Apex 的 14 个主题

### 主题变量
```css
/* 中性背景 */
--ax-bg: #F5F5F5;
--ax-surface: #FFFFFF;
--ax-surface-2: #F8F8F8;
--ax-surface-3: #F0F0F0;

/* 边框 */
--ax-line: #E8E8E8;
--ax-line-strong: #D0D0D0;

/* 文字 */
--ax-ink: #1A1A1A;
--ax-muted: #6B6B6B;
--ax-faint: #999999;

/* 语义色 */
--ax-blue: #1F6C9F;
--ax-green: #346538;
--ax-amber: #956400;
--ax-rose: #9F2F2D;
```

---

## [S10] Calendar/Tasks 系统

### 采用 Apex 的设计
- All Tasks：聚合所有 checkbox 任务
- Calendar：月视图日历，显示任务分布
- 支持任务分组（按日期、优先级）
- 支持看板视图切换

### 任务来源
- 扫描 vault 中的 markdown 文件
- 识别 `[ ]` checkbox
- 读取 `⏰`、`[due::]`、`📅` 日期
- 读取 `[priority::]` 优先级

---

## [S11] 数据持久化

### 布局状态
```typescript
interface LayoutState {
  cardOrder: string[];        // 卡片顺序
  cardSizes: Record<string, { // 卡片尺寸
    span: 1 | 2;
    height: 1 | 2;
  }>;
  collapsedSections: string[]; // 折叠的 Section
  sectionHeights: Record<string, number>; // Section 高度
}
```

### 存储位置
- 使用 LocalStorage（现有 LocalStore）
- 不依赖 vault 文件

---

## [S12] 实现优先级

### Phase 1：基础框架
1. 实现 CSS Grid 布局系统
2. 重构侧边栏结构
3. 实现拖拽排序

### Phase 2：卡片系统
4. 实现 Memo 卡片
5. 实现 Todo 卡片
6. 实现 Projects 卡片
7. 实现 Notes 卡片

### Phase 3：特色功能
8. 集成 AI Agent
9. 集成 Vault 分析
10. 集成 Inbox
11. 集成 Feeds

### Phase 4：侧边栏组件
12. 实现 Weather 组件
13. 实现 Heatmap 组件
14. 实现 Pomodoro 组件
15. 实现 Countdown 组件

### Phase 5：Calendar/Tasks
16. 实现 All Tasks
17. 实现 Calendar

---

## [S13] 验证标准

### 视觉验证
- [ ] 整体布局与 Apex Dashboard 一致
- [ ] 卡片排列符合网格系统
- [ ] 侧边栏结构正确
- [ ] 主题应用正确

### 功能验证
- [ ] 拖拽排序正常工作
- [ ] 折叠展开状态持久化
- [ ] 卡片尺寸调整正常
- [ ] 所有 Axlumen 功能正常

### 性能验证
- [ ] 首屏加载 < 500ms
- [ ] 拖拽操作流畅
- [ ] 内存占用合理

---

## [S14] 风险与约束

### 风险
1. 大规模重构可能导致回归 bug
2. 卡片类型迁移可能丢失用户数据
3. 网格布局可能影响现有组件

### 约束
1. 仅支持桌面端
2. 保持现有主题系统
3. Banner 区域不变
