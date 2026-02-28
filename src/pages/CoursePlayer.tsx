import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Clock,
  BookOpen,
  MessageSquare,
  Code2,
  X,
  ExternalLink,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getCourseContext } from "../services/courseContextService";
import { getTrackById } from "../services/trackService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "../context/AuthContext";
import AITutor from "../components/AITutor";
import { getLearnerDnaSummary } from "@/services/learnerProfileService";
import {
  fetchPersonalizedVideos,
  type LearningVideo,
} from "@/services/learningVideoService";

const CoursePlayer = () => {
  const { trackId, courseId } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [courseProgress, setCourseProgress] = useState(0);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [recommendedVideos, setRecommendedVideos] = useState<LearningVideo[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const track = trackId ? getTrackById(trackId) : null;
  const course = track && courseId ? track.courses.find((candidate) => candidate.id === courseId) : null;
  const courseContext = trackId && courseId ? getCourseContext(trackId, courseId) : null;

  useEffect(() => {
    if (!track || !course) {
      setRecommendedVideos([]);
      setActiveVideoId(null);
      setVideosError(null);
      return;
    }

    let isCancelled = false;

    const loadRecommendedVideos = async () => {
      setIsLoadingVideos(true);
      setVideosError(null);

      try {
        const dna = user ? getLearnerDnaSummary(user.id, user.branch) : null;
        const inferredBranch = user?.branch ?? track.branches[0];
        const response = await fetchPersonalizedVideos({
          query: `${course.title} ${track.title} tutorial`,
          branch: inferredBranch,
          courseTitle: course.title,
          trackTitle: track.title,
          level: track.level,
          focusLanguage: dna?.focusLanguage ?? dna?.strongestLanguage,
          focusAreas: dna?.topMistakes.map((item) => item.label).slice(0, 3) ?? [],
          maxResults: 4,
        });

        if (isCancelled) return;
        setRecommendedVideos(response.videos);
        setActiveVideoId(response.videos[0]?.videoId ?? null);
      } catch (error) {
        if (isCancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load personalized videos at the moment.";
        setVideosError(message);
      } finally {
        if (!isCancelled) {
          setIsLoadingVideos(false);
        }
      }
    };

    void loadRecommendedVideos();

    return () => {
      isCancelled = true;
    };
  }, [course, track, user]);

  if (!trackId || !courseId) {
    return <div>Invalid course URL</div>;
  }

  if (!track) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Track not found</h1>
          <Link to="/tracks" className="text-primary hover:underline">
            ← Back to tracks
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Course not found</h1>
          <Link to={`/tracks/${trackId}`} className="text-primary hover:underline">
            ← Back to track
          </Link>
        </div>
      </div>
    );
  }

  const activeVideo =
    recommendedVideos.find((video) => video.videoId === activeVideoId) ??
    recommendedVideos[0] ??
    null;

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-muted/30">
        <div className="container py-4">
          <Link
            to={`/tracks/${trackId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to track
          </Link>
        </div>
      </div>

      <div className="container mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`grid gap-8 ${tutorOpen ? "lg:grid-cols-3" : "lg:grid-cols-3"}`}
        >
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div className="mb-6 rounded-lg overflow-hidden border border-border shadow-lg">
              {activeVideo ? (
                <iframe
                  title={activeVideo.title}
                  src={activeVideo.embedUrl}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="bg-muted aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <Play className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Video Player</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {course.duration} • {course.lessons} lessons
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Course Details */}
            <Card className="border border-border/50 bg-gradient-card p-6 mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-3">{course.title}</h1>
              <p className="text-muted-foreground mb-6">{course.description}</p>

              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {course.duration}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  {course.lessons} Lessons
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  {courseProgress}% Complete
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Your Progress</span>
                  <span className="text-sm text-muted-foreground">{courseProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${courseProgress}%` }}
                  />
                </div>
              </div>

              <Button
                onClick={() => setCourseProgress(Math.min(courseProgress + 10, 100))}
                className="shadow-glow"
              >
                Continue Learning
              </Button>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="lessons">Lessons</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">What You'll Learn</h2>
                  <ul className="space-y-2">
                    {[
                      "Understand core concepts",
                      "Build practical skills",
                      "Complete real-world projects",
                      "Get certified upon completion",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Prerequisites</h2>
                  <p className="text-sm text-muted-foreground">
                    {courseContext?.prerequisites.join(", ") || "No specific prerequisites"}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="lessons" className="space-y-3 mt-6">
                {Array.from({ length: Math.min(course.lessons, 5) }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-border bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground">
                          Lesson {i + 1}: {["Introduction", "Fundamentals", "Advanced Topics", "Practice", "Assessment"][i]}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">~{10 + i * 2} minutes</p>
                      </div>
                      {i < 2 && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />}
                    </div>
                  </motion.div>
                ))}
                {course.lessons > 5 && (
                  <p className="text-sm text-center text-muted-foreground py-4">
                    +{course.lessons - 5} more lessons
                  </p>
                )}
              </TabsContent>

              <TabsContent value="resources" className="space-y-3 mt-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Code2 className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">Code Exercises</h3>
                      <p className="text-sm text-muted-foreground">Practice with interactive code examples</p>
                    </div>
                    <Button size="sm" variant="secondary">
                      Start
                    </Button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">AI Tutor</h3>
                      <p className="text-sm text-muted-foreground">Get help with this course topic</p>
                    </div>
                    <Button size="sm" variant="secondary">
                      Ask
                    </Button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <h3 className="font-medium text-foreground">Personalized YouTube Picks</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Curated videos for this course and your current learning profile.
                  </p>

                  {isLoadingVideos && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading recommendations...
                    </div>
                  )}

                  {!isLoadingVideos && videosError && (
                    <p className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700">
                      {videosError}
                    </p>
                  )}

                  {!isLoadingVideos && !videosError && recommendedVideos.length === 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Keep learning and solving problems to unlock better recommendations.
                    </p>
                  )}

                  {!isLoadingVideos && recommendedVideos.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {recommendedVideos.map((video) => (
                        <div
                          key={video.videoId}
                          className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${
                            activeVideo?.videoId === video.videoId
                              ? "border-primary/50 bg-primary/5"
                              : "border-border bg-background/60 hover:border-primary/40"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveVideoId(video.videoId)}
                            className="liquid-glass-button w-full text-left"
                          >
                            <p className="line-clamp-1 text-sm font-medium text-foreground">
                              {video.title}
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                              <PlayCircle className="h-3.5 w-3.5" />
                              {video.channelTitle}
                            </p>
                          </button>
                          <div className="mt-1">
                            <a
                              href={video.watchUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                            >
                              Open on YouTube
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Course Info */}
            <Card className="border border-border/50 bg-gradient-card p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Track</p>
                  <p className="text-sm font-medium text-foreground mt-1">{track.title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Level</p>
                  <p className="text-sm font-medium text-foreground mt-1">{track.level}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Duration</p>
                  <p className="text-sm font-medium text-foreground mt-1">{course.duration}</p>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="border border-border/50 bg-gradient-card p-6">
              <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button 
                  variant={tutorOpen ? "default" : "outline"} 
                  className="w-full justify-start"
                  onClick={() => setTutorOpen(!tutorOpen)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {tutorOpen ? "Close Tutor" : "Ask Tutor"}
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to={`/question-hub?trackId=${track.id}&courseId=${course.id}`}>
                    <Code2 className="h-4 w-4 mr-2" />
                    Open Question Hub + IDE
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Resources
                </Button>
              </div>
            </Card>

            {/* Next Steps */}
            <Card className="border border-border/50 bg-gradient-card p-6">
              <h3 className="font-semibold text-foreground mb-3">Next Steps</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-semibold flex-shrink-0">1.</span>
                  <span>Watch all video lessons</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold flex-shrink-0">2.</span>
                  <span>Complete code exercises</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold flex-shrink-0">3.</span>
                  <span>Take the final quiz</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold flex-shrink-0">4.</span>
                  <span>Get your certificate</span>
                </li>
              </ol>
            </Card>

            {/* AI Tutor */}
            {tutorOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-4 right-4 w-80 z-40"
              >
                <Card className="border border-border/50 bg-gradient-card relative">
                  <button
                    onClick={() => setTutorOpen(false)}
                    className="liquid-glass-button absolute right-2 top-2 rounded-lg p-1 transition-colors hover:bg-secondary"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div className="p-4">
                    <AITutor courseContext={courseContext} isOpen={true} />
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CoursePlayer;
