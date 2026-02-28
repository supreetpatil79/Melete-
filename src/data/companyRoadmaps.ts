export interface RoadmapStep {
  phase: string;
  duration: string;
  objective: string;
  checklist: string[];
}

export interface CompanyRoadmap {
  id: string;
  company: string;
  logoUrl: string;
  tagline: string;
  brandFrom: string;
  brandTo: string;
  careersUrl: string;
  internshipRoadmap: RoadmapStep[];
  fteRoadmap: RoadmapStep[];
  coreSkills: string[];
  hiringSignals: string[];
}

export const companyRoadmaps: CompanyRoadmap[] = [
  {
    id: "google",
    company: "Google",
    logoUrl: "/logos/google.svg",
    tagline: "Scale-first engineering with product impact and reliability.",
    brandFrom: "#1a73e8",
    brandTo: "#34a853",
    careersUrl: "https://careers.google.com/",
    coreSkills: ["Data Structures", "System Design", "Distributed Systems", "Testing"],
    hiringSignals: [
      "Open-source or public project ownership",
      "Strong problem-solving consistency",
      "Clear design tradeoff reasoning",
    ],
    internshipRoadmap: [
      {
        phase: "Foundation",
        duration: "4 weeks",
        objective: "Build algorithm and coding interview fluency.",
        checklist: [
          "Solve 80 focused DSA problems with review notes",
          "Practice complexity analysis out loud",
          "Ship one tested mini backend service",
        ],
      },
      {
        phase: "Application Ready",
        duration: "3 weeks",
        objective: "Prepare a portfolio and referral-ready profile.",
        checklist: [
          "Resume with quantified outcomes",
          "Mock interviews (2 peer + 2 mentor)",
          "Profile polishing: GitHub, LinkedIn, project demos",
        ],
      },
      {
        phase: "Interview Sprint",
        duration: "2 weeks",
        objective: "Increase consistency under timed rounds.",
        checklist: [
          "Daily 45-min timed problem set",
          "Behavioral stories using STAR format",
          "Post-round reflection loop",
        ],
      },
    ],
    fteRoadmap: [
      {
        phase: "Advanced Problem Solving",
        duration: "5 weeks",
        objective: "Handle medium-hard coding rounds reliably.",
        checklist: [
          "150 mixed problems with topic tagging",
          "Weekly contest participation",
          "Explain optimal + acceptable alternatives",
        ],
      },
      {
        phase: "System Design",
        duration: "4 weeks",
        objective: "Design scalable systems with clear tradeoffs.",
        checklist: [
          "Design 10 systems end-to-end",
          "Estimate scale and bottlenecks",
          "Cover reliability, observability, and cost",
        ],
      },
      {
        phase: "Execution and Influence",
        duration: "2 weeks",
        objective: "Show ownership and cross-team collaboration.",
        checklist: [
          "Two production-like capstone projects",
          "Design docs with review comments",
          "Behavioral prep for ownership impact",
        ],
      },
    ],
  },
  {
    id: "microsoft",
    company: "Microsoft",
    logoUrl: "/logos/microsoft.svg",
    tagline: "Product engineering with cloud-native delivery and collaboration.",
    brandFrom: "#2563eb",
    brandTo: "#0ea5e9",
    careersUrl: "https://careers.microsoft.com/",
    coreSkills: ["C#/.NET", "Cloud Architecture", "Data Structures", "API Design"],
    hiringSignals: [
      "Strong teamwork and communication",
      "Practical cloud deployment experience",
      "Well-structured coding style",
    ],
    internshipRoadmap: [
      {
        phase: "Core Prep",
        duration: "4 weeks",
        objective: "Strengthen coding and debugging speed.",
        checklist: [
          "70 DSA questions with post-analysis",
          "One full-stack project with auth",
          "Document lessons learned in README",
        ],
      },
      {
        phase: "Cloud Practical",
        duration: "3 weeks",
        objective: "Deploy and monitor cloud workloads.",
        checklist: [
          "Deploy to Azure/GCP with CI",
          "Add telemetry dashboards",
          "Run load tests and tune bottlenecks",
        ],
      },
      {
        phase: "Interview Focus",
        duration: "2 weeks",
        objective: "Sharpen coding and behavioral performance.",
        checklist: [
          "Timed coding sessions",
          "STAR stories for growth and ownership",
          "Role-fit prep for product teams",
        ],
      },
    ],
    fteRoadmap: [
      {
        phase: "Engineering Depth",
        duration: "5 weeks",
        objective: "Demonstrate backend and architecture maturity.",
        checklist: [
          "Build event-driven service with queue",
          "Add test pyramid and quality gates",
          "Optimize latency and memory metrics",
        ],
      },
      {
        phase: "System + Product Thinking",
        duration: "4 weeks",
        objective: "Balance user needs with technical scalability.",
        checklist: [
          "Design docs for two feature systems",
          "Failure-mode analysis",
          "Migration and rollout strategy planning",
        ],
      },
      {
        phase: "Final Interview Block",
        duration: "2 weeks",
        objective: "Deliver structured solutions and communication clarity.",
        checklist: [
          "Panel simulation with peers",
          "Leadership principle mapping",
          "Rapid feedback loop on weak areas",
        ],
      },
    ],
  },
  {
    id: "amazon",
    company: "Amazon",
    logoUrl: "/logos/amazon.svg",
    tagline: "Customer-obsessed engineering with high ownership and scale.",
    brandFrom: "#f59e0b",
    brandTo: "#fb7185",
    careersUrl: "https://www.amazon.jobs/",
    coreSkills: ["DSA", "Low-level Design", "Distributed Systems", "Operational Excellence"],
    hiringSignals: [
      "Leadership principles evidence",
      "Ownership-heavy project narratives",
      "Resilience and debugging discipline",
    ],
    internshipRoadmap: [
      {
        phase: "Coding Base",
        duration: "4 weeks",
        objective: "Build confidence on coding rounds and OA style tests.",
        checklist: [
          "90 OA-style problems",
          "Edge-case debugging drills",
          "One production-like API project",
        ],
      },
      {
        phase: "LP Story Bank",
        duration: "2 weeks",
        objective: "Prepare strong behavior answers for LP rounds.",
        checklist: [
          "8 STAR stories mapped to LPs",
          "Metrics-driven outcome articulation",
          "Failure + recovery examples",
        ],
      },
      {
        phase: "Interview Rehearsal",
        duration: "2 weeks",
        objective: "Combine coding and LP responses under pressure.",
        checklist: [
          "Mock interviews with constraints",
          "Post-mock action tracker",
          "Daily revision of weak themes",
        ],
      },
    ],
    fteRoadmap: [
      {
        phase: "Advanced Coding and LLD",
        duration: "5 weeks",
        objective: "Solve harder problems with strong implementation quality.",
        checklist: [
          "120 medium-hard problems",
          "LLD for services, queues, caching",
          "Write clean, testable implementations",
        ],
      },
      {
        phase: "System Reliability",
        duration: "4 weeks",
        objective: "Design fault-tolerant systems at scale.",
        checklist: [
          "Read/write-heavy system design drills",
          "Monitoring + incident response flow",
          "Cost and performance tradeoff notes",
        ],
      },
      {
        phase: "Bar Raiser Final Prep",
        duration: "2 weeks",
        objective: "Show high ownership and principled decisions.",
        checklist: [
          "End-to-end behavior + coding mocks",
          "Document decision rationale patterns",
          "Final resume and project refinement",
        ],
      },
    ],
  },
  {
    id: "meta",
    company: "Meta",
    logoUrl: "/logos/meta.svg",
    tagline: "Fast execution and product sense with strong coding rigor.",
    brandFrom: "#0ea5e9",
    brandTo: "#6366f1",
    careersUrl: "https://www.metacareers.com/",
    coreSkills: ["DSA", "Product Design", "Backend APIs", "Performance"],
    hiringSignals: [
      "High coding velocity with correctness",
      "Product-minded tradeoff thinking",
      "Strong end-to-end feature execution",
    ],
    internshipRoadmap: [
      {
        phase: "Speed + Accuracy",
        duration: "4 weeks",
        objective: "Increase coding speed while maintaining correctness.",
        checklist: [
          "Timed medium problem blocks",
          "Template-based quick starts",
          "Post-run bug pattern logging",
        ],
      },
      {
        phase: "Feature Craft",
        duration: "3 weeks",
        objective: "Ship user-facing features with analytics.",
        checklist: [
          "One full-stack feature project",
          "Experiment + metrics instrumentation",
          "Clear README and architecture notes",
        ],
      },
      {
        phase: "Interview Loop",
        duration: "2 weeks",
        objective: "Prepare coding and product collaboration stories.",
        checklist: [
          "Pair programming simulation",
          "Behavioral stories on execution",
          "System basics for API-heavy apps",
        ],
      },
    ],
    fteRoadmap: [
      {
        phase: "Coding Mastery",
        duration: "5 weeks",
        objective: "Consistent solutions in high-pressure rounds.",
        checklist: [
          "150 curated medium-hard problems",
          "Complexity + tradeoff verbalization",
          "Debugging speed drills",
        ],
      },
      {
        phase: "System and Product Thinking",
        duration: "4 weeks",
        objective: "Design user-impactful systems at scale.",
        checklist: [
          "Design 8 product systems",
          "Data model and API versioning plans",
          "Abuse, privacy, and reliability checks",
        ],
      },
      {
        phase: "Final Calibration",
        duration: "2 weeks",
        objective: "Polish delivery and communication.",
        checklist: [
          "Complete interview day simulation",
          "Concise storytelling practice",
          "Portfolio quality pass",
        ],
      },
    ],
  },
  {
    id: "nvidia",
    company: "NVIDIA",
    logoUrl: "/logos/nvidia.svg",
    tagline: "High-performance engineering for AI, systems, and acceleration.",
    brandFrom: "#22c55e",
    brandTo: "#0891b2",
    careersUrl: "https://www.nvidia.com/en-us/about-nvidia/careers/",
    coreSkills: ["C++", "Parallel Computing", "GPU Fundamentals", "Optimization"],
    hiringSignals: [
      "Performance profiling expertise",
      "Systems-level debugging depth",
      "Applied AI or graphics projects",
    ],
    internshipRoadmap: [
      {
        phase: "Systems Fundamentals",
        duration: "4 weeks",
        objective: "Strengthen C++ and computer architecture base.",
        checklist: [
          "Implement memory and threading exercises",
          "Profile CPU/GPU workload basics",
          "Read one systems paper weekly",
        ],
      },
      {
        phase: "Applied Project",
        duration: "4 weeks",
        objective: "Build one performance-focused capstone.",
        checklist: [
          "CUDA/OpenCL starter implementation",
          "Benchmark + optimization report",
          "Write technical design notes",
        ],
      },
      {
        phase: "Interview Readiness",
        duration: "2 weeks",
        objective: "Prepare coding + low-level reasoning rounds.",
        checklist: [
          "C++ and DSA mock rounds",
          "Debugging walkthrough practice",
          "Communication drill for technical depth",
        ],
      },
    ],
    fteRoadmap: [
      {
        phase: "Performance Engineering",
        duration: "5 weeks",
        objective: "Demonstrate optimization-driven engineering ability.",
        checklist: [
          "Solve advanced C++ and systems tasks",
          "Kernel-level bottleneck analysis",
          "Write reproducible benchmark scripts",
        ],
      },
      {
        phase: "AI Systems Design",
        duration: "4 weeks",
        objective: "Design robust AI inference/training pipelines.",
        checklist: [
          "Pipeline design with throughput targets",
          "Fault tolerance + observability plan",
          "Tradeoff analysis for latency/cost",
        ],
      },
      {
        phase: "Interview Finalization",
        duration: "2 weeks",
        objective: "Polish deep technical communication.",
        checklist: [
          "Whiteboard and code optimization rounds",
          "Domain-focused behavior stories",
          "Capstone demo refinement",
        ],
      },
    ],
  },
];
