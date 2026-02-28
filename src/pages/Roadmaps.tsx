import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  FileUp,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getLearnerDnaSummary } from "@/services/learnerProfileService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { companyRoadmaps, type CompanyRoadmap, type RoadmapStep } from "@/data/companyRoadmaps";
import { getCompanyTechAdvice } from "@/services/techviseService";
import CompanyCard from "@/components/CompanyCard";

type RoleMode = "internship" | "fte";

interface MatchSummary {
  internship: number;
  fte: number;
  missingSkills: string[];
}

const normalize = (value: string): string => value.toLowerCase().trim();

const RoadmapSteps = ({ steps }: { steps: RoadmapStep[] }) => (
  <div className="space-y-4">
    {steps.map((step, index) => (
      <Card key={`${step.phase}-${index}`} className="border border-border bg-card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">{step.phase}</h4>
          <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {step.duration}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{step.objective}</p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {step.checklist.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    ))}
  </div>
);

const computeMatchSummary = (
  company: CompanyRoadmap,
  dna: ReturnType<typeof getLearnerDnaSummary> | null,
): MatchSummary => {
  if (!dna) {
    return {
      internship: 52,
      fte: 44,
      missingSkills: company.coreSkills.slice(0, 2),
    };
  }

  const acceptanceScore = Math.min(42, dna.acceptanceRate * 0.42);
  const solvedScore = Math.min(30, dna.solvedProblems / 4);
  const streakScore = Math.min(8, dna.streak * 0.8);
  const fundamentals = 18 + acceptanceScore + solvedScore + streakScore;

  const learnerSignals = [
    normalize(dna.focusLanguage ?? ""),
    normalize(dna.strongestLanguage ?? ""),
    ...dna.topMistakes.map((item) => normalize(item.label)),
  ].filter(Boolean);

  const matchingCore = company.coreSkills.filter((skill) => {
    const normalizedSkill = normalize(skill);
    return learnerSignals.some((signal) => normalizedSkill.includes(signal) || signal.includes(normalizedSkill));
  });

  const missingSkills = company.coreSkills.filter((skill) => !matchingCore.includes(skill));
  const skillBonus = Math.min(16, matchingCore.length * 4);

  const internship = Math.max(32, Math.min(96, Math.round(fundamentals + skillBonus)));
  const fte = Math.max(28, Math.min(94, Math.round(internship - 8 + Math.min(6, dna.solvedProblems / 30))));

  return {
    internship,
    fte,
    missingSkills,
  };
};

const RoadmapsPage = () => {
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyRoadmaps[0]?.id ?? "");
  const [activeRole, setActiveRole] = useState<RoleMode>("internship");
  const [uploadedResumeName, setUploadedResumeName] = useState<string>("");
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  const learnerDna = useMemo(
    () => (user ? getLearnerDnaSummary(user.id, user.branch) : null),
    [user],
  );

  const selectedCompany = useMemo(
    () => companyRoadmaps.find((company) => company.id === selectedCompanyId) ?? companyRoadmaps[0],
    [selectedCompanyId],
  );

  const matchByCompany = useMemo(() => {
    const entries = companyRoadmaps.map((company) => [
      company.id,
      computeMatchSummary(company, learnerDna),
    ]);
    return Object.fromEntries(entries) as Record<string, MatchSummary>;
  }, [learnerDna]);

  const selectedMatch = matchByCompany[selectedCompany.id];

  const insiderAdvice = useMemo(
    () => getCompanyTechAdvice(selectedCompany.company, 4),
    [selectedCompany.company],
  );

  const handleOpenResumePicker = () => {
    resumeInputRef.current?.click();
  };

  const handleResumeSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF resume.");
      event.target.value = "";
      return;
    }

    setUploadedResumeName(file.name);
    toast.success(`Resume uploaded: ${file.name}`);
  };

  const handleViewPersonalizedRoadmap = (role: RoleMode) => {
    setActiveRole(role);
    const section = document.getElementById("personalized-role-roadmap");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background pb-16 pt-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border bg-card p-6"
        >
          <p className="text-xs uppercase tracking-[0.14em] text-primary">Career Roadmap Studio</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Company Roadmaps, Resume Match, and Actionable Sprints</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Compare internship vs FTE fit, upload your resume, and move to a personalized role roadmap.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={handleOpenResumePicker} className="gap-2">
              <FileUp className="h-4 w-4" />
              Upload Resume (PDF)
            </Button>
            <Button variant="outline" onClick={() => handleViewPersonalizedRoadmap(activeRole)}>
              View Personalized Roadmap
            </Button>
            {uploadedResumeName && (
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                Resume: {uploadedResumeName}
              </span>
            )}
          </div>
          <input ref={resumeInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleResumeSelected} />
        </motion.div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companyRoadmaps.map((company) => {
            const active = selectedCompany.id === company.id;
            const match = matchByCompany[company.id];
            const bestRole = match.fte > match.internship ? "FTE" : "Internship";
            const bestMatch = Math.max(match.fte, match.internship);

            return (
              <CompanyCard
                key={company.id}
                onClick={() => setSelectedCompanyId(company.id)}
                company={company.company}
                description={company.tagline}
                logoUrl={company.logoUrl}
                internshipMatch={match.internship}
                fteMatch={match.fte}
                recommendedRole={bestRole}
                match={bestMatch}
                active={active}
              />
            );
          })}
        </div>

        <motion.div
          key={selectedCompany.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border bg-card p-6"
          style={{
            background: `linear-gradient(135deg, ${selectedCompany.brandFrom}17, ${selectedCompany.brandTo}13)`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex min-h-12 min-w-[72px] items-center justify-center overflow-hidden rounded-xl border border-border bg-background px-2">
                <img
                  src={selectedCompany.logoUrl}
                  alt={`${selectedCompany.company} logo`}
                  className="h-10 w-auto max-w-[96px] object-contain"
                  loading="lazy"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedCompany.company}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedCompany.tagline}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleViewPersonalizedRoadmap("internship")}>View Internship Path</Button>
              <Button variant="outline" onClick={() => handleViewPersonalizedRoadmap("fte")}>View FTE Path</Button>
              <Button asChild variant="outline">
                <a href={selectedCompany.careersUrl} target="_blank" rel="noreferrer">
                  Careers Portal
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card className="border border-border/60 bg-background/90 p-4">
              <h3 className="text-sm font-semibold text-foreground">Core Skills</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCompany.coreSkills.map((skill) => (
                  <span
                    key={skill}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      selectedMatch.missingSkills.includes(skill)
                        ? "border-red-500/30 bg-red-500/10 text-red-700"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </Card>

            <Card className="border border-border/60 bg-background/90 p-4">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Trophy className="h-4 w-4 text-primary" />
                Personalized Match Snapshot
              </h3>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <span className="text-muted-foreground">Internship fit</span>
                  <span className="font-semibold text-foreground">{selectedMatch.internship}%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <span className="text-muted-foreground">FTE fit</span>
                  <span className="font-semibold text-foreground">{selectedMatch.fte}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Weak areas: {selectedMatch.missingSkills.slice(0, 3).join(", ") || "None detected"}
                </p>
              </div>
            </Card>
          </div>
        </motion.div>

        <div id="personalized-role-roadmap" className="mb-10">
          <Tabs value={activeRole} onValueChange={(value) => setActiveRole(value as RoleMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="internship">
                Internship Roadmap ({selectedMatch.internship}% match)
              </TabsTrigger>
              <TabsTrigger value="fte">FTE Roadmap ({selectedMatch.fte}% match)</TabsTrigger>
            </TabsList>

            <TabsContent value="internship" className="mt-4">
              <RoadmapSteps steps={selectedCompany.internshipRoadmap} />
            </TabsContent>
            <TabsContent value="fte" className="mt-4">
              <RoadmapSteps steps={selectedCompany.fteRoadmap} />
            </TabsContent>
          </Tabs>
        </div>

        <Card className="border border-border/60 bg-gradient-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Insider Advice From {selectedCompany.company} Engineers
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/techvise?company=${encodeURIComponent(selectedCompany.company)}`}>
                Ask On TechVise
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {insiderAdvice.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No insider advice yet. Start the first discussion in TechVise for this company.
            </p>
          )}

          <div className="space-y-3">
            {insiderAdvice.map((answer) => (
              <Card key={answer.id} className="border border-border/60 bg-background/80 p-4">
                <p className="text-sm text-muted-foreground">{answer.body}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {answer.author.name}
                    {answer.author.role ? ` • ${answer.author.role}` : ""}
                  </span>
                  <span>
                    Helpful votes: {answer.upvotes - answer.downvotes} ({answer.upvotes}↑ / {answer.downvotes}↓)
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RoadmapsPage;
