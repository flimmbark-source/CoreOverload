import type { Phase } from "../types";

export type GamePhase = Phase;

export type GameEvent =
  | "START"
  | "PLAN_LOCK_IN"
  | "IGNITION_DONE"
  | "ENGAGE_NEXT"
  | "MINIGAME_START"
  | "MINIGAME_COMPLETE"
  | "MAINTENANCE_RESOLVE"
  | "RESTART";

const transitions: Record<GamePhase, Partial<Record<GameEvent, GamePhase>>> = {
  Lobby: { START: "RoleReveal" },
  RoleReveal: { START: "Plan" },
  Plan: { PLAN_LOCK_IN: "Ignition" },
  Ignition: { IGNITION_DONE: "Engage" },
  Engage: {
    MINIGAME_START: "MiniGame",
    ENGAGE_NEXT: "Maintenance",
  },
  MiniGame: { MINIGAME_COMPLETE: "Engage" },
  Maintenance: {
    MAINTENANCE_RESOLVE: "Plan",
    ENGAGE_NEXT: "GameOver",
  },
  GameOver: { RESTART: "Lobby" },
};

export const nextPhase = (current: Phase, event: string): Phase => {
  const next = transitions[current]?.[event as GameEvent];
  return next ?? current;
};
