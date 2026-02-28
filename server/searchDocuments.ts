import type { CatalogTrackRecord } from "../src/shared/catalogSearch";
import type { PracticeBankProblem } from "../src/data/practiceProblemBank";
import type { CompanyRoadmap } from "../src/data/companyRoadmaps";
import type { HelpDocRecord } from "../src/data/helpDocs";

export type UnifiedSearchType = "problem" | "course" | "track" | "roadmap" | "help";
export type UnifiedSearchSection =
  | "Problems"
  | "Courses"
  | "Tracks"
  | "Roadmaps"
  | "Help Docs";

export interface UnifiedSearchDocument {
  id: string;
  title: string;
  description: string;
  tags: string[];
  type: UnifiedSearchType;
  section: UnifiedSearchSection;
  popularity: number;
  user_engagement: number;
  difficulty?: string;
  url: string;
  updated_at: string;
  track_id?: string;
  course_id?: string;
  problem_id?: string;
  roadmap_id?: string;
  help_id?: string;
}

interface SearchDocumentBuildArgs {
  tracks: CatalogTrackRecord[];
  problems: PracticeBankProblem[];
  roadmaps: CompanyRoadmap[];
  helpDocs: HelpDocRecord[];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const nowIso = (): string => new Date().toISOString();

const normalizeTag = (value: string): string => value.trim().toLowerCase();

const uniqueTags = (values: string[]): string[] => [...new Set(values.map(normalizeTag).filter(Boolean))];

const trackToDocument = (track: CatalogTrackRecord): UnifiedSearchDocument => ({
  id: `track:${track.id}`,
  type: "track",
  section: "Tracks",
  title: track.title,
  description: track.description,
  tags: uniqueTags(["track", track.level, ...track.branches, ...track.title.split(" ")]),
  popularity: clamp(55 + track.courses.length * 4, 40, 98),
  user_engagement: clamp(38 + track.courses.length * 3, 20, 90),
  difficulty: track.level,
  url: `/tracks/${track.id}`,
  updated_at: nowIso(),
  track_id: track.id,
});

const courseToDocument = (
  track: CatalogTrackRecord,
  course: CatalogTrackRecord["courses"][number],
): UnifiedSearchDocument => ({
  id: `course:${track.id}:${course.id}`,
  type: "course",
  section: "Courses",
  title: course.title,
  description: course.description,
  tags: uniqueTags([
    "course",
    "lesson",
    track.level,
    ...track.branches,
    ...track.title.split(" "),
    ...course.title.split(" "),
  ]),
  popularity: clamp(42 + course.lessons * 4, 30, 95),
  user_engagement: clamp(34 + course.lessons * 3, 22, 88),
  difficulty: track.level,
  url: `/tracks/${track.id}/courses/${course.id}`,
  updated_at: nowIso(),
  track_id: track.id,
  course_id: course.id,
});

const difficultyPopularity: Record<PracticeBankProblem["difficulty"], number> = {
  Easy: 86,
  Medium: 82,
  Hard: 76,
};

const problemToDocument = (problem: PracticeBankProblem): UnifiedSearchDocument => ({
  id: `problem:${problem.id}`,
  type: "problem",
  section: "Problems",
  title: problem.title,
  description: problem.description,
  tags: uniqueTags([
    "problem",
    "coding",
    "practice",
    problem.difficulty,
    problem.topicId ?? "",
    ...problem.tags,
  ]),
  popularity: clamp(difficultyPopularity[problem.difficulty] + problem.tags.length * 2, 45, 99),
  user_engagement: clamp(52 + problem.tags.length * 2, 30, 95),
  difficulty: problem.difficulty,
  url: `/practice?problemId=${encodeURIComponent(problem.id)}`,
  updated_at: nowIso(),
  problem_id: problem.id,
});

const roadmapToDocument = (roadmap: CompanyRoadmap): UnifiedSearchDocument => ({
  id: `roadmap:${roadmap.id}`,
  type: "roadmap",
  section: "Roadmaps",
  title: `${roadmap.company} Roadmap`,
  description: roadmap.tagline,
  tags: uniqueTags([
    "roadmap",
    "career",
    roadmap.company,
    ...roadmap.coreSkills,
    ...roadmap.hiringSignals.slice(0, 3),
  ]),
  popularity: clamp(64 + roadmap.coreSkills.length * 3, 45, 97),
  user_engagement: clamp(44 + roadmap.hiringSignals.length * 3, 30, 92),
  difficulty: "Intermediate",
  url: `/roadmaps?company=${encodeURIComponent(roadmap.id)}`,
  updated_at: nowIso(),
  roadmap_id: roadmap.id,
});

const helpToDocument = (doc: HelpDocRecord): UnifiedSearchDocument => ({
  id: `help:${doc.id}`,
  type: "help",
  section: "Help Docs",
  title: doc.title,
  description: doc.description,
  tags: uniqueTags(["help", "docs", ...doc.tags]),
  popularity: clamp(doc.popularity, 20, 99),
  user_engagement: clamp(Math.round(doc.popularity * 0.8), 20, 95),
  url: doc.url,
  updated_at: nowIso(),
  help_id: doc.id,
});

export const buildUnifiedSearchDocuments = ({
  tracks,
  problems,
  roadmaps,
  helpDocs,
}: SearchDocumentBuildArgs): UnifiedSearchDocument[] => {
  const documents: UnifiedSearchDocument[] = [];

  for (const track of tracks) {
    documents.push(trackToDocument(track));
    for (const course of track.courses) {
      documents.push(courseToDocument(track, course));
    }
  }

  for (const problem of problems) {
    documents.push(problemToDocument(problem));
  }

  for (const roadmap of roadmaps) {
    documents.push(roadmapToDocument(roadmap));
  }

  for (const doc of helpDocs) {
    documents.push(helpToDocument(doc));
  }

  return documents;
};
