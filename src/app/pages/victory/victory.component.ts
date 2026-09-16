import { Component, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { TimerService } from '../../services/timer.service';
import { ConfettiComponent } from '../../components/confetti/confetti.component';
import { OPERATION_LABELS, CHALLENGE_TARGET_SCORE } from '../../models/quiz.models';

@Component({
  selector: 'app-victory',
  standalone: true,
  imports: [ConfettiComponent],
  templateUrl: './victory.component.html',
})
export class VictoryComponent {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly timerService = inject(TimerService);

  readonly showMissed = signal(false);
  readonly result = this.quizService.lastResult;
  readonly targetScore = CHALLENGE_TARGET_SCORE;

  readonly formattedTime = computed(() => {
    const r = this.result();
    if (!r) return '0:00';
    const s = r.timeUsed;
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}m ${sec.toString().padStart(2, '0')}s`;
  });

  readonly operationLabel = computed(() => {
    const r = this.result();
    if (!r) return '';
    return OPERATION_LABELS[r.config.operation];
  });

  readonly wrongCount = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return r.totalCount - r.correctCount;
  });

  readonly missedQuestions = computed(() => {
    const r = this.result();
    if (!r) return [];
    return r.answeredQuestions.filter((a) => !a.isCorrect);
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
