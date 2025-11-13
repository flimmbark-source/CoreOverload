import React, { useEffect, useMemo, useState } from "react";
import type {
  ItemInstance,
  Job,
  MinigameResult,
  MinigameTier,
  Phase,
  Player,
  Role,
  RoundOutcome,
  RoundState,
} from "./src/game/types";
import { nextPhase } from "./src/game/state/machine";
import { createRng, shuffleArray, type Rng } from "./src/game/rng";
import { InventoryPanel } from "./src/ui/inventory/InventoryPanel";
import { InventoryTabButton } from "./src/ui/inventory/InventoryTabButton";
import {
  EngagePhase,
  GameOverPhase,
  IgnitionPhase,
  LobbyPhase,
  MaintenancePhase,
  PlanPhase,
  RoleRevealPhase,
  type PhaseUIDispatch,
  type PhaseUIHelpers,
  type PhaseUIState,
} from "./src/ui/phase";
import { getMinigameForJob } from "./src/minigames/registry";
import {
  defaultBalanceConfig,
  getCachedBalanceConfig,
  getItemEffect,
  loadBalanceConfig,
  type BalanceConfig,
} from "./src/game/config";

// Core Collapse — Mobile Game Flow (compact, deck-of-9 with 5-card hand)
// Single-device prototype of one player's phone, with inventory tab & item tooltips.

const LOCAL_PLAYER_ID = "p1";

// --- Helpers ---

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const randomCard = (deckSize: number, rng: Rng) => 1 + Math.floor(rng.next() * deckSize);

