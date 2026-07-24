/**
 * widgets/lunar.ts — 中国农历小组件
 *
 * 功能：天干地支、生肖、农历日期、节气、节日
 * 无外部依赖，纯 JavaScript 实现
 */

import { div, esc } from '../utils/dom';
import type { WidgetHandle } from '../types';

// ===== 天干地支 =====

const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// ===== 农历数据表 (1900-2100) =====
// 每年用一个整数编码农历月份大小和闰月信息
// 高4位: 闰月月份 (0=无闰月)
// 低12位: 每个月大小 (1=30天, 0=29天)
const LUNAR_INFO: number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
  0x0d520,
];

const LUNAR_YEAR = 1900;
const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

// ===== 农历计算 =====

function lunarYearDays(y: number): number {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - LUNAR_YEAR] & i) ? 1 : 0;
  }
  return sum + leapDays(y);
}

function leapMonth(y: number): number {
  return LUNAR_INFO[y - LUNAR_YEAR] & 0xf;
}

function leapDays(y: number): number {
  if (leapMonth(y)) {
    return (LUNAR_INFO[y - LUNAR_YEAR] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function monthDays(y: number, m: number): number {
  return (LUNAR_INFO[y - LUNAR_YEAR] & (0x10000 >> m)) ? 30 : 29;
}

function solarToLunar(date: Date): { year: number; month: number; day: number; isLeap: boolean } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  // 基准日期: 1900年1月31日 = 农历正月初一
  const base = new Date(1900, 0, 31);
  const target = new Date(y, m, d);
  const offset = Math.floor((target.getTime() - base.getTime()) / 86400000);

  let lunarYear = LUNAR_YEAR;
  let daysInYear: number;
  for (lunarYear = LUNAR_YEAR; lunarYear < 2101; lunarYear++) {
    daysInYear = lunarYearDays(lunarYear);
    if (offset < daysInYear) break;
  }

  let remaining = offset;
  for (let i = LUNAR_YEAR; i < lunarYear; i++) {
    remaining -= lunarYearDays(i);
  }

  const leap = leapMonth(lunarYear);
  let lunarMonth = 1;
  let isLeap = false;
  let daysInMonth: number;

  for (lunarMonth = 1; lunarMonth <= 12; lunarMonth++) {
    daysInMonth = monthDays(lunarYear, lunarMonth);
    if (remaining < daysInMonth) break;
    remaining -= daysInMonth;

    if (leap === lunarMonth) {
      daysInMonth = leapDays(lunarYear);
      if (remaining < daysInMonth) {
        isLeap = true;
        break;
      }
      remaining -= daysInMonth;
    }
  }

  return { year: lunarYear, month: lunarMonth, day: remaining + 1, isLeap };
}

// ===== 天干地支计算 =====

function ganZhiYear(year: number): string {
  return TIAN_GAN[(year - 4) % 10] + DI_ZHI[(year - 4) % 12];
}

function ganZhiMonth(year: number, month: number): string {
  // 月份天干: 年干决定月干起点
  const ganBase = (TIAN_GAN.indexOf(ganZhiYear(year)[0]) % 5) * 2;
  return TIAN_GAN[(ganBase + month - 1) % 10] + DI_ZHI[month + 1];
}

function ganZhiDay(year: number, month: number, day: number): string {
  // 基准: 1900年1月1日 = 甲戌日 (甲=0, 戌=10)
  const base = new Date(1900, 0, 1);
  const target = new Date(year, month, day);
  const offset = Math.floor((target.getTime() - base.getTime()) / 86400000);
  return TIAN_GAN[((offset % 10) + 10) % 10] + DI_ZHI[((offset % 12) + 12) % 12];
}

function shengXiao(year: number): string {
  return SHENG_XIAO[(year - 4) % 12];
}

// ===== 节气 (简化版，仅包含主要节气) =====

const SOLAR_TERMS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 5, name: '小寒' },
  { month: 1, day: 20, name: '大寒' },
  { month: 2, day: 4, name: '立春' },
  { month: 2, day: 18, name: '雨水' },
  { month: 3, day: 5, name: '惊蛰' },
  { month: 3, day: 20, name: '春分' },
  { month: 4, day: 4, name: '清明' },
  { month: 4, day: 19, name: '谷雨' },
  { month: 5, day: 5, name: '立夏' },
  { month: 5, day: 20, name: '小满' },
  { month: 6, day: 5, name: '芒种' },
  { month: 6, day: 21, name: '夏至' },
  { month: 7, day: 6, name: '小暑' },
  { month: 7, day: 22, name: '大暑' },
  { month: 8, day: 7, name: '立秋' },
  { month: 8, day: 22, name: '处暑' },
  { month: 9, day: 7, name: '白露' },
  { month: 9, day: 22, name: '秋分' },
  { month: 10, day: 8, name: '寒露' },
  { month: 10, day: 23, name: '霜降' },
  { month: 11, day: 7, name: '立冬' },
  { month: 11, day: 22, name: '小雪' },
  { month: 12, day: 6, name: '大雪' },
  { month: 12, day: 21, name: '冬至' },
];

function getSolarTerm(month: number, day: number): string | null {
  for (const term of SOLAR_TERMS) {
    if (term.month === month && term.day === day) return term.name;
  }
  return null;
}

// ===== 节日 =====

