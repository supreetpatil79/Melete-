import { safeStorage } from "@/lib/safeStorage";

const GOAL_STORAGE_PREFIX = "learnpath_goals_";

export type GoalStatus = "pending" | "completed";
export type GoalPriority = "low" | "medium" | "high";
export type GoalLinkType = "course" | "problem" | "custom" | "lecture";

export interface GoalLinkedItem {
  type: GoalLinkType;
  label: string;
  trackId?: string;
  courseId?: string;
  topicId?: string;
  path?: string;
  playlistUrl?: string;
  resourceUrls?: string[];
}

export interface LearningGoal {
  id: string;
  userId: string;
  title: string;
  notes: string;
  status: GoalStatus;
  priority: GoalPriority;
  dueAt: string;
  durationMinutes: number;
  linkedItem: GoalLinkedItem;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateGoalInput {
  title: string;
  notes?: string;
  priority?: GoalPriority;
  dueAt: string;
  durationMinutes?: number;
  linkedItem: GoalLinkedItem;
}

const storageKeyForUser = (userId: string): string => `${GOAL_STORAGE_PREFIX}${userId}`;

const safeReadGoals = (userId: string): LearningGoal[] => {
  const rawValue = safeStorage.getItem(storageKeyForUser(userId));
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as LearningGoal[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

const writeGoals = (userId: string, goals: LearningGoal[]): void => {
  safeStorage.setItem(storageKeyForUser(userId), JSON.stringify(goals));
};

const compareGoals = (left: LearningGoal, right: LearningGoal): number => {
  if (left.status !== right.status) {
    return left.status === "pending" ? -1 : 1;
  }

  const leftDue = new Date(left.dueAt).getTime();
  const rightDue = new Date(right.dueAt).getTime();
  if (leftDue !== rightDue) return leftDue - rightDue;

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
};

const sortedGoals = (goals: LearningGoal[]): LearningGoal[] => goals.slice().sort(compareGoals);

export const listGoals = (userId: string): LearningGoal[] => sortedGoals(safeReadGoals(userId));

export const createGoal = (userId: string, input: CreateGoalInput): LearningGoal => {
  const now = new Date().toISOString();
  const goal: LearningGoal = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    title: input.title.trim(),
    notes: input.notes?.trim() ?? "",
    status: "pending",
    priority: input.priority ?? "medium",
    dueAt: input.dueAt,
    durationMinutes: Math.max(15, input.durationMinutes ?? 60),
    linkedItem: input.linkedItem,
    createdAt: now,
    updatedAt: now,
  };

  const current = safeReadGoals(userId);
  current.push(goal);
  writeGoals(userId, current);
  return goal;
};

export const setGoalCompletion = (userId: string, goalId: string, isCompleted: boolean): LearningGoal[] => {
  const current = safeReadGoals(userId);
  const next = current.map((goal) => {
    if (goal.id !== goalId) return goal;

    const now = new Date().toISOString();
    return {
      ...goal,
      status: isCompleted ? "completed" : "pending",
      completedAt: isCompleted ? now : undefined,
      updatedAt: now,
    };
  });

  writeGoals(userId, next);
  return sortedGoals(next);
};

export const removeGoal = (userId: string, goalId: string): LearningGoal[] => {
  const current = safeReadGoals(userId);
  const next = current.filter((goal) => goal.id !== goalId);
  writeGoals(userId, next);
  return sortedGoals(next);
};
