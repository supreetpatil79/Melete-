import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Loader2, Check, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { branches } from "../data/branches";
import { toast } from "sonner";

const SignupPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [selectedBranch, setSelectedBranch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error("Please fill in all fields");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return false;
    }

    return true;
  };

  const handleStep1Submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBranchSelect = async () => {
    if (!selectedBranch) {
      toast.error("Please select a branch");
      return;
    }

    setIsLoading(true);
    try {
      await signup(formData.name, formData.email, formData.password, selectedBranch);
      toast.success("Account created successfully");
      navigate("/dashboard");
    } catch {
      toast.error("Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-hero pb-16 pt-24">
      <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-30" />
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />

      <div className="container relative max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <Card className="liquid-glass premium-outline border-border/70 bg-card/85 p-8 shadow-card backdrop-blur">
            <div className="mb-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Melete
              </p>

              <div className="mt-6 mb-6 flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-colors ${
                    step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > 1 ? <Check className="h-5 w-5" /> : "1"}
                </div>
                <div className={`h-1 flex-1 rounded ${step > 1 ? "bg-primary" : "bg-muted"}`} />
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-colors ${
                    step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  2
                </div>
              </div>

              <h1 className="text-3xl font-bold text-foreground">Create your Melete account</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {step === 1
                  ? "Start with your profile details."
                  : "Choose a branch so recommendations are tuned from day one."}
              </p>
            </div>

            {step === 1 && (
              <form onSubmit={handleStep1Submit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-foreground">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="h-11 rounded-xl border-border/70 bg-background pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="h-11 rounded-xl border-border/70 bg-background pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="h-11 rounded-xl border-border/70 bg-background pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-foreground">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="h-11 rounded-xl border-border/70 bg-background pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="h-11 w-full rounded-xl font-semibold shadow-glow">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto pr-1">
                  {branches.map((branch) => (
                    <motion.button
                      key={branch.id}
                      onClick={() => setSelectedBranch(branch.id)}
                      className={`motion-interactive rounded-xl border-2 p-4 text-left ${
                        selectedBranch === branch.id
                          ? "border-primary bg-primary/8"
                          : "border-border/70 bg-background/70 hover:border-primary/40"
                      }`}
                      whileHover={{ y: -1 }}
                      whileTap={{ y: 0 }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                            selectedBranch === branch.id ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {selectedBranch === branch.id && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{branch.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{branch.description}</p>
                          <p className="mt-2 text-xs font-medium text-primary">{branch.code}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="h-11 flex-1 rounded-xl"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleBranchSelect}
                    className="h-11 flex-1 rounded-xl font-semibold shadow-glow"
                    disabled={isLoading || !selectedBranch}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default SignupPage;
