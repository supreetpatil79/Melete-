export interface HelpDocRecord {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url: string;
  popularity: number;
}

export const helpDocs: HelpDocRecord[] = [
  {
    id: "getting-started",
    title: "Getting Started with Melete",
    description:
      "Set up your account, choose your branch, and start your first mission with tracks, courses, and practice.",
    tags: ["onboarding", "account", "mission", "setup"],
    url: "/help#getting-started",
    popularity: 92,
  },
  {
    id: "practice-run-submit",
    title: "Practice: Run and Submit Workflow",
    description:
      "How to run tests, read diagnostics, and submit accepted solutions in the coding workspace.",
    tags: ["practice", "run", "submit", "compiler", "tests"],
    url: "/help#practice-run-submit",
    popularity: 95,
  },
  {
    id: "search-guide",
    title: "Search Guide and Filters",
    description:
      "Use autocomplete, filters, and result ranking to find problems, tracks, courses, and roadmaps faster.",
    tags: ["search", "filters", "autocomplete", "ranking"],
    url: "/help#search-guide",
    popularity: 88,
  },
  {
    id: "roadmap-match",
    title: "Company Roadmap Match Explained",
    description:
      "Understand internship/FTE fit scores, missing skills, and how to plan your next sprint.",
    tags: ["roadmaps", "match", "companies", "career"],
    url: "/help#roadmap-match",
    popularity: 76,
  },
  {
    id: "ai-coach",
    title: "Adaptive AI Coach and Hints",
    description:
      "Generate profile insights, gap analysis, and hints based on your recent coding sessions.",
    tags: ["ai", "coach", "hints", "gap-analysis", "profile"],
    url: "/help#ai-coach",
    popularity: 84,
  },
];
