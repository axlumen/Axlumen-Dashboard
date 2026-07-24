/**
 * PomodoroService.ts — 番茄钟计时器服务
 *
 * 从 apex-dashboard 适配：Timer state machine (work/short-break/long-break)，
 * 支持 session 持久化和音频提示。
 */

import { Notice } from 'obsidian';
import type { DashboardSettings } from '../types';

export type PomodoroPhase = 'work' | 'short-break' | 'long-break';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

export interface PomodoroState {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  remainingSeconds: number;
  totalSeconds: number;
  completedWorkSessions: number;
}

export interface PomodoroSession {
  date: string;
  completed: number;
}

const DATA_FILE = 'pomodoro.json';
const MAX_SESSION_DAYS = 365;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class PomodoroService {
  private phase: PomodoroPhase = 'work';
  private status: PomodoroStatus = 'idle';
  private startedAt = 0;
  private pausedRemaining = 0;
  private durationMs = 0;
  private completedWorkSessions = 0;
  private tickInterval: number | null = null;
  private onTickCallback: (() => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private sessions: PomodoroSession[] = [];
  private loaded = false;

  constructor(private getSettings: () => DashboardSettings) {}

  async loadSessions(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem('gulldock-pomodoro');
      if (raw) {
        this.sessions = JSON.parse(raw) as PomodoroSession[];
      }
    } catch {
      this.sessions = [];
    }
    this.pruneOldSessions();
  }

  private saveSessions(): void {
    try {
      localStorage.setItem('gulldock-pomodoro', JSON.stringify(this.sessions));
    } catch { /* silent */ }
  }

  private pruneOldSessions(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_SESSION_DAYS);
    const cutoffStr = formatDate(cutoff);
    this.sessions = this.sessions.filter(s => s.date >= cutoffStr);
  }

  private getPhaseDurationMs(phase: PomodoroPhase): number {
    const s = this.getSettings();
    switch (phase) {
      case 'work': return (s.pomodoroWorkMinutes ?? 25) * 60 * 1000;
      case 'short-break': return (s.pomodoroShortBreakMinutes ?? 5) * 60 * 1000;
      case 'long-break': return (s.pomodoroLongBreakMinutes ?? 15) * 60 * 1000;
    }
  }

  private getRemainingSeconds(): number {
    if (this.status !== 'running') return Math.ceil(this.pausedRemaining / 1000);
    const elapsed = Date.now() - this.startedAt;
    return Math.max(0, Math.ceil((this.durationMs - elapsed) / 1000));
  }

  getState(): PomodoroState {
    const totalSeconds = Math.round(this.durationMs / 1000) || Math.round(this.getPhaseDurationMs(this.phase) / 1000);
    return {
      phase: this.phase,
      status: this.status,
      remainingSeconds: this.getRemainingSeconds(),
      totalSeconds,
      completedWorkSessions: this.completedWorkSessions,
    };
  }

  start(): void {
    if (this.status === 'running') return;

    if (this.status === 'paused') {
      this.durationMs = this.pausedRemaining;
      this.startedAt = Date.now();
    } else {
      this.durationMs = this.getPhaseDurationMs(this.phase);
      this.startedAt = Date.now();
    }

    this.status = 'running';
    this.ensureTickInterval();
    this.notifyTick();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.pausedRemaining = Math.max(0, this.durationMs - (Date.now() - this.startedAt));
    this.status = 'paused';
    this.clearTickInterval();
    this.notifyTick();
  }

  reset(): void {
    this.status = 'idle';
    this.phase = 'work';
    this.durationMs = this.getPhaseDurationMs('work');
    this.pausedRemaining = 0;
    this.startedAt = 0;
    this.completedWorkSessions = 0;
    this.clearTickInterval();
    this.notifyTick();
  }

  skip(): void {
    this.transitionToNextPhase();
  }

  setOnTick(cb: (() => void) | null): void {
    this.onTickCallback = cb;
  }

  setOnComplete(cb: (() => void) | null): void {
    this.onCompleteCallback = cb;
  }

  destroy(): void {
    this.clearTickInterval();
    this.onTickCallback = null;
    this.onCompleteCallback = null;
  }

  private ensureTickInterval(): void {
    if (this.tickInterval) return;
    this.tickInterval = window.setInterval(() => this.tick(), 1000);
  }

  private clearTickInterval(): void {
    if (this.tickInterval) {
      window.clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private tick(): void {
    if (this.status !== 'running') return;
    const remaining = this.getRemainingSeconds();
    if (remaining <= 0) {
      this.onPhaseComplete();
      return;
    }
    this.notifyTick();
  }

  private notifyTick(): void {
    this.onTickCallback?.();
  }

  private onPhaseComplete(): void {
    if (this.phase === 'work') {
      this.completedWorkSessions++;
      void this.recordSession();
      this.playSound();
      new Notice('🍅 工作阶段完成！');
    } else {
      this.playSound();
      new Notice('☕ 休息结束！');
    }

    this.onCompleteCallback?.();
    this.transitionToNextPhase();
  }

  private transitionToNextPhase(): void {
    if (this.phase === 'work') {
      const settings = this.getSettings();
      if (this.completedWorkSessions >= (settings.pomodoroLongBreakInterval ?? 4)) {
        this.phase = 'long-break';
        this.completedWorkSessions = 0;
      } else {
        this.phase = 'short-break';
      }
    } else {
      this.phase = 'work';
    }

    this.durationMs = this.getPhaseDurationMs(this.phase);
    this.startedAt = 0;
    this.pausedRemaining = this.durationMs;

    this.status = 'running';
    this.startedAt = Date.now();
    this.ensureTickInterval();

    this.notifyTick();
  }

  private async recordSession(): Promise<void> {
    const today = formatDate(new Date());
    const existing = this.sessions.find(s => s.date === today);
    if (existing) {
      existing.completed++;
    } else {
      this.sessions.push({ date: today, completed: 1 });
    }
    this.saveSessions();
  }

  private playSound(): void {
    const settings = this.getSettings();
    if (settings.pomodoroSoundEnabled === false) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
      osc.onended = () => ctx.close();
    } catch { /* Web Audio not available */ }
  }

  getTodayCount(): number {
    const today = formatDate(new Date());
    const session = this.sessions.find(s => s.date === today);
    return session?.completed ?? 0;
  }
}
