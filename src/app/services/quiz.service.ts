import { Injectable, signal, computed } from '@angular/core';
import {
  type QuizConfig,
  type Question,
  type AnsweredQuestion,
  type QuizResult,
  DIFFICULTY_SETTINGS,
  CHALLENGE_TARGET_SCORE,
  CHALLENGE_DEFAULT_PENALTY_SECONDS,
} from '../models/quiz.models';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly _config = signal<QuizConfig | null>(null);
  private readonly _questions = signal<Question[]>([]);
  private readonly _currentIndex = signal(0);
  private readonly _answeredQuestions = signal<AnsweredQuestion[]>([]);
  private readonly _lastResult = signal<QuizResult | null>(null);
  private readonly _challengeScore = signal(0);

  readonly config = this._config.asReadonly();
  readonly currentIndex = this._currentIndex.asReadonly();
  readonly answeredQuestions = this._answeredQuestions.asReadonly();
  readonly lastResult = this._lastResult.asReadonly();
  readonly challengeScore = this._challengeScore.asReadonly();

  readonly isChallenge = computed(() => this._config()?.difficulty === 'challenge');
  readonly inputMode = computed(() => this._config()?.inputMode ?? 'keyboard');

  readonly challengeTargetScore = CHALLENGE_TARGET_SCORE;

  readonly challengePenaltySeconds = computed(() => {
    const config = this._config();
    return config?.challengePenaltySeconds ?? CHALLENGE_DEFAULT_PENALTY_SECONDS;
  });

  readonly challengeProgressPercent = computed(() => {
    const score = this._challengeScore();
    return Math.min(100, Math.round((score / CHALLENGE_TARGET_SCORE) * 100));
  });

  readonly currentQuestion = computed(() => {
    const questions = this._questions();
    const index = this._currentIndex();
    if (index < questions.length) return questions[index];
    // For challenge mode: recycle questions when pool is exhausted
    if (this.isChallenge() && questions.length > 0) {
      return questions[index % questions.length];
    }
    return null;
  });

  readonly correctCount = computed(() =>
    this._answeredQuestions().filter((a) => a.isCorrect).length
  );

  readonly totalAnswered = computed(() => this._answeredQuestions().length);

  readonly timerSeconds = computed(() => {
    const config = this._config();
    if (!config) return 60;
    return DIFFICULTY_SETTINGS[config.difficulty].timerSeconds;
  });

  startQuiz(config: QuizConfig): void {
    this._config.set(config);
    this._currentIndex.set(0);
    this._answeredQuestions.set([]);
    this._lastResult.set(null);
    this._challengeScore.set(0);

    const questions = this.generateQuestions(config);
    this._questions.set(questions);
  }

  submitAnswer(userAnswer: number | null): AnsweredQuestion {
    const question = this.currentQuestion();
    if (!question) {
      throw new Error('No current question');
    }

    const isCorrect =
      userAnswer !== null && parseInt(String(userAnswer), 10) === question.answer;

    const answered: AnsweredQuestion = {
      question,
      userAnswer: userAnswer !== null ? parseInt(String(userAnswer), 10) : null,
      isCorrect,
    };

    this._answeredQuestions.update((list) => [...list, answered]);
    this._currentIndex.update((i) => i + 1);

    return answered;
  }

  /**
   * Submit an answer in challenge mode.
   * Returns the answered question and whether the challenge target has been reached.
   */
  submitChallengeAnswer(
    userAnswer: number | null,
    questionElapsedSeconds: number
  ): { answered: AnsweredQuestion; won: boolean } {
    const question = this.currentQuestion();
    if (!question) {
      throw new Error('No current question');
    }

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
    this._currentIndex.update((i) => i + 1);

    // Calculate score delta
    let delta = isCorrect ? 1 : -1;
    if (timePenalty) delta -= 1;

    this._challengeScore.update((score) => Math.max(0, score + delta));

    const won = this._challengeScore() >= CHALLENGE_TARGET_SCORE;
    return { answered, won };
  }

  /**
   * Generate 4 choices for a multiple choice question.
   * Returns an array of 4 numbers: 1 correct + 3 distractors, shuffled.
   */
  generateChoices(question: Question): number[] {
    const correct = question.answer;
    const maxTable = DIFFICULTY_SETTINGS[this._config()?.difficulty ?? 'medium'].maxTable;
    const wrongSet = new Set<number>();

    // Phase 1: table-based distractors
    if (question.operator === '×') {
      // For a × b, try a×(b±1), a×(b±2), (a±1)×b
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
      // For c ÷ a = b, try other quotients from the same divisor
      const divisor = question.operand2;
      for (let q = 1; q <= maxTable; q++) {
        if (q !== correct && wrongSet.size < 2) {
          wrongSet.add(q);
        }
      }
    }

    // Phase 2: offset-based distractors to fill remaining
    const offsets = [-3, 3, -2, 2, -5, 5, -1, 1, -7, 7, -4, 4, -8, 8, -6, 6, -9, 9, -10, 10];
    for (const offset of offsets) {
      if (wrongSet.size >= 3) break;
      const candidate = correct + offset;
      if (candidate > 0 && candidate !== correct && !wrongSet.has(candidate)) {
        wrongSet.add(candidate);
      }
    }

    // Fallback: if still not enough (very unlikely), add random values
    let fallback = 1;
    while (wrongSet.size < 3) {
      if (fallback !== correct && !wrongSet.has(fallback)) {
        wrongSet.add(fallback);
      }
      fallback++;
    }

    const choices = [correct, ...Array.from(wrongSet).slice(0, 3)];

    // Shuffle using Fisher-Yates
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }

    return choices;
  }

  finishQuiz(timeUsed: number): QuizResult {
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
      totalTime: DIFFICULTY_SETTINGS[config.difficulty].timerSeconds,
    };

    this._lastResult.set(result);
    return result;
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
      totalTime: 0,
      challengeWon: true,
      challengeScore: this._challengeScore(),
    };

    this._lastResult.set(result);
    return result;
  }

  private generateQuestions(config: QuizConfig): Question[] {
    const maxTable = DIFFICULTY_SETTINGS[config.difficulty].maxTable;
    const questions: Question[] = [];

    // Generate a pool of all possible questions
    const pool: Question[] = [];

    if (config.operation === 'multiplication' || config.operation === 'both') {
      for (let a = 1; a <= maxTable; a++) {
        for (let b = 1; b <= maxTable; b++) {
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
      for (let a = 1; a <= maxTable; a++) {
        for (let b = 1; b <= maxTable; b++) {
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

    // Shuffle the pool using Fisher-Yates
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // For challenge mode, keep the full shuffled pool (questions recycle via modulo)
    // For normal mode, take up to 100 questions
    const maxQuestions = config.difficulty === 'challenge' ? shuffled.length : 100;

    // Avoid consecutive duplicates (same label)
    let lastLabel = '';
    for (const q of shuffled) {
      if (q.label !== lastLabel) {
        questions.push(q);
        lastLabel = q.label;
      }
      if (questions.length >= maxQuestions) break;
    }

    return questions;
  }
}
