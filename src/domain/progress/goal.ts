export interface GoalProgress {
  readonly minutes: number;
  readonly ratio: number;
  readonly done: boolean;
}

export function goalProgress(secondsToday: number, goalMinutes: number): GoalProgress {
  const minutes = Math.floor(Math.max(0, secondsToday) / 60);
  if (goalMinutes <= 0) return { minutes, ratio: 1, done: true };
  const ratio = Math.min(1, secondsToday / 60 / goalMinutes);
  return { minutes, ratio, done: ratio >= 1 };
}
