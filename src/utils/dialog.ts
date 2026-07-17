/**
 * utils/dialog.ts — Obsidian 原生 Modal 对话框
 *
 * 替代浏览器原生的 prompt()/confirm() — Obsidian 插件规范明确禁止使用后者。
 * 使用 obsidian.Modal 类确保主题一致性和可访问性。
 */

import { App, Modal, Setting } from 'obsidian';

/** 显示一个输入对话框，返回用户输入的字符串；取消则返回 null */
export function showInputDialog(
  app: App,
  title: string,
  placeholder: string,
  defaultValue: string = '',
): Promise<string | null> {
  return new Promise((resolve) => {
    new InputDialog(app, title, placeholder, defaultValue, resolve).open();
  });
}

/** 显示一个确认对话框，返回 true/false */
export function showConfirmDialog(
  app: App,
  title: string,
  message: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    new ConfirmDialog(app, title, message, resolve).open();
  });
}

// ==================== 内部实现 ====================

class InputDialog extends Modal {
  private result: string;
  private resolve: (value: string | null) => void;

  constructor(
    app: App,
    title: string,
    placeholder: string,
    defaultValue: string,
    resolve: (value: string | null) => void,
  ) {
    super(app);
    this.titleEl.setText(title);
    this.result = defaultValue;
    this.resolve = resolve;
  }

  onOpen() {
    const { contentEl } = this;
    let textComponent: import('obsidian').TextComponent;

    new Setting(contentEl)
      .addText((text) => {
        textComponent = text;
        text.setPlaceholder(this.result ? '' : '请输入...')
          .setValue(this.result)
          .onChange((v) => { this.result = v; });
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('确定')
          .setCta()
          .onClick(() => {
            this.close();
            this.resolve(this.result || null);
          }))
      .addButton((btn) =>
        btn.setButtonText('取消')
          .onClick(() => {
            this.close();
            this.resolve(null);
          }));
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ConfirmDialog extends Modal {
  private resolve: (value: boolean) => void;

  constructor(
    app: App,
    title: string,
    message: string,
    resolve: (value: boolean) => void,
  ) {
    super(app);
    this.titleEl.setText(title);
    this.resolve = resolve;
    this.contentEl.setText(message);
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('确定')
          .setCta()
          .onClick(() => {
            this.close();
            this.resolve(true);
          }))
      .addButton((btn) =>
        btn.setButtonText('取消')
          .onClick(() => {
            this.close();
            this.resolve(false);
          }));
  }

  onClose() {
    this.contentEl.empty();
  }
}
