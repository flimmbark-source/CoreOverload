import React from "react";
import type { PhaseComponentProps } from "./types";

const Maintenance: React.FC<PhaseComponentProps> = ({ state, dispatchEvent, players, helpers }) => {
  const { RoundHeader, jobLabel } = helpers;
  const { round, reactorLimit, shipHealth01, overloads, roundIndex } = state;
  const total = round.totalAfterItems;
  const outcome = round.outcome;
  const tierStyles: Record<string, string> = {
    SUCCESS: "bg-emerald-900/50 border-emerald-500/70",
    PARTIAL: "bg-amber-900/50 border-amber-500/60",
    FAIL: "bg-red-900/60 border-red-500/70",
  };
  const tierLabels: Record<string, string> = {
    SUCCESS: "Success",
    PARTIAL: "Partial",
    FAIL: "Failure",
  };
  const outcomeBannerColor =
    outcome === "Overload"
      ? "bg-red-900/60 border-red-500"
      : outcome === "Clear"
      ? "bg-emerald-900/60 border-emerald-500"
      : "bg-amber-900/40 border-amber-500";
  const formatDelta = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  const totalReactorDelta = round.minigameResults.reduce((acc, r) => acc + r.deltaTotal, 0);
  const totalShipDelta = round.minigameResults.reduce((acc, r) => acc + r.deltaShipHP, 0);
  const overloaded = outcome === "Overload" || total > reactorLimit;

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />
      <div className="rounded-2xl border border-slate-600/70 bg-slate-900/60 p-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-300">System Check</div>
        {round.minigameResults.length > 0 ? (
          <div className="mt-3 space-y-2">
            {round.minigameResults.map((r, idx) => {
              const player = players.find((p) => p.id === r.playerId);
              const tierClass = tierStyles[r.tier] ?? "bg-slate-900/70 border-slate-600/70";
              const label = tierLabels[r.tier] ?? r.tier;
              return (
                <div key={idx} className={`rounded-xl border p-3 ${tierClass}`}>
                  <div className="text-xs uppercase tracking-wide text-slate-200/90">
                    {player?.name ?? "Unknown"} · {jobLabel(r.job)}
                  </div>
                  <div className="text-lg font-semibold text-slate-50 mt-1">
                    {label} ({r.percentFinished}%)
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-200 mt-1">No system checks have been recorded.</div>
        )}
      </div>
      {outcome && (
        <div className={`rounded-2xl border p-3 ${outcomeBannerColor}`}>
          <div className="text-sm text-slate-100">Round Outcome: {outcome}</div>
          <div className="text-[11px] text-slate-200 mt-1">Final Total {total} (base {round.totalBeforeItems})</div>
        </div>
      )}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-3">
        <div className="text-[11px] text-slate-400 uppercase tracking-wide">Station Effects</div>
        <ul className="mt-2 text-[11px] text-slate-200 space-y-1">
          {round.minigameResults.map((r, idx) => (
            <li key={idx}>
              Reactor {formatDelta(r.deltaTotal)} · Ship HP {formatDelta(r.deltaShipHP)}
            </li>
          ))}
          {round.minigameResults.length === 0 && <li>No station items used.</li>}
        </ul>
        {round.minigameResults.length > 0 && (
          <div className="text-[11px] text-slate-200 mt-3 border-t border-slate-700/80 pt-2">
            Reactor {formatDelta(totalReactorDelta)} · Ship HP {formatDelta(totalShipDelta)}
          </div>
        )}
        {overloaded && (
          <div className="text-sm font-semibold text-red-400 mt-2">OVERLOADED!</div>
        )}
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
