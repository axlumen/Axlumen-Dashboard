/**
 * WorkflowRegistry.ts — 薄路由层：L2 注册表
 *
 * 每个 workflow 一行 purpose + 触发条件 + 禁用条件。
 * match() 使用简单关键词评分匹配用户输入。
 */

export interface WorkflowRoute {
  /** workflow id */
  id: string;
  /** 一句话定位（≤100 字，截断安全） */
  purpose: string;
  /** 触发关键词/短语 */
  triggerPatterns: string[];
  /** 禁用条件（匹配时跳过此路由） */
  disableWhen: string[];
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
  /** 预期输出形状简述 */
  outputHint: string;
}

export interface RoutingContext {
  hasActiveTask: boolean;
  inboxCount: number;
  lastRunTime: Record<string, number>;
  currentHour: number;
}

export interface RoutingMatch {
  route: WorkflowRoute;
  score: number;
}

const MAX_PURPOSE_LENGTH = 100;

export class WorkflowRegistry {
  private routes: Map<string, WorkflowRoute> = new Map();

  /** 注册路由，自动截断过长 purpose */
  register(route: WorkflowRoute): void {
    const safePurpose = route.purpose.length > MAX_PURPOSE_LENGTH
      ? route.purpose.slice(0, MAX_PURPOSE_LENGTH - 3) + '...'
      : route.purpose;
    this.routes.set(route.id, { ...route, purpose: safePurpose });
  }

  unregister(id: string): void {
    this.routes.delete(id);
  }

  get(id: string): WorkflowRoute | undefined {
    return this.routes.get(id);
  }

  getAll(): WorkflowRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * 匹配用户输入与所有已注册路由。
   * 返回按分数降序排列的匹配结果。
   * 空数组 = "不需要工具" 是合法结果。
   */
  match(input: string, context?: RoutingContext): RoutingMatch[] {
    const results: RoutingMatch[] = [];
    const inputLower = input.toLowerCase();
    const inputTokens = this.tokenize(inputLower);

    for (const route of this.routes.values()) {
      // 检查禁用条件
      if (context && this.isDisabled(route, context)) continue;

      let score = 0;

      // 关键词匹配
      for (const pattern of route.triggerPatterns) {
        const patternLower = pattern.toLowerCase().trim();
        if (!patternLower) continue;

        // 精确包含
        if (inputLower.includes(patternLower)) {
          score += 10;
        } else {
          // 部分 token 匹配
          const patternTokens = this.tokenize(patternLower);
          for (const pt of patternTokens) {
            for (const it of inputTokens) {
              if (it === pt || it.includes(pt)) {
                score += 3;
              }
            }
          }
        }
      }

      // purpose 语义匹配（轻量）
      const purposeTokens = this.tokenize(route.purpose.toLowerCase());
      for (const pt of purposeTokens) {
        for (const it of inputTokens) {
          if (it === pt && pt.length > 2) {
            score += 1;
          }
        }
      }

      if (score > 0) {
        results.push({ route, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /** 检查路由是否应被禁用 */
  isDisabled(route: WorkflowRoute, context: RoutingContext): boolean {
    for (const condition of route.disableWhen) {
      const c = condition.toLowerCase().trim();
      if (!c) continue;

      if (c === 'has-active-task' && context.hasActiveTask) return true;
      if (c === 'no-internet' && context.inboxCount < 0) return true;
      if (c.startsWith('inbox-threshold:')) {
        const threshold = parseInt(c.split(':')[1]);
        if (!isNaN(threshold) && context.inboxCount < threshold) return true;
      }
      if (c.startsWith('last-run-within:')) {
        const minutes = parseInt(c.split(':')[1]);
        if (!isNaN(minutes)) {
          const routeId = route.id;
          const lastRun = context.lastRunTime[routeId];
          if (lastRun && (Date.now() - lastRun) < minutes * 60_000) return true;
        }
      }
      if (c.startsWith('hour-range:')) {
        const [start, end] = c.split(':')[1].split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          if (start <= end) {
            if (context.currentHour < start || context.currentHour > end) return true;
          } else {
            if (context.currentHour < start && context.currentHour > end) return true;
          }
        }
      }
    }
    return false;
  }

  /** 简单分词：按空白和标点切分 */
  private tokenize(text: string): string[] {
    return text.split(/[\s,;.!?、。，；！？]+/).filter(t => t.length > 1);
  }
}
