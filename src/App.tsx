import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./components/theme-provider";
import { AppearanceProvider } from "./context/AppearanceContext";
import AppErrorBoundary from "./components/AppErrorBoundary";
import NetworkStatusBanner from "./components/NetworkStatusBanner";
import RouteLoader from "./components/RouteLoader";

const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/Login"));
const SignupPage = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TracksPage = lazy(() => import("./pages/Tracks"));
const TrackDetail = lazy(() => import("./pages/TrackDetail"));
const CoursePlayer = lazy(() => import("./pages/CoursePlayer"));
const CoursesPage = lazy(() => import("./pages/Courses"));
const PracticePage = lazy(() => import("./pages/Practice"));
const QuestionHubPage = lazy(() => import("./pages/QuestionHub"));
const HackathonsPage = lazy(() => import("./pages/Hackathons"));
const TechVisePage = lazy(() => import("./pages/TechVise"));
const RoadmapsPage = lazy(() => import("./pages/Roadmaps"));
const MissionPage = lazy(() => import("./pages/Mission"));
const GoalsPage = lazy(() => import("./pages/Goals"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const WhatsUpInTechPage = lazy(() => import("./pages/WhatsUpInTech"));
const SearchResultsPage = lazy(() => import("./pages/SearchResults"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 45_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppearanceProvider>
        <AppErrorBoundary>
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <a
                  href="#main-content"
                  className="sr-only z-[60] rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:border focus:border-border"
                >
                  Skip to main content
                </a>
                <Navbar />
                <NetworkStatusBanner />
                <main id="main-content">
                  <Suspense fallback={<RouteLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignupPage />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/tracks" element={<TracksPage />} />
                      <Route path="/tracks/:trackId" element={<TrackDetail />} />
                      <Route path="/tracks/:trackId/courses/:courseId" element={<CoursePlayer />} />
                      <Route path="/courses" element={<CoursesPage />} />
                      <Route path="/practice" element={<PracticePage />} />
                      <Route path="/question-hub" element={<QuestionHubPage />} />
                      <Route path="/hackathons" element={<HackathonsPage />} />
                      <Route path="/techvise" element={<TechVisePage />} />
                      <Route path="/whats-up-in-tech" element={<WhatsUpInTechPage />} />
                      <Route path="/roadmaps" element={<RoadmapsPage />} />
                      <Route path="/mission" element={<MissionPage />} />
                      <Route path="/goals" element={<GoalsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/settings" element={<ProfilePage />} />
                      <Route path="/search-results" element={<SearchResultsPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </main>
              </BrowserRouter>
            </AuthProvider>
          </TooltipProvider>
        </AppErrorBoundary>
      </AppearanceProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
