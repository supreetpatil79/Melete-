interface CompanyCardProps {
  company: string;
  description: string;
  logoUrl: string;
  match: number;
  internshipMatch: number;
  fteMatch: number;
  recommendedRole: "Internship" | "FTE";
  active?: boolean;
  onClick?: () => void;
}

const CompanyCard = ({
  company,
  description,
  logoUrl,
  match,
  internshipMatch,
  fteMatch,
  recommendedRole,
  active = false,
  onClick,
}: CompanyCardProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border bg-card p-5 text-left transition-shadow duration-200 ${
        active ? "border-primary shadow-card" : "border-border hover:shadow-card"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex min-h-10 min-w-[64px] items-center justify-center rounded-xl border border-border bg-background px-2">
          <img
            src={logoUrl}
            alt={`${company} logo`}
            className="h-10 w-auto max-w-[96px] object-contain"
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-foreground">{company}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border bg-secondary px-2 py-1">
              Internship: {internshipMatch}%
            </span>
            <span className="rounded-md border border-border bg-secondary px-2 py-1">FTE: {fteMatch}%</span>
            <span className="rounded-md border border-border bg-secondary px-2 py-1">
              Recommended: {recommendedRole}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-primary bg-primary px-3 py-2 text-center text-primary-foreground">
          <p className="text-[10px] font-semibold uppercase tracking-wide">Match</p>
          <p className="text-sm font-bold">{match}%</p>
        </div>
      </div>
    </button>
  );
};

export default CompanyCard;
