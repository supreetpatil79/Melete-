import { motion } from "framer-motion";
import { branches } from "../data/branches";
import { useAuth } from "../context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const BranchSelector = () => {
  const { user, changeBranch } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Select Your Branch</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Your branch determines which courses and tracks you see
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {branches.map((branch) => (
          <motion.button
            key={branch.id}
            onClick={() => changeBranch(branch.id)}
            className={`motion-interactive rounded-lg border-2 p-3 text-left text-sm ${
              user.branch === branch.id
                ? "border-primary bg-primary/5"
                : "border-border/50 bg-muted/30 hover:border-primary/50"
            }`}
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
          >
            <div className="flex items-start gap-2">
              <div
                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  user.branch === branch.id
                    ? "border-primary bg-primary"
                    : "border-border"
                }`}
              >
                {user.branch === branch.id && (
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{branch.code}</h4>
                <p className="text-xs text-muted-foreground">{branch.name}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default BranchSelector;
