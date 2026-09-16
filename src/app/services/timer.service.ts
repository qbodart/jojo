import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TimerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly _totalSeconds = signal(0);
  private readonly _remainingSeconds = signal(0);
  private readonly _isRunning = signal(false);
  private readonly _isFinished = signal(false);

  readonly remainingSeconds = this._remainingSeconds.asReadonly();
  readonly isRunning = this._isRunning.asReadonly();
  readonly isFinished = this._isFinished.asReadonly();

  readonly elapsedSeconds = computed(() => this._totalSeconds() - this._remainingSeconds());

  readonly progressPercent = computed(() => {
    const total = this._totalSeconds();
    if (total === 0) return 100;
    return Math.round((this._remainingSeconds() / total) * 100);
  });

  /** 'green' when > 50%, 'yellow' when 20-50%, 'red' when < 20% */
  readonly timerColor = computed(() => {
    const pct = this.progressPercent();
    if (pct > 50) return 'green';
    if (pct > 20) return 'yellow';
    return 'red';
  });

  readonly formattedTime = computed(() => {
    const s = this._remainingSeconds();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  private onFinishCallback: (() => void) | null = null;

  start(totalSeconds: number, onFinish: () => void): void {
    this.stop();
    this._totalSeconds.set(totalSeconds);
    this._remainingSeconds.set(totalSeconds);
    this._isRunning.set(true);
    this._isFinished.set(false);
    this.onFinishCallback = onFinish;

    this.intervalId = setInterval(() => {
      this._remainingSeconds.update((s) => {
        const next = s - 1;
        if (next <= 0) {
          this._remainingSeconds.set(0);
          this._isRunning.set(false);
          this._isFinished.set(true);
          this.clearInterval();
          this.onFinishCallback?.();
          return 0;
        }
        return next;
      });
    }, 1000);
  }

  stop(): void {
    this.clearInterval();
    this._isRunning.set(false);
  }

  reset(): void {
    this.stop();
    this._remainingSeconds.set(0);
    this._totalSeconds.set(0);
    this._isFinished.set(false);
    this.onFinishCallback = null;
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
