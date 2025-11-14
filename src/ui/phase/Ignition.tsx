import React from "react";
import type { PhaseComponentProps } from "./types";

const Ignition: React.FC<PhaseComponentProps> = ({ state, dispatchEvent, localPlayer, players, helpers }) => {
  const { RoundHeader, energyLabel } = helpers;
  const { round, reactorLimit, shipHealth01 } = state;
  const total = round.totalBeforeItems;
  const energy = round.reactorEnergy01;
  const otherPlayers = players.filter((p) => p.id !== localPlayer.id);

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <RoundHeader
        gate={round.gate}
        reactorLimit={reactorLimit}
        shipHealth={shipHealth01}
        enginePower={round.totalAfterItems}
      />
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3 flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span>Your card</span>
          <span className="font-semibold text-emerald-400">{round.cardsPlayed[localPlayer.id]}</span>
        </div>
        {otherPlayers.map((p) => (
          <div key={p.id} className="flex justify-between text-sm text-slate-200">
            <span>{p.name}</span>
            <span className="font-semibold">{round.cardsPlayed[p.id]}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex justify-between items-center">
        <div className="text-sm text-slate-200">
          Total: <span className="font-semibold">{total}</span>
        </div>
        <div className="text-[11px] text-slate-400 text-right">
          Load
          <div className="w-24 h-2 rounded bg-slate-800 overflow-hidden mt-1">
            <div
              className={`h-full ${energy < 0.25 ? "bg-sky-500" : energy < 0.6 ? "bg-amber-400" : "bg-red-500"}`}
              style={{ width: `${energy * 100}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] uppercase">{energyLabel(energy)}</div>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => dispatchEvent("ignition.proceed")} className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
          Proceed to Job
        </button>
      </div>
    </div>
  );
};

export default Ignition;
