import type { ItemInstance, Job, Player, RoundState } from "./types";

export const LOCAL_PLAYER_ID = "p1";

const createJobItems = (job: Job): ItemInstance[] => {
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

export const createDefaultPlayers = (): Player[] => [
  {
    id: LOCAL_PLAYER_ID,
    name: "You",
    seatIndex: 0,
    role: "Crew",
    job: "PowerEngineer",
    items: createJobItems("PowerEngineer"),
  },
  {
    id: "p2",
    name: "Bravo",
    seatIndex: 1,
    role: "Crew",
    job: "CoolantTech",
    items: createJobItems("CoolantTech"),
  },
  {
    id: "p3",
    name: "Charlie",
    seatIndex: 2,
    role: "Saboteur",
    job: "FluxSpecialist",
    items: createJobItems("FluxSpecialist"),
  },
];

const GATE_OFFSETS = [-2, -1, 0, 1, 2];

export const createInitialRound = (
  index: number,
  players: Player[],
): RoundState => {
  const baseGate = players.length * 4;
  const offset = GATE_OFFSETS[(index - 1) % GATE_OFFSETS.length];
  const cardsPlayed: Record<string, number | null> = {};

  players.forEach((player) => {
    cardsPlayed[player.id] = null;
  });

  return {
    index,
    gate: baseGate + offset,
    cardsPlayed,
    totalBeforeItems: 0,
    totalAfterItems: 0,
    reactorEnergy01: 0,
    outcome: null,
    minigameResults: [],
  };
};
