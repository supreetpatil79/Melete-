import { describe, expect, it } from "vitest";
import { tracks } from "@/data/tracks";
import { CatalogSearchEngine } from "@/shared/catalogSearch";

describe("CatalogSearchEngine", () => {
  const engine = new CatalogSearchEngine(tracks);

  it("ranks exact title matches first", () => {
    const result = engine.search("Full-Stack Development", { type: "track", limit: 5 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.results[0].type).toBe("track");
    expect(result.results[0].trackId).toBe("full-stack-dev");
  });

  it("supports fuzzy matching for typo-heavy queries", () => {
    const result = engine.search("machien learnng", { limit: 5 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.results.some((item) => item.trackId === "ai-ml")).toBe(true);
  });

  it("filters by branch", () => {
    const result = engine.search("signals", { branch: "ece", limit: 20 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.results.every((item) => item.branches.includes("ece"))).toBe(true);
  });

  it("returns only requested entity type", () => {
    const result = engine.search("deployment", { type: "course", limit: 20 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.results.every((item) => item.type === "course")).toBe(true);
  });

  it("returns trie-based title suggestions for live prefixes", () => {
    const suggestions = engine.suggest("mach", { limit: 6 });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((item) => item.trackId === "ai-ml")).toBe(true);
  });

  it("applies branch and type filters on suggestions", () => {
    const suggestions = engine.suggest("signal", { branch: "ece", type: "track", limit: 8 });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => item.type === "track")).toBe(true);
    expect(suggestions.every((item) => item.branches.includes("ece"))).toBe(true);
  });

  it("returns deeper suggestions for multi-token queries regardless of token order", () => {
    const suggestions = engine.suggest("deployment devops", { type: "course", limit: 8 });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(
      suggestions.some((item) => item.type === "course" && item.courseId === "deployment"),
    ).toBe(true);
  });

  it("supports typo-tolerant suggestions for title terms", () => {
    const suggestions = engine.suggest("machne", { limit: 8 });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((item) => item.trackId === "ai-ml")).toBe(true);
  });

  it("supports quoted phrase matching for complex queries", () => {
    const result = engine.search('"machine learning"', { type: "track", limit: 5 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.results[0].trackId).toBe("ai-ml");
  });

  it("supports exclusion operators for complex queries", () => {
    const result = engine.search("development -full", { limit: 20 });

    expect(result.total).toBeGreaterThan(0);
    expect(
      result.results.every((item) => {
        const combined = `${item.title} ${item.description} ${item.trackTitle}`.toLowerCase();
        return !combined.includes("full");
      }),
    ).toBe(true);
  });

  it("supports required operators for must-have terms", () => {
    const result = engine.search("deployment +docker", { limit: 20 });

    expect(result.total).toBeGreaterThan(0);
    expect(
      result.results.every((item) => {
        const combined = `${item.title} ${item.description} ${item.trackTitle}`.toLowerCase();
        return combined.includes("docker");
      }),
    ).toBe(true);
  });
});
