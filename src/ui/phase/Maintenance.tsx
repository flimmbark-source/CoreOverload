import React from "react";
import type { PhaseComponentProps } from "./types";

const Maintenance: React.FC<PhaseComponentProps> = ({ state, dispatchEvent, players, helpers }) => {
  const { RoundHeader, jobLabel } = helpers;
  const { round, reactorLimit, shipHealth01, overloads, roundIndex } = state;
  const total = round.totalAfterItems;
  const outcome = round.outcome;
  const bannerColor =
    outcome === "Overload"
      ? "bg-red-900/60 border-red-500"
      : outcome === "Clear"
      ? "bg-emerald-900/60 border-emerald-500"
      : "bg-amber-900/40 border-amber-500";

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />
      <div className={`rounded-2xl border p-3 ${bannerColor}`}>
        <div className="text-sm text-slate-100">Outcome: {outcome ?? "?"}</div>
        <div className="text-[11px] text-slate-200 mt-1">Final Total {total} (base {round.totalBeforeItems})</div>
        <ul className="mt-2 text-[11px] text-slate-200 space-y-1">
          {round.minigameResults.map((r, idx) => {
            const player = players.find((p) => p.id === r.playerId);
            return (
              <li key={idx}>
                {player?.name} [{jobLabel(r.job)}] {r.itemId}: {r.tier.toUpperCase()} → {r.deltaTotal >= 0 ? "+" : ""}
                {r.deltaTotal}
                {r.deltaShipHealth01 !== 0 && (
                  <span>
                    {" "}/ Ship {r.deltaShipHealth01 >= 0 ? "+" : ""}
                    {Math.round(r.deltaShipHealth01 * 100)}%
                  </span>
                )}
              </li>
            );
          })}
          {round.minigameResults.length === 0 && <li>No station items used.</li>}
        </ul>
      </div>
      <div className="flex justify-end">
        <button onClick={() => dispatchEvent("maintenance.resolve")} className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
          {overloads >= 2 || roundIndex >= 6 ? "Resolve & End Game" : "Resolve & Next Round"}
        </button>
      </div>
    </div>
  );
};

export default Maintenance;
