# Axlumen Dashboard 布局重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Axlumen Dashboard 的布局从 Kanban 风格重构为复刻 Apex Dashboard 的视觉排版样式，同时保留 AI Agent、Vault 分析、Inbox、Feeds 等特色功能。

**Architecture:** 使用 CSS Grid 实现响应式网格布局，重构侧边栏结构，实现拖拽排序和折叠展开交互。保留现有主题系统和 Banner 设计。

**Tech Stack:** TypeScript, CSS Grid, Obsidian Plugin API, LocalStorage

## Global Constraints

- 仅支持桌面端（不支持移动端）
- 保持现有主题系统（Island、Nordic）
- Banner 区域保持现有设计不变
- 卡片类型：Memo、Todo、Projects、Notes + Axlumen 特色（Agent、Vault、Inbox、Feeds）
- 侧边栏组件：Weather、Heatmap、Pomodoro、Countdown + Axlumen 特色

---

## Task 1: CSS Grid 布局系统

**Covers:** [S3]

**Files:**
- Modify: `src/styles.css` (添加网格布局样式)
- Modify: `src/view.ts:516-641` (重构 render 方法)

**Interfaces:**
- Consumes: 现有的 CARD_IDS 数组
- Produces: `.ax-grid` 容器，卡片支持 `[data-span]` 和 `[data-height]` 属性

- [ ] **Step 1: 添加网格 CSS 样式**

```css
/* 网格布局 */
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

/* 卡片基础样式 */
.ax-card {
  background: var(--ax-surface);
  border: 1px solid var(--ax-line);
  border-radius: var(--ax-radius);
  overflow: hidden;
  transition: box-shadow 0.15s var(--ax-ease);
}

.ax-card:hover {
  box-shadow: var(--ax-shadow-lift);
}
```

- [ ] **Step 2: 重构 render 方法使用网格**

```typescript
// 在 render() 方法中替换 kanban 相关代码
const grid = div('ax-grid');
grid.setAttribute('data-page', 'overview');

// 渲染卡片
const order = this.getCardOrder();
for (const cardId of order) {
  const card = this.createCardById(cardId);
  if (card) grid.appendChild(card);
}

pageOverview.appendChild(grid);
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/styles.css src/view.ts
git commit -m "feat: implement CSS Grid layout system"
```

---

## Task 2: 侧边栏结构重构

**Covers:** [S4]

**Files:**
- Modify: `src/view.ts:645-729` (renderWidgetSidebar 方法)
- Modify: `src/styles.css` (侧边栏样式)

**Interfaces:**
- Consumes: 现有的 Quick Actions、Agent、Inbox 等组件
- Produces: 新的侧边栏布局结构

- [ ] **Step 1: 添加侧边栏 CSS 样式**

```css
/* 侧边栏布局 */
.ax-sidebar {
  width: 240px;
  min-width: 240px;
  background: var(--ax-surface);
  border-right: 1px solid var(--ax-line);
  display: flex;
  flex-direction: column;
  transition: width 0.2s var(--ax-ease);
}

.ax-sidebar--collapsed {
  width: 48px;
  min-width: 48px;
}

.ax-sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
}

/* 侧边栏导航 */
.ax-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.ax-sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.ax-sidebar-nav-item:hover {
  background: var(--ax-surface-2);
}

.ax-sidebar-nav-active {
  background: var(--ax-blue-bg);
  color: var(--ax-blue);
}
```

- [ ] **Step 2: 重构 renderWidgetSidebar 方法**

