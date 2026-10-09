/** Savings goal progress & honest completion estimates. */
import { addMonths, diffMonths, monthStart, type ISODate } from "../dates";
import { percentOf } from "../money";
import type { SavingsContribution, SavingsGoal } from "../types";

type Goal = Pick<SavingsGoal, "target_minor" | "target_date" | "monthly_contribution_minor">;

export interface GoalProgress {
  currentMinor: number;
  remainingMinor: number;
  pct: number;
  reached: boolean;
  /** Months needed at the planned monthly contribution (null if no plan). */
  monthsToGo: number | null;
  estimatedCompletion: ISODate | null;
  /** Monthly amount required to hit target_date (null without a date). */
  requiredMonthlyMinor: number | null;
  onTrack: boolean | null;
}

export function goalProgress(goal: Goal, contributions: Pick<SavingsContribution, "amount_minor">[], today: ISODate): GoalProgress {
  const currentMinor = Math.max(0, contributions.reduce((s, c) => s + c.amount_minor, 0));
  const remainingMinor = Math.max(0, goal.target_minor - currentMinor);
  const reached = remainingMinor === 0;
  const monthly = goal.monthly_contribution_minor;

  const monthsToGo = reached ? 0 : monthly > 0 ? Math.ceil(remainingMinor / monthly) : null;
  const estimatedCompletion = reached ? today : monthsToGo !== null ? addMonths(monthStart(today), monthsToGo) : null;

  let requiredMonthlyMinor: number | null = null;
  let onTrack: boolean | null = null;
  if (goal.target_date && !reached) {
    const monthsLeft = Math.max(1, diffMonths(goal.target_date, today));
    requiredMonthlyMinor = Math.ceil(remainingMinor / monthsLeft);
    onTrack = monthly > 0 ? monthly >= requiredMonthlyMinor : false;
  } else if (reached) {
    onTrack = true;
  }

  return {
    currentMinor,
    remainingMinor,
    pct: Math.min(100, percentOf(currentMinor, goal.target_minor)),
    reached,
    monthsToGo,
    estimatedCompletion,
    requiredMonthlyMinor,
    onTrack,
  };
}
