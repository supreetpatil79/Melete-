import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, BookOpen, ChevronRight } from "lucide-react";
import { tracks } from "../data/tracks";
import CourseCard from "../components/CourseCard";

const TrackDetail = () => {
  const { trackId } = useParams();
  const track = tracks.find((t) => t.id === trackId);

  if (!track) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Track not found</h1>
          <Link to="/tracks" className="mt-4 inline-block text-primary hover:underline">
            ← Back to tracks
          </Link>
        </div>
      </div>
    );
  }

  const Icon = track.icon;

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container">
        {/* Breadcrumb */}
        <Link
          to="/tracks"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tracks
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col gap-6 md:flex-row md:items-start md:gap-8"
        >
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${track.color}20`, color: track.color }}
          >
            <Icon className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">{track.title}</h1>
            <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{track.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> {track.courseCount} courses
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {track.duration}
              </span>
              <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium">{track.level}</span>
            </div>
          </div>
          <button className="liquid-glass-button motion-interactive motion-button shrink-0 rounded-xl !bg-primary px-6 py-3 font-semibold !text-primary-foreground shadow-glow">
            Start Track
          </button>
        </motion.div>

        {/* Course list */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Courses in this track</h2>
          <p className="mt-1 text-sm text-muted-foreground">Complete them in order for the best learning experience</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {track.courses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <CourseCard {...course} trackId={track.id} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrackDetail;
