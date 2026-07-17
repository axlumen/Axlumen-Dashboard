/**
 * prompts.ts — Claudian Prompt 模板
 */

/** 构建一键入库 prompt */
export function buildIngestPrompt(content: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `你是 Axlumen 的知识库管理助手。请将以下内容入库，分两步完成。

## 第一步：清洗、格式化，保存到 raw/ 文件夹

### 清洗规则
1. 修正明显的错别字和格式问题
2. 统一 Markdown 格式：标题层级、列表、代码块
3. 补充缺失的标点和分段
4. 如果内容是碎片化的，整理成可读的段落结构
5. 保留原始含义，不添加、不删减核心信息

### 保存位置（按 Wiki 分类）

**tech-wiki/raw/** — 技术类（平铺，不分子目录）
路径示例：\`tech-wiki/raw/RAG新思路.md\`

**finance-wiki/raw/** — 金融类（平铺，不分子目录）
路径示例：\`finance-wiki/raw/AI产业链-观察.md\`

**Axlumen-wiki/raw/** — 个人类（按子分类存放）
- \`Axlumen-wiki/raw/Jots/\` — 灵感摘录、短句、想法碎片
- \`Axlumen-wiki/raw/Life/\` — 生活经验、方法论、指南
- \`Axlumen-wiki/raw/Tips/\` — 实用技巧、工具推荐
- \`Axlumen-wiki/raw/Diary/\` — 日记、心情记录
- \`Axlumen-wiki/raw/about Axlumen/\` — 关于个人的素材

### raw 文件格式
\`\`\`markdown
# 标题

> 来源：（如果有的话）
> 日期：${today}

（清洗后的正文内容）
\`\`\`

## 第二步：Ingest 编译为 Wiki 页面

从刚保存的 raw 文件出发，创建正式的 Wiki 页面。

### Wiki 定位
- **tech-wiki** — 技术知识库（编程/AI/架构/工具）— 武器库
- **finance-wiki** — 金融知识库（投资/产业链/股票/策略）— 主战场
- **Axlumen-wiki** — 个人知识库（哲学/生活/成长/心态）— 操作系统

### 页面类型
- **concepts/** — 概念页（type/concept）：400-1200 字，解释一个概念/方法论/框架
- **entities/** — 实体页（type/entity）：人物/工具/论文/组织
- **sources/** — 来源摘要（type/source）：200-400 字，对原始来源的摘要
- **comparisons/** — 对比页（type/comparison）：两个概念/方案的对比
- **synthesis/** — 综合页（type/synthesis）：多源知识的综合分析

### 命名规范
- 文件名用中文，连字符分隔：rag-optimization.md
- 概念页直接用概念名：向量数据库.md
- 实体页用人名/工具名：Andrej Karpathy.md

### Frontmatter 模板
\`\`\`yaml
---
title: "页面标题"
created: ${today}
updated: ${today}
tags:
  - type/concept
  - theme/xxx
aliases: []
status: draft
source: "[[raw文件名]]"
---
\`\`\`

### 写作要求
- 概念页 400-1200 字，来源摘要 200-400 字
- 建立与其他页面的 wikilink 关联（至少 3 个相关页面链接）
- source 字段链接回 raw 原始文件

## 要入库的内容

${content}

## 完成后

告诉我：
1. 清洗了什么（简要说明格式化改动）
2. raw 文件保存到了哪里
3. 创建了哪些 Wiki 页面（路径和类型）
4. 建立了哪些关联链接`;
}

/** 构建一键查询 prompt */
export function buildQueryPrompt(content: string): string {
  return `你是 Axlumen 的知识库查询助手。请基于知识库内容回答以下问题。

## 知识库结构

- **tech-wiki** — 技术知识库（编程/AI/架构/工具）
- **finance-wiki** — 金融知识库（投资/产业链/股票/策略）
- **Axlumen-wiki** — 个人知识库（哲学/生活/成长/心态）

## 查询规则

1. 优先从知识库中检索相关内容回答
2. 引用页面时使用 wikilink 格式：[[页面名]]
3. 如果知识库中没有相关内容，明确说明并建议 ingest 什么来源来补充
4. 回答要简洁、结构化、可直接复制到 Obsidian

## 用户问题

${content}`;
}

