import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTracksByBranch } from "../services/trackService";
import { branches } from "../data/branches";
import { getLearnerDnaSummary } from "@/services/learnerProfileService";
import {
  ensureLearnerInsight,
  getStoredLearnerInsight,
  type StoredLearnerInsight,
} from "@/services/learnerInsightService";
import {
  fetchPersonalizedVideos,
  type LearningVideo,
} from "@/services/learningVideoService";
import TrackCard from "../components/TrackCard";
import BranchSelector from "../components/BranchSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import {
  Brain,
  Code2,
  ExternalLink,
  Flame,
  BookOpen,
  Clock,
  Loader2,
  Map,
  PlayCircle,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";

const Dashboard = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [insight, setInsight] = useState<StoredLearnerInsight | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [videos, setVideos] = useState<LearningVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoQuery, setVideoQuery] = useState("");
  const [isVideosLoading, setIsVideosLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setInsight(null);
      setIsInsightLoading(false);
      setVideos([]);
      setSelectedVideoId(null);
      setVideoQuery("");
      setVideoError(null);
      return;
    }

    const dnaSnapshot = getLearnerDnaSummary(user.id, user.branch);
    const cachedInsight = getStoredLearnerInsight(user.id);
    if (cachedInsight) {
      setInsight(cachedInsight);
    }
    setIsInsightLoading(!cachedInsight);

    let isCancelled = false;

    const hydrateAiInsight = async () => {
      try {
        const generated = await ensureLearnerInsight(user, dnaSnapshot);
        if (isCancelled) return;
        setInsight(generated);
      } finally {
        if (!isCancelled) {
          setIsInsightLoading(false);
        }
      }
    };

    const hydrateVideos = async () => {
      setIsVideosLoading(true);
      setVideoError(null);
      try {
        const response = await fetchPersonalizedVideos({
          branch: user.branch,
          courseTitle: `${user.branch.toUpperCase()} developer roadmap`,
          trackTitle: "software engineering",
          level: dnaSnapshot.acceptanceRate >= 70 ? "intermediate" : "beginner",
          focusLanguage: dnaSnapshot.focusLanguage,
          focusAreas: dnaSnapshot.topMistakes.map((item) => item.label).slice(0, 4),
          query: `${dnaSnapshot.focusLanguage ?? "software engineering"} ${
            dnaSnapshot.topMistakes[0]?.label ?? "coding fundamentals"
          }`,
          maxResults: 4,
        });
        if (isCancelled) return;
        setVideos(response.videos);
        setVideoQuery(response.query);
        setSelectedVideoId(response.videos[0]?.videoId ?? null);
      } catch (error) {
        if (isCancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Video recommendations are temporarily unavailable.";
        setVideoError(message);
      } finally {
        if (!isCancelled) {
          setIsVideosLoading(false);
        }
      }
    };

    void hydrateAiInsight();
    void hydrateVideos();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-4 border-border border-t-primary animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-24">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-4">Please log in</h1>
          <p className="text-muted-foreground mb-6">
            You need to be logged in to access your dashboard.
          </p>
          <Button
            onClick={() => navigate("/login")}
            className="shadow-glow hover:scale-105 transition-transform"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const tracksByBranch = getTracksByBranch(user.branch);
  const currentBranch = branches.find((b) => b.id === user.branch);
  const learnerDna = getLearnerDnaSummary(user.id, user.branch);
  const selectedVideo =
    videos.find((video) => video.videoId === selectedVideoId) ?? videos[0] ?? null;

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-foreground">
            Welcome back, <span className="text-gradient-primary">{user.name}</span>
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {currentBranch
              ? `You're enrolled in ${currentBranch.name}`
              : "Let's continue your learning journey"}
          </p>
          <div className="mt-5">
            <Button onClick={() => navigate("/mission")} className="gap-2">
              <Target className="h-4 w-4" />
              Start Today Mission
            </Button>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12 grid gap-4 md:grid-cols-3"
        >
          <Card className="border border-border/50 bg-gradient-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Tracks</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{tracksByBranch.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="border border-border/50 bg-gradient-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                <p className="mt-1 text-3xl font-bold text-foreground">
                  {learnerDna.acceptanceRate}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-accent" />
              </div>
            </div>
          </Card>

          <Card className="border border-border/50 bg-gradient-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Learning Streak</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{learnerDna.streak} days</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </Card>
        </motion.div>

        {(isInsightLoading || insight) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mb-12 grid gap-4 lg:grid-cols-3"
          >
            {isInsightLoading && !insight ? (
              <>
                <Card className="border border-border/50 bg-gradient-card p-6 lg:col-span-2">
                  <div className="animate-pulse space-y-4">
                    <div className="h-6 w-44 rounded-md bg-muted" />
                    <div className="h-8 w-3/4 rounded-md bg-muted" />
                    <div className="h-4 w-full rounded-md bg-muted" />
                    <div className="h-4 w-4/5 rounded-md bg-muted" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded-md bg-muted" />
                        <div className="h-8 w-full rounded-md bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded-md bg-muted" />
                        <div className="h-8 w-full rounded-md bg-muted" />
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="border border-border/50 bg-gradient-card p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 w-40 rounded-md bg-muted" />
                    <div className="h-4 w-full rounded-md bg-muted" />
                    <div className="h-4 w-5/6 rounded-md bg-muted" />
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card className="border border-border/50 bg-gradient-card p-6 lg:col-span-2">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Learner Profile
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">{insight?.headline}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{insight?.conciseBio}</p>
                  <p className="mt-3 text-xs font-medium text-primary">{insight?.signature}</p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Strength Signals
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {insight?.strengths.map((entry) => (
                          <span
                            key={entry}
                            className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs text-green-700"
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Focus Targets
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {insight?.focusAreas.map((entry) => (
                          <span
                            key={entry}
                            className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-700"
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="border border-border/50 bg-gradient-card p-6">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Brain className="h-4 w-4 text-primary" />
                    Next Best Move
                  </div>
                  <p className="text-sm text-muted-foreground">{insight?.nextAction}</p>
                  <p className="mt-5 text-xs text-muted-foreground">
                    Profile source: {insight?.source === "ai" ? "AI model" : "local fallback"}
                  </p>
                </Card>
              </>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <Card className="border border-border/50 bg-gradient-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Personalized Video Stack</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Curated from YouTube based on your current learning gap.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {videoQuery && (
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    Query: {videoQuery}
                  </span>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate("/question-hub")}>
                  <Code2 className="mr-1.5 h-4 w-4" />
                  Open Question Hub
                </Button>
              </div>
            </div>

            {isVideosLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recommendations...
              </div>
            )}

            {!isVideosLoading && videoError && (
              <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700">
                {videoError}
              </p>
            )}

            {!isVideosLoading && !videoError && videos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No recommendations yet. Keep solving problems and we will adapt this feed.
              </p>
            )}

            {!isVideosLoading && videos.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
                <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                  {selectedVideo ? (
                    <iframe
                      title={selectedVideo.title}
                      src={selectedVideo.embedUrl}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                      Select a video to play.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {videos.map((video) => {
                    const active = selectedVideo?.videoId === video.videoId;
                    return (
                      <div
                        key={video.videoId}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-muted/20 hover:border-primary/30"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedVideoId(video.videoId)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start gap-3">
                            {video.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt={video.title}
                                className="h-16 w-28 rounded-md object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-16 w-28 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                                No preview
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-semibold text-foreground">
                                {video.title}
                              </p>
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                {video.channelTitle}
                              </p>
                              <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                                <PlayCircle className="h-3.5 w-3.5" />
                                Play here
                              </span>
                            </div>
                          </div>
                        </button>
                        <a
                          href={video.watchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          Open on YouTube
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mb-12 grid gap-4 md:grid-cols-3"
        >
          <Card className="border border-border/50 bg-gradient-card p-6">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Hackathons</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tech-only events and competitions with deadline tracking.
            </p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/hackathons")}>
              Explore Events
            </Button>
          </Card>

          <Card className="border border-border/50 bg-gradient-card p-6">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">TechVise</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Advice feed from engineers, ranked by impact and profile strength.
            </p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/techvise")}>
              Join Discussion
            </Button>
          </Card>

          <Card className="border border-border/50 bg-gradient-card p-6">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Map className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Company Roadmaps</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Internship and FTE plans for top tech companies.
            </p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/roadmaps")}>
              View Roadmaps
            </Button>
          </Card>
        </motion.div>

        {/* Branch Selector */}
        {tracksByBranch.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <Card className="border border-border/50 bg-gradient-card p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">Your Branch</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Switch your branch anytime to see different learning paths
                </p>
              </div>
              <BranchSelector />
            </Card>
          </motion.div>
        )}

        {/* Recommended Tracks */}
        {tracksByBranch.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">Your Tracks</h2>
              <p className="mt-1 text-muted-foreground">
                Recommended learning paths based on your branch
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tracksByBranch.map((track, i) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  <TrackCard {...track} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {tracksByBranch.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border bg-muted/30 p-12 text-center"
          >
            <p className="text-muted-foreground mb-4">
              No tracks available for your selected branch yet.
            </p>
            <Button
              onClick={() => setShowBranchDialog(true)}
              className="shadow-glow hover:scale-105 transition-transform"
            >
              Change Branch
            </Button>
          </motion.div>
        )}
      </div>

      {/* Branch Dialog */}
      <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Your Branch</DialogTitle>
          </DialogHeader>
          <BranchSelector />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
