import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'reken-kampioen-name';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly _name = signal('');

  readonly name = this._name.asReadonly();
  readonly hasName = computed(() => this._name().trim().length > 0);

  constructor() {
    this.loadName();
  }

  saveName(name: string): void {
    const trimmed = name.trim();
    this._name.set(trimmed);
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // localStorage might be unavailable (private browsing, etc.)
    }
  }

  clearName(): void {
    this._name.set('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private loadName(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this._name.set(stored);
      }
    } catch {
      // ignore
    }
  }
}
