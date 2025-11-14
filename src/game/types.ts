export type Role = "Crew" | "Saboteur";

export type Job = "PowerEngineer" | "CoolantTech" | "FluxSpecialist";

export const JOBS: Job[] = ["PowerEngineer", "CoolantTech", "FluxSpecialist"];

export type Phase =
  | "Lobby"
  | "RoleReveal"
  | "Plan"
  | "Ignition"
  | "Engage"
  | "Maintenance"
  | "GameOver";

export type ItemTiming = "Plan" | "Engage";

export type ItemId = "BOOST" | "VENT" | "EQUALIZER";

export type ItemInstance = {
  id: ItemId;
  name: string;
  timing: ItemTiming;
  job: Job;
  used: boolean;
};

export type Player = {
  id: string;
  name: string;
  seatIndex: number;
  role: Role;
  job: Job;
  items: ItemInstance[];
};

export type MinigameTier = "FAIL" | "PARTIAL" | "SUCCESS";

export type MinigameResult = {
  playerId: string;
  job: Job;
  itemId: ItemId;
  tier: MinigameTier;
  percentFinished: number;
  deltaTotal: number;
  deltaShipHP: number;
};

export type RoundOutcome = "Clear" | "Fail" | "Overload" | null;

export type RoundState = {
  index: number;
  gate: number;
  cardsPlayed: Record<string, number | null>;
  totalBeforeItems: number;
  totalAfterItems: number;
  reactorEnergy01: number;
  outcome: RoundOutcome;
  minigameResults: MinigameResult[];
};
