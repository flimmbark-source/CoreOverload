import React from "react";
import type { PhaseComponentProps } from "./types";

const RoleReveal: React.FC<PhaseComponentProps> = ({ dispatchEvent, localPlayer, helpers }) => {
  const { RoleBadge, JobBadge } = helpers;

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">Your Assignment</h2>
      <div className="w-full max-w-sm rounded-2xl bg-slate-950/90 border border-slate-700 p-4 flex flex-col gap-2">
        <div className="text-xs text-slate-400">Callsign</div>
        <div className="text-lg font-semibold">{localPlayer.name}</div>
        <div className="flex justify-between items-center mt-1">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-400">Role</div>
            <RoleBadge role={localPlayer.role} />
          </div>
          <div className="text-right flex flex-col gap-1 items-end">
            <div className="text-xs text-slate-400">Station</div>
            <JobBadge job={localPlayer.job} />
          </div>
        </div>
        <p className="text-[11px] text-slate-300 mt-2">
          Crew: clear 4+ hazards in 6 rounds without 2 overloads. Saboteur: force 2 overloads or keep clears &lt; 4.
        </p>
      </div>
      <button onClick={() => dispatchEvent("roleReveal.continue")} className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
        Continue to Round 1
      </button>
    </div>
  );
};

export default RoleReveal;
