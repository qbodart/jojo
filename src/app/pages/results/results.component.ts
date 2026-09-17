import { Component, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { PlayerService } from '../../services/player.service';
import { ConfettiComponent } from '../../components/confetti/confetti.component';
import { OPERATION_LABELS } from '../../models/quiz.models';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [ConfettiComponent],
  templateUrl: './results.component.html',
})
export class ResultsComponent {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  protected readonly playerService = inject(PlayerService);

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
    const name = this.playerService.name() || 'Kampioen';
    const s = this.stars();
    switch (s) {
      case 3:
        return `Fantastisch, ${name}!`;
      case 2:
        return `Goed gedaan, ${name}!`;
      default:
        return 'Blijf oefenen!';
    }
  });

  readonly isPerfect = computed(() => {
    const r = this.result();
    return r !== null && r.percentage === 100;
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
    return `${opLabel} · Alle Tafels`;
  });

  readonly formattedTime = computed(() => {
    const r = this.result();
    if (!r) return '0:00';
    const s = r.timeUsed;
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}m ${sec.toString().padStart(2, '0')}s`;
  });

  readonly extraQuestionsCount = computed(() => {
    const r = this.result();
    return r?.extraQuestions ?? 0;
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
      this.quizService.startQuiz(r.config);
      this.router.navigate(['/quiz']);
    }
  }

  goToMenu(): void {
    this.router.navigate(['/']);
  }
}
