export type DashboardResultState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_TO_SUBMIT"
  | "AWAITING_SUBMISSION"
  | "SUBMITTED";

export function getDashboardResultState(input: {
  answeredQuestions: number;
  totalQuestions: number;
  submitted: boolean;
  isCoordinator: boolean;
}): DashboardResultState {
  if (input.submitted) return "SUBMITTED";
  if (input.answeredQuestions <= 0) return "NOT_STARTED";
  if (input.totalQuestions <= 0 || input.answeredQuestions < input.totalQuestions) {
    return "IN_PROGRESS";
  }
  return input.isCoordinator ? "READY_TO_SUBMIT" : "AWAITING_SUBMISSION";
}
