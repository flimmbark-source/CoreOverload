import React from "react";
import type { PhaseComponentProps } from "./types";

const Lobby: React.FC<PhaseComponentProps> = ({ dispatchEvent, localPlayer }) => (
  <div className="flex flex-col items-center gap-4">
    <h1 className="text-2xl font-semibold">Core Collapse</h1>
    <div className="w-full max-w-sm rounded-2xl bg-slate-950/80 border border-slate-800 p-4 flex flex-col gap-3">
      <label className="text-xs text-slate-400 flex flex-col gap-1">
        Callsign
        <input
          type="text"
          value={localPlayer.name}
          onChange={(e) => dispatchEvent("lobby.rename", e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
        />
      </label>
      <button onClick={() => dispatchEvent("lobby.ready")} className="w-full mt-2 px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
        Ready Up
      </button>
    </div>
  </div>
);

export default Lobby;