```typescript
private async renderWidgetSidebar(sidebar: HTMLElement) {
  const scroll = div('ax-sidebar-scroll');

  // 1. Tab navigation
  scroll.appendChild(this.createSidebarNav());
  scroll.appendChild(div('ax-sidebar-divider'));

  // 2. Quick Actions
  this.initQuickActions();
  scroll.appendChild(this.createSidebarQuickActions());
  scroll.appendChild(div('ax-sidebar-divider'));

  // 3. Pomodoro (if enabled)
  if (this.plugin.settings.pomodoroEnabled) {
    scroll.appendChild(this.createSidebarPomodoro());
    scroll.appendChild(div('ax-sidebar-divider'));
  }

  // 4. Weather (if enabled)
  if (this.plugin.settings.widgetWeatherEnabled) {
    scroll.appendChild(await this.createSidebarWeather());
    scroll.appendChild(div('ax-sidebar-divider'));
  }

  // 5. Heatmap (if enabled)
  if (this.plugin.settings.widgetHeatmapEnabled) {
    scroll.appendChild(this.createSidebarHeatmap());
    scroll.appendChild(div('ax-sidebar-divider'));
  }

  // 6. Countdown (if enabled)
  if (this.plugin.settings.widgetCountdownEnabled) {
    scroll.appendChild(this.createSidebarCountdown());
    scroll.appendChild(div('ax-sidebar-divider'));
  }

  // 7. Agent & Workflows
  scroll.appendChild(await this.createCombinedAgentPanel());
  scroll.appendChild(div('ax-sidebar-divider'));

  // 8. Inbox Router
  scroll.appendChild(await this.createInboxRouterPanel());

  // 9. Feeds
  scroll.appendChild(await this.createFeedsPanel());

  sidebar.appendChild(scroll);
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/view.ts src/styles.css
git commit -m "refactor: restructure sidebar layout"
```

---

## Task 3: 拖拽排序实现

**Covers:** [S6]

**Files:**
- Modify: `src/view.ts:982-1033` (setupSectionDragAndDrop 方法)
- Modify: `src/styles.css` (拖拽样式)

**Interfaces:**
- Consumes: 卡片元素和 ID
- Produces: 拖拽排序功能，布局状态持久化

- [ ] **Step 1: 添加拖拽 CSS 样式**

```css
/* 拖拽状态 */
.ax-card--dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.ax-card--drag-over {
  border: 2px dashed var(--ax-blue);
}

/* 拖拽占位符 */
.ax-card--placeholder {
  background: var(--ax-surface-2);
  border: 2px dashed var(--ax-line);
}
```

- [ ] **Step 2: 实现拖拽排序逻辑**

```typescript
private setupGridDragAndDrop(card: HTMLElement, cardId: string): void {
  card.setAttribute('draggable', 'true');

  this.regDom(card, 'dragstart', (e) => {
    card.addClass('ax-card--dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cardId);
    }
  });

  this.regDom(card, 'dragend', () => {
    card.removeClass('ax-card--dragging');
    document.querySelectorAll('.ax-card--drag-over')
      .forEach(el => el.removeClass('ax-card--drag-over'));
  });

  this.regDom(card, 'dragover', (e) => {
    if (!card.hasClass('ax-card--dragging')) {
      e.preventDefault();
      card.addClass('ax-card--drag-over');
    }
  });

  this.regDom(card, 'dragleave', () => {
    card.removeClass('ax-card--drag-over');
  });

  this.regDom(card, 'drop', (e) => {
    e.preventDefault();
    card.removeClass('ax-card--drag-over');
    const fromId = e.dataTransfer?.getData('text/plain');
    if (!fromId || fromId === cardId) return;

    // 更新卡片顺序
    const order = this.getCardOrder();
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(cardId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newOrder = [...order];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, fromId);
    this.saveCardOrder(newOrder);
    this.refresh();
  });
}
```

- [ ] **Step 3: 在 createCardById 中调用拖拽设置**

```typescript
// 在 createCardById 方法末尾添加
this.setupGridDragAndDrop(shell, cardId);
```

- [ ] **Step 4: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 5: 提交代码**

```bash
git add src/view.ts src/styles.css
git commit -m "feat: implement drag-and-drop sorting"
```

---

## Task 4: 折叠展开功能

**Covers:** [S6]

**Files:**
- Modify: `src/view.ts:938-967` (enhanceCardWithCollapseAndDrag 方法)
- Modify: `src/styles.css` (折叠样式)

**Interfaces:**
- Consumes: 卡片元素和 ID
- Produces: 折叠/展开功能，状态持久化

