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

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('answerInput');

  readonly userAnswer = signal('');
  readonly feedbackState = signal<'none' | 'correct' | 'wrong'>('none');
  readonly lastCorrectAnswer = signal<number | null>(null);
  readonly showingFeedback = signal(false);
  readonly lastTimePenalty = signal(false);

  // Choice mode signals
  readonly choices = signal<number[]>([]);
  readonly selectedChoice = signal<number | null>(null);
  readonly choiceFeedbackCorrectAnswer = signal<number | null>(null);

  // Uitdaging timing signals
  readonly questionStartTime = signal(0);
  readonly questionElapsed = signal(0);
  readonly elapsedTotal = signal(0);

  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;

  readonly isUitdaging = this.quizService.isUitdaging;
  readonly isAlleTafels = this.quizService.isAlleTafels;
  readonly inputMode = this.quizService.inputMode;
  readonly challengeScore = this.quizService.challengeScore;
  readonly challengeTargetScore = this.quizService.challengeTargetScore;
  readonly challengeProgressPercent = this.quizService.challengeProgressPercent;
  readonly penaltyThreshold = this.quizService.challengePenaltySeconds;

  // Alle Tafels signals
  readonly remainingCount = this.quizService.remainingCount;
  readonly originalQuestionCount = this.quizService.originalQuestionCount;
  readonly alleTafelsProgressPercent = this.quizService.alleTafelsProgressPercent;
  readonly correctCount = this.quizService.correctCount;
  readonly totalAnswered = this.quizService.totalAnswered;

  // Dutch encouraging messages
  private readonly correctMessages = [
    'Goed zo!',
    'Super!',
    'Fantastisch!',
    'Perfect!',
    'Geweldig!',
    'Top!',
    'Uitstekend!',
    'Knap!',
  ];

  private readonly wrongMessages = [
    'Niet erg, we gaan verder!',
    'De volgende keer beter!',
    'Je kunt het!',
    'Bijna!',
    'Geef niet op!',
  ];

  readonly feedbackMessage = signal('');
  readonly currentQuestion = this.quizService.currentQuestion;

  readonly formattedElapsed = computed(() => {
    const s = this.elapsedTotal();
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

  readonly alleTafelsBarColor = computed(() => {
    const pct = this.alleTafelsProgressPercent();
    if (pct >= 80) return 'bg-gradient-to-r from-emerald-400 to-green-400';
    if (pct >= 50) return 'bg-gradient-to-r from-teal-400 to-emerald-400';
    return 'bg-gradient-to-r from-sky-400 to-teal-400';
  });

  readonly showTimePenaltyWarning = computed(() => {
    return this.isUitdaging() && this.questionElapsed() >= this.penaltyThreshold();
  });

  constructor() {
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

    this.startTimers();
    this.loadChoicesForCurrentQuestion();

    if (this.inputMode() === 'keyboard') {
      setTimeout(() => this.focusInput(), 100);
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
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

  choiceButtonClass(value: number): string {
    const base = 'flex items-center justify-center p-4 sm:p-6 rounded-2xl shadow-lg font-extrabold text-2xl sm:text-3xl transition-all duration-200 cursor-pointer ';

    if (this.feedbackState() === 'none') {
      return base + 'bg-white text-purple-800 border-3 border-purple-200 hover:border-purple-400 hover:scale-105 active:scale-95';
    }

    const correctAnswer = this.choiceFeedbackCorrectAnswer();
    const selected = this.selectedChoice();

    if (value === correctAnswer) {
      return base + 'bg-green-500 text-white border-3 border-green-600 scale-105';
    }
    if (value === selected && this.feedbackState() === 'wrong') {
      return base + 'bg-red-500 text-white border-3 border-red-600';
    }
    return base + 'bg-white text-purple-300 border-3 border-gray-200 opacity-50';
  }

  // --- Shared answer handling ---

  private handleAnswer(parsed: number): void {
    const correctAns = this.quizService.currentQuestion()!.answer;
    this.choiceFeedbackCorrectAnswer.set(correctAns);

    if (this.isUitdaging()) {
      this.submitUitdagingAnswer(parsed);
    } else {
      this.submitAlleTafelsAnswer(parsed);
    }
  }

  private submitUitdagingAnswer(parsed: number): void {
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
        this.finishUitdagingVictory();
      } else {
        this.questionStartTime.set(Date.now());
        this.questionElapsed.set(0);
        this.loadChoicesForCurrentQuestion();
      }
    }, delay);
  }

  private submitAlleTafelsAnswer(parsed: number): void {
    const answered: AnsweredQuestion = this.quizService.submitAlleTafelsAnswer(parsed);

    this.showingFeedback.set(true);
    this.lastTimePenalty.set(false);

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

      // Check if stack is empty -> finished
      if (this.quizService.remainingCount() === 0) {
        this.finishAlleTafels();
      } else {
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

  // --- Timers ---

  private startTimers(): void {
    const now = Date.now();
    this.startedAt = now;
    this.questionStartTime.set(now);
    this.questionElapsed.set(0);
    this.elapsedTotal.set(0);

    this.tickInterval = setInterval(() => {
      const qStart = this.questionStartTime();
      this.questionElapsed.set(Math.floor((Date.now() - qStart) / 1000));
      this.elapsedTotal.set(Math.floor((Date.now() - this.startedAt) / 1000));
    }, 1000);
  }

  private clearTimers(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private finishUitdagingVictory(): void {
    const timeUsed = this.elapsedTotal();
    this.clearTimers();
    this.quizService.finishChallenge(timeUsed);
    this.router.navigate(['/victory']);
  }

  private finishAlleTafels(): void {
    const timeUsed = this.elapsedTotal();
    this.clearTimers();
    this.quizService.finishAlleTafels(timeUsed);
    this.router.navigate(['/results']);
  }

  private focusInput(): void {
    this.inputRef()?.nativeElement?.focus();
  }

  private randomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
  }
}
