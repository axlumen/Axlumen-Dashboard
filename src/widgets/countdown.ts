/**
 * widgets/countdown.ts — 倒计时模块（+ Disposable handle）
 */

import { el, div } from '../utils/dom';
import { MS_PER_DAY } from '../constants';
import type { DashboardSettings } from '../types';
import { type WidgetHandle, createRootedDisposable } from '../types';

interface CountdownSettings {
  target: string;
  label: string;
}

/** 返回 { section, handle } */
export function createCountdownPanel(
  settings: DashboardSettings,
  saveSettings: () => Promise<void>,
  showToast: (msg: string) => void,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('倒计时', '#FB7185', '');

  const cleaners: Array<() => void> = [];

  // 输入行
  const inputRow = div('ax-cd-input-row');
  const labelInput = el('input', {
    type: 'text',
    placeholder: '标签（如：距年终）',
    class: 'ax-cd-input ax-cd-label',
  }) as HTMLInputElement;
  const dateInput = el('input', {
    type: 'date',
    class: 'ax-cd-input ax-cd-date',
  }) as HTMLInputElement;
  const addBtn = el('button', { class: 'ax-todo-add' }, '+');
  const onAddClick = () => addCountdown(settings, saveSettings, showToast, labelInput, dateInput, section);
  const onLabelKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') addCountdown(settings, saveSettings, showToast, labelInput, dateInput, section);
  };
  addBtn.addEventListener('click', onAddClick);
  labelInput.addEventListener('keydown', onLabelKey);
  cleaners.push(
    () => addBtn.removeEventListener('click', onAddClick),
    () => labelInput.removeEventListener('keydown', onLabelKey),
  );
  inputRow.appendChild(labelInput);
  inputRow.appendChild(dateInput);
  inputRow.appendChild(addBtn);
  section.appendChild(inputRow);

  // 列表
  const list = div('ax-cd-list');
  list.id = 'ax-cd-list';
  section.appendChild(list);

  renderCountdownList(settings, saveSettings, list);

  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners) fn();
    section.empty();
  });

  return { section, handle };
}

function renderCountdownList(
  settings: DashboardSettings,
  saveSettings: () => Promise<void>,
  listEl: HTMLElement,
) {
  const countdowns = settings.countdowns;
  listEl.empty();

  if (countdowns.length === 0) {
    listEl.appendChild(el('div', { class: 'ax-empty' }, '暂无倒计时'));
    return;
  }

  countdowns.forEach((cd, i) => {
    const target = new Date(cd.target);
    const now = new Date();
    const days = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / MS_PER_DAY));

    const item = div('ax-countdown');
    item.innerHTML = `
      <div class="ax-cd-main">
        <b>${days}</b>
        <span>${cd.label}</span>
      </div>
      <div class="ax-cd-meta">
        <span class="ax-cd-date">${cd.target}</span>
        <button class="ax-cd-del" data-idx="${i}">&times;</button>
      </div>
    `;
    const delBtn = item.querySelector('.ax-cd-del') as HTMLElement;
    delBtn?.addEventListener('click', async () => {
      settings.countdowns.splice(i, 1);
      await saveSettings();
      renderCountdownList(settings, saveSettings, listEl);
    });
    listEl.appendChild(item);
  });
}

async function addCountdown(
  settings: DashboardSettings,
  saveSettings: () => Promise<void>,
  showToast: (msg: string) => void,
  labelInput: HTMLInputElement,
  dateInput: HTMLInputElement,
  section: HTMLElement,
) {
  const label = labelInput.value.trim();
  const target = dateInput.value;
  if (!label || !target) {
    showToast('请填写标签和日期');
    return;
  }
  settings.countdowns.push({ target, label });
  await saveSettings();
  labelInput.value = '';
  dateInput.value = '';
  const listEl = section.querySelector('#ax-cd-list') as HTMLElement;
  if (listEl) renderCountdownList(settings, saveSettings, listEl);
  showToast(`已添加倒计时：${label}`);
}