- [ ] **Step 1: 添加折叠 CSS 样式**

```css
/* 折叠状态 */
.ax-card--collapsed .ax-card-content {
  display: none;
}

.ax-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
}

.ax-card-toggle {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.ax-card--collapsed .ax-card-toggle {
  transform: rotate(-90deg);
}
```

- [ ] **Step 2: 实现折叠展开逻辑**

```typescript
private enhanceCardWithCollapse(card: HTMLElement, cardId: string): void {
  const header = card.querySelector('.ax-card-header') as HTMLElement;
  if (!header) return;

  const toggle = header.querySelector('.ax-card-toggle') as HTMLElement;
  if (!toggle) return;

  // 恢复折叠状态
  const collapseState = this.getCardCollapseState();
  if (collapseState[cardId]) {
    card.addClass('ax-card--collapsed');
  }

  this.regDom(toggle, 'click', (e) => {
    e.stopPropagation();
    const collapsed = card.hasClass('ax-card--collapsed');
    card.toggleClass('ax-card--collapsed', !collapsed);

    // 保存状态
    const state = this.getCardCollapseState();
    state[cardId] = !collapsed;
    this.saveCardCollapseState(state);
  });
}
```

- [ ] **Step 3: 在 createCardById 中调用折叠设置**

```typescript
// 在 createCardById 方法末尾添加
this.enhanceCardWithCollapse(shell, cardId);
```

- [ ] **Step 4: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 5: 提交代码**

```bash
git add src/view.ts src/styles.css
git commit -m "feat: implement collapse/expand functionality"
```

---

## Task 5: Memo 卡片实现

**Covers:** [S7]

**Files:**
- Modify: `src/widgets/memo.ts`
- Modify: `src/styles.css` (Memo 样式)

**Interfaces:**
- Consumes: 现有的 createMemoPanel
- Produces: Memo 卡片，支持 wikilink

- [ ] **Step 1: 添加 Memo CSS 样式**

```css
/* Memo 卡片 */
.ax-memo-card {
  padding: 16px;
}

.ax-memo-textarea {
  width: 100%;
  min-height: 120px;
  border: 1px solid var(--ax-line);
  border-radius: 6px;
  padding: 12px;
  font-family: var(--ax-font);
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
}

.ax-memo-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
```

- [ ] **Step 2: 实现 Memo 卡片组件**

```typescript
export function createMemoCard(
  app: App,
  onCreate: (content: string) => void,
): HTMLElement {
  const card = div('ax-memo-card');

  const textarea = el('textarea', {
    class: 'ax-memo-textarea',
    placeholder: '输入笔记... 支持 [[wikilink]]',
  }) as HTMLTextAreaElement;

  const actions = div('ax-memo-actions');
  const saveBtn = el('button', {
    class: 'ax-btn ax-btn-primary',
  }, '保存');
  saveBtn.addEventListener('click', () => {
    const content = textarea.value.trim();
    if (content) {
      onCreate(content);
      textarea.value = '';
    }
  });

  actions.appendChild(saveBtn);
  card.appendChild(textarea);
  card.appendChild(actions);

  return card;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/widgets/memo.ts src/styles.css
git commit -m "feat: implement Memo card component"
```

---

## Task 6: Todo 卡片实现

**Covers:** [S7]

**Files:**
- Modify: `src/widgets/todos.ts`
- Modify: `src/styles.css` (Todo 样式)

**Interfaces:**
- Consumes: 现有的 createTodosPanel
- Produces: Todo 卡片，支持拖拽排序和进度条

- [ ] **Step 1: 添加 Todo CSS 样式**

```css
/* Todo 卡片 */
.ax-todo-card {
  padding: 16px;
}

.ax-todo-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ax-todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ax-line);
}

.ax-todo-item:last-child {
  border-bottom: none;
}

.ax-todo-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--ax-blue);
}

.ax-todo-text {
  flex: 1;
  font-size: 14px;
}

.ax-todo-text--done {
  text-decoration: line-through;
  color: var(--ax-muted);
}

.ax-todo-progress {
  height: 4px;
  background: var(--ax-surface-2);
  border-radius: 2px;
  margin-top: 12px;
  overflow: hidden;
}

.ax-todo-progress-bar {
  height: 100%;
  background: var(--ax-green);
  transition: width 0.3s;
}
```

