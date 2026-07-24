/**
 * TruncationGuard.ts — 截断安全写作规则
 *
 * 强制 TGCR 写作纪律：
 * - purpose ≤ 100 字
 * - description 首句 ≤ 200 字
 * - disableWhen 不放末尾
 * - prompt 前 3 行含动词
 * - 输出路径 ≤ 120 字
 */

export interface TruncationViolation {
  field: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface TruncationReport {
  valid: boolean;
  violations: TruncationViolation[];
}

const MAX_PURPOSE_LENGTH = 100;
const MAX_FIRST_SENTENCE_LENGTH = 200;
const MAX_OUTPUT_PATH_LENGTH = 120;
const VERB_PATTERN = /^(?:请|你|您|分析|扫描|检查|生成|创建|评估|比较|整理|归纳|提取|汇总|清洗|编译|检测|路由|归档|分类|聚合|摘要|研究|执行|运行|触发|analyze|scan|check|generate|create|evaluate|process|run|route|ingest|clean|compile|detect|aggregate|summarize|research)/mi;

export class TruncationGuard {
  /**
   * 验证 workflow 模板的截断安全性。
   */
  static validateTemplate(template: {
    purpose?: string;
    description?: string;
    prompt: string;
    disableWhen?: string;
    defaultOutput?: string;
  }): TruncationReport {
    const violations: TruncationViolation[] = [];

    // Rule 1: purpose ≤ 100 chars
    if (template.purpose && template.purpose.length > MAX_PURPOSE_LENGTH) {
      violations.push({
        field: 'purpose',
        rule: 'purpose-max-length',
        severity: 'error',
        message: `purpose 长度 ${template.purpose.length} 字，超过限制 ${MAX_PURPOSE_LENGTH} 字`,
      });
    }

    // Rule 2: description 首句 ≤ 200 chars
    if (template.description) {
      const firstSentence = this.extractFirstSentence(template.description);
      if (firstSentence.length > MAX_FIRST_SENTENCE_LENGTH) {
        violations.push({
          field: 'description',
          rule: 'description-first-sentence',
          severity: 'warning',
          message: `description 首句长度 ${firstSentence.length} 字，建议 ≤ ${MAX_FIRST_SENTENCE_LENGTH} 字`,
        });
      }
    }

    // Rule 3: disableWhen 不放末尾
    if (template.disableWhen && template.prompt) {
      const promptLines = template.prompt.split('\n').filter(l => l.trim());
      const lastLines = promptLines.slice(-3).join('\n').toLowerCase();
      const disableTerms = template.disableWhen.toLowerCase().split(',').map(s => s.trim()).filter(t => t.length > 0);
      for (const term of disableTerms) {
        if (term && lastLines.includes(term)) {
          violations.push({
            field: 'prompt',
            rule: 'disable-conditions-not-at-end',
            severity: 'error',
            message: `禁用条件 "${term}" 出现在 prompt 末尾，截断时会丢失`,
          });
        }
      }
    }

    // Rule 4: prompt 前 3 行含动词（意图声明）
    if (template.prompt) {
      const firstLines = template.prompt.split('\n').slice(0, 3).join('\n');
      if (!VERB_PATTERN.test(firstLines)) {
        violations.push({
          field: 'prompt',
          rule: 'prompt-intent-in-first-3-lines',
          severity: 'warning',
          message: 'prompt 前 3 行未包含动词（意图声明），建议在前 3 行表达用途',
        });
      }
    }

    // Rule 5: 输出路径 ≤ 120 chars
    if (template.defaultOutput && template.defaultOutput.length > MAX_OUTPUT_PATH_LENGTH) {
      violations.push({
        field: 'defaultOutput',
        rule: 'output-path-max-length',
        severity: 'error',
        message: `输出路径长度 ${template.defaultOutput.length} 字，超过限制 ${MAX_OUTPUT_PATH_LENGTH} 字`,
      });
    }

    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
    };
  }

  /**
   * 验证纯 prompt 字符串的截断安全性。
   */
  static validatePrompt(prompt: string): TruncationViolation[] {
    const violations: TruncationViolation[] = [];
    const firstLines = prompt.split('\n').slice(0, 3).join('\n');

    if (!VERB_PATTERN.test(firstLines)) {
      violations.push({
        field: 'prompt',
        rule: 'prompt-intent-in-first-3-lines',
        severity: 'warning',
        message: 'prompt 前 3 行未包含动词（意图声明）',
      });
    }

    if (prompt.length > 5000) {
      violations.push({
        field: 'prompt',
        rule: 'prompt-length',
        severity: 'warning',
        message: `prompt 长度 ${prompt.length} 字，过长可能导致截断风险`,
      });
    }

    return violations;
  }

  /**
   * 自动截断过长 purpose。
   */
  static truncatePurpose(purpose: string, maxLen: number = MAX_PURPOSE_LENGTH): string {
    if (purpose.length <= maxLen) return purpose;
    // 尝试在句号处截断
    const truncated = purpose.slice(0, maxLen - 3);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('!'),
    );
    if (lastPeriod > maxLen * 0.6) {
      return truncated.slice(0, lastPeriod + 1);
    }
    return truncated + '...';
  }

  /** 提取首句 */
  private static extractFirstSentence(text: string): string {
    const match = text.match(/^[^。.!！\n]+[。.!！]?/);
    return match ? match[0].trim() : text.split('\n')[0].trim();
  }
}
