/**
 * banner.ts — 紧凑 Banner 组件（背景图 + 名言轮播）
 *
 * 从 apex-dashboard 适配：紧凑高度（~60-70px），支持背景图和名言轮播。
 */

import { App, Modal, setIcon } from 'obsidian';
import type { BannerConfig, QuoteItem } from './types';
import { el, div, esc } from './utils/dom';

// ===== 数据访问 =====

export function getActiveQuote(banner: BannerConfig): QuoteItem | null {
  if (banner.quotes && banner.quotes.length > 0) {
    return banner.quotes[0]!;
  }
  return null;
}

export function getActiveImage(banner: BannerConfig): string | null {
  if (banner.images && banner.images.length > 0) {
    return banner.images[0]!;
  }
  return banner.backgroundImage || null;
}

// ===== 渲染 =====

export function renderBanner(
  container: HTMLElement,
  banner: BannerConfig,
  onEdit: () => void,
  app: App,
): HTMLElement {
  const el = div('dashboard-banner');

  const activeImage = getActiveImage(banner);
  if (activeImage) {
    const resolved = resolveVaultImage(app, activeImage);
    if (resolved) {
      el.style.backgroundImage = `url("${resolved}")`;
    }
  }

  const overlay = div('dashboard-banner-overlay');
  const content = div('dashboard-banner-content');

  const active = getActiveQuote(banner);
  if (active) {
    const quoteText = content.createEl('p', {
      cls: 'dashboard-banner-quote',
    });
    quoteText.textContent = active.text;

    const authorText = content.createEl('cite', {
      cls: 'dashboard-banner-author',
    });
    authorText.textContent = '— ' + active.source;

    if (banner.quoteColor) {
      quoteText.style.color = banner.quoteColor;
      authorText.style.color = banner.quoteColor;
      quoteText.style.textShadow = '0 1px 3px rgba(0,0,0,0.3)';
      authorText.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';
    }
  }

  overlay.appendChild(content);

  const editBtn = overlay.createEl('button', {
    cls: 'dashboard-banner-edit-btn',
    attr: { 'aria-label': '编辑 Banner' },
  });
  setIcon(editBtn, 'wand');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit();
  });

  el.appendChild(overlay);
  container.appendChild(el);

  return el;
}

// ===== 工具函数 =====

export function resolveVaultImage(app: App, relativePath: string): string | null {
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  const file = app.vault.getFileByPath(relativePath);
  if (!file) return null;

  const adapter = app.vault.adapter as any;
  if (typeof adapter?.getResourcePath === 'function') {
    return adapter.getResourcePath(relativePath);
  }

  const parts = relativePath.split('/');
  const encoded = parts.map(p => encodeURIComponent(p)).join('/');
  return `app://local/${encoded}`;
}

// ===== Banner 编辑模态框 =====

export class BannerEditModal extends Modal {
  private banner: BannerConfig;
  private onSave: (updates: Partial<BannerConfig>) => void;
  private theme: string;
  private quotes: QuoteItem[];
  private images: string[];

  constructor(
    app: App,
    banner: BannerConfig,
    onSave: (updates: Partial<BannerConfig>) => void,
    theme?: string,
  ) {
    super(app);
    this.banner = banner;
    this.onSave = onSave;
    this.theme = theme ?? 'island';
    this.quotes = banner.quotes && banner.quotes.length > 0
      ? banner.quotes.map(q => ({ ...q }))
      : [];
    this.images = banner.images && banner.images.length > 0
      ? [...banner.images]
      : banner.backgroundImage ? [banner.backgroundImage] : [];
  }