- [ ] **Step 2: 实现 Todo 卡片组件**

```typescript
export function createTodoCard(
  tasks: Array<{ id: string; text: string; done: boolean }>,
  onToggle: (id: string, done: boolean) => void,
  onReorder: (fromId: string, toId: string) => void,
): HTMLElement {
  const card = div('ax-todo-card');
  const list = el('ul', { class: 'ax-todo-list' });

  tasks.forEach(task => {
    const item = el('li', { class: 'ax-todo-item' });
    item.setAttribute('draggable', 'true');
    item.setAttribute('data-task-id', task.id);

    const checkbox = el('input', {
      class: 'ax-todo-checkbox',
      type: 'checkbox',
    }) as HTMLInputElement;
    checkbox.checked = task.done;
    checkbox.addEventListener('change', () => {
      onToggle(task.id, checkbox.checked);
      text.classList.toggle('ax-todo-text--done', checkbox.checked);
      updateProgress();
    });

    const text = el('span', {
      class: 'ax-todo-text' + (task.done ? ' ax-todo-text--done' : ''),
    }, task.text);

    item.appendChild(checkbox);
    item.appendChild(text);
    list.appendChild(item);
  });

  // 进度条
  const progress = div('ax-todo-progress');
  const progressBar = div('ax-todo-progress-bar');
  progress.appendChild(progressBar);

  const updateProgress = () => {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    progressBar.style.width = (total > 0 ? (done / total) * 100 : 0) + '%';
  };
  updateProgress();

  card.appendChild(list);
  card.appendChild(progress);

  return card;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/widgets/todos.ts src/styles.css
git commit -m "feat: implement Todo card component"
```

---

## Task 7: Projects 卡片实现

**Covers:** [S7]

**Files:**
- Modify: `src/view.ts` (createProjectsContent 方法)
- Modify: `src/styles.css` (Projects 样式)

**Interfaces:**
- Consumes: 现有的项目数据
- Produces: Projects 卡片，支持封面图

- [ ] **Step 1: 添加 Projects CSS 样式**

```css
/* Projects 卡片 */
.ax-projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.ax-project-card {
  background: var(--ax-surface-2);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.ax-project-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ax-shadow-lift);
}

.ax-project-cover {
  width: 100%;
  height: 120px;
  object-fit: cover;
  background: var(--ax-surface-3);
}

.ax-project-info {
  padding: 12px;
}

.ax-project-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.ax-project-meta {
  font-size: 12px;
  color: var(--ax-muted);
}
```

- [ ] **Step 2: 实现 Projects 卡片组件**

```typescript
export function createProjectsCard(
  projects: Array<{
    name: string;
    path: string;
    cover?: string;
    description?: string;
  }>,
  onOpen: (path: string) => void,
): HTMLElement {
  const card = div('ax-projects-card');
  const grid = div('ax-projects-grid');

  projects.forEach(project => {
    const projectCard = div('ax-project-card');
    projectCard.addEventListener('click', () => onOpen(project.path));

    if (project.cover) {
      const cover = el('img', {
        class: 'ax-project-cover',
        src: project.cover,
      });
      projectCard.appendChild(cover);
    } else {
      const placeholder = div('ax-project-cover');
      projectCard.appendChild(placeholder);
    }

    const info = div('ax-project-info');
    const name = div('ax-project-name', project.name);
    const meta = div('ax-project-meta', project.description || '');

    info.appendChild(name);
    info.appendChild(meta);
    projectCard.appendChild(info);
    grid.appendChild(projectCard);
  });

  card.appendChild(grid);
  return card;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/view.ts src/styles.css
git commit -m "feat: implement Projects card component"
```

---

## Task 8: Notes 卡片实现

