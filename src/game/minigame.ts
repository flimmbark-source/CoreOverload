import type { MinigameResult, MinigameTier } from "./types";

export type { MinigameTier } from "./types";

export function getMinigameTier(percentFinished: number): MinigameTier {
  if (percentFinished >= 80) return "SUCCESS";
  if (percentFinished >= 40) return "PARTIAL";
  return "FAIL";
}

export type ResolvedMinigame = Pick<
  MinigameResult,
  "tier" | "percentFinished" | "deltaTotal" | "deltaShipHP"
>;

export function resolveMinigame(percentFinished: number): ResolvedMinigame {
  const tier = getMinigameTier(percentFinished);
  let deltaTotal = 0;
  let deltaShipHP = 0;

  switch (tier) {
    case "SUCCESS":
      deltaTotal = 3;
      deltaShipHP = 0;
      break;
    case "PARTIAL":
      deltaTotal = 0;
      deltaShipHP = 0;
      break;
    case "FAIL":
    default:
      deltaTotal = -2;
      deltaShipHP = -1;
      break;
  }

  return { tier, percentFinished, deltaTotal, deltaShipHP };
}
