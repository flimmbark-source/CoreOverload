import React from "react";
import type { MinigameTier } from "../game/types";

export interface MinigameProps {
  reactorEnergy: number;
  shipHealth: number;
  onComplete: (tier: MinigameTier, score01: number) => void;
}

export const MinigameCard: React.FC<{
  title: string;
  subtitle: string;
  description: string;
  onSuccess: () => void;
  onPartial: () => void;
  onFail: () => void;
}> = ({ title, subtitle, description, onSuccess, onPartial, onFail }) => (
  <div className="w-full max-w-sm rounded-2xl bg-slate-950/90 border border-slate-700 p-4 flex flex-col gap-3">
    <div>
      <h3 className="text-lg font-semibold text-slate-50">{title}</h3>
      <p className="text-[11px] text-emerald-400 mt-0.5">{subtitle}</p>
    </div>
    <p className="text-sm text-slate-200 leading-relaxed">{description}</p>
    <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-400">
      <div className="flex justify-between"><span>Perfect control</span><span className="text-emerald-400">Strong</span></div>
      <div className="flex justify-between"><span>Decent control</span><span className="text-amber-300">Medium</span></div>
      <div className="flex justify-between"><span>Chaotic / missed</span><span className="text-red-400">Weak</span></div>
    </div>
    <div className="flex flex-col gap-2 mt-1">
      <button onClick={onSuccess} className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-emerald-600 text-slate-950">
        Clean Success
      </button>
      <button onClick={onPartial} className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-amber-600 text-slate-950">
        Messy / Partial
      </button>
      <button onClick={onFail} className="w-full px-3 py-2 rounded-full text-xs font-semibold bg-red-700 text-slate-50">
        Panic / Fail
      </button>
    </div>
  </div>
);