**Covers:** [S7]

**Files:**
- Modify: `src/widgets/library.ts`
- Modify: `src/styles.css` (Notes 样式)

**Interfaces:**
- Consumes: 现有的 createLibraryPanel
- Produces: Notes 卡片，紧凑列表布局

- [ ] **Step 1: 添加 Notes CSS 样式**

```css
/* Notes 卡片 */
.ax-notes-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ax-note-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ax-line);
  cursor: pointer;
}

.ax-note-item:last-child {
  border-bottom: none;
}

.ax-note-item:hover {
  background: var(--ax-surface-2);
}

.ax-note-icon {
  width: 16px;
  height: 16px;
  color: var(--ax-muted);
}

.ax-note-name {
  flex: 1;
  font-size: 13px;
}

.ax-note-date {
  font-size: 11px;
  color: var(--ax-faint);
}
```

- [ ] **Step 2: 实现 Notes 卡片组件**

```typescript
export function createNotesCard(
  files: Array<{ name: string; path: string; modified: number }>,
  onOpen: (path: string) => void,
): HTMLElement {
  const card = div('ax-notes-card');
  const list = el('ul', { class: 'ax-notes-list' });

  files.forEach(file => {
    const item = el('li', { class: 'ax-note-item' });
    item.addEventListener('click', () => onOpen(file.path));

    const icon = div('ax-note-icon');
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

    const name = div('ax-note-name', file.name);
    const date = div('ax-note-date', new Date(file.modified).toLocaleDateString());

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(date);
    list.appendChild(item);
  });

  card.appendChild(list);
  return card;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/widgets/library.ts src/styles.css
git commit -m "feat: implement Notes card component"
```

---

## Task 9: Weather 组件实现

**Covers:** [S8]

**Files:**
- Modify: `src/widgets/weather.ts`
- Modify: `src/styles.css` (Weather 样式)

**Interfaces:**
- Consumes: 现有的 WeatherService
- Produces: Weather 侧边栏组件

- [ ] **Step 1: 添加 Weather CSS 样式**

```css
/* Weather 组件 */
.ax-weather {
  padding: 12px;
}

.ax-weather-current {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ax-weather-icon {
  font-size: 32px;
}

.ax-weather-temp {
  font-size: 24px;
  font-weight: 600;
}

.ax-weather-desc {
  font-size: 12px;
  color: var(--ax-muted);
}

.ax-weather-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 12px;
}

.ax-weather-detail {
  display: flex;
  flex-direction: column;
}

.ax-weather-detail-label {
  color: var(--ax-muted);
}

.ax-weather-detail-value {
  font-weight: 500;
}
```

- [ ] **Step 2: 实现 Weather 组件**

```typescript
export function createWeatherWidget(
  weather: {
    temp: number;
    feelsLike: number;
    humidity: number;
    wind: number;
    description: string;
    icon: string;
  },
): HTMLElement {
  const widget = div('ax-weather');

  const current = div('ax-weather-current');
  const icon = div('ax-weather-icon', weather.icon);
  const temp = div('ax-weather-temp', weather.temp + '°C');
  const desc = div('ax-weather-desc', weather.description);

  current.appendChild(icon);
  current.appendChild(temp);
  current.appendChild(desc);

  const details = div('ax-weather-details');
  const feelsLike = div('ax-weather-detail');
  feelsLike.innerHTML = `<span class="ax-weather-detail-label">体感</span><span class="ax-weather-detail-value">${weather.feelsLike}°C</span>`;

  const humidity = div('ax-weather-detail');
  humidity.innerHTML = `<span class="ax-weather-detail-label">湿度</span><span class="ax-weather-detail-value">${weather.humidity}%</span>`;

  const wind = div('ax-weather-detail');
  wind.innerHTML = `<span class="ax-weather-detail-label">风速</span><span class="ax-weather-detail-value">${weather.wind} km/h</span>`;

  details.appendChild(feelsLike);
  details.appendChild(humidity);
  details.appendChild(wind);

  widget.appendChild(current);
  widget.appendChild(details);

  return widget;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/widgets/weather.ts src/styles.css
git commit -m "feat: implement Weather sidebar widget"
```

