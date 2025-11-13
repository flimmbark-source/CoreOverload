import React from "react";

type RoundHeaderProps = {
  gate: number;
  reactorLimit: number;
  shipHealth: number;
};

const ShipBar: React.FC<{ health: number }> = ({ health }) => (
  <div className="text-[10px] text-slate-400 text-center">
    Ship
    <div className="w-28 h-2 rounded bg-slate-800 overflow-hidden mt-1 mx-auto">
      <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(health, 1)) * 100}%` }} />
    </div>
  </div>
);

export const RoundHeader: React.FC<RoundHeaderProps> = ({ gate, reactorLimit, shipHealth }) => (
  <header className="w-full flex flex-col items-center justify-center mb-2 mt-1">
    <div className="text-xs text-slate-200 flex items-center gap-3 justify-center">
      <span>🚧 Gate {gate}</span>
      <span>☢️ Limit {reactorLimit}</span>
    </div>
    <div className="mt-2">
      <ShipBar health={shipHealth} />
    </div>
  </header>
);
