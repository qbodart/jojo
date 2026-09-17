import { Component, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { PlayerService } from '../../services/player.service';
import { ConfettiComponent } from '../../components/confetti/confetti.component';
import { OPERATION_LABELS } from '../../models/quiz.models';

@Component({
  selector: 'app-victory',
  standalone: true,
  imports: [ConfettiComponent],
  templateUrl: './victory.component.html',
})
export class VictoryComponent {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  protected readonly playerService = inject(PlayerService);

  readonly showMissed = signal(false);
  readonly result = this.quizService.lastResult;

  readonly targetScore = computed(() => this.result()?.challengeScore ?? 20);

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
      this.quizService.startQuiz(r.config);
      this.router.navigate(['/quiz']);
    }
  }

  goToMenu(): void {
    this.router.navigate(['/']);
  }
}
