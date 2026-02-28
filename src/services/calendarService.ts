import type { TechEvent } from "@/data/techEvents";

const toUtcDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

const addDays = (value: Date, days: number): Date => {
  const copy = new Date(value.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const asCalendarDay = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const asCalendarDateTime = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  const seconds = String(value.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const buildEventDetails = (event: TechEvent): string => {
  const lines = [
    `Organizer: ${event.organizer}`,
    `Category: ${event.category}`,
    `Mode: ${event.mode}`,
    `Level: ${event.level}`,
    `Prize: ${event.prize}`,
    `Tags: ${event.tags.join(", ")}`,
    "",
    `Event link: ${event.url}`,
  ];

  return lines.join("\n");
};

export const buildGoogleCalendarEventUrl = (event: TechEvent): string => {
  const startDate = toUtcDate(event.eventStart);
  const endExclusive = addDays(toUtcDate(event.eventEnd), 1);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${asCalendarDay(startDate)}/${asCalendarDay(endExclusive)}`,
    details: buildEventDetails(event),
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export interface GoalCalendarEvent {
  title: string;
  dueAt: string;
  durationMinutes?: number;
  details?: string;
  location?: string;
}

export const buildGoogleCalendarGoalUrl = (goal: GoalCalendarEvent): string => {
  const start = new Date(goal.dueAt);
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const durationMinutes = Math.max(15, goal.durationMinutes ?? 60);
  const end = new Date(safeStart.getTime() + durationMinutes * 60_000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: goal.title,
    dates: `${asCalendarDateTime(safeStart)}/${asCalendarDateTime(end)}`,
    details: goal.details ?? "",
    location: goal.location ?? "Melete",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
