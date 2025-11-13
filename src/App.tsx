import React from "react";
import { applyItem } from "./game/actions/items";
import type {
  ItemInstance,
  Job,
  MinigameResult,
  MinigameTier,
  Phase,
  Player,
  RoundOutcome,
  RoundState,
} from "./game/types";
import { JOBS } from "./game/types";
import { createInitialRound, createDefaultPlayers, createJobItems, LOCAL_PLAYER_ID } from "./game/setup";
import { createRng, shuffleArray } from "./game/rng";
import { InventoryPanel } from "./ui/inventory/InventoryPanel";
import { InventoryTabButton } from "./ui/inventory/InventoryTabButton";
import {
  LobbyPhase,
  RoleRevealPhase,
  PlanPhase,
  IgnitionPhase,
  EngagePhase,
  MaintenancePhase,
  GameOverPhase,
  type PhaseComponentProps,
  type PhaseUIDispatch,
  type PhaseUIHelpers,
  type PhaseUIState,
} from "./ui/phase";
import { JobBadge, RoleBadge } from "./ui/atoms/Badges";
import { RoundHeader } from "./ui/atoms/RoundHeader";
import { energyLabel, jobLabel } from "./ui/helpers";
import { getMinigameForJob } from "./minigames/registry";

type PendingItemEffect = {
  playerId: string;
  itemId: ItemInstance["id"];
  deltaTotal: number;
  deltaShip: number;
};

type ActiveMinigame =
  | {
      mode: "job";
      player: Player;
      item: ItemInstance;
    }
  | {
      mode: "item";
      player: Player;
      item: ItemInstance;
    };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const isJob = (value: unknown): value is Job =>
  typeof value === "string" && (JOBS as readonly string[]).includes(value);

const phaseComponentMap: Partial<Record<Phase, React.FC<PhaseComponentProps>>> = {
  Lobby: LobbyPhase,
  RoleReveal: RoleRevealPhase,
  Plan: PlanPhase,
  Ignition: IgnitionPhase,
  Engage: EngagePhase,
  Maintenance: MaintenancePhase,
  GameOver: GameOverPhase,
};

