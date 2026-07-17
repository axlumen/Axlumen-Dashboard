/**
 * services/triggers/index.ts — Trigger 工厂 + 统一导出
 */

import type { App } from 'obsidian';
import type { Trigger, TriggerConfig } from './types';
import { ScheduleTrigger, SCHEDULE_TRIGGER_TYPE } from './ScheduleTrigger';
import { InboxThresholdTrigger, INBOX_THRESHOLD_TRIGGER_TYPE } from './InboxThresholdTrigger';
import { OnStartupTrigger, ON_STARTUP_TRIGGER_TYPE } from './OnStartupTrigger';
import { EventTrigger, EVENT_TRIGGER_TYPE } from './EventTrigger';

export type { Trigger, TriggerConfig } from './types';
export { ScheduleTrigger, SCHEDULE_TRIGGER_TYPE } from './ScheduleTrigger';
export { InboxThresholdTrigger, INBOX_THRESHOLD_TRIGGER_TYPE } from './InboxThresholdTrigger';
export { OnStartupTrigger, ON_STARTUP_TRIGGER_TYPE } from './OnStartupTrigger';
export { EventTrigger, EVENT_TRIGGER_TYPE } from './EventTrigger';

/**
 * 根据 TriggerConfig.type 创建对应的 Trigger 实例
 * @param app Obsidian App 实例（某些 Trigger 需要访问 Vault）
 * @param config 持久化的 TriggerConfig
 */
export function createTriggerFromConfig(app: App, config: TriggerConfig): Trigger {
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
