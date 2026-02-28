import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Search,
  Menu,
  X,
  LogOut,
  Settings,
  Target,
  CalendarClock,
  Sun,
  Moon,
  Monitor,
  Code2,
  Compass,
  Trophy,
  Users,
  Map,
  Newspaper,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useAuth } from "../context/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import GlobalSearch from "@/components/GlobalSearch";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Mission", href: "/mission", icon: Target },
  { label: "Goals", href: "/goals", icon: CalendarClock },
  { label: "Tracks", href: "/tracks", icon: LayoutDashboard },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Practice", href: "/practice", icon: GraduationCap },
];

const discoverItems = [
  { label: "What's Up in Tech", href: "/whats-up-in-tech", icon: Newspaper },
  { label: "Question Hub", href: "/question-hub", icon: Code2 },
  { label: "Hackathons", href: "/hackathons", icon: Trophy },
  { label: "TechVise", href: "/techvise", icon: Users },
  { label: "Roadmaps", href: "/roadmaps", icon: Map },
];

const themeOptions = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
] as const;

const orderedThemes: Array<(typeof themeOptions)[number]["key"]> = ["light", "dark", "system"];

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const activeTheme = mounted ? theme ?? "system" : "system";
  const ActiveThemeIcon = themeOptions.find((option) => option.key === activeTheme)?.icon ?? Monitor;

  const cycleTheme = () => {
    const currentIndex = orderedThemes.indexOf(activeTheme as (typeof orderedThemes)[number]);
    const nextTheme = orderedThemes[(currentIndex + 1) % orderedThemes.length];
    setTheme(nextTheme);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      setSearchOpen((previous) => !previous);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <nav className="fixed left-0 right-0 top-3 z-50 px-3 sm:px-5 lg:px-8">
      <div className="liquid-glass-nav mx-auto max-w-[1320px] border border-border px-3 py-2 sm:px-4">
        <div className="flex h-[54px] items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 rounded-full px-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <div className="leading-none">
              <div className="font-display text-[1.65rem] font-semibold tracking-tight text-foreground">Melete</div>
              <div className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">Earn Every Line</div>
            </div>
          </Link>

          <div className="hidden items-center gap-0.5 xl:flex">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link key={item.href} to={item.href} className={cn("nav-link-pill", isActive && "nav-link-pill-active")}>
                  {item.label}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "nav-link-pill",
                    discoverItems.some((item) => location.pathname.startsWith(item.href)) && "nav-link-pill-active",
                  )}
                >
                  <Compass className="h-3.5 w-3.5" />
                  Discover
                  <ChevronRight className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="liquid-glass w-56 border border-border bg-card p-1.5">
                {discoverItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link to={item.href} className="flex cursor-pointer items-center gap-2.5 rounded-xl">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={cycleTheme}
              className="liquid-glass-button liquid-glass-icon inline-flex items-center justify-center"
              aria-label="Cycle theme"
            >
              <ActiveThemeIcon className="h-[18px] w-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="liquid-glass-button liquid-glass-button-primary inline-flex h-11 items-center gap-2 px-5 text-sm font-medium"
            >
              <Search className="h-4 w-4" />
              Experience Melete
            </button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="liquid-glass-button inline-flex h-11 items-center gap-2 px-3.5 text-sm font-medium">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs font-semibold">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[160px] truncate text-foreground">{user.name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="liquid-glass w-56 border border-border bg-card p-1.5">
                  <DropdownMenuItem className="rounded-xl text-xs text-muted-foreground">{user.branch.toUpperCase()}</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-xl">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="flex cursor-pointer items-center gap-2 rounded-xl text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/signup" className="liquid-glass-button inline-flex h-11 items-center px-5 text-sm font-semibold">
                Talk to Sales
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="liquid-glass-button liquid-glass-icon inline-flex items-center justify-center"
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className="liquid-glass-button liquid-glass-icon inline-flex items-center justify-center"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="motion-dropdown md:hidden"
            >
              <div className="mt-2 space-y-2 rounded-3xl border border-border bg-card p-3">
                <div className="mb-1 flex items-center gap-1.5 rounded-2xl border border-border bg-background p-1">
                  {themeOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setTheme(option.key)}
                      className={cn(
                        "liquid-glass-button inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold",
                        activeTheme === option.key ? "liquid-glass-button-brand text-white" : "text-foreground",
                      )}
                    >
                      <option.icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  ))}
                </div>

                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="liquid-glass-button flex h-11 items-center gap-2.5 px-3 text-sm font-medium text-foreground"
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </Link>
                ))}

                {discoverItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="liquid-glass-button flex h-11 items-center gap-2.5 px-3 text-sm font-medium text-foreground"
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </Link>
                ))}

                {user ? (
                  <>
                    <div className="liquid-glass-field rounded-2xl px-3 py-2 text-xs text-muted-foreground">
                      {user.name} | {user.branch.toUpperCase()}
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setMobileOpen(false)}
                      className="liquid-glass-button flex h-11 items-center gap-2.5 px-3 text-sm font-medium text-foreground"
                    >
                      <Settings className="h-4 w-4 text-primary" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMobileOpen(false);
                      }}
                      className="liquid-glass-button flex h-11 w-full items-center justify-center gap-2 border-red-500/55 bg-red-500/12 text-sm font-medium text-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="liquid-glass-button inline-flex h-11 items-center justify-center px-3 text-sm font-semibold"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setMobileOpen(false)}
                      className="liquid-glass-button liquid-glass-button-brand inline-flex h-11 items-center justify-center px-3 text-sm font-semibold text-white"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </nav>
  );
};

export default Navbar;
