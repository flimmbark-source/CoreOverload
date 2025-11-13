import type React from "react";
import type { Job, Player, Role, RoundState } from "../../game/types";

export type PhaseUIState = {
  round: RoundState;
  roundIndex: number;
  reactorLimit: number;
  shipHealth01: number;
  overloads: number;
  clears: number;
  hand: number[];
  slotCard: number | null;
  engageSeatIndex: number;
};

export type PhaseUIDispatch = (event: string, payload?: unknown) => void;

export type PhaseUIHelpers = {
  JobBadge: React.ComponentType<{ job: Job; compact?: boolean }>;
  RoleBadge: React.ComponentType<{ role: Role }>;
  RoundHeader: React.ComponentType<{
    gate: number;
    reactorLimit: number;
    shipHealth: number;
  }>;
  jobLabel: (job: Job) => string;
  energyLabel: (value: number) => string;
  openInventory?: () => void;
};

export type PhaseComponentProps = {
  state: PhaseUIState;
  dispatchEvent: PhaseUIDispatch;
  localPlayer: Player;
  players: Player[];
  helpers: PhaseUIHelpers;
};
