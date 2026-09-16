export type Operation = 'multiplication' | 'division' | 'both';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'challenge';
export type InputMode = 'keyboard' | 'choice';

export interface QuizConfig {
  operation: Operation;
  difficulty: Difficulty;
  inputMode: InputMode;
  challengePenaltySeconds?: number; // only used in challenge mode
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
  timePenalty?: boolean; // true if a time penalty was applied on this question
}

export interface QuizResult {
  config: QuizConfig;
  answeredQuestions: AnsweredQuestion[];
  correctCount: number;
  totalCount: number;
  percentage: number;
  timeUsed: number; // seconds used
  totalTime: number; // total seconds allowed (0 for challenge)
  // Challenge-specific
  challengeWon?: boolean;
  challengeScore?: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, { maxTable: number; timerSeconds: number; label: string }> = {
  easy: { maxTable: 5, timerSeconds: 90, label: 'Facile' },
  medium: { maxTable: 10, timerSeconds: 75, label: 'Moyen' },
  hard: { maxTable: 10, timerSeconds: 60, label: 'Difficile' },
  challenge: { maxTable: 10, timerSeconds: 0, label: 'Défi' },
};

export const OPERATION_LABELS: Record<Operation, string> = {
  multiplication: 'Multiplications',
  division: 'Divisions',
  both: 'Les deux',
};

export const INPUT_MODE_LABELS: Record<InputMode, string> = {
  keyboard: 'Clavier',
  choice: 'Choix',
};

// Challenge mode constants
export const CHALLENGE_TARGET_SCORE = 20;
export const CHALLENGE_DEFAULT_PENALTY_SECONDS = 5;
export const CHALLENGE_TIMER_OPTIONS = [5, 7, 10];