const FESTIVALS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: '元旦' },
  { month: 2, day: 14, name: '情人节' },
  { month: 3, day: 8, name: '妇女节' },
  { month: 3, day: 12, name: '植树节' },
  { month: 4, day: 1, name: '愚人节' },
  { month: 5, day: 1, name: '劳动节' },
  { month: 5, day: 4, name: '青年节' },
  { month: 6, day: 1, name: '儿童节' },
  { month: 7, day: 1, name: '建党节' },
  { month: 8, day: 1, name: '建军节' },
  { month: 9, day: 10, name: '教师节' },
  { month: 10, day: 1, name: '国庆节' },
  { month: 12, day: 25, name: '圣诞节' },
];

const LUNAR_FESTIVALS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: '春节' },
  { month: 1, day: 15, name: '元宵节' },
  { month: 5, day: 5, name: '端午节' },
  { month: 7, day: 7, name: '七夕' },
  { month: 7, day: 15, name: '中元节' },
  { month: 8, day: 15, name: '中秋节' },
  { month: 9, day: 9, name: '重阳节' },
  { month: 12, day: 8, name: '腊八节' },
  { month: 12, day: 30, name: '除夕' },
];

function getFestivals(month: number, day: number, lunarMonth: number, lunarDay: number): string[] {
  const result: string[] = [];
  for (const f of FESTIVALS) {
    if (f.month === month + 1 && f.day === day) result.push(f.name);
  }
  for (const f of LUNAR_FESTIVALS) {
    if (f.month === lunarMonth && f.day === lunarDay) result.push(f.name);
  }
  return result;
}

// ===== 宜忌 (简化版) =====

const YI_ITEMS = ['嫁娶', '出行', '搬家', '开业', '签约', '祈福', '动土', '修造', '求财', '会友'];
const JI_ITEMS = ['破土', '安葬', '开市', '嫁娶', '远行', '诉讼', '搬家', '修造', '动土', '求医'];

function getAlmanac(date: Date): { yi: string[]; ji: string[] } {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const yi: string[] = [];
  const ji: string[] = [];
  for (let i = 0; i < 4; i++) {
    yi.push(YI_ITEMS[(seed + i * 7) % YI_ITEMS.length]);
    ji.push(JI_ITEMS[(seed + i * 13) % JI_ITEMS.length]);
  }
  return { yi, ji };
}

// ===== 主渲染函数 =====

export function createLunarWidget(
  initialDate?: Date,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = div('ax-lunar-widget');
  let disposed = false;

  const now = initialDate ?? new Date();

  // 计算农历数据
  const lunar = solarToLunar(now);
  const gzYear = ganZhiYear(lunar.year);
  const gzMonth = ganZhiMonth(lunar.year, lunar.month);
  const gzDay = ganZhiDay(now.getFullYear(), now.getMonth(), now.getDate());
  const zodiac = shengXiao(lunar.year);
  const lunarDateStr = (lunar.isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[lunar.month - 1] + '月' + LUNAR_DAY_NAMES[lunar.day - 1];
  const jieQi = getSolarTerm(now.getMonth() + 1, now.getDate());
  const festivals = getFestivals(now.getMonth(), now.getDate(), lunar.month, lunar.day);
  const almanac = getAlmanac(now);

  // ---- 日期大字 ----
  const dateBig = div('ax-lunar-date-big');
  dateBig.textContent = String(now.getDate());
  section.appendChild(dateBig);

  // ---- 星期 ----
  const weekNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekEl = div('ax-lunar-week');
  weekEl.textContent = weekNames[now.getDay()];
  section.appendChild(weekEl);

  // ---- 农历日期 ----
  const lunarDateEl = div('ax-lunar-date');
  lunarDateEl.textContent = lunarDateStr;
  section.appendChild(lunarDateEl);

  // ---- 天干地支 + 生肖 ----
  const meta = div('ax-lunar-meta');
  meta.createSpan({ cls: 'ax-lunar-ganzhi', text: gzYear + '年' });
  meta.createSpan({ cls: 'ax-lunar-zodiac', text: zodiac });
  section.appendChild(meta);

  const meta2 = div('ax-lunar-meta');
  meta2.createSpan({ cls: 'ax-lunar-ganzhi', text: gzMonth + '月 ' + gzDay + '日' });
  section.appendChild(meta2);

  // ---- 节气 ----
  if (jieQi) {
    const jieqiEl = div('ax-lunar-jieqi');
    jieqiEl.textContent = jieQi;
    section.appendChild(jieqiEl);
  }

  // ---- 节日 ----
  if (festivals.length > 0) {
    const festivalEl = div('ax-lunar-festivals');
    for (const f of festivals.slice(0, 2)) {
      festivalEl.createSpan({ cls: 'ax-lunar-festival-badge', text: f });
    }
    section.appendChild(festivalEl);
  }

  // ---- 宜忌 ----
  const almanacEl = div('ax-lunar-almanac');
  const yiEl = div('ax-lunar-almanac-row');
  yiEl.createSpan({ cls: 'ax-lunar-almanac-label', text: '宜' });
  yiEl.createSpan({ cls: 'ax-lunar-almanac-text', text: almanac.yi.join(' · ') });
  almanacEl.appendChild(yiEl);
  const jiEl = div('ax-lunar-almanac-row');
  jiEl.createSpan({ cls: 'ax-lunar-almanac-label ax-lunar-almanac-label--ji', text: '忌' });
  jiEl.createSpan({ cls: 'ax-lunar-almanac-text', text: almanac.ji.join(' · ') });
  almanacEl.appendChild(jiEl);
  section.appendChild(almanacEl);

  return {
    section,
    handle: {
      get disposed() { return disposed; },
      roots: [section],
      dispose() {
        if (disposed) return;
        disposed = true;
        section.remove();
      },
    },
  };
}
