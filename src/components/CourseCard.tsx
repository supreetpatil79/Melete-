import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Clock, BookOpen, CheckCircle2 } from "lucide-react";

interface CourseCardProps {
  id: string;
  title: string;
  description: string;
  duration: string;
  lessons: number;
  progress?: number;
  image?: string;
  trackId?: string;
}

const CourseCard = ({ id, title, description, duration, lessons, progress, trackId }: CourseCardProps) => {
  const href = trackId ? `/tracks/${trackId}/courses/${id}` : "#";

  return (
    <Link to={href}>
      <motion.div className="motion-card group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">{title}</h4>
          {progress !== undefined && progress >= 100 && <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">{description}</p>

        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {duration}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {lessons} lessons
          </span>
        </div>

        {progress !== undefined && (
          <div>
            <div className="h-1.5 w-full rounded-full bg-secondary">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="mt-1 inline-block text-xs text-muted-foreground">{progress}% complete</span>
          </div>
        )}
      </motion.div>
    </Link>
  );
};

export default CourseCard;
