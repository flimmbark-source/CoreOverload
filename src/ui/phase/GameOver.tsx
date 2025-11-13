import React from "react";
import type { PhaseComponentProps } from "./types";

const GameOver: React.FC<PhaseComponentProps> = ({ state, dispatchEvent, players, helpers }) => {
  const { jobLabel } = helpers;
  const { clears, overloads } = state;
  const crewWin = clears >= 4 && overloads < 2;
  const title = crewWin ? "Crew Victory" : "Saboteur Victory";
  const color = crewWin ? "bg-emerald-900/60 border-emerald-500" : "bg-red-900/60 border-red-500";

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div className={`w-full rounded-2xl border p-4 ${color}`}>
        <h2 className="text-xl font-semibold mb-1">{title}</h2>
        <p className="text-sm text-slate-100">Clears {clears} / 6 · Overloads {overloads}</p>
      </div>
      <div className="w-full rounded-2xl bg-slate-950/80 border border-slate-700 p-3">
        <h3 className="text-sm font-semibold mb-1">Final roles</h3>
        <ul className="space-y-1 text-[11px] text-slate-300">
          {players.map((p) => (
            <li key={p.id}>
              {p.name} — {p.role} ({jobLabel(p.job)})
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={() => dispatchEvent("gameOver.restart")}
        className="px-4 py-2 rounded-lg bg-slate-800 text-sm font-semibold border border-slate-600"
      >
        Back to Lobby
      </button>
    </div>
  );
};

export default GameOver;