  onOpen(): void {
    const { contentEl, containerEl } = this;
    containerEl.dataset.theme = this.theme;
    contentEl.addClass('dashboard-modal', 'dashboard-modal--compact');
    containerEl.addClass('modal--dashboard');
    containerEl.parentElement?.addClass('modal-bg--dashboard');
    contentEl.createEl('h2', { text: '编辑 Banner' });

    const form = contentEl.createDiv({ cls: 'dashboard-modal-form' });

    // === 名言列表 ===
    const quotesSection = form.createDiv({ cls: 'dashboard-modal-quotes' });
    quotesSection.createEl('label', { text: '名言列表', cls: 'dashboard-modal-quotes-label' });
    const quotesList = quotesSection.createDiv({ cls: 'dashboard-modal-quotes-list' });

    const renderQuotes = () => {
      quotesList.empty();
      for (let i = 0; i < this.quotes.length; i++) {
        const item = this.quotes[i]!;
        const row = quotesList.createDiv({ cls: 'dashboard-modal-quote-item' });
        const fields = row.createDiv({ cls: 'dashboard-modal-quote-fields' });

        const qInput = fields.createEl('textarea', {
          cls: 'dashboard-modal-input dashboard-modal-quote-input',
          attr: { rows: '2', placeholder: '名言内容' },
        });
        qInput.value = item.text;
        qInput.addEventListener('input', () => {
          this.quotes[i] = { ...this.quotes[i]!, text: qInput.value };
        });

        const aInput = fields.createEl('input', {
          cls: 'dashboard-modal-input dashboard-modal-author-input',
          attr: { type: 'text', placeholder: '作者' },
        });
        aInput.value = item.source;
        aInput.addEventListener('input', () => {
          this.quotes[i] = { ...this.quotes[i]!, source: aInput.value };
        });

        if (this.quotes.length > 1) {
          const delBtn = row.createEl('button', {
            cls: 'dashboard-modal-quote-delete',
            attr: { 'aria-label': '删除名言' },
          });
          setIcon(delBtn, 'x');
          delBtn.addEventListener('click', () => {
            this.quotes.splice(i, 1);
            renderQuotes();
          });
        }
      }
    };

    renderQuotes();

    const addQuoteBtn = quotesSection.createEl('button', {
      cls: 'dashboard-modal-quote-add',
      text: '+ 添加名言',
    });
    addQuoteBtn.addEventListener('click', () => {
      this.quotes.push({ text: '', source: '' });
      renderQuotes();
      const last = quotesList.querySelector<HTMLTextAreaElement>('.dashboard-modal-quote-item:last-child textarea');
      if (last) last.focus();
    });

    // === 背景图列表 ===
    const imagesSection = form.createDiv({ cls: 'dashboard-modal-images' });
    imagesSection.createEl('label', { text: '背景图', cls: 'dashboard-modal-images-label' });
    const imagesList = imagesSection.createDiv({ cls: 'dashboard-modal-images-list' });

    const renderImages = () => {
      imagesList.empty();
      for (let i = 0; i < this.images.length; i++) {
        const row = imagesList.createDiv({ cls: 'dashboard-modal-image-item' });
        const imgInput = row.createEl('input', {
          cls: 'dashboard-modal-input dashboard-modal-image-input',
          attr: { type: 'text', placeholder: 'attachments/banner.jpg' },
        });
        imgInput.value = this.images[i]!;
        imgInput.addEventListener('input', () => {
          this.images[i] = imgInput.value;
        });

        if (this.images.length > 1) {
          const delBtn = row.createEl('button', {
            cls: 'dashboard-modal-image-delete',
            attr: { 'aria-label': '删除图片' },
          });
          setIcon(delBtn, 'x');
          delBtn.addEventListener('click', () => {
            this.images.splice(i, 1);
            renderImages();
          });
        }
      }
    };

    renderImages();

    const addImageBtn = imagesSection.createEl('button', {
      cls: 'dashboard-modal-image-add',
      text: '+ 添加图片',
    });
    addImageBtn.addEventListener('click', () => {
      this.images.push('');
      renderImages();
      const last = imagesList.querySelector<HTMLInputElement>('.dashboard-modal-image-item:last-child input');
      if (last) last.focus();
    });

    // === 名言颜色 ===
    const colorSection = form.createDiv({ cls: 'dashboard-modal-quote-color' });
    colorSection.createEl('label', { text: '名言颜色', cls: 'dashboard-modal-quote-color-label' });
    const colorRow = colorSection.createDiv({ cls: 'dashboard-modal-quote-color-row' });

    const colorInput = colorRow.createEl('input', {
      cls: 'dashboard-modal-color-input',
      attr: { type: 'color' },
    });
    colorInput.value = this.banner.quoteColor || '#ffffff';

    const colorResetBtn = colorRow.createEl('button', {
      cls: 'dashboard-modal-color-reset',
      text: '重置',
    });
    colorResetBtn.addEventListener('click', () => {
      colorInput.value = '#ffffff';
    });

    // === 操作按钮 ===
    const actions = form.createDiv({ cls: 'dashboard-modal-actions' });

    const saveBtn = actions.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      const validQuotes = this.quotes.filter(q => q.text.trim());
      const validImages = this.images.filter(s => s.trim());
      const updates: Partial<BannerConfig> = {};

      if (validQuotes.length > 0) {
        updates.quotes = validQuotes;
      } else {
        updates.quotes = [];
      }
      if (validImages.length > 0) {
        updates.images = validImages;
        updates.backgroundImage = validImages[0];
      } else {
        updates.images = [];
        updates.backgroundImage = '';
      }

      const colorVal = colorInput.value;
      updates.quoteColor = colorVal === '#ffffff' ? undefined : colorVal;

      this.onSave(updates);
      this.close();
    });

    const cancelBtn = actions.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
