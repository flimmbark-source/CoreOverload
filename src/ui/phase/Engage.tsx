import React from "react";
import type { PhaseComponentProps } from "./types";

const Engage: React.FC<PhaseComponentProps> = ({ state, localPlayer, players, helpers }) => {
  const { RoundHeader, energyLabel, jobLabel } = helpers;
  const { round, reactorLimit, shipHealth01 } = state;
  const { totalAfterItems, reactorEnergy01 } = round;

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4 text-sm text-slate-200">
        <p className="leading-relaxed">
          All crew stations are live. Operate your
          <span className="text-emerald-300 font-semibold"> {jobLabel(localPlayer.job)}</span>
          {" "}
          console in the overlay to shape the round outcome while the rest of the crew does the same. Reactor
          diagnostics update in real time and item effects resolve automatically.
        </p>
        <p className="text-[11px] text-slate-400 mt-3">
          Use the side inventory tab to fire any additional Engage items while you are running your job minigame.
        </p>
      </div>
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 flex justify-between items-center">
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">Current Load</div>
          <div className="text-2xl font-semibold text-slate-50">{totalAfterItems}</div>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          Load
          <div className="w-28 h-2 rounded bg-slate-800 overflow-hidden mt-1">
            <div
              className={`h-full ${
                reactorEnergy01 < 0.25
                  ? "bg-sky-500"
                  : reactorEnergy01 < 0.6
                  ? "bg-amber-400"
                  : "bg-red-500"
              }`}
              style={{ width: `${reactorEnergy01 * 100}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] uppercase">{energyLabel(reactorEnergy01)}</div>
        </div>
      </div>
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4">
        <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-2">Crew readiness</div>
        <div className="flex flex-col gap-1.5 text-sm">
          {players.map((player) => {
            const ready = player.items.some((item) => !item.used && item.timing === "Engage");
            return (
              <div key={player.id} className="flex justify-between text-slate-200">
                <span>
                  {player.name} · {jobLabel(player.job)}
                </span>
                <span className={ready ? "text-emerald-400" : "text-slate-500"}>{ready ? "Active" : "Spent"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Engage;
