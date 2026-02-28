import type { LearnerProfile, MistakePattern } from "@/services/learnerProfileService";

interface WrapUpMetricSet {
  solvedProblems: number;
  totalRuns: number;
  streak: number;
  acceptanceRate: number;
  strongestLanguage?: string;
  focusLanguage?: string;
  techViseQueries: number;
  techViseAnswers: number;
  helpfulVotes: number;
  communityScore: number;
}

interface WrapUpRankingSet {
  overallRank: number;
  problemRank: number;
  queryRank: number;
  answerRank: number;
  voteRank: number;
  totalContributors: number;
}

interface WrapUpScoreBreakdown {
  questionPoints: number;
  answerPoints: number;
  votePoints: number;
  solvedPoints: number;
  streakPoints: number;
  acceptancePoints: number;
}

export interface LearningWrapUpPdfInput {
  learner: {
    id: string;
    name: string;
    branch: string;
  };
  generatedAt: string;
  metrics: WrapUpMetricSet;
  rankings: WrapUpRankingSet;
  topMistakes: MistakePattern[];
  scoreBreakdown: WrapUpScoreBreakdown;
  profile: LearnerProfile;
}

interface TextEntry {
  text: string;
  kind: "title" | "heading" | "body" | "spacer";
}

interface PositionedLine {
  text: string;
  font: "F1" | "F2";
  size: number;
  y: number;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT_MARGIN = 46;
const TOP_MARGIN = 52;
const BOTTOM_MARGIN = 52;

const asDateLabel = (isoValue: string): string => {
  const parsed = Date.parse(isoValue);
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const toAscii = (value: string): string => value.replace(/[^\x20-\x7E]/g, "?");

const escapePdfText = (value: string): string =>
  toAscii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");

const wrapText = (value: string, maxChars: number): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [""];

  const words = trimmed.split(/\s+/g);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (line.length === 0) {
      line = word;
      continue;
    }

    if (`${line} ${word}`.length <= maxChars) {
      line = `${line} ${word}`;
      continue;
    }

    lines.push(line);
    line = word;
  }

  if (line.length > 0) {
    lines.push(line);
  }

  return lines;
};

const buildWrapUpEntries = (input: LearningWrapUpPdfInput): TextEntry[] => {
  const entries: TextEntry[] = [];
  const generatedLabel = asDateLabel(input.generatedAt);
  const strongestLanguage = input.metrics.strongestLanguage ?? "Not enough runs yet";
  const focusLanguage = input.metrics.focusLanguage ?? "Not enough runs yet";

  entries.push({ text: "Melete Learning Wrap-Up", kind: "title" });
  entries.push({ text: "Earn Every Line", kind: "body" });
  entries.push({ text: `Generated: ${generatedLabel}`, kind: "body" });
  entries.push({ text: `Learner: ${input.learner.name} (${input.learner.id})`, kind: "body" });
  entries.push({ text: `Branch: ${input.learner.branch.toUpperCase()}`, kind: "body" });
  entries.push({ text: "", kind: "spacer" });

  entries.push({ text: "Core Snapshot", kind: "heading" });
  entries.push({ text: `Solved problems: ${input.metrics.solvedProblems}`, kind: "body" });
  entries.push({ text: `Total coding runs: ${input.metrics.totalRuns}`, kind: "body" });
  entries.push({ text: `Acceptance rate: ${input.metrics.acceptanceRate}%`, kind: "body" });
  entries.push({ text: `Current streak: ${input.metrics.streak}`, kind: "body" });
  entries.push({ text: `Strongest language: ${strongestLanguage}`, kind: "body" });
  entries.push({ text: `Focus language: ${focusLanguage}`, kind: "body" });
  entries.push({ text: "", kind: "spacer" });

  entries.push({ text: "Community & Ranking", kind: "heading" });
  entries.push({ text: `Community score: ${input.metrics.communityScore}`, kind: "body" });
  entries.push({ text: `Overall rank: #${input.rankings.overallRank} of ${input.rankings.totalContributors}`, kind: "body" });
  entries.push({ text: `Problem rank: #${input.rankings.problemRank}`, kind: "body" });
  entries.push({ text: `Query rank: #${input.rankings.queryRank}`, kind: "body" });
  entries.push({ text: `Answer rank: #${input.rankings.answerRank}`, kind: "body" });
  entries.push({ text: `Votes rank: #${input.rankings.voteRank}`, kind: "body" });
  entries.push({ text: `TechVise queries asked: ${input.metrics.techViseQueries}`, kind: "body" });
  entries.push({ text: `TechVise answers posted: ${input.metrics.techViseAnswers}`, kind: "body" });
  entries.push({ text: `Helpful votes earned: ${input.metrics.helpfulVotes}`, kind: "body" });
  entries.push({ text: "", kind: "spacer" });

  entries.push({ text: "Score Breakdown", kind: "heading" });
  entries.push({ text: `Query points: ${input.scoreBreakdown.questionPoints}`, kind: "body" });
  entries.push({ text: `Answer points: ${input.scoreBreakdown.answerPoints}`, kind: "body" });
  entries.push({ text: `Vote points: ${input.scoreBreakdown.votePoints}`, kind: "body" });
  entries.push({ text: `Solved points: ${input.scoreBreakdown.solvedPoints}`, kind: "body" });
  entries.push({ text: `Streak points: ${input.scoreBreakdown.streakPoints}`, kind: "body" });
  entries.push({ text: `Acceptance points: ${input.scoreBreakdown.acceptancePoints}`, kind: "body" });
  entries.push({ text: "", kind: "spacer" });

  entries.push({ text: "Top Learning Gaps", kind: "heading" });
  if (input.topMistakes.length === 0) {
    entries.push({ text: "No recurring mistake patterns yet.", kind: "body" });
  } else {
    for (const mistake of input.topMistakes) {
      entries.push({ text: `- ${mistake.label}: ${mistake.count}`, kind: "body" });
    }
  }
  entries.push({ text: "", kind: "spacer" });

  entries.push({ text: "Recent Practice Sessions", kind: "heading" });
  const sessions = input.profile.recentSessions.slice(0, 12);
  if (sessions.length === 0) {
    entries.push({ text: "No recent sessions yet.", kind: "body" });
  } else {
    for (const session of sessions) {
      const createdLabel = asDateLabel(session.createdAt);
      const runtimeSeconds = Math.round(session.tookMs / 100) / 10;
      entries.push({ text: session.problemTitle, kind: "body" });
      entries.push({
        text: `  ${session.language.toUpperCase()} | ${session.passedTests}/${session.totalTests} tests | ${runtimeSeconds}s | ${createdLabel}`,
        kind: "body",
      });
    }
  }

  return entries;
};

