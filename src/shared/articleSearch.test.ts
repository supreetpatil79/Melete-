import { describe, expect, it } from "vitest";
import { searchTechNewsArticles } from "@/shared/articleSearch";
import type { TechNewsArticle } from "@/services/techNewsService";

const sampleArticles: TechNewsArticle[] = [
  {
    id: "a1",
    title: "Open Source AI Models Speed Up Developer Tooling",
    url: "https://example.com/a1",
    source: "Hacker News",
    publishedAt: "2026-02-17T08:20:00.000Z",
    summary: "Engineering teams adopt open source models for code generation and review.",
    score: 34,
    relevance: "personalized",
    query: "open source ai software engineering news",
  },
  {
    id: "a2",
    title: "Cloud Deployment Patterns for Large Backends",
    url: "https://example.com/a2",
    source: "Hacker News",
    publishedAt: "2026-02-16T07:20:00.000Z",
    summary: "Docker and Kubernetes patterns for resilient platform rollouts.",
    score: 31,
    relevance: "general",
    query: "cloud infrastructure software engineering",
  },
  {
    id: "a3",
    title: "Semiconductor Startup Raises for Next-Gen Chip Design",
    url: "https://example.com/a3",
    source: "TechCrunch",
    publishedAt: "2026-02-15T06:20:00.000Z",
    summary: "Chip design and EDA software are seeing renewed investor demand.",
    score: 28,
    relevance: "general",
    query: "semiconductor embedded systems",
  },
];

describe("searchTechNewsArticles", () => {
  it("returns ranked results for broad searches", () => {
    const results = searchTechNewsArticles(sampleArticles, "open source ai", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("a1");
  });

  it("supports quoted phrase matching", () => {
    const results = searchTechNewsArticles(sampleArticles, '"chip design"', 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("a3");
  });

  it("supports exclusion terms", () => {
    const results = searchTechNewsArticles(sampleArticles, "deployment -docker", 10);

    expect(results.every((item) => !`${item.title} ${item.summary}`.toLowerCase().includes("docker"))).toBe(
      true,
    );
  });

  it("supports required terms", () => {
    const results = searchTechNewsArticles(sampleArticles, "cloud +kubernetes", 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => `${item.title} ${item.summary}`.toLowerCase().includes("kubernetes"))).toBe(
      true,
    );
  });
});
