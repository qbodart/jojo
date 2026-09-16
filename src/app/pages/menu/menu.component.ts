import { Component, signal, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import {
  type Operation,
  type Difficulty,
  type InputMode,
  DIFFICULTY_SETTINGS,
  OPERATION_LABELS,
  INPUT_MODE_LABELS,
  CHALLENGE_TARGET_SCORE,
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

  readonly selectedOperation = signal<Operation | null>(null);
  readonly selectedDifficulty = signal<Difficulty | null>(null);
  readonly selectedInputMode = signal<InputMode>('keyboard');
  readonly selectedChallengeTimer = signal<number>(CHALLENGE_DEFAULT_PENALTY_SECONDS);

  readonly showChallengeTimer = computed(() => this.selectedDifficulty() === 'challenge');

  readonly operations: { key: Operation; label: string; icon: string }[] = [
    { key: 'multiplication', label: OPERATION_LABELS.multiplication, icon: '×' },
    { key: 'division', label: OPERATION_LABELS.division, icon: '÷' },
    { key: 'both', label: OPERATION_LABELS.both, icon: '×÷' },
  ];

  readonly difficulties: { key: Difficulty; label: string; description: string }[] = [
    {
      key: 'easy',
      label: DIFFICULTY_SETTINGS.easy.label,
      description: `Tables de 1 à ${DIFFICULTY_SETTINGS.easy.maxTable} · ${DIFFICULTY_SETTINGS.easy.timerSeconds}s`,
    },
    {
      key: 'medium',
      label: DIFFICULTY_SETTINGS.medium.label,
      description: `Tables de 1 à ${DIFFICULTY_SETTINGS.medium.maxTable} · ${DIFFICULTY_SETTINGS.medium.timerSeconds}s`,
    },
    {
      key: 'hard',
      label: DIFFICULTY_SETTINGS.hard.label,
      description: `Tables de 1 à ${DIFFICULTY_SETTINGS.hard.maxTable} · ${DIFFICULTY_SETTINGS.hard.timerSeconds}s`,
    },
    {
      key: 'challenge',
      label: DIFFICULTY_SETTINGS.challenge.label,
      description: `Atteins ${CHALLENGE_TARGET_SCORE} pts !`,
    },
  ];

  readonly inputModes: { key: InputMode; label: string; icon: string }[] = [
    { key: 'keyboard', label: INPUT_MODE_LABELS.keyboard, icon: '⌨' },
    { key: 'choice', label: INPUT_MODE_LABELS.choice, icon: '☝' },
  ];

  readonly challengeTimerOptions = CHALLENGE_TIMER_OPTIONS;

  selectOperation(op: Operation): void {
    this.selectedOperation.set(op);
  }

  selectDifficulty(diff: Difficulty): void {
    this.selectedDifficulty.set(diff);
  }

  selectInputMode(mode: InputMode): void {
    this.selectedInputMode.set(mode);
  }

  selectChallengeTimer(seconds: number): void {
    this.selectedChallengeTimer.set(seconds);
  }

  canStart(): boolean {
    return this.selectedOperation() !== null && this.selectedDifficulty() !== null;
  }

  startQuiz(): void {
    const operation = this.selectedOperation();
    const difficulty = this.selectedDifficulty();
    if (!operation || !difficulty) return;

    this.quizService.startQuiz({
      operation,
      difficulty,
      inputMode: this.selectedInputMode(),
      challengePenaltySeconds: difficulty === 'challenge' ? this.selectedChallengeTimer() : undefined,
    });
    this.router.navigate(['/quiz']);
  }
}
