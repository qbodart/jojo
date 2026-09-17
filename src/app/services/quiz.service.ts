import { Injectable, signal, computed } from '@angular/core';
import {
  type QuizConfig,
  type Question,
  type AnsweredQuestion,
  type QuizResult,
  CHALLENGE_DEFAULT_TARGET_SCORE,
  CHALLENGE_DEFAULT_PENALTY_SECONDS,
} from '../models/quiz.models';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly _config = signal<QuizConfig | null>(null);
  private readonly _answeredQuestions = signal<AnsweredQuestion[]>([]);
  private readonly _lastResult = signal<QuizResult | null>(null);

  // --- Uitdaging state ---
  private readonly _challengeScore = signal(0);
  private readonly _uitdagingQuestions = signal<Question[]>([]);
  private readonly _uitdagingIndex = signal(0);

  // --- Alle Tafels state ---
  private readonly _questionStack = signal<Question[]>([]);
  private readonly _originalQuestionCount = signal(0);
  private readonly _extraQuestions = signal(0);

  // --- Public signals ---
  readonly config = this._config.asReadonly();
  readonly answeredQuestions = this._answeredQuestions.asReadonly();
  readonly lastResult = this._lastResult.asReadonly();
  readonly challengeScore = this._challengeScore.asReadonly();

  readonly isUitdaging = computed(() => this._config()?.gameMode === 'uitdaging');
  readonly isAlleTafels = computed(() => this._config()?.gameMode === 'alleTafels');
  readonly inputMode = computed(() => this._config()?.inputMode ?? 'keyboard');

  readonly challengeTargetScore = computed(() =>
    this._config()?.challengeTargetScore ?? CHALLENGE_DEFAULT_TARGET_SCORE
  );

  readonly challengePenaltySeconds = computed(() =>
    this._config()?.challengePenaltySeconds ?? CHALLENGE_DEFAULT_PENALTY_SECONDS
  );

  readonly challengeProgressPercent = computed(() => {
    const target = this.challengeTargetScore();
    const score = this._challengeScore();
    return Math.min(100, Math.round((score / target) * 100));
  });

  readonly currentQuestion = computed(() => {
    const config = this._config();
    if (!config) return null;

    if (config.gameMode === 'uitdaging') {
      const questions = this._uitdagingQuestions();
      const index = this._uitdagingIndex();
      if (index < questions.length) return questions[index];
      // Recycle for uitdaging
      if (questions.length > 0) return questions[index % questions.length];
      return null;
    }

    // Alle Tafels: top of stack
    const stack = this._questionStack();
    return stack.length > 0 ? stack[0] : null;
  });

  readonly correctCount = computed(() =>
    this._answeredQuestions().filter((a) => a.isCorrect).length
  );

  readonly totalAnswered = computed(() => this._answeredQuestions().length);

  // Alle Tafels specifics
  readonly remainingCount = computed(() => this._questionStack().length);
  readonly originalQuestionCount = computed(() => this._originalQuestionCount());

  readonly alleTafelsProgressPercent = computed(() => {
    const original = this._originalQuestionCount();
    const remaining = this._questionStack().length;
    if (original === 0) return 0;
    return Math.round(((original - remaining) / original) * 100);
  });

  // ===================== START =====================

  startQuiz(config: QuizConfig): void {
    this._config.set(config);
    this._answeredQuestions.set([]);
    this._lastResult.set(null);
    this._challengeScore.set(0);
    this._uitdagingIndex.set(0);
    this._extraQuestions.set(0);

    const pool = this.generatePool(config);

    if (config.gameMode === 'uitdaging') {
      this._uitdagingQuestions.set(pool);
      this._questionStack.set([]);
      this._originalQuestionCount.set(0);
    } else {
      this._uitdagingQuestions.set([]);
      this._questionStack.set(pool);
      this._originalQuestionCount.set(pool.length);
    }
  }

  // ===================== UITDAGING =====================

  submitChallengeAnswer(
    userAnswer: number | null,
    questionElapsedSeconds: number
  ): { answered: AnsweredQuestion; won: boolean } {
    const question = this.currentQuestion();
    if (!question) throw new Error('No current question');

    const penaltySeconds = this.challengePenaltySeconds();
    const isCorrect =
      userAnswer !== null && parseInt(String(userAnswer), 10) === question.answer;
    const timePenalty = questionElapsedSeconds >= penaltySeconds;

    const answered: AnsweredQuestion = {
      question,
      userAnswer: userAnswer !== null ? parseInt(String(userAnswer), 10) : null,
      isCorrect,
      timePenalty,
    };

    this._answeredQuestions.update((list) => [...list, answered]);
    this._uitdagingIndex.update((i) => i + 1);

    let delta = isCorrect ? 1 : -1;
    if (timePenalty) delta -= 1;
    this._challengeScore.update((score) => Math.max(0, score + delta));

    const won = this._challengeScore() >= this.challengeTargetScore();
    return { answered, won };
  }

  finishChallenge(timeUsed: number): QuizResult {
    const config = this._config()!;
    const answered = this._answeredQuestions();
    const correct = answered.filter((a) => a.isCorrect).length;
    const total = answered.length;

    const result: QuizResult = {
      config,
      answeredQuestions: answered,
      correctCount: correct,
      totalCount: total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      timeUsed,
      challengeWon: true,
      challengeScore: this._challengeScore(),
    };

    this._lastResult.set(result);
    return result;
  }

  // ===================== ALLE TAFELS =====================

  submitAlleTafelsAnswer(userAnswer: number | null): AnsweredQuestion {
    const question = this.currentQuestion();
    if (!question) throw new Error('No current question');

    const isCorrect =
      userAnswer !== null && parseInt(String(userAnswer), 10) === question.answer;

    const answered: AnsweredQuestion = {
      question,
      userAnswer: userAnswer !== null ? parseInt(String(userAnswer), 10) : null,
      isCorrect,
    };

    this._answeredQuestions.update((list) => [...list, answered]);

    // Remove top of stack
    this._questionStack.update((stack) => {
      const newStack = stack.slice(1);

      if (!isCorrect && newStack.length > 0) {
        // Insert the question twice at random positions
        this._extraQuestions.update((n) => n + 2);
        const pos1 = Math.floor(Math.random() * (newStack.length + 1));
        newStack.splice(pos1, 0, { ...question });
        const pos2 = Math.floor(Math.random() * (newStack.length + 1));
        newStack.splice(pos2, 0, { ...question });
      } else if (!isCorrect && newStack.length === 0) {
        // Stack was last question and she got it wrong -- add it back twice
        this._extraQuestions.update((n) => n + 2);
        newStack.push({ ...question }, { ...question });
      }

      return newStack;
    });

    return answered;
  }

  finishAlleTafels(timeUsed: number): QuizResult {
    const config = this._config()!;
    const answered = this._answeredQuestions();
    const correct = answered.filter((a) => a.isCorrect).length;
    const total = answered.length;
    const original = this._originalQuestionCount();

    const result: QuizResult = {
      config,
      answeredQuestions: answered,
      correctCount: correct,
      totalCount: total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      timeUsed,
      originalQuestionCount: original,
      extraQuestions: this._extraQuestions(),
    };

    this._lastResult.set(result);
    return result;
  }

  // ===================== CHOICES =====================

  generateChoices(question: Question): number[] {
    const correct = question.answer;
    const tables = this._config()?.tables ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const wrongSet = new Set<number>();

    // Phase 1: table-based distractors
    if (question.operator === '×') {
      const a = question.operand1;
      const b = question.operand2;
      const candidates = [
        a * (b - 1), a * (b + 1), a * (b - 2), a * (b + 2),
        (a - 1) * b, (a + 1) * b,
      ];
      for (const c of candidates) {
        if (c > 0 && c !== correct && wrongSet.size < 2) {
          wrongSet.add(c);
        }
      }
    } else {
      for (let q = 1; q <= 10; q++) {
        if (q !== correct && wrongSet.size < 2) {
          wrongSet.add(q);
        }
      }
    }

    // Phase 2: offset-based distractors
    const offsets = [-3, 3, -2, 2, -5, 5, -1, 1, -7, 7, -4, 4, -8, 8, -6, 6, -9, 9, -10, 10];
    for (const offset of offsets) {
      if (wrongSet.size >= 3) break;
      const candidate = correct + offset;
      if (candidate > 0 && candidate !== correct && !wrongSet.has(candidate)) {
        wrongSet.add(candidate);
      }
    }

    // Fallback
    let fallback = 1;
    while (wrongSet.size < 3) {
      if (fallback !== correct && !wrongSet.has(fallback)) {
        wrongSet.add(fallback);
      }
      fallback++;
    }

    const choices = [correct, ...Array.from(wrongSet).slice(0, 3)];
    this.shuffle(choices);
    return choices;
  }

  // ===================== POOL GENERATION =====================

  private generatePool(config: QuizConfig): Question[] {
    const tables = config.tables;
    const pool: Question[] = [];

    if (config.operation === 'multiplication' || config.operation === 'both') {
      for (const a of tables) {
        for (let b = 1; b <= 10; b++) {
          pool.push({
            operand1: a,
            operand2: b,
            operator: '×',
            answer: a * b,
            label: `${a} × ${b}`,
          });
        }
      }
    }

    if (config.operation === 'division' || config.operation === 'both') {
      for (const a of tables) {
        for (let b = 1; b <= 10; b++) {
          const product = a * b;
          pool.push({
            operand1: product,
            operand2: a,
            operator: '÷',
            answer: b,
            label: `${product} ÷ ${a}`,
          });
        }
      }
    }

    this.shuffle(pool);

    // For uitdaging, avoid consecutive duplicates
    if (config.gameMode === 'uitdaging') {
      const deduped: Question[] = [];
      let lastLabel = '';
      for (const q of pool) {
        if (q.label !== lastLabel) {
          deduped.push(q);
          lastLabel = q.label;
        }
      }
      return deduped;
    }

    return pool;
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
