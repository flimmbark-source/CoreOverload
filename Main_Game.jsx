import React, { useState } from "react";
import { applyItem } from "./src/game/actions/items";

// Core Collapse — Mobile Game Flow (compact, deck-of-9 with 5-card hand)
// Single-device prototype of one player's phone, with inventory tab & item tooltips.

// --- Types ---

type Role = "Crew" | "Saboteur";

type Job = "PowerEngineer" | "CoolantTech" | "FluxSpecialist";

type Phase =
  | "Lobby"
  | "RoleReveal"
  | "Plan"
  | "Ignition"
  | "Engage"
  | "MiniGame"
  | "Maintenance"
  | "GameOver";

type ItemTiming = "Plan" | "Engage";

type ItemId = "BOOST" | "VENT" | "EQUALIZER";

type ItemInstance = {
  id: ItemId;
  name: string;
  timing: ItemTiming;
  job: Job;
  used: boolean;
};

type Player = {
  id: string;
  name: string;
  seatIndex: number;
  role: Role;
  job: Job;
  items: ItemInstance[];
};

type MinigameTier = "fail" | "partial" | "success";

type MinigameResult = {
  playerId: string;
  job: Job;
  itemId: ItemId;
  tier: MinigameTier;
  score01: number;
  deltaTotal: number;
  deltaShipHealth01: number;
};

type RoundOutcome = "Clear" | "Fail" | "Overload" | null;

type RoundState = {
  index: number;
  gate: number;
  cardsPlayed: Record<string, number | null>;
  totalBeforeItems: number;
  totalAfterItems: number;
  reactorEnergy01: number;
  outcome: RoundOutcome;
  minigameResults: MinigameResult[];
};

type PendingItemEffect = {
  playerId: string;
  itemId: ItemId;
  deltaTotal: number;
  deltaShip: number;
};

const LOCAL_PLAYER_ID = "p1";

