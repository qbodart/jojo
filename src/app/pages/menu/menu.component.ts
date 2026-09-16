import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import {
  type Operation,
  type Difficulty,
  DIFFICULTY_SETTINGS,
  OPERATION_LABELS,
  CHALLENGE_TARGET_SCORE,
  CHALLENGE_PENALTY_SECONDS,
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
      description: `Atteins ${CHALLENGE_TARGET_SCORE} pts ! -1 si > ${CHALLENGE_PENALTY_SECONDS}s`,
    },
  ];

  selectOperation(op: Operation): void {
    this.selectedOperation.set(op);
  }

  selectDifficulty(diff: Difficulty): void {
    this.selectedDifficulty.set(diff);
  }

  canStart(): boolean {
    return this.selectedOperation() !== null && this.selectedDifficulty() !== null;
  }

  startQuiz(): void {
    const operation = this.selectedOperation();
    const difficulty = this.selectedDifficulty();
    if (!operation || !difficulty) return;

    this.quizService.startQuiz({ operation, difficulty });
    this.router.navigate(['/quiz']);
  }
}
