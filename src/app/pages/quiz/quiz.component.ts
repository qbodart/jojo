import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  viewChild,
  ElementRef,
  effect,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../services/quiz.service';
import { TimerService } from '../../services/timer.service';
import { CHALLENGE_PENALTY_SECONDS } from '../../models/quiz.models';
import type { AnsweredQuestion } from '../../models/quiz.models';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quiz.component.html',
})
export class QuizComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  protected readonly quizService = inject(QuizService);
  protected readonly timerService = inject(TimerService);

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('answerInput');

  readonly userAnswer = signal('');
  readonly feedbackState = signal<'none' | 'correct' | 'wrong'>('none');
  readonly lastCorrectAnswer = signal<number | null>(null);
  readonly showingFeedback = signal(false);
  readonly lastTimePenalty = signal(false);

  // Challenge mode signals
  readonly questionStartTime = signal(0);
  readonly questionElapsed = signal(0); // seconds elapsed on current question
  readonly challengeElapsedTotal = signal(0); // total seconds elapsed in challenge

  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private questionTimerInterval: ReturnType<typeof setInterval> | null = null;
  private challengeClockInterval: ReturnType<typeof setInterval> | null = null;

  readonly isChallenge = this.quizService.isChallenge;
  readonly challengeScore = this.quizService.challengeScore;
  readonly challengeTargetScore = this.quizService.challengeTargetScore;
  readonly challengeProgressPercent = this.quizService.challengeProgressPercent;
  readonly penaltyThreshold = CHALLENGE_PENALTY_SECONDS;

  // Encouraging messages
  private readonly correctMessages = [
    'Bravo !',
    'Super !',
    'Excellent !',
    'Génial !',
    'Parfait !',
    'Trop forte !',
    'Bien joué !',
    'Magnifique !',
  ];

  private readonly wrongMessages = [
    'Pas grave, on continue !',
    'La prochaine sera la bonne !',
    'Continue, tu vas y arriver !',
    'Presque !',
    'Allez, on ne lâche rien !',
  ];

  readonly feedbackMessage = signal('');

  readonly currentQuestion = this.quizService.currentQuestion;
  readonly correctCount = this.quizService.correctCount;
  readonly totalAnswered = this.quizService.totalAnswered;

  readonly remainingSeconds = this.timerService.remainingSeconds;
  readonly formattedTime = this.timerService.formattedTime;
  readonly progressPercent = this.timerService.progressPercent;
  readonly timerColor = this.timerService.timerColor;

  readonly timerBarClasses = computed(() => {
    const color = this.timerColor();
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-amber-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-green-500';
    }
  });

  readonly challengeFormattedTime = computed(() => {
    const s = this.challengeElapsedTotal();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  readonly challengeBarColor = computed(() => {
    const pct = this.challengeProgressPercent();
    if (pct >= 80) return 'bg-gradient-to-r from-amber-400 to-yellow-400';
    if (pct >= 50) return 'bg-gradient-to-r from-purple-400 to-pink-400';
    return 'bg-gradient-to-r from-indigo-400 to-purple-400';
  });

  /** True if the current question has been open for >= 5 seconds */
  readonly showTimePenaltyWarning = computed(() => {
    return this.isChallenge() && this.questionElapsed() >= CHALLENGE_PENALTY_SECONDS;
  });

  constructor() {
    // Auto-focus input when feedback clears
    effect(() => {
      if (!this.showingFeedback()) {
        setTimeout(() => this.focusInput(), 50);
      }
    });
  }

  ngOnInit(): void {
    // Guard: if no quiz config, go back to menu
    if (!this.quizService.config()) {
      this.router.navigate(['/']);
      return;
    }

    if (this.isChallenge()) {
      this.startChallengeTimers();
    } else {
      const totalSeconds = this.quizService.timerSeconds();
      this.timerService.start(totalSeconds, () => this.onTimerFinish());
    }

    setTimeout(() => this.focusInput(), 100);
  }

  ngOnDestroy(): void {
    this.timerService.stop();
    this.clearChallengeTimers();
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
  }

  onSubmit(): void {
    if (this.showingFeedback()) return;
    if (!this.currentQuestion()) return;

    const raw = this.userAnswer().trim();
    const parsed = raw === '' ? null : parseInt(raw, 10);
    if (parsed === null || isNaN(parsed)) return;

    if (this.isChallenge()) {
      this.submitChallengeAnswer(parsed);
    } else {
      this.submitNormalAnswer(parsed);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === '.' || event.key === ',' || event.key === 'e' || event.key === 'E') {
      event.preventDefault();
    }
  }

  private submitNormalAnswer(parsed: number): void {
    const result: AnsweredQuestion = this.quizService.submitAnswer(parsed);

    this.showingFeedback.set(true);
    this.lastTimePenalty.set(false);

    if (result.isCorrect) {
      this.feedbackState.set('correct');
      this.feedbackMessage.set(this.randomMessage(this.correctMessages));
      this.lastCorrectAnswer.set(null);
    } else {
      this.feedbackState.set('wrong');
      this.feedbackMessage.set(this.randomMessage(this.wrongMessages));
      this.lastCorrectAnswer.set(result.question.answer);
    }

    const delay = result.isCorrect ? 800 : 1500;
    this.feedbackTimeout = setTimeout(() => {
      this.feedbackState.set('none');
      this.lastCorrectAnswer.set(null);
      this.userAnswer.set('');
      this.showingFeedback.set(false);

      if (!this.quizService.currentQuestion()) {
        this.finishQuiz();
      }
    }, delay);
  }

  private submitChallengeAnswer(parsed: number): void {
    const elapsed = this.questionElapsed();
    const { answered, won } = this.quizService.submitChallengeAnswer(parsed, elapsed);

    this.showingFeedback.set(true);
    this.lastTimePenalty.set(answered.timePenalty ?? false);

    if (answered.isCorrect) {
      this.feedbackState.set('correct');
      this.feedbackMessage.set(this.randomMessage(this.correctMessages));
      this.lastCorrectAnswer.set(null);
    } else {
      this.feedbackState.set('wrong');
      this.feedbackMessage.set(this.randomMessage(this.wrongMessages));
      this.lastCorrectAnswer.set(answered.question.answer);
    }

    const delay = answered.isCorrect ? 800 : 1500;
    this.feedbackTimeout = setTimeout(() => {
      this.feedbackState.set('none');
      this.lastCorrectAnswer.set(null);
      this.lastTimePenalty.set(false);
      this.userAnswer.set('');
      this.showingFeedback.set(false);

      if (won) {
        this.finishChallengeVictory();
      } else {
        // Reset question timer for next question
        this.questionStartTime.set(Date.now());
        this.questionElapsed.set(0);
      }
    }, delay);
  }

  private startChallengeTimers(): void {
    const now = Date.now();
    this.questionStartTime.set(now);
    this.questionElapsed.set(0);
    this.challengeElapsedTotal.set(0);

    // Tick every second to update question elapsed and total elapsed
    const startedAt = now;
    this.questionTimerInterval = setInterval(() => {
      const currentQuestionStart = this.questionStartTime();
      this.questionElapsed.set(Math.floor((Date.now() - currentQuestionStart) / 1000));
      this.challengeElapsedTotal.set(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
  }

  private clearChallengeTimers(): void {
    if (this.questionTimerInterval !== null) {
      clearInterval(this.questionTimerInterval);
      this.questionTimerInterval = null;
    }
    if (this.challengeClockInterval !== null) {
      clearInterval(this.challengeClockInterval);
      this.challengeClockInterval = null;
    }
  }

  private onTimerFinish(): void {
    this.finishQuiz();
  }

  private finishQuiz(): void {
    const timeUsed = this.timerService.elapsedSeconds();
    this.timerService.stop();
    this.quizService.finishQuiz(timeUsed);
    this.router.navigate(['/results']);
  }

  private finishChallengeVictory(): void {
    const timeUsed = this.challengeElapsedTotal();
    this.clearChallengeTimers();
    this.quizService.finishChallenge(timeUsed);
    this.router.navigate(['/victory']);
  }

  private focusInput(): void {
    this.inputRef()?.nativeElement?.focus();
  }

  private randomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
  }
}
