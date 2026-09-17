import { Component, signal, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { PlayerService } from '../../services/player.service';
import {
  type Operation,
  type GameMode,
  type InputMode,
  OPERATION_LABELS,
  INPUT_MODE_LABELS,
  ALL_TABLES,
  CHALLENGE_DEFAULT_TARGET_SCORE,
  CHALLENGE_TARGET_OPTIONS,
  CHALLENGE_DEFAULT_PENALTY_SECONDS,
  CHALLENGE_TIMER_OPTIONS,
} from '../../models/quiz.models';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
})
export class MenuComponent {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  protected readonly playerService = inject(PlayerService);

  readonly selectedOperation = signal<Operation | null>(null);
  readonly selectedGameMode = signal<GameMode | null>(null);
  readonly selectedInputMode = signal<InputMode>('keyboard');
  readonly selectedTables = signal<Set<number>>(new Set(ALL_TABLES));
  readonly selectedChallengeTarget = signal<number>(CHALLENGE_DEFAULT_TARGET_SCORE);
  readonly selectedChallengeTimer = signal<number>(CHALLENGE_DEFAULT_PENALTY_SECONDS);
  readonly editingName = signal(false);
  readonly nameInput = signal('');

  readonly showUitdagingOptions = computed(() => this.selectedGameMode() === 'uitdaging');
  readonly allTablesSelected = computed(() => this.selectedTables().size === ALL_TABLES.length);

  readonly operations: { key: Operation; label: string; icon: string }[] = [
    { key: 'multiplication', label: OPERATION_LABELS.multiplication, icon: '×' },
    { key: 'division', label: OPERATION_LABELS.division, icon: '÷' },
    { key: 'both', label: OPERATION_LABELS.both, icon: '×÷' },
  ];

  readonly gameModes: { key: GameMode; label: string; description: string; icon: string }[] = [
    { key: 'uitdaging', label: 'Uitdaging', description: 'Scoor punten!', icon: '⚡' },
    { key: 'alleTafels', label: 'Alle Tafels', description: 'Alles goed!', icon: '🏆' },
  ];

  readonly inputModes: { key: InputMode; label: string; icon: string }[] = [
    { key: 'keyboard', label: INPUT_MODE_LABELS.keyboard, icon: '⌨' },
    { key: 'choice', label: INPUT_MODE_LABELS.choice, icon: '☝' },
  ];

  readonly allTables = ALL_TABLES;
  readonly challengeTargetOptions = CHALLENGE_TARGET_OPTIONS;
  readonly challengeTimerOptions = CHALLENGE_TIMER_OPTIONS;

  ngOnInit(): void {
    if (!this.playerService.hasName()) {
      this.router.navigate(['/welcome']);
    }
  }

  selectOperation(op: Operation): void {
    this.selectedOperation.set(op);
  }

  selectGameMode(mode: GameMode): void {
    this.selectedGameMode.set(mode);
  }

  selectInputMode(mode: InputMode): void {
    this.selectedInputMode.set(mode);
  }

  toggleTable(table: number): void {
    this.selectedTables.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(table)) {
        // Don't allow deselecting the last one
        if (newSet.size > 1) {
          newSet.delete(table);
        }
      } else {
        newSet.add(table);
      }
      return newSet;
    });
  }

  toggleAllTables(): void {
    if (this.allTablesSelected()) {
      // Deselect all except first
      this.selectedTables.set(new Set([1]));
    } else {
      this.selectedTables.set(new Set(ALL_TABLES));
    }
  }

  selectChallengeTarget(target: number): void {
    this.selectedChallengeTarget.set(target);
  }

  selectChallengeTimer(seconds: number): void {
    this.selectedChallengeTimer.set(seconds);
  }

  isTableSelected(table: number): boolean {
    return this.selectedTables().has(table);
  }

  startEditName(): void {
    this.nameInput.set(this.playerService.name());
    this.editingName.set(true);
  }

  saveEditName(): void {
    const name = this.nameInput().trim();
    if (name) {
      this.playerService.saveName(name);
    }
    this.editingName.set(false);
  }

  canStart(): boolean {
    return (
      this.selectedOperation() !== null &&
      this.selectedGameMode() !== null &&
      this.selectedTables().size > 0
    );
  }

  startQuiz(): void {
    const operation = this.selectedOperation();
    const gameMode = this.selectedGameMode();
    if (!operation || !gameMode) return;

    this.quizService.startQuiz({
      operation,
      gameMode,
      inputMode: this.selectedInputMode(),
      tables: Array.from(this.selectedTables()).sort((a, b) => a - b),
      challengeTargetScore: gameMode === 'uitdaging' ? this.selectedChallengeTarget() : undefined,
      challengePenaltySeconds: gameMode === 'uitdaging' ? this.selectedChallengeTimer() : undefined,
    });
    this.router.navigate(['/quiz']);
  }
}