---

## Task 10: Heatmap 组件实现

**Covers:** [S8]

**Files:**
- Modify: `src/widgets/heatmap.ts` (新建)
- Modify: `src/styles.css` (Heatmap 样式)

**Interfaces:**
- Consumes: vault 文件数据
- Produces: GitHub 风格热力图

- [ ] **Step 1: 添加 Heatmap CSS 样式**

```css
/* Heatmap 组件 */
.ax-heatmap {
  padding: 12px;
}

.ax-heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}

.ax-heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: var(--ax-surface-2);
}

.ax-heatmap-cell--level-1 { background: #9be9a8; }
.ax-heatmap-cell--level-2 { background: #40c463; }
.ax-heatmap-cell--level-3 { background: #30a14e; }
.ax-heatmap-cell--level-4 { background: #216e39; }

.ax-heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--ax-muted);
}
```

- [ ] **Step 2: 实现 Heatmap 组件**

```typescript
export function createHeatmapWidget(
  data: Array<{ date: string; count: number }>,
): HTMLElement {
  const widget = div('ax-heatmap');
  const grid = div('ax-heatmap-grid');

  // 获取最近 90 天的数据
  const days = 90;
  const today = new Date();
  const counts: Record<string, number> = {};

  data.forEach(d => {
    counts[d.date] = d.count;
  });

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = counts[dateStr] || 0;

    const cell = div('ax-heatmap-cell');
    if (count > 0) {
      const level = Math.min(4, Math.ceil(count / 3));
      cell.addClass('ax-heatmap-cell--level-' + level);
    }
    cell.title = dateStr + ': ' + count + ' 次';
    grid.appendChild(cell);
  }

  // 图例
  const legend = div('ax-heatmap-legend');
  legend.innerHTML = '<span>Less</span><div class="ax-heatmap-cell"></div><div class="ax-heatmap-cell ax-heatmap-cell--level-1"></div><div class="ax-heatmap-cell ax-heatmap-cell--level-2"></div><div class="ax-heatmap-cell ax-heatmap-cell--level-3"></div><div class="ax-heatmap-cell ax-heatmap-cell--level-4"></div><span>More</span>';

  widget.appendChild(grid);
  widget.appendChild(legend);

  return widget;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/widgets/heatmap.ts src/styles.css
git commit -m "feat: implement Heatmap sidebar widget"
```

---

## Task 11: Countdown 组件实现

**Covers:** [S8]

**Files:**
- Modify: `src/widgets/countdown.ts` (新建)
- Modify: `src/styles.css` (Countdown 样式)

**Interfaces:**
- Consumes: 目标日期
- Produces: 倒计时组件

- [ ] **Step 1: 添加 Countdown CSS 样式**

```css
/* Countdown 组件 */
.ax-countdown {
  padding: 12px;
  text-align: center;
}

.ax-countdown-label {
  font-size: 12px;
  color: var(--ax-muted);
  margin-bottom: 8px;
}

.ax-countdown-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--ax-blue);
}

.ax-countdown-unit {
  font-size: 12px;
  color: var(--ax-muted);
  margin-left: 4px;
}
```

- [ ] **Step 2: 实现 Countdown 组件**

```typescript
export function createCountdownWidget(
  targetDate: string,
  label: string,
): HTMLElement {
  const widget = div('ax-countdown');

  const labelEl = div('ax-countdown-label', label);
  const valueEl = div('ax-countdown-value');

  const updateCountdown = () => {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) {
      valueEl.textContent = '已到';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const unit = days === 1 ? '天' : '天';
    valueEl.innerHTML = days + '<span class="ax-countdown-unit">' + unit + '</span>';
  };

  updateCountdown();
  setInterval(updateCountdown, 1000 * 60); // 每分钟更新

  widget.appendChild(labelEl);
  widget.appendChild(valueEl);

  return widget;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/widgets/countdown.ts src/styles.css
git commit -m "feat: implement Countdown sidebar widget"
```

