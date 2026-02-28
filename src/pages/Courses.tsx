import { motion } from "framer-motion";
import { useState } from "react";
import { Filter } from "lucide-react";
import CourseCard from "../components/CourseCard";
import { useAuth } from "../context/AuthContext";
import { getTracksByBranch } from "../services/trackService";
import { branches } from "../data/branches";
import { Button } from "@/components/ui/button";

const CoursesPage = () => {
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState(user?.branch || "");
  const [showBranchFilter, setShowBranchFilter] = useState(false);

  const filteredTracks = getTracksByBranch(selectedBranch || undefined);
  const allCourses = filteredTracks.flatMap((track) =>
    track.courses.map((course) => ({ ...course, trackTitle: track.title, trackColor: track.color })),
  );
  const currentBranch = branches.find((branch) => branch.id === selectedBranch);

  return (
    <div className="min-h-screen bg-background pb-16 pt-24">
      <div className="container">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-semibold text-foreground">Courses</h1>
          <p className="mt-2 text-muted-foreground">
            Explore {allCourses.length} courses across {filteredTracks.length} tracks.
          </p>
          {currentBranch && <p className="mt-2 text-sm font-medium text-primary">Showing courses for {currentBranch.name}</p>}
        </motion.section>

        {user && (
          <section className="mb-8 rounded-xl border border-border bg-card p-4">
            <Button variant={showBranchFilter ? "default" : "outline"} onClick={() => setShowBranchFilter((value) => !value)} className="h-11 gap-2">
              <Filter className="h-4 w-4" />
              Filter by Branch
            </Button>

            {showBranchFilter && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => setSelectedBranch(selectedBranch === branch.id ? "" : branch.id)}
                      className={`liquid-glass-button rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedBranch === branch.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/50"
                      }`}
                    >
                      {branch.code}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </section>
        )}

        {filteredTracks.map((track) => (
          <section key={track.id} className="mb-12">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.color }} />
              <h2 className="text-2xl font-semibold text-foreground">{track.title}</h2>
              <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {track.courses.length} courses
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {track.courses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  viewport={{ once: true }}
                >
                  <CourseCard {...course} trackId={track.id} />
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default CoursesPage;