const App: React.FC = () => {
  const [players, setPlayers] = React.useState<Player[]>(() => createDefaultPlayers());
  const [reactorLimit, setReactorLimit] = React.useState(() => players.length * 6);
  const [phase, setPhase] = React.useState<Phase>("Lobby");
  const [roundIndex, setRoundIndex] = React.useState(1);
  const [round, setRound] = React.useState<RoundState>(() => createInitialRound(1, players));
  const [shipHealth01, setShipHealth01] = React.useState(1);
  const [overloads, setOverloads] = React.useState(0);
  const [clears, setClears] = React.useState(0);
  const [hand, setHand] = React.useState<number[]>([]);
  const [slotCard, setSlotCard] = React.useState<number | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = React.useState(false);
  const [activeMinigame, setActiveMinigame] = React.useState<ActiveMinigame | null>(null);
  const [pendingItemEffect, setPendingItemEffect] = React.useState<PendingItemEffect | null>(null);

  const rngRef = React.useRef(createRng(Date.now()));
  const jobMinigameRoundRef = React.useRef<number | null>(null);
  const engageItemResetRoundRef = React.useRef<number | null>(null);

  const localPlayer = players.find((player) => player.id === LOCAL_PLAYER_ID) ?? players[0];
  const isLocalSaboteur = localPlayer?.role === "Saboteur";

  const dealHand = React.useCallback(() => {
    const shuffled = shuffleArray(CARD_VALUES, rngRef.current);
    setHand(shuffled.slice(0, 5));
    setSlotCard(null);
    setRound((prev) => ({
      ...prev,
      cardsPlayed: { ...prev.cardsPlayed, [LOCAL_PLAYER_ID]: null },
    }));
  }, []);

  const randomCard = React.useCallback(() => 1 + Math.floor(rngRef.current.next() * 9), []);

  const startGame = React.useCallback(() => {
    setPhase("RoleReveal");
  }, []);

  const proceedFromRoleReveal = React.useCallback(() => {
    dealHand();
    setPhase("Plan");
  }, [dealHand]);

  const handleChooseCard = React.useCallback(
    (value: number) => {
      if (phase !== "Plan" || !localPlayer) return;
      setHand((prev) => {
        const next = [...prev];
        const index = next.indexOf(value);
        if (index === -1) return prev;
        next.splice(index, 1);
        if (slotCard != null) {
          next.push(slotCard);
        }
        return next;
      });
      setSlotCard(value);
      setRound((prev) => ({
        ...prev,
        cardsPlayed: { ...prev.cardsPlayed, [localPlayer.id]: value },
      }));
    },
    [localPlayer, phase, slotCard],
  );

  const proceedFromPlan = React.useCallback(() => {
    if (phase !== "Plan" || !localPlayer) return;
    if (round.cardsPlayed[localPlayer.id] == null) return;

    setRound((prev) => {
      const updatedCards: Record<string, number | null> = { ...prev.cardsPlayed };
      players.forEach((player) => {
        if (updatedCards[player.id] == null) {
          updatedCards[player.id] = randomCard();
        }
      });
      const total = Object.values(updatedCards).reduce<number>(
        (sum, value) => sum + (value ?? 0),
        0,
      );
      const energy = clamp01(total / reactorLimit);
      return {
        ...prev,
        cardsPlayed: updatedCards,
        totalBeforeItems: total,
        totalAfterItems: total,
        reactorEnergy01: energy,
      };
    });
    setPhase("Ignition");
  }, [localPlayer, phase, players, randomCard, reactorLimit, round.cardsPlayed]);

  const proceedFromIgnition = React.useCallback(() => {
    setIsInventoryOpen(false);
    setPhase("Engage");
  }, []);

  const startMinigame = React.useCallback(
    (player: Player, item: ItemInstance, mode: ActiveMinigame["mode"]) => {
      const effect = applyItem({
        round: { totalAfterItems: round.totalAfterItems, gate: round.gate },
        itemId: item.id,
        context: { isBelowGate: round.totalAfterItems < round.gate },
      });
      setPendingItemEffect({
        playerId: player.id,
        itemId: item.id,
        deltaTotal: effect.deltaTotal,
        deltaShip: effect.deltaShip,
      });
      setActiveMinigame({ mode, player, item });
    },
    [round.gate, round.totalAfterItems],
  );

  const handlePlayEngageItem = React.useCallback(
    (player: Player, item: ItemInstance) => {
      if (
        phase !== "Engage" ||
        item.used ||
        player.id !== localPlayer?.id ||
        activeMinigame
      ) {
        return;
      }
      startMinigame(player, item, "item");
    },
    [activeMinigame, localPlayer?.id, phase, startMinigame],
  );

  const handleUseItemFromInventory = React.useCallback(
    (item: ItemInstance) => {
      if (!localPlayer) return;
      handlePlayEngageItem(localPlayer, item);
    },
    [handlePlayEngageItem, localPlayer],
  );

  React.useEffect(() => {
    if (phase !== "Engage") return;
    if (engageItemResetRoundRef.current === round.index) return;
    engageItemResetRoundRef.current = round.index;
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        items: player.items.map((item) =>
          item.timing === "Engage" ? { ...item, used: false } : item,
        ),
      })),
    );
  }, [phase, round.index]);

  React.useEffect(() => {
    if (phase !== "Engage") {
      jobMinigameRoundRef.current = null;
      return;
    }
    if (!localPlayer || activeMinigame) return;
    if (jobMinigameRoundRef.current === round.index) return;
    const nextJobItem = localPlayer.items.find((item) => item.timing === "Engage" && !item.used);
    if (!nextJobItem) return;
    jobMinigameRoundRef.current = round.index;
    startMinigame(localPlayer, nextJobItem, "job");
  }, [activeMinigame, localPlayer, phase, round.index, startMinigame]);

  const handleMinigameComplete = React.useCallback(
    (result: MinigameResult) => {
      const fallbackDelta = result.deltaTotal ?? 0;
      const fallbackShip = result.deltaShipHealth01 ?? 0;
      const effect =
        pendingItemEffect &&
        pendingItemEffect.playerId === result.playerId &&
        pendingItemEffect.itemId === result.itemId
          ? pendingItemEffect
          : { deltaTotal: fallbackDelta, deltaShip: fallbackShip };

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
        prev.map((player) =>
          player.id === adjustedResult.playerId
            ? {
                ...player,
                items: player.items.map((it) =>
                  it.id === adjustedResult.itemId ? { ...it, used: true } : it,
                ),
              }
            : player,
        ),
      );
      const currentMode = activeMinigame?.mode ?? "item";
      setActiveMinigame(null);
      if (currentMode === "job") {
        setPhase("Maintenance");
      }
    },
    [activeMinigame?.mode, pendingItemEffect],
  );

  const resolveMaintenance = React.useCallback(() => {
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
    setRound(createInitialRound(nextRoundIndex, players));
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        items: player.items.map((item) =>
          item.timing === "Engage" ? { ...item, used: false } : item,
        ),
      })),
    );
    dealHand();
    setPhase("Plan");
  }, [clears, dealHand, overloads, players, reactorLimit, round, roundIndex, shipHealth01]);

  const restartGame = React.useCallback(() => {
    const basePlayers = createDefaultPlayers();
    setPlayers(basePlayers);
    const limit = basePlayers.length * 6;
    setReactorLimit(limit);
    setShipHealth01(1);
    setOverloads(0);
    setClears(0);
    setRoundIndex(1);
    setRound(createInitialRound(1, basePlayers));
    setHand([]);
    setSlotCard(null);
    setPhase("Lobby");
    setIsInventoryOpen(false);
    setActiveMinigame(null);
    setPendingItemEffect(null);
  }, []);

  const dispatchEvent = React.useCallback<PhaseUIDispatch>(
    (event, payload) => {
      switch (event) {
        case "lobby.rename": {
          if (typeof payload === "string" && localPlayer) {
            const nextName = payload.trim() || "You";
            setPlayers((prev) =>
              prev.map((player) =>
                player.id === localPlayer.id ? { ...player, name: nextName } : player,
              ),
            );
          }
          break;
        }
        case "lobby.selectJob": {
          if (isJob(payload) && localPlayer) {
            setPlayers((prev) =>
              prev.map((player) =>
                player.id === localPlayer.id
                  ? { ...player, job: payload, items: createJobItems(payload) }
                  : player,
              ),
            );
          }
          break;
        }
        case "lobby.ready":
          startGame();
          break;
        case "roleReveal.continue":
          proceedFromRoleReveal();
          break;
        case "plan.chooseCard":
          if (typeof payload === "number") {
            handleChooseCard(payload);
          }
          break;
        case "plan.lock":
          proceedFromPlan();
          break;
        case "ignition.proceed":
          proceedFromIgnition();
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
    },
    [
      handleChooseCard,
      localPlayer,
      proceedFromIgnition,
      proceedFromPlan,
      proceedFromRoleReveal,
      resolveMaintenance,
      restartGame,
      startGame,
    ],
  );

  const phaseState: PhaseUIState = {
    round,
    roundIndex,
    reactorLimit,
    shipHealth01,
    overloads,
    clears,
    hand,
    slotCard,
  };

  const helpers: PhaseUIHelpers = {
    JobBadge,
    RoleBadge,
    RoundHeader,
    jobLabel,
    energyLabel,
    openInventory: () => setIsInventoryOpen(true),
  };

  const CurrentPhaseComponent = phaseComponentMap[phase];
  const hasUsableItems = localPlayer?.items.some(
    (item) => !item.used && phase === "Engage" && item.timing === "Engage",
  );

  const renderMinigame = () => {
    if (!activeMinigame) return null;
    const MinigameComponent = getMinigameForJob(activeMinigame.player.job);
    const modeLabel = activeMinigame.mode === "job" ? "Station Operation" : "Item Calibration";
    const minigameKey = `${activeMinigame.player.id}-${activeMinigame.item.id}-${round.index}-${activeMinigame.mode}`;
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 z-30 rounded-2xl p-4">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl">
          <div className="flex justify-between items-center text-xs text-slate-300 mb-2">
            <span>
              {activeMinigame.player.name} · {jobLabel(activeMinigame.player.job)} · {activeMinigame.item.name}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-emerald-300">{modeLabel}</span>
          </div>
          <MinigameComponent
            key={minigameKey}
            reactorEnergy={round.reactorEnergy01}
            shipHealth={shipHealth01}
            onComplete={(tier: MinigameTier, score01: number, deltaTotal = 0, deltaShipHealth01 = 0) =>
              handleMinigameComplete({
                playerId: activeMinigame.player.id,
                job: activeMinigame.player.job,
                itemId: activeMinigame.item.id,
                tier,
                score01,
                deltaTotal,
                deltaShipHealth01,
              })
            }
          />
        </div>
      </div>
    );
  };

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
          {CurrentPhaseComponent && localPlayer ? (
            <CurrentPhaseComponent
              state={phaseState}
              dispatchEvent={dispatchEvent}
              localPlayer={localPlayer}
              players={players}
              helpers={helpers}
            />
          ) : null}

          <InventoryTabButton
            hasUsableItems={Boolean(hasUsableItems)}
            isOpen={isInventoryOpen}
            onToggle={() => setIsInventoryOpen((open) => !open)}
          />

          {isInventoryOpen && localPlayer && (
            <InventoryPanel
              localPlayer={localPlayer}
              phase={phase}
              onClose={() => setIsInventoryOpen(false)}
              onUseItem={handleUseItemFromInventory}
              jobLabel={jobLabel}
            />
          )}

          {activeMinigame && renderMinigame()}
        </div>
      </div>
    </div>
  );
};

export default App;