// --- Helpers ---

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const randomCard = () => 1 + Math.floor(Math.random() * 9);

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
      ? "M8 2 L13 8 L8 14 L3 8 Z" // diamond
      : id === "VENT"
      ? "M3 4 H13 V12 H3 Z" // square
      : "M2 12 C4 4, 9 14, 14 3"; // wave

  return (
    <svg
      className={`h-4 w-4 ${strokeClass}`}
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
    >
      <path
        d={pathD}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const createDefaultPlayers = (): Player[] => {
  const baseItems = (job: Job): ItemInstance[] => {
    switch (job) {
      case "PowerEngineer":
        return [{ id: "BOOST", name: "BOOST", timing: "Engage", job, used: false }];
      case "CoolantTech":
        return [{ id: "VENT", name: "VENT", timing: "Engage", job, used: false }];
      case "FluxSpecialist":
        return [{ id: "EQUALIZER", name: "EQUALIZER", timing: "Engage", job, used: false }];
      default:
        return [];
    }
  };

  return [
    {
      id: "p1",
      name: "You",
      seatIndex: 0,
      role: "Crew",
      job: "PowerEngineer",
      items: baseItems("PowerEngineer"),
    },
    {
      id: "p2",
      name: "Bravo",
      seatIndex: 1,
      role: "Crew",
      job: "CoolantTech",
      items: baseItems("CoolantTech"),
    },
    {
      id: "p3",
      name: "Charlie",
      seatIndex: 2,
      role: "Saboteur",
      job: "FluxSpecialist",
      items: baseItems("FluxSpecialist"),
    },
  ];
};

const createInitialRound = (
  index: number,
  reactorLimit: number,
  players: Player[]
): RoundState => {
  const n = players.length;
  const base = 4 * n;
  const offset = [-2, -1, 0, 1, 2][(index - 1) % 5];
  const gate = base + offset;

  const cardsPlayed: Record<string, number | null> = {};
  players.forEach((p) => {
    cardsPlayed[p.id] = null;
  });

  return {
    index,
    gate,
    cardsPlayed,
    totalBeforeItems: 0,
    totalAfterItems: 0,
    reactorEnergy01: 0,
    outcome: null,
    minigameResults: [],
  };
};

const energyLabel = (e: number) => {
  if (e < 0.25) return "LOW";
  if (e < 0.6) return "MED";
  return "HIGH";
};

const jobLabel = (job: Job): string => {
  switch (job) {
    case "PowerEngineer":
      return "Power Engineer";
    case "CoolantTech":
      return "Coolant Tech";
    case "FluxSpecialist":
      return "Flux Specialist";
    default:
      return job;
  }
};

const jobAccentClasses = (job: Job): string => {
  switch (job) {
    case "PowerEngineer":
      return "border-red-400/60 bg-red-500/10 text-red-300";
    case "CoolantTech":
      return "border-sky-400/60 bg-sky-500/10 text-sky-300";
    case "FluxSpecialist":
      return "border-emerald-400/60 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-slate-500/60 bg-slate-500/10 text-slate-200";
  }
};

// --- UI atoms ---

const RoleBadge: React.FC<{ role: Role }> = ({ role }) => {
  const isCrew = role === "Crew";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shadow-sm ${
        isCrew
          ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-300"
          : "border-red-400/70 bg-red-500/10 text-red-300"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isCrew ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
      {role.toUpperCase()}
    </span>
  );
};

const JobBadge: React.FC<{ job: Job; compact?: boolean }> = ({ job, compact }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 ${
      compact ? "py-0.5 text-[9px]" : "py-0.5 text-[10px]"
    } rounded-full font-medium border ${jobAccentClasses(job)}`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {jobLabel(job)}
  </span>
);

const ShipBar: React.FC<{ health: number }> = ({ health }) => (
  <div className="text-[10px] text-slate-400 text-center">
    Ship
    <div className="w-28 h-2 rounded bg-slate-800 overflow-hidden mt-1 mx-auto">
      <div className="h-full bg-emerald-500" style={{ width: `${health * 100}%` }} />
    </div>
  </div>
);

type RoundHeaderProps = {
  gate: number;
  reactorLimit: number;
  shipHealth: number;
};

// UPDATED: Centered header with emojis; Ship HP bar directly UNDER the gate/limit line
const RoundHeader: React.FC<RoundHeaderProps> = ({ gate, reactorLimit, shipHealth }) => (
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

type InventoryTabButtonProps = {
  hasUsableItems: boolean;
  isOpen: boolean;
  onToggle: () => void;
};

// UPDATED: Keep inside the main container, positioned near the top-right with a small buffer
const InventoryTabButton: React.FC<InventoryTabButtonProps> = ({ hasUsableItems, isOpen, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`absolute right-2 top-5 rounded-l-2xl px-1.5 py-3 text-[10px] font-semibold flex flex-col items-center gap-1 shadow-lg border ${
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

// --- Minigame placeholders ---

interface MinigameProps {
  reactorEnergy: number;
  shipHealth: number;
  onComplete: (
    tier: MinigameTier,
    score01: number,
    deltaTotal: number,
    deltaShipHealth01?: number
  ) => void;
}

const MinigameCard: React.FC<{
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

const PowerEngineerMinigame: React.FC<MinigameProps> = ({ reactorEnergy, shipHealth, onComplete }) => (
  <MinigameCard
    title="Power Conduit"
    subtitle="Power Engineer • BOOST/OVERDRIVE"
    description={`Ride the meter in the green band. Load ${Math.round(reactorEnergy * 100)}%, Hull ${Math.round(shipHealth * 100)}%.`}
    onSuccess={() => onComplete("success", 1, +3, 0)}
    onPartial={() => onComplete("partial", 0.6, +1, 0)}
    onFail={() => onComplete("fail", 0.2, 0, 0)}
  />
);

const CoolantTechMinigame: React.FC<MinigameProps> = ({ reactorEnergy, shipHealth, onComplete }) => (
  <MinigameCard
    title="Coolant Lines"
    subtitle="Coolant Tech • VENT/SCRAM"
    description={`Tap leaks in twin tubes. Load ${Math.round(reactorEnergy * 100)}%, Hull ${Math.round(shipHealth * 100)}%.`}
    onSuccess={() => onComplete("success", 1, -3, +0.05)}
    onPartial={() => onComplete("partial", 0.6, -2, 0)}
    onFail={() => onComplete("fail", 0.2, -1, -0.02)}
  />
);

const FluxSpecialistMinigame: React.FC<MinigameProps> = ({ reactorEnergy, shipHealth, onComplete }) => (
  <MinigameCard
    title="Flux Spikes"
    subtitle="Flux • EQUALIZER/STABILIZER"
    description={`Trim swinging spikes. Load ${Math.round(reactorEnergy * 100)}%, Hull ${Math.round(shipHealth * 100)}%.`}
    onSuccess={() => onComplete("success", 1, -2, 0)}
    onPartial={() => onComplete("partial", 0.6, +1, 0)}
    onFail={() => onComplete("fail", 0.2, 0, -0.02)}
  />
);

// --- Inventory panel ---

type InventoryPanelProps = {
  localPlayer: Player;
  phase: Phase;
  onClose: () => void;
  onUseItem: (item: ItemInstance) => void;
};

const InventoryPanel: React.FC<InventoryPanelProps> = ({ localPlayer, phase, onClose, onUseItem }) => {
  const [focusedItem, setFocusedItem] = useState<ItemId | null>(null);
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
        <button onClick={onClose} className="h-6 w-6 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-xs text-slate-300">
          ✕
        </button>
      </div>
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {localPlayer.items.length === 0 && (
          <div className="text-[11px] text-slate-500">No station items.</div>
        )}
        {localPlayer.items.map((item) => {
          const isFocused = focusedItem === item.id;
          const isUsable = canUseItems && !item.used && item.timing === "Engage";
          return (
            <div key={item.id} className="flex flex-col gap-1">
              <button
                type="button"
                onMouseEnter={() => setFocusedItem(item.id)}
                onMouseLeave={() => setFocusedItem((prev) => (prev === item.id ? null : prev))}
                onClick={() => {
                  if (isUsable) {
                    onUseItem(item);
                  } else {
                    setFocusedItem((prev) => (prev === item.id ? null : item.id));
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
              <div className={`text-[10px] text-slate-400 transition-all ${isFocused ? "opacity-100 max-h-12" : "opacity-0 max-h-0 overflow-hidden"}`}>
                {itemDescription(item.id)}
                {!canUseItems && (
                  <span className="block mt-0.5 text-[9px] text-slate-500">Usable during ENGAGE.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Main component ---

const CoreCollapseGame: React.FC = () => {
  const [phase, setPhase] = useState<Phase>("Lobby");
  const [players, setPlayers] = useState<Player[]>(createDefaultPlayers);

  const [roundIndex, setRoundIndex] = useState(1);
  const [reactorLimit, setReactorLimit] = useState(6 * 3);
  const [shipHealth01, setShipHealth01] = useState(1);
  const [overloads, setOverloads] = useState(0);
  const [clears, setClears] = useState(0);

  const [round, setRound] = useState<RoundState>(() => createInitialRound(1, reactorLimit, players));

  const localPlayer = players.find((p) => p.id === LOCAL_PLAYER_ID) ?? players[0];
  const otherPlayers = players.filter((p) => p.id !== localPlayer.id);
  const isLocalSaboteur = localPlayer.role === "Saboteur";

  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  // Deck-of-9 → draw 5 hand per round
  const [hand, setHand] = useState<number[]>([]);
  const [slotCard, setSlotCard] = useState<number | null>(null);

  const dealHand = () => {
    const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    cards.sort(() => Math.random() - 0.5);
    setHand(cards.slice(0, 5));
    setSlotCard(null);
    setRound((prev) => ({ ...prev, cardsPlayed: { ...prev.cardsPlayed, [localPlayer.id]: null } }));
  };

  const [engageSeatIndex, setEngageSeatIndex] = useState(0);
  const [activeMinigame, setActiveMinigame] = useState<null | { player: Player; item: ItemInstance }>(null);
  const [pendingItemEffect, setPendingItemEffect] = useState<PendingItemEffect | null>(null);

  // --- Phase transitions ---

  const startGame = () => setPhase("RoleReveal");

  const proceedFromRoleReveal = () => {
    dealHand();
    setPhase("Plan");
  };

  const handleChooseCard = (value: number) => {
    if (phase !== "Plan") return;
    setHand((prev) => {
      const without = prev.filter((c) => c !== value);
      if (slotCard != null) without.push(slotCard);
      return without;
    });
    setSlotCard(value);
    setRound((prev) => ({ ...prev, cardsPlayed: { ...prev.cardsPlayed, [localPlayer.id]: value } }));
  };

  const proceedFromPlan = () => {
    if (phase !== "Plan") return;
    const localCard = round.cardsPlayed[localPlayer.id];
    if (localCard == null) return;

    const updatedCards: Record<string, number | null> = { ...round.cardsPlayed };
    players.forEach((p) => {
      if (updatedCards[p.id] == null) updatedCards[p.id] = randomCard();
    });

    const total = Object.values(updatedCards).reduce((sum, v) => sum + (v ?? 0), 0);
    const energy = clamp01(total / reactorLimit);

    setRound((prev) => ({
      ...prev,
      cardsPlayed: updatedCards,
      totalBeforeItems: total,
      totalAfterItems: total,
      reactorEnergy01: energy,
    }));

    setPhase("Ignition");
  };

  const proceedFromIgnition = () => {
    setEngageSeatIndex(0);
    setPhase("Engage");
  };

  const currentEngagePlayer = phase === "Engage" ? players.find((p) => p.seatIndex === engageSeatIndex) ?? null : null;

  const handleEngagePass = () => {
    if (phase !== "Engage") return;
    const next = engageSeatIndex + 1;
    if (next >= players.length) setPhase("Maintenance");
    else setEngageSeatIndex(next);
  };

  const handlePlayEngageItem = (player: Player, item: ItemInstance) => {
    if (phase !== "Engage" || item.used || player.id !== localPlayer.id) return;
    const effect = applyItem({
      round,
      itemId: item.id,
      context: { isBelowGate: round.totalAfterItems < round.gate },
    });
    setPendingItemEffect({
      playerId: player.id,
      itemId: item.id,
      deltaTotal: effect.deltaTotal,
      deltaShip: effect.deltaShip,
    });
    setActiveMinigame({ player, item });
    setPhase("MiniGame");
  };

  const handleUseItemFromInventory = (item: ItemInstance) => {
    handlePlayEngageItem(localPlayer, item);
  };

  const handleMinigameComplete = (result: MinigameResult) => {
    const effect =
      pendingItemEffect &&
      pendingItemEffect.playerId === result.playerId &&
      pendingItemEffect.itemId === result.itemId
        ? pendingItemEffect
        : { deltaTotal: result.deltaTotal, deltaShip: result.deltaShipHealth01 };
    setPendingItemEffect(null);
    const adjustedResult: MinigameResult = {
      ...result,
      deltaTotal: effect.deltaTotal,
      deltaShipHealth01: effect.deltaShip,
    };
    setRound((prev) => ({
      ...prev,
      totalAfterItems: prev.totalAfterItems + adjustedResult.deltaTotal,
      minigameResults: [...prev.minigameResults, adjustedResult],
    }));
    setShipHealth01((prev) => clamp01(prev + adjustedResult.deltaShipHealth01));
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === adjustedResult.playerId
          ? { ...p, items: p.items.map((it) => (it.id === adjustedResult.itemId ? { ...it, used: true } : it)) }
          : p
      )
    );
    setActiveMinigame(null);
    setTimeout(() => {
      setPhase("Engage");
      setEngageSeatIndex((idx) => {
        const next = idx + 1;
        if (next >= players.length) {
          setPhase("Maintenance");
          return idx;
        }
        return next;
      });
    }, 0);
  };

  const resolveMaintenance = () => {
    const total = round.totalAfterItems;
    let outcome: RoundOutcome;
    if (total >= reactorLimit) outcome = "Overload";
    else if (total >= round.gate) outcome = "Clear";
    else outcome = "Fail";

    let newShip = shipHealth01;
    let newOverloads = overloads;
    let newClears = clears;

    if (outcome === "Overload") {
      newShip = clamp01(newShip - 0.3);
      newOverloads += 1;
    } else if (outcome === "Fail") {
      newShip = clamp01(newShip - 0.1);
    } else {
      newClears += 1;
      if (round.minigameResults.every((r) => r.tier === "success")) {
        newShip = clamp01(newShip + 0.05);
      }
    }

    setShipHealth01(newShip);
    setOverloads(newOverloads);
    setClears(newClears);
    setRound((prev) => ({ ...prev, outcome }));

    if (newOverloads >= 2 || roundIndex >= 6) {
      setPhase("GameOver");
      return;
    }

    const nextRoundIndex = roundIndex + 1;
    setRoundIndex(nextRoundIndex);
    setRound(createInitialRound(nextRoundIndex, reactorLimit, players));
    dealHand();
    setPhase("Plan");
  };

  // --- Minigame router ---

  const renderMinigame = () => {
    if (!activeMinigame) return null;
    const { player, item } = activeMinigame;

    const onComplete = (
      tier: MinigameTier,
      score01: number,
      deltaTotal: number,
      deltaShipHealth01: number = 0
    ) => {
      const result: MinigameResult = {
        playerId: player.id,
        job: player.job,
        itemId: item.id,
        tier,
        score01,
        deltaTotal,
        deltaShipHealth01,
      };
      handleMinigameComplete(result);
    };

    const common = {
      reactorEnergy: round.reactorEnergy01,
      shipHealth: shipHealth01,
    };

    if (player.job === "PowerEngineer") return <PowerEngineerMinigame {...common} onComplete={onComplete} />;
    if (player.job === "CoolantTech") return <CoolantTechMinigame {...common} onComplete={onComplete} />;
    return <FluxSpecialistMinigame {...common} onComplete={onComplete} />;
  };

  // --- Phase UIs ---

  const renderLobby = () => (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-semibold">Core Collapse</h1>
      <div className="w-full max-w-sm rounded-2xl bg-slate-950/80 border border-slate-800 p-4 flex flex-col gap-3">
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Callsign
          <input
            type="text"
            value={localPlayer.name}
            onChange={(e) =>
              setPlayers((prev) =>
                prev.map((p) => (p.id === localPlayer.id ? { ...p, name: e.target.value || "You" } : p))
              )
            }
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
          />
        </label>
        <button onClick={startGame} className="w-full mt-2 px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
          Ready Up
        </button>
      </div>
    </div>
  );

  const renderRoleReveal = () => (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">Your Assignment</h2>
      <div className="w-full max-w-sm rounded-2xl bg-slate-950/90 border border-slate-700 p-4 flex flex-col gap-2">
        <div className="text-xs text-slate-400">Callsign</div>
        <div className="text-lg font-semibold">{localPlayer.name}</div>
        <div className="flex justify-between items-center mt-1">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-400">Role</div>
            <RoleBadge role={localPlayer.role} />
          </div>
          <div className="text-right flex flex-col gap-1 items-end">
            <div className="text-xs text-slate-400">Station</div>
            <JobBadge job={localPlayer.job} />
          </div>
        </div>
        <p className="text-[11px] text-slate-300 mt-2">
          Crew: clear 4+ hazards in 6 rounds without 2 overloads. Saboteur: force 2 overloads or keep clears &lt; 4.
        </p>
      </div>
      <button onClick={proceedFromRoleReveal} className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
        Continue to Round 1
      </button>
    </div>
  );

  const renderPlan = () => {
    const localCard = round.cardsPlayed[localPlayer.id];
    return (
      <div className="flex flex-col gap-4 w-full max-w-md">
        {/* Header: ONLY emojis text + Ship bar below (handled in RoundHeader) */}
        <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />

        {/* (Kept the brief helper line; previous long swap hint removed earlier) */}
        <p className="text-[11px] text-slate-300 text-center">Draw 5 from your 1–9 deck. Place 1 into the power slot.</p>

        <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3 flex flex-col gap-3">
          {/* Power slot centered */}
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

          {/* Hand centered */}
          <div className="flex flex-col items-center">
            <div className="text-[11px] text-slate-400 mb-1 text-center">Your hand</div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {hand.length === 0 && <span className="text-[11px] text-slate-500">Dealing…</span>}
              {hand.map((v) => (
                <button
                  key={v}
                  onClick={() => handleChooseCard(v)}
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
            onClick={proceedFromPlan}
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

  const renderIgnition = () => {
    const total = round.totalBeforeItems;
    const energy = round.reactorEnergy01;
    return (
      <div className="flex flex-col gap-4 w-full max-w-md">
        <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />
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
          <button onClick={proceedFromIgnition} className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
            Proceed to Items
          </button>
        </div>
      </div>
    );
  };

  const renderEngage = () => {
    const current = currentEngagePlayer;
    const total = round.totalAfterItems;
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
                onClick={() => setIsInventoryOpen(true)}
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
          <button onClick={handleEngagePass} className="px-4 py-2 rounded-lg bg-slate-800 text-sm font-semibold">
            {isLocalTurn ? "Pass" : "Advance"}
          </button>
        </div>
      </div>
    );
  };

  const renderMaintenance = () => {
    const total = round.totalAfterItems;
    const outcome = round.outcome;
    const bannerColor =
      outcome === "Overload"
        ? "bg-red-900/60 border-red-500"
        : outcome === "Clear"
        ? "bg-emerald-900/60 border-emerald-500"
        : "bg-amber-900/40 border-amber-500";

    return (
      <div className="flex flex-col gap-4 w-full max-w-md">
        <RoundHeader gate={round.gate} reactorLimit={reactorLimit} shipHealth={shipHealth01} />
        <div className={`rounded-2xl border p-3 ${bannerColor}`}>
          <div className="text-sm text-slate-100">Outcome: {outcome ?? "?"}</div>
          <div className="text-[11px] text-slate-200 mt-1">Final Total {total} (base {round.totalBeforeItems})</div>
          <ul className="mt-2 text-[11px] text-slate-200 space-y-1">
            {round.minigameResults.map((r, idx) => {
              const player = players.find((p) => p.id === r.playerId);
              return (
                <li key={idx}>
                  {player?.name} [{jobLabel(r.job)}] {r.itemId}: {r.tier.toUpperCase()} → {r.deltaTotal >= 0 ? "+" : ""}
                  {r.deltaTotal}
                  {r.deltaShipHealth01 !== 0 && (
                    <span>
                      {" "}/ Ship {r.deltaShipHealth01 >= 0 ? "+" : ""}
                      {Math.round(r.deltaShipHealth01 * 100)}%
                    </span>
                  )}
                </li>
              );
            })}
            {round.minigameResults.length === 0 && <li>No station items used.</li>}
          </ul>
        </div>
        <div className="flex justify-end">
          <button onClick={resolveMaintenance} className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold">
            {overloads >= 2 || roundIndex >= 6 ? "Resolve & End Game" : "Resolve & Next Round"}
          </button>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
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
          onClick={() => {
            const newPlayers = createDefaultPlayers();
            setPlayers(newPlayers);
            setReactorLimit(6 * newPlayers.length);
            setShipHealth01(1);
            setOverloads(0);
            setClears(0);
            setRoundIndex(1);
            setRound(createInitialRound(1, 6 * newPlayers.length, newPlayers));
            setHand([]);
            setSlotCard(null);
            setPhase("Lobby");
            setIsInventoryOpen(false);
          }}
          className="px-4 py-2 rounded-lg bg-slate-800 text-sm font-semibold border border-slate-600"
        >
          Back to Lobby
        </button>
      </div>
    );
  };

  const hasUsableItems = localPlayer.items.some((it) => !it.used && phase === "Engage" && it.timing === "Engage");

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-6 px-3">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">CORE COLLAPSE</div>
            <div className="text-xs text-slate-400">{players.length} crew · Overloads {overloads}</div>
          </div>
          <div className="text-[10px] text-slate-400 text-right">
            Phase
            <div
              className={`mt-0.5 px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                isLocalSaboteur ? "bg-red-950/80 border-red-500/70" : "bg-slate-900 border-slate-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isLocalSaboteur ? "bg-red-400" : "bg-emerald-400"}`} />
              <span className="text-[10px] font-medium text-slate-100">{phase}</span>
            </div>
          </div>
        </div>

        <div className="relative border border-slate-800 rounded-2xl bg-slate-900/80 p-4 shadow min-h-[420px] flex items-center justify-center">
          {phase === "Lobby" && renderLobby()}
          {phase === "RoleReveal" && renderRoleReveal()}
          {phase === "Plan" && renderPlan()}
          {phase === "Ignition" && renderIgnition()}
          {phase === "Engage" && renderEngage()}
          {phase === "MiniGame" && renderMinigame()}
          {phase === "Maintenance" && renderMaintenance()}
          {phase === "GameOver" && renderGameOver()}

          <InventoryTabButton hasUsableItems={hasUsableItems} isOpen={isInventoryOpen} onToggle={() => setIsInventoryOpen((open) => !open)} />

          {isInventoryOpen && (
            <InventoryPanel
              localPlayer={localPlayer}
              phase={phase}
              onClose={() => setIsInventoryOpen(false)}
              onUseItem={handleUseItemFromInventory}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CoreCollapseGame;
