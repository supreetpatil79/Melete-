import { beforeEach, describe, expect, it } from "vitest";
import { safeStorage } from "@/lib/safeStorage";
import { createGoal, listGoals, removeGoal, setGoalCompletion } from "@/services/goalService";

describe("goalService", () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it("creates and lists goals sorted by due date", () => {
    createGoal("user-1", {
      title: "Solve SQL set",
      dueAt: "2026-03-20T10:00:00.000Z",
      linkedItem: {
        type: "problem",
        label: "SQL Queries",
        topicId: "sql-queries",
        path: "/practice?topic=sql-queries",
      },
    });

    createGoal("user-1", {
      title: "Complete React course",
      dueAt: "2026-03-18T10:00:00.000Z",
      linkedItem: {
        type: "course",
        label: "React Development",
        trackId: "full-stack-dev",
        courseId: "react-dev",
        path: "/tracks/full-stack-dev/courses/react-dev",
      },
    });

    const goals = listGoals("user-1");

    expect(goals).toHaveLength(2);
    expect(goals[0]?.title).toBe("Complete React course");
    expect(goals[1]?.title).toBe("Solve SQL set");
  });

  it("marks goal complete and moves it after pending goals", () => {
    const first = createGoal("user-1", {
      title: "Finish project notes",
      dueAt: "2026-03-18T10:00:00.000Z",
      linkedItem: { type: "custom", label: "Project wrap-up" },
    });

    createGoal("user-1", {
      title: "Practice JavaScript",
      dueAt: "2026-03-19T10:00:00.000Z",
      linkedItem: { type: "problem", label: "JavaScript Challenges", topicId: "js-challenges" },
    });

    const updated = setGoalCompletion("user-1", first.id, true);

    expect(updated[0]?.status).toBe("pending");
    expect(updated[1]?.status).toBe("completed");
    expect(updated[1]?.completedAt).toBeTruthy();
  });

  it("stores lecture goals with YouTube metadata", () => {
    createGoal("user-1", {
      title: "Complete DBMS lecture playlist",
      dueAt: "2026-03-25T10:00:00.000Z",
      linkedItem: {
        type: "lecture",
        label: "YouTube playlist • 2 links",
        playlistUrl: "https://www.youtube.com/playlist?list=PL1234567890",
        resourceUrls: [
          "https://www.youtube.com/playlist?list=PL1234567890",
          "https://youtu.be/abcd1234",
        ],
      },
    });

    const goals = listGoals("user-1");
    expect(goals).toHaveLength(1);
    expect(goals[0]?.linkedItem.type).toBe("lecture");
    expect(goals[0]?.linkedItem.resourceUrls).toHaveLength(2);
    expect(goals[0]?.linkedItem.playlistUrl).toContain("playlist");
  });

  it("removes a goal", () => {
    const created = createGoal("user-1", {
      title: "Finish roadmap reading",
      dueAt: "2026-03-22T10:00:00.000Z",
      linkedItem: { type: "custom", label: "Roadmap review" },
    });

    const remaining = removeGoal("user-1", created.id);
    expect(remaining).toHaveLength(0);
  });
});
