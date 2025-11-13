export type Role = "Crew" | "Saboteur";

export type Job = "PowerEngineer" | "CoolantTech" | "FluxSpecialist";

export type Phase =
  | "Lobby"
  | "RoleReveal"
  | "Plan"
  | "Ignition"
  | "Engage"
  | "MiniGame"
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

export type MinigameTier = "fail" | "partial" | "success";

export type MinigameResult = {
  playerId: string;
  job: Job;
  itemId: ItemId;
  tier: MinigameTier;
  score01: number;
  deltaTotal: number;
  deltaShipHealth01: number;
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
