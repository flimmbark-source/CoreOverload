import React from "react";
import type { PhaseComponentProps } from "./types";

const Plan: React.FC<PhaseComponentProps> = ({ state, dispatchEvent, localPlayer, players, helpers }) => {
  const { RoundHeader, JobBadge } = helpers;
  const { round, reactorLimit, shipHealth01, hand, slotCard } = state;
  const otherPlayers = players.filter((p) => p.id !== localPlayer.id);
  const localCard = round.cardsPlayed[localPlayer.id];

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />

      <p className="text-[11px] text-slate-300 text-center">Draw 5 from your 1–9 deck. Place 1 into the power slot.</p>

      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3 flex flex-col gap-3">
        <div className="flex flex-col items-center">
          <div className="text-[11px] text-slate-400">Power slot</div>
          <div className="mt-1">
            <div
              className={`w-14 h-20 rounded-xl border flex items-center justify-center text-lg font-semibold ${
                slotCard != null
                  ? "bg-emerald-500 text-slate-950 border-emerald-300"
                  : "bg-slate-900 text-slate-500 border-dashed border-slate-600"
              }`}
            >
              {slotCard ?? "?"}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="text-[11px] text-slate-400 mb-1 text-center">Your hand</div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {hand.length === 0 && <span className="text-[11px] text-slate-500">Dealing…</span>}
            {hand.map((v) => (
              <button
                key={v}
                onClick={() => dispatchEvent("plan.chooseCard", v)}
                className="w-10 h-14 rounded-xl border bg-slate-900 border-slate-700 text-sm flex items-center justify-center"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5 text-[11px] text-slate-400">
        <div className="font-semibold text-slate-200 mb-1">Crew</div>
        {otherPlayers.map((p) => (
          <div key={p.id} className="flex justify-between items-center">
            <span>{p.name}</span>
            <JobBadge job={p.job} compact />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => dispatchEvent("plan.lock")}
          disabled={localCard == null}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
            localCard != null
              ? "bg-emerald-600 border-emerald-500"
              : "bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed"
          }`}
        >
          Lock In Power
        </button>
      </div>
    </div>
  );
};

export default Plan;