const paginateEntries = (entries: TextEntry[]): PositionedLine[][] => {
  const pages: PositionedLine[][] = [[]];
  let pageIndex = 0;
  let y = PAGE_HEIGHT - TOP_MARGIN;

  const pushLine = (line: PositionedLine): void => {
    pages[pageIndex].push(line);
  };

  const ensureCapacity = (requiredHeight: number): void => {
    if (y - requiredHeight >= BOTTOM_MARGIN) return;
    pageIndex += 1;
    pages[pageIndex] = [];
    y = PAGE_HEIGHT - TOP_MARGIN;
  };

  for (const entry of entries) {
    if (entry.kind === "spacer") {
      y -= 8;
      ensureCapacity(0);
      continue;
    }

    const font: "F1" | "F2" = entry.kind === "body" ? "F1" : "F2";
    const size = entry.kind === "title" ? 19 : entry.kind === "heading" ? 13 : 11;
    const lineHeight = entry.kind === "title" ? 26 : entry.kind === "heading" ? 18 : 14;
    const maxChars = entry.kind === "title" ? 42 : entry.kind === "heading" ? 70 : 95;

    const lines = wrapText(entry.text, maxChars);
    for (const line of lines) {
      ensureCapacity(lineHeight);
      pushLine({ text: line, font, size, y });
      y -= lineHeight;
    }
  }

  if (pages[pages.length - 1].length === 0) {
    pages.pop();
  }

  return pages;
};

const buildPdfDocument = (pages: PositionedLine[][]): Uint8Array => {
  const objects: string[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const pageRefs: string[] = [];
  let objectIndex = 5;

  for (const page of pages) {
    const pageObjectId = objectIndex;
    const contentObjectId = objectIndex + 1;
    objectIndex += 2;

    const streamCommands = page
      .map((line) => {
        const safe = escapePdfText(line.text);
        return `BT /${line.font} ${line.size} Tf ${LEFT_MARGIN.toFixed(2)} ${line.y.toFixed(2)} Td (${safe}) Tj ET`;
      })
      .join("\n");

    objects[pageObjectId] = [
      "<<",
      "/Type /Page",
      "/Parent 2 0 R",
      `/MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}]`,
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>",
      `/Contents ${contentObjectId} 0 R`,
      ">>",
    ].join("\n");

    objects[contentObjectId] = [
      `<< /Length ${streamCommands.length} >>`,
      "stream",
      streamCommands,
      "endstream",
    ].join("\n");

    pageRefs.push(`${pageObjectId} 0 R`);
  }

  objects[2] = `<< /Type /Pages /Kids [ ${pageRefs.join(" ")} ] /Count ${pageRefs.length} >>`;

  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    const body = objects[id];
    if (!body) continue;

    offsets[id] = output.length;
    output += `${id} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n`;
  output += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    const offset = offsets[id] ?? 0;
    output += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(output);
};

const buildFileName = (name: string): string => {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

  const datePart = new Date().toISOString().slice(0, 10);
  return `${safeName || "learner"}-melete-wrap-up-${datePart}.pdf`;
};

const triggerPdfDownload = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);

  const supportsDownloadAttribute = "download" in HTMLAnchorElement.prototype;
  if (supportsDownloadAttribute) {
    anchor.click();
  } else {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
  }

  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 30_000);
};

export const downloadLearningWrapUpPdf = (input: LearningWrapUpPdfInput): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("PDF export is only available in a browser environment.");
  }

  const entries = buildWrapUpEntries(input);
  const pages = paginateEntries(entries);
  const pdfBytes = buildPdfDocument(pages);

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  triggerPdfDownload(blob, buildFileName(input.learner.name));
};
