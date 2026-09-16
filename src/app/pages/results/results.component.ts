import { Component, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { TimerService } from '../../services/timer.service';
import { DIFFICULTY_SETTINGS, OPERATION_LABELS } from '../../models/quiz.models';

@Component({
  selector: 'app-results',
  standalone: true,
  templateUrl: './results.component.html',
})
export class ResultsComponent {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly timerService = inject(TimerService);

  readonly showMissed = signal(false);

  readonly result = this.quizService.lastResult;

  readonly stars = computed(() => {
    const r = this.result();
    if (!r) return 0;
    if (r.percentage >= 80) return 3;
    if (r.percentage >= 50) return 2;
    return 1;
  });

  readonly encouragement = computed(() => {
    const s = this.stars();
    switch (s) {
      case 3:
        return 'Bravo, tu es une championne !';
      case 2:
        return 'Bien joué Joséphine !';
      default:
        return "Continue à t'entraîner !";
    }
  });

  readonly missedQuestions = computed(() => {
    const r = this.result();
    if (!r) return [];
    return r.answeredQuestions.filter((a) => !a.isCorrect);
  });

  readonly configLabel = computed(() => {
    const r = this.result();
    if (!r) return '';
    const opLabel = OPERATION_LABELS[r.config.operation];
    const diffLabel = DIFFICULTY_SETTINGS[r.config.difficulty].label;
    return `${opLabel} · ${diffLabel}`;
  });

  readonly starsArray = computed(() => {
    const count = this.stars();
    return Array.from({ length: 3 }, (_, i) => i < count);
  });

  toggleMissed(): void {
    this.showMissed.update((v) => !v);
  }

  replay(): void {
    const r = this.result();
    if (r) {
      this.timerService.reset();
      this.quizService.startQuiz(r.config);
      this.router.navigate(['/quiz']);
    }
  }

  goToMenu(): void {
    this.timerService.reset();
    this.router.navigate(['/']);
  }
}
