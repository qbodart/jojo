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

  // Choice mode signals
  readonly choices = signal<number[]>([]);
  readonly selectedChoice = signal<number | null>(null);
  readonly choiceFeedbackCorrectAnswer = signal<number | null>(null); // always set during choice feedback

  // Challenge mode signals
  readonly questionStartTime = signal(0);
  readonly questionElapsed = signal(0);
  readonly challengeElapsedTotal = signal(0);

  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private questionTimerInterval: ReturnType<typeof setInterval> | null = null;
  private challengeClockInterval: ReturnType<typeof setInterval> | null = null;

  readonly isChallenge = this.quizService.isChallenge;
  readonly inputMode = this.quizService.inputMode;
  readonly challengeScore = this.quizService.challengeScore;
  readonly challengeTargetScore = this.quizService.challengeTargetScore;
  readonly challengeProgressPercent = this.quizService.challengeProgressPercent;

  readonly penaltyThreshold = this.quizService.challengePenaltySeconds;

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

  readonly showTimePenaltyWarning = computed(() => {
    return this.isChallenge() && this.questionElapsed() >= this.penaltyThreshold();
  });

  constructor() {
    // Auto-focus input when feedback clears (only in keyboard mode)
    effect(() => {
      if (!this.showingFeedback() && this.inputMode() === 'keyboard') {
        setTimeout(() => this.focusInput(), 50);
      }
    });
  }

  ngOnInit(): void {
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

    // Generate initial choices if in choice mode
    this.loadChoicesForCurrentQuestion();

    if (this.inputMode() === 'keyboard') {
      setTimeout(() => this.focusInput(), 100);
    }
  }

  ngOnDestroy(): void {
    this.timerService.stop();
    this.clearChallengeTimers();
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
  }

  // --- Keyboard mode ---

  onSubmit(): void {
    if (this.showingFeedback()) return;
    if (!this.currentQuestion()) return;

    const raw = this.userAnswer().trim();
    const parsed = raw === '' ? null : parseInt(raw, 10);
    if (parsed === null || isNaN(parsed)) return;

    this.handleAnswer(parsed);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === '.' || event.key === ',' || event.key === 'e' || event.key === 'E') {
      event.preventDefault();
    }
  }

  // --- Choice mode ---

  selectChoice(value: number): void {
    if (this.showingFeedback()) return;
    if (!this.currentQuestion()) return;

    this.selectedChoice.set(value);
    this.handleAnswer(value);
  }

  /** Get the CSS classes for a choice button based on feedback state */
  choiceButtonClass(value: number): string {
    const base = 'flex items-center justify-center p-4 sm:p-6 rounded-2xl shadow-lg font-extrabold text-2xl sm:text-3xl transition-all duration-200 cursor-pointer ';

    if (this.feedbackState() === 'none') {
      return base + 'bg-white text-purple-800 border-3 border-purple-200 hover:border-purple-400 hover:scale-105 active:scale-95';
    }

    const correctAnswer = this.choiceFeedbackCorrectAnswer();
    const selected = this.selectedChoice();

    if (value === correctAnswer) {
      // This is the correct answer -- green
      return base + 'bg-green-500 text-white border-3 border-green-600 scale-105';
    }
    if (value === selected && this.feedbackState() === 'wrong') {
      // She tapped this one and it was wrong -- red
      return base + 'bg-red-500 text-white border-3 border-red-600';
    }
    // Other buttons fade
    return base + 'bg-white text-purple-300 border-3 border-gray-200 opacity-50';
  }

  // --- Shared answer handling ---

  private handleAnswer(parsed: number): void {
    if (this.isChallenge()) {
      this.submitChallengeAnswer(parsed);
    } else {
      this.submitNormalAnswer(parsed);
    }
  }

  private submitNormalAnswer(parsed: number): void {
    // Store correct answer before submitAnswer advances the question index
    const correctAns = this.quizService.currentQuestion()!.answer;
    this.choiceFeedbackCorrectAnswer.set(correctAns);

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
      this.clearFeedbackState();

      if (!this.quizService.currentQuestion()) {
        this.finishQuiz();
      } else {
        this.loadChoicesForCurrentQuestion();
      }
    }, delay);
  }

  private submitChallengeAnswer(parsed: number): void {
    // Store correct answer before submitChallengeAnswer advances the question index
    const correctAns = this.quizService.currentQuestion()!.answer;
    this.choiceFeedbackCorrectAnswer.set(correctAns);

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
      this.clearFeedbackState();

      if (won) {
        this.finishChallengeVictory();
      } else {
        this.questionStartTime.set(Date.now());
        this.questionElapsed.set(0);
        this.loadChoicesForCurrentQuestion();
      }
    }, delay);
  }

  private clearFeedbackState(): void {
    this.feedbackState.set('none');
    this.lastCorrectAnswer.set(null);
    this.lastTimePenalty.set(false);
    this.userAnswer.set('');
    this.selectedChoice.set(null);
    this.choiceFeedbackCorrectAnswer.set(null);
    this.showingFeedback.set(false);
  }

  private loadChoicesForCurrentQuestion(): void {
    if (this.inputMode() === 'choice') {
      const question = this.quizService.currentQuestion();
      if (question) {
        this.choices.set(this.quizService.generateChoices(question));
      }
    }
  }

  private startChallengeTimers(): void {
    const now = Date.now();
    this.questionStartTime.set(now);
    this.questionElapsed.set(0);
    this.challengeElapsedTotal.set(0);

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
