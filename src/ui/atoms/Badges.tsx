import React from "react";
import type { Job, Role } from "../../game/types";
import { jobAccentClasses, jobLabel } from "../helpers";

export const RoleBadge: React.FC<{ role: Role }> = ({ role }) => {
  const isCrew = role === "Crew";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shadow-sm ${
        isCrew ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-300" : "border-red-400/70 bg-red-500/10 text-red-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isCrew ? "bg-emerald-400" : "bg-red-400"}`} />
      {role.toUpperCase()}
    </span>
  );
};

export const JobBadge: React.FC<{ job: Job; compact?: boolean }> = ({ job, compact }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 ${
      compact ? "py-0.5 text-[9px]" : "py-0.5 text-[10px]"
    } rounded-full font-medium border ${jobAccentClasses(job)}`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {jobLabel(job)}
  </span>
);
