import { describe, expect, it } from "vitest";
import { buildGoogleCalendarEventUrl, buildGoogleCalendarGoalUrl } from "@/services/calendarService";

describe("calendarService", () => {
  it("builds a Google Calendar all-day URL with end date exclusive", () => {
    const url = buildGoogleCalendarEventUrl({
      id: "evt_1",
      title: "Hack Sprint",
      organizer: "Melete",
      category: "Hackathon",
      mode: "Online",
      location: "Global",
      registrationDeadline: "2026-03-01",
      eventStart: "2026-03-16",
      eventEnd: "2026-03-18",
      prize: "Top 3 awards",
      level: "Intermediate",
      url: "https://example.com/event",
      tags: ["backend", "api"],
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://calendar.google.com");
    expect(parsed.pathname).toBe("/calendar/render");
    expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
    expect(parsed.searchParams.get("text")).toBe("Hack Sprint");
    expect(parsed.searchParams.get("dates")).toBe("20260316/20260319");
    expect(parsed.searchParams.get("location")).toBe("Global");
    expect(parsed.searchParams.get("details")).toContain("https://example.com/event");
  });

  it("builds a timed Google Calendar URL for goals", () => {
    const url = buildGoogleCalendarGoalUrl({
      title: "Finish React module",
      dueAt: "2026-03-16T15:30:00.000Z",
      durationMinutes: 90,
      details: "Linked item: React Development",
      location: "Melete",
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://calendar.google.com");
    expect(parsed.pathname).toBe("/calendar/render");
    expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
    expect(parsed.searchParams.get("text")).toBe("Finish React module");
    expect(parsed.searchParams.get("dates")).toBe("20260316T153000Z/20260316T170000Z");
    expect(parsed.searchParams.get("details")).toContain("React Development");
    expect(parsed.searchParams.get("location")).toBe("Melete");
  });
});