---

## Task 12: Calendar/Tasks 系统实现

**Covers:** [S10]

**Files:**
- Modify: `src/widgets/calendar.ts`
- Modify: `src/styles.css` (Calendar 样式)

**Interfaces:**
- Consumes: vault 中的任务数据
- Produces: Calendar 月视图 + All Tasks 列表

- [ ] **Step 1: 添加 Calendar CSS 样式**

```css
/* Calendar 组件 */
.ax-calendar {
  padding: 16px;
}

.ax-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ax-calendar-nav {
  display: flex;
  gap: 8px;
}

.ax-calendar-nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ax-line);
  border-radius: 6px;
  cursor: pointer;
  background: var(--ax-surface);
}

.ax-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.ax-calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
}

.ax-calendar-day:hover {
  background: var(--ax-surface-2);
}

.ax-calendar-day--today {
  background: var(--ax-blue);
  color: white;
}

.ax-calendar-day--has-task {
  position: relative;
}

.ax-calendar-day--has-task::after {
  content: '';
  position: absolute;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--ax-green);
}
```

- [ ] **Step 2: 实现 Calendar 组件**

```typescript
export function createCalendarWidget(
  tasks: Array<{ date: string; text: string }>,
  onDayClick: (date: string) => void,
): HTMLElement {
  const widget = div('ax-calendar');
  const today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();

  const header = div('ax-calendar-header');
  const title = div('ax-calendar-title');
  const nav = div('ax-calendar-nav');

  const prevBtn = el('button', { class: 'ax-calendar-nav-btn' }, '←');
  const nextBtn = el('button', { class: 'ax-calendar-nav-btn' }, '→');

  prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });

  nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });

  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  header.appendChild(title);
  header.appendChild(nav);

  const grid = div('ax-calendar-grid');

  const renderCalendar = () => {
    title.textContent = currentYear + '年' + (currentMonth + 1) + '月';
    grid.empty();

    // 星期标题
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    weekdays.forEach(day => {
      const header = div('ax-calendar-day-header', day);
      grid.appendChild(header);
    });

    // 日期
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // 填充空白
    for (let i = 0; i < firstDay; i++) {
      grid.appendChild(div('ax-calendar-day'));
    }

    // 日期格子
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = currentYear + '-' +
        String(currentMonth + 1).padStart(2, '0') + '-' +
        String(day).padStart(2, '0');

      const dayEl = div('ax-calendar-day', String(day));
      dayEl.addEventListener('click', () => onDayClick(dateStr));

      // 检查是否有任务
      if (tasks.some(t => t.date === dateStr)) {
        dayEl.addClass('ax-calendar-day--has-task');
      }

      // 今天
      if (dateStr === today.toISOString().split('T')[0]) {
        dayEl.addClass('ax-calendar-day--today');
      }

      grid.appendChild(dayEl);
    }
  };

  renderCalendar();

  widget.appendChild(header);
  widget.appendChild(grid);

  return widget;
}
```

