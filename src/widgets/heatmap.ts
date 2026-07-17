/**
 * widgets/heatmap.ts — 写作热力图模块（Canvas 版本）
 *
 * 从 630 个 div → 1 个 <canvas> 元素，大幅减少 DOM 节点。
 * 使用 mousemove 事件委托做 tooltip（精确命中检测）。
 */

import { App } from 'obsidian';
import { el, div, esc } from '../utils/dom';
import { getWritingActivity } from '../scanner';
import {
  HEATMAP_CELL_SIZE, HEATMAP_GAP,
  HEATMAP_LOW_THRESHOLD, HEATMAP_HIGH_THRESHOLD,
} from '../constants';
import { DayActivity, VaultHealthData } from '../services/VaultScanner';
import { type WidgetHandle, createRootedDisposable } from '../types';

const HEATMAP_DAYS = 90;

/** 维度定义 */
type HeatmapDimension = 'notes' | 'words' | 'tasks' | 'agentRuns';

interface DimensionConfig {
  key: HeatmapDimension;
  label: string;
  colorVarPrefix: string;
  tooltipUnit: string;
}

const DIMENSIONS: DimensionConfig[] = [
  { key: 'notes', label: 'Notes Created', colorVarPrefix: 'ax-heatmap', tooltipUnit: 'notes' },
  { key: 'words', label: 'Words Written', colorVarPrefix: 'ax-heatmap-words', tooltipUnit: 'words' },
  { key: 'tasks', label: 'Tasks Completed', colorVarPrefix: 'ax-heatmap-tasks', tooltipUnit: 'tasks' },
  { key: 'agentRuns', label: 'Agent Runs', colorVarPrefix: 'ax-heatmap-agent', tooltipUnit: 'runs' },
];

/** 解析 CSS 自定义属性为实际颜色值 */
function resolveColor(varName: string): string {
  const el = document.querySelector('.axlumen-dashboard');
  if (!el) return '#333';
  return getComputedStyle(el).getPropertyValue(varName).trim() || '#333';
}

/** 预计算颜色映射 */
function buildColorMap(prefix: string): { empty: string; l1: string; l2: string; l3: string } {
  return {
    empty: resolveColor(`--${prefix}-empty`),
    l1: resolveColor(`--${prefix}-L1`),
    l2: resolveColor(`--${prefix}-L2`),
    l3: resolveColor(`--${prefix}-L3`),
  };
}

/** 根据 count 返回颜色 */
function getColor(count: number, colors: { empty: string; l1: string; l2: string; l3: string }): string {
  if (count <= 0) return colors.empty;
  if (count <= HEATMAP_LOW_THRESHOLD) return colors.l1;
  if (count <= HEATMAP_HIGH_THRESHOLD) return colors.l2;
  return colors.l3;
}

/** 按周分组热力图数据 */
interface WeekGroup {
  week: DayActivity[];
  firstMonth: number;
  firstDate: string;
}

function groupByWeeks(activity: DayActivity[]): WeekGroup[] {
  const weeks: WeekGroup[] = [];
  let currentWeek: DayActivity[] = [];
  let firstMonth = -1;
  let firstDate = '';

  if (activity.length > 0) {
    const firstDateObj = new Date(activity[0].date);
    const dayOfWeek = (firstDateObj.getDay() + 6) % 7; // Monday=0
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push({ date: '', count: -1 });
    }
  }

  for (const day of activity) {
    if (currentWeek.length === 0 || (currentWeek.length > 0 && !currentWeek[0].date)) {
      firstMonth = day.date ? new Date(day.date).getMonth() : -1;
      firstDate = day.date;
    }
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push({ week: currentWeek, firstMonth, firstDate });
      currentWeek = [];
      firstMonth = -1;
      firstDate = '';
    }
  }
  if (currentWeek.length > 0) {
    weeks.push({ week: currentWeek, firstMonth, firstDate });
  }

  return weeks;
}

