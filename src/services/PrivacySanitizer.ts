/**
 * PrivacySanitizer.ts — 隐私脱敏：写入前安全扫描
 *
 * 在 Agent 输出写入 Wiki 前扫描敏感信息。
 * 支持 block（阻断写入）、warn（警告）、mask（替换）三种严重级别。
 */

export type SensitivePatternType =
  | 'api-key'
  | 'password'
  | 'token'
  | 'private-key'
  | 'email'
  | 'ip-address'
  | 'aws-credentials'
  | 'github-token'
  | 'custom';

export type SanitizeSeverity = 'block' | 'warn' | 'mask';

export interface SanitizeRule {
  id: string;
  name: string;
  pattern: RegExp;
  type: SensitivePatternType;
  replacement: string;
  enabled: boolean;
  severity: SanitizeSeverity;
}

export interface SanitizeFinding {
  ruleId: string;
  type: SensitivePatternType;
  matched: string;
  position: { line: number; col: number };
  severity: SanitizeSeverity;
}

export interface SanitizeReport {
  clean: boolean;
  findings: SanitizeFinding[];
  sanitizedContent?: string;
  blocked: boolean;
}

// ==================== 默认规则 ====================

const DEFAULT_RULES: SanitizeRule[] = [
  {
    id: 'api-key',
    name: 'API Keys',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)[\s:=]+["']?([a-zA-Z0-9\-_]{20,})["']?/gi,
    type: 'api-key',
    replacement: '[REDACTED-API-KEY]',
    enabled: true,
    severity: 'mask',
  },
  {
    id: 'password',
    name: 'Passwords',
    pattern: /(?:password|passwd|pwd|pass)[\s:=]+["']?([^\s"']{8,})["']?/gi,
    type: 'password',
    replacement: '[REDACTED-PASSWORD]',
    enabled: true,
    severity: 'mask',
  },
  {
    id: 'token',
    name: 'JWT / Bearer Tokens',
    pattern: /(?:token|bearer|authorization)[\s:=]+["']?(eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+)/gi,
    type: 'token',
    replacement: '[REDACTED-TOKEN]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'private-key',
    name: 'Private Keys',
    pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+)?PRIVATE\s+KEY-----/g,
    type: 'private-key',
    replacement: '[REDACTED-PRIVATE-KEY]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key',
    pattern: /(?:AKIA[0-9A-Z]{16})/g,
    type: 'aws-credentials',
    replacement: '[REDACTED-AWS-KEY]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Key',
    pattern: /(?:aws[_-]?secret[_-]?access[_-]?key)[\s:=]+["']?([a-zA-Z0-9/+=]{40})["']?/gi,
    type: 'aws-credentials',
    replacement: '[REDACTED-AWS-SECRET]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'github-token',
    name: 'GitHub Tokens',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    type: 'github-token',
    replacement: '[REDACTED-GITHUB-TOKEN]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'github-fine-grained',
    name: 'GitHub Fine-Grained Token',
    pattern: /github_pat_[a-zA-Z0-9_]{82}/g,
    type: 'github-token',
    replacement: '[REDACTED-GITHUB-TOKEN]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'openai-key',
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{48}/g,
    type: 'api-key',
    replacement: '[REDACTED-OPENAI-KEY]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'anthropic-key',
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9\-_]{93}/g,
    type: 'api-key',
    replacement: '[REDACTED-ANTHROPIC-KEY]',
    enabled: true,
    severity: 'block',
  },
  {
    id: 'email',
    name: 'Email Addresses',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    type: 'email',
    replacement: '[REDACTED-EMAIL]',
    enabled: false,
    severity: 'warn',
  },
  {
    id: 'ipv4',
    name: 'IPv4 Addresses',
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    type: 'ip-address',
    replacement: '[REDACTED-IP]',
    enabled: false,
    severity: 'warn',
  },
];

// ==================== Service ====================

export class PrivacySanitizer {
  private rules: SanitizeRule[];
  private _customRules: SanitizeRule[] = [];

  constructor() {
    this.rules = [...DEFAULT_RULES];
  }

  /** 获取默认规则（静态） */
  static getDefaultRules(): SanitizeRule[] {
    return DEFAULT_RULES.map(r => ({ ...r }));
  }

  /** 添加自定义规则 */
  addRule(rule: SanitizeRule): void {
    // 移除同 id 的旧规则
    this.rules = this.rules.filter(r => r.id !== rule.id);
    this._customRules = this._customRules.filter(r => r.id !== rule.id);
    this.rules.push(rule);
    this._customRules.push(rule);
  }

  /** 移除规则 */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this._customRules = this._customRules.filter(r => r.id !== ruleId);
  }

  /** 获取所有规则（用于设置 UI） */
  getRules(): SanitizeRule[] {
    return [...this.rules];
  }

  /** 切换规则启用状态 */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 扫描内容中的敏感模式。
   * 不修改内容，仅返回发现。
   */
  scan(content: string): SanitizeFinding[] {
    const findings: SanitizeFinding[] = [];
    const lines = content.split('\n');

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        // 重置 lastIndex（因为 pattern 是 global）
        rule.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = rule.pattern.exec(line)) !== null) {
          findings.push({
            ruleId: rule.id,
            type: rule.type,
            matched: match[0].slice(0, 30) + (match[0].length > 30 ? '...' : ''),
            position: { line: lineIdx + 1, col: match.index + 1 },
            severity: rule.severity,
          });
        }
      }
    }

    return findings;
  }

  /**
   * 脱敏内容：替换/屏蔽发现的敏感信息。
   */
  sanitize(content: string): SanitizeReport {
    const findings = this.scan(content);
    let sanitizedContent = content;
    let blocked = false;

    // 按 severity 处理
    for (const finding of findings) {
      const rule = this.rules.find(r => r.id === finding.ruleId);
      if (!rule) continue;

      if (finding.severity === 'block') {
        blocked = true;
      }

      if (finding.severity === 'mask' || finding.severity === 'block') {
        // 用新的 global regex 替换所有匹配（String.replace 只替换第一个）
        const globalPattern = new RegExp(rule.pattern.source, 'g');
        sanitizedContent = sanitizedContent.replace(globalPattern, rule.replacement);
      }
    }

    return {
      clean: findings.length === 0,
      findings,
      sanitizedContent: findings.length > 0 ? sanitizedContent : undefined,
      blocked,
    };
  }

  /**
   * 扫描 + 脱敏一步到位。
   */
  process(content: string): SanitizeReport {
    return this.sanitize(content);
  }

  /** 持久化自定义规则（同时保存 flags） */
  serializeRules(): Array<Omit<SanitizeRule, 'pattern'> & { pattern: string; flags: string }> {
    return this._customRules.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      replacement: r.replacement,
      enabled: r.enabled,
      severity: r.severity,
      pattern: r.pattern.source,
      flags: r.pattern.flags,
    }));
  }

  /** 加载自定义规则 */
  loadRules(rules: Array<Omit<SanitizeRule, 'pattern'> & { pattern: string; flags?: string }>): void {
    for (const r of rules) {
      const flags = r.flags || (r.pattern.endsWith('i') ? 'gi' : 'g');
      const rule: SanitizeRule = {
        ...r,
        pattern: new RegExp(r.pattern, flags),
      };
      this.addRule(rule);
    }
  }
}
