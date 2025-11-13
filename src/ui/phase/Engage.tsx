import React from "react";
import type { PhaseComponentProps } from "./types";

const Engage: React.FC<PhaseComponentProps> = ({ state, dispatchEvent, localPlayer, players, helpers }) => {
  const { RoundHeader, energyLabel, openInventory } = helpers;
  const { round, reactorLimit, shipHealth01, engageSeatIndex } = state;
  const total = round.totalAfterItems;
  const current = players.find((p) => p.seatIndex === engageSeatIndex) ?? null;
  const isLocalTurn = current?.id === localPlayer.id;

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex justify-between items-center">
        <div className="text-sm text-slate-200">
          Current: <span className="font-semibold">{total}</span>
        </div>
        <div className="text-[11px] text-slate-400 text-right">
          Load
          <div className="w-24 h-2 rounded bg-slate-800 overflow-hidden mt-1">
            <div
              className={`h-full ${
                round.reactorEnergy01 < 0.25
                  ? "bg-sky-500"
                  : round.reactorEnergy01 < 0.6
                  ? "bg-amber-400"
                  : "bg-red-500"
              }`}
              style={{ width: `${round.reactorEnergy01 * 100}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] uppercase">{energyLabel(round.reactorEnergy01)}</div>
        </div>
      </div>
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3 flex flex-col gap-3">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Acting now</span>
          <span className="text-sm text-slate-100">{current?.name ?? "—"}</span>
        </div>
        <p className="text-[11px] text-slate-300">
          {isLocalTurn ? "Open your station inventory to fire one item, or pass." : `Waiting for ${current?.name ?? "crew"}...`}
        </p>
        {isLocalTurn && (
          <div className="flex flex-col gap-2 mt-1">
            <button
              type="button"
              onClick={() => openInventory?.()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600/90 text-slate-950 border border-emerald-400 shadow"
            >
              Open Inventory
            </button>
            <span className="text-[10px] text-slate-500">Items are used from the inventory panel.</span>
          </div>
        )}
      </div>
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-[11px] text-slate-400">
        <div className="font-semibold text-slate-200 mb-1">Turn order</div>
        {players.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span>
              {p.seatIndex + 1}. {p.name}
            </span>
            <span className={p.seatIndex === engageSeatIndex ? "text-emerald-400" : "text-slate-500"}>
              {p.seatIndex === engageSeatIndex ? "Acting" : p.items.every((it) => it.used) ? "Spent" : "Waiting"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={() => dispatchEvent("engage.pass")} className="px-4 py-2 rounded-lg bg-slate-800 text-sm font-semibold">
          {isLocalTurn ? "Pass" : "Advance"}
        </button>
      </div>
    </div>
  );
};

export default Engage;