/** 返回 { section, handle } */
export function createHeatmapPanel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
  healthData?: VaultHealthData | null,
): { section: HTMLElement; handle: WidgetHandle } {
  const section = createSection('写作热力图', '#34D399', `近 ${HEATMAP_DAYS} 天`);
  section.addClass('ax-heatmap-section');

  const cleaners: Array<() => void> = [];

  // 维度切换下拉
  let currentDim: HeatmapDimension = 'notes';

  const toolbar = div('ax-heatmap-toolbar');
  const select = el('select', { class: 'ax-heatmap-dim-select' }) as HTMLSelectElement;
  DIMENSIONS.forEach(dim => {
    const opt = el('option', { value: dim.key }, dim.label) as HTMLOptionElement;
    select.appendChild(opt);
  });
  const onSelectChange = () => {
    currentDim = select.value as HeatmapDimension;
    renderCanvas();
  };
  select.addEventListener('change', onSelectChange);
  cleaners.push(() => select.removeEventListener('change', onSelectChange));
  toolbar.appendChild(select);
  section.appendChild(toolbar);

  // 热力图内容容器
  const container = div('ax-heatmap-container');
  section.appendChild(container);

  // 获取原始数据
  const notesActivity = getWritingActivity(app, HEATMAP_DAYS);

  // 获取多维度数据
  const multiDim = healthData?.dailyActivityMultiDim;

  function getActivityForDim(dim: HeatmapDimension): DayActivity[] {
    if (multiDim && multiDim[dim] && multiDim[dim].length > 0) {
      return multiDim[dim];
    }
    return notesActivity;
  }

  // Canvas 相关变量
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let currentActivity: DayActivity[] = [];
  let currentDimConfig: DimensionConfig = DIMENSIONS[0];
  let cellPositions: Array<{ x: number; y: number; w: number; h: number; date: string; count: number }> = [];

  // Tooltip 元素
  const tooltip = div('ax-heatmap-tooltip');
  tooltip.style.cssText = 'display:none;position:fixed;z-index:9999;pointer-events:none;';
  document.body.appendChild(tooltip);
  cleaners.push(() => tooltip.remove());

  function renderCanvas() {
    container.empty();
    currentActivity = getActivityForDim(currentDim);
    currentDimConfig = DIMENSIONS.find(d => d.key === currentDim)!;

    // 统计信息
    const activeDays = currentActivity.filter(d => d.count > 0).length;
    const totalCount = currentActivity.reduce((sum, d) => sum + d.count, 0);
    const avgPerDay = activeDays > 0 ? Math.round(totalCount / activeDays) : 0;

    const statsRow = div('ax-heatmap-stats');
    statsRow.innerHTML =
      `<span><b>${activeDays}</b> 活跃天</span>` +
      `<span><b>${totalCount.toLocaleString()}</b> ${currentDimConfig.tooltipUnit}</span>` +
      `<span><b>${avgPerDay.toLocaleString()}</b> 日均</span>`;
    container.appendChild(statsRow);

    // 按周分组
    const weekGroups = groupByWeeks(currentActivity);
    const cs = HEATMAP_CELL_SIZE;
    const gp = HEATMAP_GAP;

    // 计算尺寸
    const labelOffsetX = 22;
    const monthLabelHeight = 14;
    const canvasWidth = weekGroups.length * (cs + gp) + labelOffsetX + 10;
    const canvasHeight = 7 * (cs + gp) + monthLabelHeight + 4;

    // 创建 Canvas
    canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.className = 'ax-heatmap-canvas';
    canvas.style.cssText = 'display:block;max-width:100%;height:auto;cursor:pointer;';

    ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 高 DPI 支持
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    ctx.scale(dpr, dpr);

    // 解析颜色
    const colors = buildColorMap(currentDimConfig.colorVarPrefix);

    // 绘制背景
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 绘制日期标签
    const dayLabels = ['一', '三', '五'];
    const dayLabelRows = [0, 2, 4];
    ctx.fillStyle = resolveColor('--ax-faint');
    ctx.font = '9px ' + getComputedStyle(canvas).fontFamily;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < dayLabels.length; i++) {
      const y = dayLabelRows[i] * (cs + gp) + cs / 2 + monthLabelHeight;
      ctx.fillText(dayLabels[i], labelOffsetX - 4, y);
    }

    // 记录每个 cell 的位置（用于 hit test）
    cellPositions = [];

    let lastMonth = -1;
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    for (let wi = 0; wi < weekGroups.length; wi++) {
      const { week, firstMonth: wMonth } = weekGroups[wi];
      for (let di = 0; di < week.length; di++) {
        const day = week[di];
        if (day.count < 0) continue;

        const x = wi * (cs + gp) + labelOffsetX;
        const y = di * (cs + gp) + monthLabelHeight;

        // 绘制月份标签
        if (di === 0 && day.date) {
          const month = new Date(day.date).getMonth();
          if (month !== lastMonth) {
            ctx.fillStyle = resolveColor('--ax-faint');
            ctx.font = '9px ' + getComputedStyle(canvas).fontFamily;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(monthNames[month], x, monthLabelHeight - 2);
            lastMonth = month;
          }
        }

        // 绘制 cell
        ctx.fillStyle = getColor(day.count, colors);
        ctx.beginPath();
        ctx.roundRect(x, y, cs, cs, 2);
        ctx.fill();

        // 记录位置
        cellPositions.push({
          x, y, w: cs, h: cs,
          date: day.date,
          count: day.count,
        });
      }
    }

    // 事件委托：mousemove 做 tooltip
    const onCanvasMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      let hit = false;
      for (const cell of cellPositions) {
        if (mx >= cell.x && mx <= cell.x + cell.w &&
            my >= cell.y && my <= cell.y + cell.h) {
          const tooltipText = cell.date + ': ' + cell.count + ' ' + currentDimConfig.tooltipUnit;
          tooltip.textContent = tooltipText;
          tooltip.style.display = 'block';
          tooltip.style.left = (e.clientX + 10) + 'px';
          tooltip.style.top = (e.clientY - 30) + 'px';
          hit = true;
          break;
        }
      }
      if (!hit) {
        tooltip.style.display = 'none';
      }
    };

    const onCanvasMouseLeave = () => {
      tooltip.style.display = 'none';
    };

    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    cleaners.push(() => {
      canvas?.removeEventListener('mousemove', onCanvasMouseMove);
      canvas?.removeEventListener('mouseleave', onCanvasMouseLeave);
    });

    // 网格容器
    const grid = div('ax-heatmap-grid');
    grid.appendChild(canvas);
    container.appendChild(grid);

    // 图例
    const legend = div('ax-heatmap-legend');
    legend.innerHTML =
      '<span>少</span>' +
      `<div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-empty)"></div>` +
      `<div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-L1)"></div>` +
      `<div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-L2)"></div>` +
      `<div class="ax-heatmap-cell-legend" style="background:var(--${currentDimConfig.colorVarPrefix}-L3)"></div>` +
      '<span>多</span>';
    container.appendChild(legend);
  }

  // 初始渲染
  renderCanvas();

  const handle = createRootedDisposable([section], () => {
    for (const fn of cleaners) fn();
    section.empty();
  });

  return { section, handle };
}