- [ ] **Step 3: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add src/widgets/calendar.ts src/styles.css
git commit -m "feat: implement Calendar/Tasks system"
```

---

## Task 13: 集成所有组件到主视图

**Covers:** [S1], [S2], [S4], [S7], [S8]

**Files:**
- Modify: `src/view.ts` (render 方法和相关子方法)

**Interfaces:**
- Consumes: 所有前面实现的组件
- Produces: 完整的 Dashboard 视图

- [ ] **Step 1: 更新 render 方法**

```typescript
private async render() {
  this._isRendering = true;
  try {
    const settings = this.plugin.settings;
    const container = this.containerEl;

    // Parallel independent I/O
    const [stats] = await Promise.all([
      this.stats || scanVault(this.app, settings.wikis),
      this.computeKpiData(),
    ]);
    if (!this.stats) this.stats = stats;

    const app = div('ax-app');
    app.addClass('apex-dashboard-root');
    app.setAttribute('data-theme', settings.theme);
    app.addClass('gulldock-theme-' + settings.theme);

    // Banner
    this.initFocusData();
    app.appendChild(this.createBanner());

    // Main layout: Sidebar + Grid
    const mainLayout = div('ax-main-layout');

    // Sidebar
    const sidebar = div('ax-sidebar');
    if (this.sidebarPinned) sidebar.addClass('ax-sidebar--pinned');
    else if (this.sidebarExpanded) sidebar.addClass('ax-sidebar--expanded');
    else sidebar.addClass('ax-sidebar--collapsed');
    await this.renderWidgetSidebar(sidebar);
    mainLayout.appendChild(sidebar);

    // Content Grid
    const content = div('ax-content');

    // Overview page (Grid)
    const pageOverview = div('ax-page');
    pageOverview.setAttribute('data-page', 'overview');

    // 创建网格
    const grid = div('ax-grid');
    this.lazyRenderer = new LazyRenderer(grid);

    // 渲染卡片
    const order = this.getCardOrder();
    const FIRST_SCREEN_COUNT = 4;
    for (let i = 0; i < order.length; i++) {
      const cardId = order[i];
      const card = this.createCardById(cardId);
      if (card) {
        grid.appendChild(card);
        if (i < FIRST_SCREEN_COUNT) {
          const contentEl = card.querySelector('.ax-card-lazy-content') as HTMLElement;
          if (contentEl) this.lazyRenderer.forceRender(contentEl);
        }
      }
    }

    pageOverview.appendChild(grid);
    content.appendChild(pageOverview);

    // Calendar page
    const pageCalendar = div('ax-page');
    pageCalendar.setAttribute('data-page', 'calendar');
    pageCalendar.appendChild(this.createCalendarPage());
    content.appendChild(pageCalendar);

    mainLayout.appendChild(content);
    app.appendChild(mainLayout);

    container.appendChild(app);

    // 初始化交互
    this.switchPage(this.currentPage);
    this.startClock();
    this.setupSidebarBehavior(sidebar);

    // 入场动画
    requestAnimationFrame(() => {
      setTimeout(() => {
        const cards = container.querySelectorAll<HTMLElement>('.ax-card');
        staggerEntrance(Array.from(cards), 60);
      }, 50);
    });

    this._renderCooldown = Date.now() + 2000;
  } finally {
    this._isRendering = false;
  }
}
```

- [ ] **Step 2: 运行测试验证**

Run: `npm run build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 3: 提交代码**

```bash
git add src/view.ts
git commit -m "feat: integrate all components into main view"
```

---

## Task 14: 最终验证和清理

**Covers:** [S12], [S13]

**Files:**
- Modify: `src/styles.css` (清理冗余样式)
- Modify: `src/view.ts` (清理冗余代码)

**Interfaces:**
- Consumes: 所有前面的任务
- Produces: 清理后的最终代码

- [ ] **Step 1: 清理 styles.css**

删除不再使用的 Kanban 相关样式：
```css
/* 删除以下样式 */
.ax-kanban { ... }
.ax-kanban-wrapper { ... }
.ax-section-row { ... }
.ax-section-header { ... }
```

- [ ] **Step 2: 清理 view.ts**

删除不再使用的方法：
- `createKanbanSection`
- `createSectionScaffold`
- `setupSectionDragAndDrop`
- `setupSectionResize`

- [ ] **Step 3: 运行完整测试**

Run: `npm run build && npm test`
Expected: 所有测试通过，无 TypeScript 错误

- [ ] **Step 4: 提交代码**

```bash
git add -A
git commit -m "chore: cleanup redundant code and styles"
```

---

## 执行完成检查清单

- [ ] CSS Grid 布局系统正常工作
- [ ] 侧边栏结构正确
- [ ] 拖拽排序功能正常
- [ ] 折叠展开功能正常
- [ ] 所有卡片类型正常显示
- [ ] 所有侧边栏组件正常工作
- [ ] Calendar/Tasks 系统正常
- [ ] 主题应用正确
- [ ] 无 TypeScript 错误
- [ ] 无控制台错误
