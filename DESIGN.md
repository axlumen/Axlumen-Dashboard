# Axlumen Dashboard 设计系统

> 综合 Taste Skill（minimalist）+ Impeccable（product UI）规范。
> 优先级：产品 UI 规范 > 美学修饰。

## 定位

个人工作台（产品 UI），不是营销页面。
用户在工作流程中使用，效率 > 美观。

## 颜色

```css
/* 中性背景（不偏暖不偏冷） */
--ax-bg: #F5F5F5;
--ax-surface: #FFFFFF;
--ax-surface-2: #F8F8F8;
--ax-surface-3: #F0F0F0;

/* 边框 */
--ax-line: #E8E8E8;
--ax-line-strong: #D0D0D0;

/* 文字（确保 4.5:1 对比度） */
--ax-ink: #1A1A1A;      /* 主文字 */
--ax-muted: #6B6B6B;    /* 次要文字 */
--ax-faint: #999999;     /* 辅助文字 */

/* 语义色（柔和，不刺眼） */
--ax-blue: #1F6C9F;      /* 信息/选中 */
--ax-green: #346538;      /* 成功/健康 */
--ax-amber: #956400;      /* 警告/待处理 */
--ax-rose: #9F2F2D;       /* 错误/异常 */

/* 弱化语义色底色（Pastel） */
--ax-blue-bg: #E1F3FE;
--ax-green-bg: #EDF3EC;
--ax-amber-bg: #FBF3DB;
--ax-rose-bg: #FDEBEC;
```

## 字体

```css
/* 品牌区（Hero 标题、品牌名）—— 衬线，克制使用 */
--ax-font-display: "Libre Baskerville", Georgia, serif;

/* 产品 UI（标签、正文、按钮、导航）—— 一个无衬线族 */
--ax-font: "DM Sans", "PingFang SC", "Microsoft YaHei", sans-serif;

/* 数据（数字、代码、时间、统计）—— 等宽 */
--ax-mono: "IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace;
```

### 字体使用规则

- Hero 标题：衬线，17px，-0.01em tracking
- 模块标题：无衬线，13px，大写，0.02em tracking
- 正文：无衬线，14px，1.5 line-height
- 数据：等宽，13-14px
- 标签：无衬线，10-11px，大写，0.08em tracking

## 边框

```css
/* 统一 1px 实线，不用 rgba 混合 */
border: 1px solid #E8E8E8;

/* 圆角 */
--ax-radius: 10px;
```

## 阴影

```css
/* 极淡，几乎不可见（opacity < 0.05） */
--ax-shadow-flat: 0 0 0 transparent;
--ax-shadow-lift: 0 2px 8px rgba(0, 0, 0, .04);
--ax-shadow-float: 0 4px 16px rgba(0, 0, 0, .05);
```

## 动效

```css
/* 产品级速度：150-250ms */
--ax-ease: cubic-bezier(.16, 1, .3, 1);

/* 入场：250ms */
animation: ax-rise .25s var(--ax-ease) both;

/* Hover：150ms */
transition: box-shadow .15s var(--ax-ease), transform .15s var(--ax-ease);
```

### 动效规则

- 动效传达状态，不是装饰
- 不动画布局属性（top, left, width, height）
- 用 transform 和 opacity
- 支持 prefers-reduced-motion

## 布局

- 全屏铺满（100vw × 100vh），零外边距
- 左侧固定 240px 导航 + 右侧自适应内容
- 头部固定，内容区滚动
- 卡片避免嵌套
- 间距用 8px 网格

## 禁止项

- ❌ 暖沙/骨色背景（AI 默认审美）
- ❌ 衬线字体用于 UI 标签/按钮/数据
- ❌ 重阴影、发光、渐变
- ❌ 600ms+ 动效
- ❌ emoji 用于正式 UI（暂保留，后续替换为 SVG 图标）
- ❌ 嵌套卡片
