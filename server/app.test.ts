// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./app";

describe("backend search API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/healthz",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.status).toBe("ok");
  });

  it("returns ranked search results", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/search",
      query: {
        q: "machine learning",
        type: "all",
        limit: "6",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.total).toBeGreaterThan(0);
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results[0]).toHaveProperty("score");
    expect(payload.backend).toBe("local");
  });

  it("returns ranked search suggestions", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/search/suggest",
      query: {
        q: "machne",
        type: "all",
        limit: "6",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Array.isArray(payload.suggestions)).toBe(true);
    expect(payload.suggestions.length).toBeGreaterThan(0);
    expect(payload.suggestions[0]).toHaveProperty("score");
    expect(payload.backend).toBe("local");
  });

  it("returns unified multi-section search results", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/search",
      query: {
        q: "run submit workflow",
        type: "all",
        limit: "10",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.total).toBeGreaterThan(0);
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results[0]).toHaveProperty("section");
    expect(payload.results[0]).toHaveProperty("highlights");
  });

  it("returns unified autocomplete results", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/search/autocomplete",
      query: {
        q: "road",
        limit: "8",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0]).toHaveProperty("score");
  });

  it("accepts search engagement payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/search/engagement",
      payload: {
        userId: "u1",
        type: "problem",
        tags: ["arrays", "hashmap"],
        query: "two sum",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.status).toBe("ok");
  });

  it("returns 503 for search reindex when Elasticsearch is not configured", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/search/reindex",
      payload: {
        reason: "test",
      },
    });

    expect(response.statusCode).toBe(503);
  });

  it("uses cache for repeated queries", async () => {
    await app.inject({
      method: "GET",
      url: "/api/search",
      query: { q: "deployment", type: "all", limit: "10" },
    });

    const secondResponse = await app.inject({
      method: "GET",
      url: "/api/search",
      query: { q: "deployment", type: "all", limit: "10" },
    });

    expect(secondResponse.statusCode).toBe(200);
    const payload = secondResponse.json();
    expect(payload.cache).toBe("hit");
  });

  it("supports advanced operators in search queries", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/search",
      query: {
        q: "deployment -full +docker",
        type: "all",
        limit: "12",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.total).toBeGreaterThan(0);
    expect(
      payload.results.every((item: { title: string; description: string; trackTitle: string }) => {
        const combined = `${item.title} ${item.description} ${item.trackTitle}`.toLowerCase();
        return combined.includes("docker") && !combined.includes("full");
      }),
    ).toBe(true);
  });

  it("rejects invalid query parameters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/search",
      query: {
        q: "a",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects invalid suggestion query parameters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/search/suggest",
      query: {
        q: "",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 503 for compiler languages when provider is not configured", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/code/languages",
    });

    expect(response.statusCode).toBe(503);
  });

  it("stores and returns code submissions", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/code/submissions",
      payload: {
        userId: "u1",
        problemId: "lc-two-sum",
        problemTitle: "Two Sum",
        language: "javascript",
        runtimeName: "JavaScript (Node.js)",
        sourceCode: "function twoSum(){ return [0,1]; }",
        totalTests: 3,
        passedTests: 3,
        tookMs: 420,
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const createPayload = createResponse.json();
    expect(createPayload.status).toBe("accepted");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/code/submissions",
      query: {
        userId: "u1",
        problemId: "lc-two-sum",
        limit: "5",
      },
    });

    expect(listResponse.statusCode).toBe(200);
    const listPayload = listResponse.json();
    expect(listPayload.total).toBeGreaterThan(0);
    expect(listPayload.rows[0].problemId).toBe("lc-two-sum");
  });

  it("validates submission payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/code/submissions",
      payload: {
        userId: "u1",
        problemId: "x",
        problemTitle: "Broken",
        language: "javascript",
        sourceCode: "a",
        totalTests: 1,
        passedTests: 2,
        tookMs: 1,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 503 for AI profile insight when OpenAI is not configured", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/profile-insight",
      payload: {
        userId: "u1",
        name: "Demo",
        branch: "cse",
        acceptanceRate: 62,
        streak: 3,
        solvedProblems: 7,
        topMistakes: [],
        recentSessions: [],
      },
    });

    expect(response.statusCode).toBe(503);
  });

  it("returns 503 for AI hint when OpenAI is not configured", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/hint",
      payload: {
        userId: "u1",
        branch: "cse",
        problemTitle: "Two Sum",
        language: "javascript",
        sourceCode: "function solve(){}",
        passedTests: 0,
        totalTests: 2,
        topMistakes: [],
      },
    });

    expect(response.statusCode).toBe(503);
  });

  it("returns fallback personalized videos when YouTube is not configured", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/learning/videos",
      payload: {
        branch: "cse",
        focusLanguage: "javascript",
        focusAreas: ["algorithms"],
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.source).toBe("fallback");
    expect(Array.isArray(payload.videos)).toBe(true);
    expect(payload.videos.length).toBeGreaterThan(0);
  });

  it("builds learning knowledge graph from user activity", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/graph/learning",
      payload: {
        userId: "u1",
        name: "Demo User",
        branch: "cse",
        strongestLanguage: "typescript",
        focusLanguage: "javascript",
        topMistakes: [
          { label: "Compile errors", count: 4 },
          { label: "Wrong answers", count: 2 },
        ],
        recentSessions: [
          {
            problemId: "two-sum",
            problemTitle: "Two Sum",
            topicTitle: "arrays",
            language: "javascript",
            passedTests: 3,
            totalTests: 4,
            tookMs: 1320,
          },
          {
            problemId: "lis",
            problemTitle: "Longest Increasing Subsequence",
            topicTitle: "dynamic programming",
            language: "typescript",
            passedTests: 2,
            totalTests: 5,
            tookMs: 2440,
          },
        ],
        techViseTags: ["backend", "system design"],
        targetCompanies: ["Google", "Amazon"],
        solvedProblems: 12,
        totalRuns: 32,
        acceptanceRate: 68,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.summary.nodeCount).toBeGreaterThan(0);
    expect(payload.summary.edgeCount).toBeGreaterThan(0);
    expect(Array.isArray(payload.nodes)).toBe(true);
    expect(Array.isArray(payload.edges)).toBe(true);
    expect(Array.isArray(payload.insights.recommendations)).toBe(true);
  });

  it("validates question recommendation payloads", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/questions/recommendations",
      payload: {
        keywords: ["a"],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
