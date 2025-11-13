import React from "react";

type InventoryTabButtonProps = {
  hasUsableItems: boolean;
  isOpen: boolean;
  onToggle: () => void;
};

export const InventoryTabButton: React.FC<InventoryTabButtonProps> = ({
  hasUsableItems,
  isOpen,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={`absolute right-2 top-5 rounded-l-2xl px-1.5 py-3 text-[10px] font-semibold flex flex-col items-center gap-1 shadow-lg border z-50 ${
      isOpen ? "bg-emerald-900/90 border-emerald-500" : "bg-slate-900/95 border-slate-700"
    }`}
  >
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 ${hasUsableItems ? "text-emerald-300" : "text-slate-200"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
      <path d="M3 7h10" />
    </svg>
    <span className="rotate-90">INV</span>
    {hasUsableItems && (
      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
    )}
  </button>
);
