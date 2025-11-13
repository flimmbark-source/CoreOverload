import React from "react";
import type {
  ItemId,
  ItemInstance,
  Job,
  Phase,
  Player,
} from "../../game/types";
import { Tooltip } from "../atoms/Tooltip";

type InventoryPanelProps = {
  localPlayer: Player;
  phase: Phase;
  onClose: () => void;
  onUseItem: (item: ItemInstance) => void;
  jobLabel: (job: Job) => string;
};

const itemDescription = (id: ItemId): string => {
  switch (id) {
    case "BOOST":
      return "+3 to the reactor total this round.";
    case "VENT":
      return "-3 to the reactor total, easing overload risk.";
    case "EQUALIZER":
      return "If below Gate: +2. Otherwise: -2 to the reactor total.";
    default:
      return "";
  }
};

const ItemIcon: React.FC<{ id: ItemId }> = ({ id }) => {
  const strokeClass =
    id === "BOOST"
      ? "text-amber-300"
      : id === "VENT"
      ? "text-sky-300"
      : "text-emerald-300";

  const pathD =
    id === "BOOST"
      ? "M8 2 L13 8 L8 14 L3 8 Z"
      : id === "VENT"
      ? "M3 4 H13 V12 H3 Z"
      : "M2 12 C4 4, 9 14, 14 3";

  return (
    <svg
      className={`h-4 w-4 ${strokeClass}`}
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
    >
      <path d={pathD} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  localPlayer,
  phase,
  onClose,
  onUseItem,
  jobLabel,
}) => {
  const canUseItems = phase === "Engage";

  return (
    <div className="absolute top-2 right-2 w-56 sm:w-60 rounded-2xl bg-slate-950/95 border border-slate-700 shadow-xl p-3 z-20">
      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-400">Inventory</span>
          <span className="text-xs text-slate-200 font-semibold">
            {localPlayer.name} · {jobLabel(localPlayer.job)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-xs text-slate-300"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {localPlayer.items.length === 0 && (
          <div className="text-[11px] text-slate-500">No station items.</div>
        )}
        {localPlayer.items.map((item) => {
          const isUsable = canUseItems && !item.used && item.timing === "Engage";
          const tooltipContent = (
            <span className="flex flex-col gap-0.5 text-[10px] text-slate-100">
              <span>{itemDescription(item.id)}</span>
              {!canUseItems && <span className="text-slate-400">Usable during ENGAGE.</span>}
            </span>
          );

          return (
            <div key={item.id} className="flex flex-col gap-1">
              <Tooltip label={tooltipContent} className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    if (isUsable) {
                      onUseItem(item);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
                    item.used
                      ? "bg-slate-900 border-slate-800 text-slate-500 line-through"
                      : isUsable
                      ? "bg-emerald-600/10 border-emerald-400/70 text-slate-100"
                      : "bg-slate-900 border-slate-700 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ItemIcon id={item.id} />
                    <span className="font-semibold">{item.name}</span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wide text-slate-400">{item.timing}</span>
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
};