const computeGate = (index: number, players: Player[], balance: BalanceConfig) => {
  const base = balance.gateBasePerPlayer * players.length;
  const offsets = balance.gateOffsets.length > 0 ? balance.gateOffsets : defaultBalanceConfig.gateOffsets;
  const offset = offsets[(index - 1) % offsets.length];
  return base + offset;
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
  players: Player[],
  balance: BalanceConfig
): RoundState => {
  const gate = computeGate(index, players, balance);

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

// --- Main component ---

const CoreCollapseGame: React.FC = () => {
  const [balanceConfig, setBalanceConfig] = useState<BalanceConfig>(() => getCachedBalanceConfig());
  const [phase, setPhase] = useState<Phase>("Lobby");
  const [players, setPlayers] = useState<Player[]>(createDefaultPlayers);

  const [roundIndex, setRoundIndex] = useState(1);
  const [reactorLimit, setReactorLimit] = useState(6 * 3);
  const [shipHealth01, setShipHealth01] = useState(1);
  const [overloads, setOverloads] = useState(0);
  const [clears, setClears] = useState(0);

  const [round, setRound] = useState<RoundState>(() =>
    createInitialRound(1, 6 * 3, createDefaultPlayers(), getCachedBalanceConfig())
  );

  const localPlayer = players.find((p) => p.id === LOCAL_PLAYER_ID) ?? players[0];
  const isLocalSaboteur = localPlayer.role === "Saboteur";

  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  // Deck-of-9 → draw 5 hand per round
  const [hand, setHand] = useState<number[]>([]);
  const [slotCard, setSlotCard] = useState<number | null>(null);
  const rng = useMemo(() => createRng(roundIndex + players.length), [roundIndex, players.length]);

  const dealHand = () => {
    const cards = shuffleArray(
      Array.from({ length: balanceConfig.deckSize }, (_, i) => i + 1),
      rng
    );
    const nextHandSize = Math.min(balanceConfig.handSize, cards.length);
    setHand(cards.slice(0, nextHandSize));
    setSlotCard(null);
    setRound((prev) => ({ ...prev, cardsPlayed: { ...prev.cardsPlayed, [localPlayer.id]: null } }));
  };

  const [engageSeatIndex, setEngageSeatIndex] = useState(0);
  const [activeMinigame, setActiveMinigame] = useState<null | { player: Player; item: ItemInstance }>(null);

  const transitionPhase = (event: string) => {
    setPhase((prev) => nextPhase(prev, event));
  };

  useEffect(() => {
    loadBalanceConfig().then(setBalanceConfig).catch(() => {});
  }, []);

  useEffect(() => {
    setRound((prev) => ({
      ...prev,
      gate: computeGate(prev.index, players, balanceConfig),
    }));
    // TODO: Rebuild hands/limit if future configs alter deck math mid-run.
  }, [balanceConfig, players]);

  // --- Phase transitions ---

  const startGame = () => transitionPhase("START");

  const proceedFromRoleReveal = () => {
    dealHand();
    transitionPhase("START");
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
      if (updatedCards[p.id] == null) {
        updatedCards[p.id] = randomCard(balanceConfig.deckSize, rng);
      }
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

    transitionPhase("PLAN_LOCK_IN");
  };

  const proceedFromIgnition = () => {
    setEngageSeatIndex(0);
    transitionPhase("IGNITION_DONE");
  };

  const handleEngagePass = () => {
    if (phase !== "Engage") return;
    const next = engageSeatIndex + 1;
    if (next >= players.length) transitionPhase("ENGAGE_NEXT");
    else setEngageSeatIndex(next);
  };

  const handlePlayEngageItem = (player: Player, item: ItemInstance) => {
    if (phase !== "Engage" || item.used || player.id !== localPlayer.id) return;
    setActiveMinigame({ player, item });
    transitionPhase("MINIGAME_START");
  };

  const handleUseItemFromInventory = (item: ItemInstance) => {
    handlePlayEngageItem(localPlayer, item);
  };

  const finalizeMinigame = (result: MinigameResult) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === result.playerId
          ? { ...p, items: p.items.map((it) => (it.id === result.itemId ? { ...it, used: true } : it)) }
          : p
      )
    );
    setActiveMinigame(null);
    setTimeout(() => {
      transitionPhase("MINIGAME_COMPLETE");
      setEngageSeatIndex((idx) => {
        const next = idx + 1;
        if (next >= players.length) {
          transitionPhase("ENGAGE_NEXT");
          return idx;
        }
        return next;
      });
    }, 0);
  };

  const handleMinigameComplete = (tier: MinigameTier, score01: number) => {
    if (!activeMinigame) return;
    const { player, item } = activeMinigame;
    const { deltaTotal, deltaShipHealth01 } = getItemEffect({
      itemId: item.id,
      tier,
      isBelowGate: round.totalAfterItems < round.gate,
      balance: balanceConfig,
    });

    const result: MinigameResult = {
      playerId: player.id,
      job: player.job,
      itemId: item.id,
      tier,
      score01,
      deltaTotal,
      deltaShipHealth01,
    };

    setRound((prev) => ({
      ...prev,
      totalAfterItems: prev.totalAfterItems + result.deltaTotal,
      minigameResults: [...prev.minigameResults, result],
    }));
    setShipHealth01((prev) => clamp01(prev + result.deltaShipHealth01));
    finalizeMinigame(result);
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
      newShip = clamp01(newShip - balanceConfig.overloadLoss);
      newOverloads += 1;
    } else if (outcome === "Fail") {
      newShip = clamp01(newShip - balanceConfig.failLoss);
    } else {
      newClears += 1;
      if (round.minigameResults.every((r) => r.tier === "success")) {
        newShip = clamp01(newShip + balanceConfig.allSuccessGain);
      }
    }

    setShipHealth01(newShip);
    setOverloads(newOverloads);
    setClears(newClears);
    setRound((prev) => ({ ...prev, outcome }));

    if (newOverloads >= 2 || roundIndex >= balanceConfig.roundsMax) {
      transitionPhase("ENGAGE_NEXT");
      return;
    }

    const nextRoundIndex = roundIndex + 1;
    setRoundIndex(nextRoundIndex);
    setRound(createInitialRound(nextRoundIndex, reactorLimit, players, balanceConfig));
    dealHand();
    transitionPhase("MAINTENANCE_RESOLVE");
  };

  const restartGame = () => {
    const newPlayers = createDefaultPlayers();
    setPlayers(newPlayers);
    const limit = 6 * newPlayers.length;
    setReactorLimit(limit);
    setShipHealth01(1);
    setOverloads(0);
    setClears(0);
    setRoundIndex(1);
    setRound(createInitialRound(1, limit, newPlayers, balanceConfig));
    setHand([]);
    setSlotCard(null);
    transitionPhase("RESTART");
    setIsInventoryOpen(false);
  };

  const dispatchPhaseEvent: PhaseUIDispatch = (event, payload) => {
    switch (event) {
      case "lobby.ready":
        startGame();
        break;
      case "lobby.rename": {
        const nextName = typeof payload === "string" && payload.trim().length > 0 ? payload : "You";
        setPlayers((prev) =>
          prev.map((p) => (p.id === localPlayer.id ? { ...p, name: nextName } : p))
        );
        break;
      }
      case "roleReveal.continue":
        proceedFromRoleReveal();
        break;
      case "plan.chooseCard":
        if (typeof payload === "number") handleChooseCard(payload);
        break;
      case "plan.lock":
        proceedFromPlan();
        break;
      case "ignition.proceed":
        proceedFromIgnition();
        break;
      case "engage.pass":
        handleEngagePass();
        break;
      case "maintenance.resolve":
        resolveMaintenance();
        break;
      case "gameOver.restart":
        restartGame();
        break;
      default:
        break;
    }
  };

  // --- Minigame router ---

  const renderMinigame = () => {
    if (!activeMinigame) return null;
    const { player, item } = activeMinigame;

    const onComplete = (tier: MinigameTier, score01: number) => {
      handleMinigameComplete(tier, score01);
    };

    const common = {
      reactorEnergy: round.reactorEnergy01,
      shipHealth: shipHealth01,
    };

    const MinigameComponent = getMinigameForJob(player.job);
    return <MinigameComponent {...common} onComplete={onComplete} />;
  };

  const phaseState: PhaseUIState = {
    round,
    roundIndex,
    reactorLimit,
    shipHealth01,
    overloads,
    clears,
    hand,
    slotCard,
    engageSeatIndex,
  };

  const phaseHelpers: PhaseUIHelpers = {
    JobBadge,
    RoleBadge,
    RoundHeader,
    jobLabel,
    energyLabel,
    openInventory: () => setIsInventoryOpen(true),
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
          {phase === "Lobby" && (
            <LobbyPhase
              state={phaseState}
              dispatchEvent={dispatchPhaseEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={phaseHelpers}
            />
          )}
          {phase === "RoleReveal" && (
            <RoleRevealPhase
              state={phaseState}
              dispatchEvent={dispatchPhaseEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={phaseHelpers}
            />
          )}
          {phase === "Plan" && (
            <PlanPhase
              state={phaseState}
              dispatchEvent={dispatchPhaseEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={phaseHelpers}
            />
          )}
          {phase === "Ignition" && (
            <IgnitionPhase
              state={phaseState}
              dispatchEvent={dispatchPhaseEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={phaseHelpers}
            />
          )}
          {phase === "Engage" && (
            <EngagePhase
              state={phaseState}
              dispatchEvent={dispatchPhaseEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={phaseHelpers}
            />
          )}
          {phase === "MiniGame" && renderMinigame()}
          {phase === "Maintenance" && (
            <MaintenancePhase
              state={phaseState}
              dispatchEvent={dispatchPhaseEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={phaseHelpers}
            />
          )}
          {phase === "GameOver" && (
            <GameOverPhase
              state={phaseState}
              dispatchEvent={dispatchPhaseEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={phaseHelpers}
            />
          )}

          <InventoryTabButton hasUsableItems={hasUsableItems} isOpen={isInventoryOpen} onToggle={() => setIsInventoryOpen((open) => !open)} />

          {isInventoryOpen && (
            <InventoryPanel
              localPlayer={localPlayer}
              phase={phase}
              jobLabel={jobLabel}
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
