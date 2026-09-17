export type Operation = 'multiplication' | 'division' | 'both';
export type GameMode = 'uitdaging' | 'alleTafels';
export type InputMode = 'keyboard' | 'choice';

export interface QuizConfig {
  operation: Operation;
  gameMode: GameMode;
  inputMode: InputMode;
  tables: number[]; // which tables to practice, e.g. [3, 6, 7, 8]
  // Uitdaging-specific:
  challengeTargetScore?: number; // 20, 50, or 100
  challengePenaltySeconds?: number; // 5, 7, or 10
}

export interface Question {
  operand1: number;
  operand2: number;
  operator: '×' | '÷';
  answer: number;
  label: string; // e.g. "7 × 8"
}

export interface AnsweredQuestion {
  question: Question;
  userAnswer: number | null;
  isCorrect: boolean;
  timePenalty?: boolean; // true if a time penalty was applied (uitdaging only)
}

export interface QuizResult {
  config: QuizConfig;
  answeredQuestions: AnsweredQuestion[];
  correctCount: number;
  totalCount: number;
  percentage: number;
  timeUsed: number; // seconds
  // Uitdaging-specific:
  challengeWon?: boolean;
  challengeScore?: number;
  // Alle Tafels-specific:
  originalQuestionCount?: number; // initial pool size before re-insertions
  extraQuestions?: number; // how many extra questions from wrong answers
}

// --- Dutch labels ---

export const OPERATION_LABELS: Record<Operation, string> = {
  multiplication: 'Maaltafels',
  division: 'Deeltafels',
  both: 'Allebei',
};

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  uitdaging: 'Uitdaging',
  alleTafels: 'Alle Tafels',
};

export const INPUT_MODE_LABELS: Record<InputMode, string> = {
  keyboard: 'Toetsenbord',
  choice: 'Keuze',
};

// --- Challenge (Uitdaging) constants ---

export const CHALLENGE_DEFAULT_TARGET_SCORE = 20;
export const CHALLENGE_TARGET_OPTIONS = [20, 50, 100];
export const CHALLENGE_DEFAULT_PENALTY_SECONDS = 5;
export const CHALLENGE_TIMER_OPTIONS = [5, 7, 10];

// --- All tables ---

export const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
