import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Flag,
  Link2,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getTracksByBranch } from "@/services/trackService";
import { practiceTopics } from "@/data/practiceTopics";
import { buildGoogleCalendarGoalUrl } from "@/services/calendarService";
import {
  createGoal,
  listGoals,
  removeGoal,
  setGoalCompletion,
  type GoalLinkType,
  type GoalPriority,
  type LearningGoal,
} from "@/services/goalService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const goalTypeOptions: Array<{ value: GoalLinkType; label: string; hint: string }> = [
  { value: "course", label: "Course Goal", hint: "Link a goal directly to a track course." },
  { value: "problem", label: "Problem Goal", hint: "Attach a goal to a practice problem set." },
  {
    value: "lecture",
    label: "YouTube Lectures Goal",
    hint: "Paste a YouTube playlist or lecture links and set a completion deadline.",
  },
  { value: "custom", label: "Custom Goal", hint: "Track your own custom learning objective." },
];

const priorityOptions: Array<{ value: GoalPriority; label: string }> = [
  { value: "high", label: "High Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "low", label: "Low Priority" },
];

const branchLanguageMap: Record<string, string[]> = {
  cse: ["javascript", "python", "sql", "verilog"],
  ece: ["verilog", "python", "javascript", "sql"],
  ee: ["python", "verilog", "javascript", "sql"],
  "data-science": ["python", "sql", "javascript", "verilog"],
  mechanical: ["python", "javascript", "sql", "verilog"],
  civil: ["python", "sql", "javascript", "verilog"],
};

interface ParsedLectureLinks {
  urls: string[];
  playlistUrl?: string;
  invalidEntries: string[];
}

const normalizeHttpUrl = (rawValue: string): string | null => {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const isYouTubeHost = (host: string): boolean => {
  const normalizedHost = host.toLowerCase();
  return normalizedHost === "youtube.com" || normalizedHost.endsWith(".youtube.com") || normalizedHost === "youtu.be";
};

const parseYouTubeLectureInput = (value: string): ParsedLectureLinks => {
  const candidates = value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const urls: string[] = [];
  const invalidEntries: string[] = [];
  const dedupeSet = new Set<string>();
  let playlistUrl: string | undefined;

  for (const candidate of candidates) {
    const normalizedUrl = normalizeHttpUrl(candidate);
    if (!normalizedUrl) {
      invalidEntries.push(candidate);
      continue;
    }

    const parsedUrl = new URL(normalizedUrl);
    if (!isYouTubeHost(parsedUrl.hostname)) {
      invalidEntries.push(candidate);
      continue;
    }

    if (dedupeSet.has(normalizedUrl)) continue;
    dedupeSet.add(normalizedUrl);
    urls.push(normalizedUrl);

    if (!playlistUrl && parsedUrl.searchParams.get("list")) {
      playlistUrl = normalizedUrl;
    }
  }

  return { urls, playlistUrl, invalidEntries };
};

const toDateTimeLocalValue = (value: Date): string => {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
};

const defaultDueInput = (): string => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(18, 0, 0, 0);
  return toDateTimeLocalValue(value);
};

const formatDueDate = (dueAt: string): string =>
  new Date(dueAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const goalPriorityTone: Record<GoalPriority, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
  low: "border-green-500/30 bg-green-500/10 text-green-700",
};

const GoalsPage = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState<GoalLinkType>("course");
  const [trackId, setTrackId] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [lectureLinksInput, setLectureLinksInput] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [dueInput, setDueInput] = useState(defaultDueInput);
  const [durationInput, setDurationInput] = useState("60");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [notes, setNotes] = useState("");
  const [syncCalendarOnCreate, setSyncCalendarOnCreate] = useState(true);
  const [syncCalendarOnComplete, setSyncCalendarOnComplete] = useState(true);

  const availableTracks = useMemo(() => {
    if (!user) return [];
    return getTracksByBranch(user.branch);
  }, [user]);

  const selectedTrack = useMemo(
    () => availableTracks.find((track) => track.id === trackId),
    [availableTracks, trackId],
  );

  const selectedCourse = useMemo(
    () => selectedTrack?.courses.find((course) => course.id === courseId),
    [selectedTrack, courseId],
  );

  const branchTopics = useMemo(() => {
    if (!user) return practiceTopics;
    const allowedLanguages = branchLanguageMap[user.branch] ?? ["javascript", "python", "sql", "verilog"];
    return practiceTopics.filter((topic) => allowedLanguages.includes(topic.language));
  }, [user]);

  const selectedTopic = useMemo(
    () => branchTopics.find((topic) => topic.id === topicId),
    [branchTopics, topicId],
  );

  const lectureLinksPreview = useMemo(
    () => parseYouTubeLectureInput(lectureLinksInput),
    [lectureLinksInput],
  );

  useEffect(() => {
    if (!user) {
      setGoals([]);
      return;
    }

    setGoals(listGoals(user.id));
  }, [user]);

  useEffect(() => {
    if (trackId || availableTracks.length === 0) return;
    setTrackId(availableTracks[0].id);
  }, [availableTracks, trackId]);

  useEffect(() => {
    if (!selectedTrack) {
      setCourseId("");
      return;
    }

    if (selectedTrack.courses.some((course) => course.id === courseId)) return;
    setCourseId(selectedTrack.courses[0]?.id ?? "");
  }, [courseId, selectedTrack]);

  useEffect(() => {
    if (goalType !== "problem") return;
    if (branchTopics.length === 0) {
      setTopicId("");
      return;
    }
    if (branchTopics.some((topic) => topic.id === topicId)) return;
    setTopicId(branchTopics[0]?.id ?? "");
  }, [branchTopics, goalType, topicId]);

  const stats = useMemo(() => {
    const now = Date.now();
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const completed = goals.filter((goal) => goal.status === "completed").length;
    const pending = goals.length - completed;
    const dueThisWeek = goals.filter((goal) => {
      const dueTime = new Date(goal.dueAt).getTime();
      return goal.status === "pending" && dueTime >= now && dueTime <= oneWeekFromNow;
    }).length;
    return {
      total: goals.length,
      completed,
      pending,
      dueThisWeek,
    };
  }, [goals]);

  const previewTarget = useMemo(() => {
    if (goalType === "course" && selectedTrack && selectedCourse) {
      return {
        label: `${selectedTrack.title} • ${selectedCourse.title}`,
        path: `/tracks/${selectedTrack.id}/courses/${selectedCourse.id}`,
      };
    }

    if (goalType === "problem" && selectedTopic) {
      return {
        label: `${selectedTopic.title} (${selectedTopic.problems} problems)`,
        path: `/practice?topic=${encodeURIComponent(selectedTopic.id)}`,
      };
    }

    if (goalType === "lecture") {
      if (lectureLinksPreview.urls.length === 0) {
        return { label: "YouTube lectures (add playlist or lecture links)" };
      }

      const countLabel = lectureLinksPreview.urls.length === 1 ? "1 link" : `${lectureLinksPreview.urls.length} links`;
      const kindLabel = lectureLinksPreview.playlistUrl ? "YouTube playlist" : "YouTube lecture set";
      return { label: `${kindLabel} • ${countLabel}` };
    }

    const label = customTarget.trim() || "Custom milestone";
    return { label };
  }, [customTarget, goalType, lectureLinksPreview.playlistUrl, lectureLinksPreview.urls.length, selectedCourse, selectedTopic, selectedTrack]);

  const resetForm = () => {
    setTitle("");
    setLectureLinksInput("");
    setCustomTarget("");
    setDueInput(defaultDueInput());
    setDurationInput("60");
    setPriority("medium");
    setNotes("");
  };

  const calendarDetailsForGoal = (goal: LearningGoal): string => {
    const details: string[] = [
      `Priority: ${goal.priority}`,
      `Linked target: ${goal.linkedItem.label}`,
      `Goal status: ${goal.status}`,
    ];

    if (goal.completedAt) {
      details.push(`Completed at: ${new Date(goal.completedAt).toLocaleString()}`);
    }

    if (goal.notes) {
      details.push("", goal.notes);
    }

    if ((goal.linkedItem.resourceUrls?.length ?? 0) > 0) {
      details.push("", "Lecture links:");
      for (const url of goal.linkedItem.resourceUrls ?? []) {
        details.push(url);
      }
    }

    if (goal.linkedItem.path && typeof window !== "undefined") {
      details.push("", `Open in Melete: ${window.location.origin}${goal.linkedItem.path}`);
    }

    return details.join("\n");
  };

  const calendarUrlForGoal = (goal: LearningGoal): string =>
    buildGoogleCalendarGoalUrl({
      title: `Goal: ${goal.title}`,
      dueAt: goal.dueAt,
      durationMinutes: goal.durationMinutes,
      details: calendarDetailsForGoal(goal),
      location: "Melete",
    });

  const completionCalendarUrlForGoal = (goal: LearningGoal): string =>
    buildGoogleCalendarGoalUrl({
      title: `Completed: ${goal.title}`,
      dueAt: goal.completedAt ?? new Date().toISOString(),
      durationMinutes: 30,
      details: calendarDetailsForGoal(goal),
      location: "Melete",
    });

  const handleCreateGoal = () => {
    if (!user) return;
    if (title.trim().length < 3) {
      toast.error("Goal title should be at least 3 characters.");
      return;
    }

    const dueDate = new Date(dueInput);
    if (Number.isNaN(dueDate.getTime())) {
      toast.error("Choose a valid due date and time.");
      return;
    }

    const parsedDuration = Number.parseInt(durationInput, 10);
    const durationMinutes = Number.isFinite(parsedDuration)
      ? Math.min(360, Math.max(15, parsedDuration))
      : 60;

    if (goalType === "lecture") {
      if (lectureLinksPreview.urls.length === 0) {
        toast.error("Paste at least one YouTube playlist or lecture URL.");
        return;
      }
      if (lectureLinksPreview.invalidEntries.length > 0) {
        toast.error("Some links are invalid or non-YouTube. Remove them and try again.");
        return;
      }
    }

    const linkedItem =
      goalType === "course"
        ? {
            type: "course" as const,
            label: previewTarget.label,
            trackId: selectedTrack?.id,
            courseId: selectedCourse?.id,
            path: previewTarget.path,
          }
        : goalType === "problem"
          ? {
              type: "problem" as const,
              label: previewTarget.label,
              topicId: selectedTopic?.id,
              path: previewTarget.path,
            }
          : goalType === "lecture"
            ? {
                type: "lecture" as const,
                label: previewTarget.label,
                playlistUrl: lectureLinksPreview.playlistUrl,
                resourceUrls: lectureLinksPreview.urls,
              }
          : {
              type: "custom" as const,
              label: previewTarget.label,
            };

    if ((goalType === "course" || goalType === "problem") && !linkedItem.path) {
      toast.error("Select a valid linked course/problem before creating the goal.");
      return;
    }

    const created = createGoal(user.id, {
      title,
      notes,
      priority,
      dueAt: dueDate.toISOString(),
      durationMinutes,
      linkedItem,
    });

    const latestGoals = listGoals(user.id);
    setGoals(latestGoals);
    resetForm();
    toast.success("Goal created and added to your planner.");

    if (syncCalendarOnCreate) {
      window.open(calendarUrlForGoal(created), "_blank", "noopener,noreferrer");
    }
  };

  const handleToggleCompletion = (goal: LearningGoal) => {
    if (!user) return;
    const shouldComplete = goal.status !== "completed";
    const next = setGoalCompletion(user.id, goal.id, shouldComplete);
    setGoals(next);

    if (!shouldComplete) {
      toast.success(`Reopened "${goal.title}"`);
      return;
    }

    const completedGoal = next.find((item) => item.id === goal.id);
    toast.success(`Completed "${goal.title}"`);
    if (syncCalendarOnComplete && completedGoal) {
      window.open(completionCalendarUrlForGoal(completedGoal), "_blank", "noopener,noreferrer");
    }
  };

  const handleDeleteGoal = (goal: LearningGoal) => {
    if (!user) return;
    const next = removeGoal(user.id, goal.id);
    setGoals(next);
    toast.success(`Deleted "${goal.title}"`);
  };

  const renderLinkedFields = () => {
    if (goalType === "course") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="goal-track">Track</Label>
            <Select value={trackId || undefined} onValueChange={setTrackId}>
              <SelectTrigger id="goal-track" className="mt-2">
                <SelectValue placeholder="Choose a track" />
              </SelectTrigger>
              <SelectContent>
                {availableTracks.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {track.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="goal-course">Course</Label>
            <Select
              value={courseId || undefined}
              onValueChange={setCourseId}
              disabled={!selectedTrack || selectedTrack.courses.length === 0}
            >
              <SelectTrigger id="goal-course" className="mt-2">
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                {(selectedTrack?.courses ?? []).map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (goalType === "problem") {
      return (
        <div>
          <Label htmlFor="goal-problem">Problem Set</Label>
          <Select value={topicId || undefined} onValueChange={setTopicId}>
            <SelectTrigger id="goal-problem" className="mt-2">
              <SelectValue placeholder="Choose a problem set" />
            </SelectTrigger>
            <SelectContent>
              {branchTopics.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.title} • {topic.problems} problems
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (goalType === "lecture") {
      return (
        <div>
          <Label htmlFor="goal-lecture-links">YouTube Playlist or Lecture Links</Label>
          <Textarea
            id="goal-lecture-links"
            value={lectureLinksInput}
            onChange={(event) => setLectureLinksInput(event.target.value)}
            placeholder={
              "Paste one link per line or comma separated.\nhttps://www.youtube.com/playlist?list=...\nhttps://youtu.be/..."
            }
            className="mt-2 min-h-[110px]"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {lectureLinksPreview.urls.length} valid link{lectureLinksPreview.urls.length === 1 ? "" : "s"} detected.
          </p>
          {lectureLinksPreview.invalidEntries.length > 0 && (
            <p className="mt-1 text-xs text-red-600">
              Invalid entries: {lectureLinksPreview.invalidEntries.slice(0, 2).join(", ")}
              {lectureLinksPreview.invalidEntries.length > 2 ? ` +${lectureLinksPreview.invalidEntries.length - 2} more` : ""}
            </p>
          )}
        </div>
      );
    }

    return (
      <div>
        <Label htmlFor="goal-custom-target">Custom Linked Target</Label>
        <Input
          id="goal-custom-target"
          value={customTarget}
          onChange={(event) => setCustomTarget(event.target.value)}
          placeholder="Example: Solve 20 graph problems this week"
          className="mt-2"
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-24">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="text-muted-foreground">Loading goals planner...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-24">
        <Card className="max-w-md border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Please log in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Goal planning and calendar sync are available after login.</p>
          <Button onClick={() => navigate("/login")} className="mt-5">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 pt-24">
      <div className="container">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="liquid-glass mb-8 rounded-2xl border border-border/70 p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-primary">Goals Planner</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">Plan goals. Link learning. Sync with Google Calendar.</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Create structured goals tied to Melete courses, problem sets, or YouTube lecture playlists, then schedule them in your calendar workflow.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{stats.pending}</span> active goals
            </div>
          </div>
        </motion.section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <Card className="border border-border/60 bg-gradient-card p-4">
            <p className="text-xs text-muted-foreground">Total goals</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
          </Card>
          <Card className="border border-border/60 bg-gradient-card p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stats.pending}</p>
          </Card>
          <Card className="border border-border/60 bg-gradient-card p-4">
            <p className="text-xs text-muted-foreground">Due in 7 days</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stats.dueThisWeek}</p>
          </Card>
          <Card className="border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs text-primary">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stats.completed}</p>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr,1fr]">
          <Card className="liquid-glass border border-border/70 bg-card/90 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Create New Goal</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="goal-title">Goal Title</Label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: Complete React Development course"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="goal-type">Goal Type</Label>
                <Select value={goalType} onValueChange={(value) => setGoalType(value as GoalLinkType)}>
                  <SelectTrigger id="goal-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {goalTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  {goalTypeOptions.find((option) => option.value === goalType)?.hint}
                </p>
              </div>

              {renderLinkedFields()}

              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked Preview</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <Link2 className="h-4 w-4 text-primary" />
                  {previewTarget.label}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="goal-due">Due Date & Time</Label>
                  <Input
                    id="goal-due"
                    type="datetime-local"
                    value={dueInput}
                    onChange={(event) => setDueInput(event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="goal-duration">Duration (min)</Label>
                  <Input
                    id="goal-duration"
                    type="number"
                    min={15}
                    max={360}
                    step={5}
                    value={durationInput}
                    onChange={(event) => setDurationInput(event.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr,auto,auto] md:items-end">
                <div>
                  <Label htmlFor="goal-priority">Priority</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as GoalPriority)}>
                    <SelectTrigger id="goal-priority" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <Switch
                    checked={syncCalendarOnCreate}
                    onCheckedChange={setSyncCalendarOnCreate}
                    aria-label="Open Google Calendar after goal creation"
                  />
                  <p className="text-xs text-muted-foreground">Open Calendar on create</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <Switch
                    checked={syncCalendarOnComplete}
                    onCheckedChange={setSyncCalendarOnComplete}
                    aria-label="Open Google Calendar when goal is completed"
                  />
                  <p className="text-xs text-muted-foreground">Open Calendar on complete</p>
                </div>
              </div>

              <div>
                <Label htmlFor="goal-notes">Notes</Label>
                <Textarea
                  id="goal-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add execution details, target outcomes, or constraints."
                  className="mt-2 min-h-[90px]"
                />
              </div>

              <Button onClick={handleCreateGoal} className="h-11 w-full gap-2 text-sm font-semibold">
                <Flag className="h-4 w-4" />
                Create Goal
              </Button>
            </div>
          </Card>

          <Card className="liquid-glass border border-border/70 bg-card/90 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Goal Queue</h2>
            </div>

            {goals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background/60 p-8 text-center">
                <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No goals yet. Create your first goal and sync it to Google Calendar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal, index) => (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`rounded-xl border p-4 ${
                      goal.status === "completed"
                        ? "border-green-500/30 bg-green-500/8"
                        : "border-border bg-background/70"
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{goal.title}</p>
                      <Badge className={goalPriorityTone[goal.priority]} variant="outline">
                        {goal.priority}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">{goal.linkedItem.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Due {formatDueDate(goal.dueAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Planned slot: {goal.durationMinutes} min</p>

                    {goal.notes && <p className="mt-2 text-sm text-muted-foreground">{goal.notes}</p>}
                    {(goal.linkedItem.resourceUrls?.length ?? 0) > 0 && (
                      <div className="mt-2 space-y-1">
                        {(goal.linkedItem.resourceUrls ?? []).slice(0, 3).map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {url}
                          </a>
                        ))}
                        {(goal.linkedItem.resourceUrls?.length ?? 0) > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{(goal.linkedItem.resourceUrls?.length ?? 0) - 3} more link
                            {(goal.linkedItem.resourceUrls?.length ?? 0) - 3 === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={goal.status === "completed" ? "outline" : "default"}
                        onClick={() => handleToggleCompletion(goal)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {goal.status === "completed" ? "Reopen" : "Mark Complete"}
                      </Button>

                      <Button size="sm" variant="outline" asChild>
                        <a href={calendarUrlForGoal(goal)} target="_blank" rel="noreferrer">
                          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                          Google Calendar
                        </a>
                      </Button>

                      {goal.linkedItem.path && (
                        <Button size="sm" variant="ghost" onClick={() => navigate(goal.linkedItem.path!)}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Open Linked
                        </Button>
                      )}

                      <Button size="sm" variant="ghost" onClick={() => handleDeleteGoal(goal)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GoalsPage;
