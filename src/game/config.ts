import type { ItemId, MinigameTier } from "./types";

export type BalanceConfig = {
  roundsMax: number;
  overloadLoss: number;
  failLoss: number;
  allSuccessGain: number;
  deckSize: number;
  handSize: number;
  gateBasePerPlayer: number;
  gateOffsets: number[];
  items: {
    BOOST: { deltaTotal: number; deltaShip: number };
    VENT: { deltaTotal: number; deltaShip: number };
    EQUALIZER: { belowGate: number; otherwise: number; deltaShip: number };
  };
};

export const defaultBalanceConfig: BalanceConfig = {
  roundsMax: 6,
  overloadLoss: 0.3,
  failLoss: 0.1,
  allSuccessGain: 0.05,
  deckSize: 9,
  handSize: 5,
  gateBasePerPlayer: 4,
  gateOffsets: [-2, -1, 0, 1, 2],
  items: {
    BOOST: { deltaTotal: 3, deltaShip: 0 },
    VENT: { deltaTotal: -3, deltaShip: 0.05 },
    EQUALIZER: { belowGate: 2, otherwise: -2, deltaShip: 0 },
  },
};

let cachedConfig: BalanceConfig = defaultBalanceConfig;

const mergeBalanceConfig = (incoming: Partial<BalanceConfig>): BalanceConfig => {
  if (!incoming || typeof incoming !== "object") return defaultBalanceConfig;
  return {
    ...defaultBalanceConfig,
    ...incoming,
    gateOffsets: Array.isArray(incoming.gateOffsets)
      ? incoming.gateOffsets.filter((n) => typeof n === "number" && Number.isFinite(n))
      : defaultBalanceConfig.gateOffsets,
    items: {
      BOOST: { ...defaultBalanceConfig.items.BOOST, ...(incoming.items?.BOOST ?? {}) },
      VENT: { ...defaultBalanceConfig.items.VENT, ...(incoming.items?.VENT ?? {}) },
      EQUALIZER: { ...defaultBalanceConfig.items.EQUALIZER, ...(incoming.items?.EQUALIZER ?? {}) },
    },
  };
};

export const getCachedBalanceConfig = (): BalanceConfig => cachedConfig;

export const loadBalanceConfig = async (): Promise<BalanceConfig> => {
  try {
    const response = await fetch("/config/balance.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Failed to load balance config");
    const raw = (await response.json()) as Partial<BalanceConfig>;
    cachedConfig = mergeBalanceConfig(raw);
    return cachedConfig;
  } catch (error) {
    console.warn("Balance config load failed, using defaults", error);
    cachedConfig = defaultBalanceConfig;
    return cachedConfig;
  }
};

const ITEM_TIER_MULTIPLIERS: Record<ItemId, Record<MinigameTier, number>> = {
  BOOST: { SUCCESS: 1, PARTIAL: 1 / 3, FAIL: 0 },
  VENT: { SUCCESS: 1, PARTIAL: 2 / 3, FAIL: 1 / 3 },
  EQUALIZER: { SUCCESS: 1, PARTIAL: 0.5, FAIL: 0 },
};

const ITEM_SHIP_MULTIPLIERS: Record<ItemId, Record<MinigameTier, number>> = {
  BOOST: { SUCCESS: 0, PARTIAL: 0, FAIL: 0 },
  VENT: { SUCCESS: 1, PARTIAL: 0, FAIL: -0.4 },
  EQUALIZER: { SUCCESS: 0, PARTIAL: 0, FAIL: 0 },
};

const roundHundred = (value: number) => Math.round(value * 100) / 100;

export const getItemEffect = ({
  itemId,
  tier,
  isBelowGate,
  balance,
}: {
  itemId: ItemId;
  tier: MinigameTier;
  isBelowGate: boolean;
  balance: BalanceConfig;
}): { deltaTotal: number; deltaShipHealth01: number } => {
  const multipliers = ITEM_TIER_MULTIPLIERS[itemId];
  const shipMultipliers = ITEM_SHIP_MULTIPLIERS[itemId];
  const tierMultiplier = multipliers?.[tier] ?? 0;
  const shipMultiplier = shipMultipliers?.[tier] ?? 0;

  switch (itemId) {
    case "BOOST": {
      const base = balance.items.BOOST.deltaTotal;
      return {
        deltaTotal: roundHundred(base * tierMultiplier),
        deltaShipHealth01: roundHundred(balance.items.BOOST.deltaShip * shipMultiplier),
      };
    }
    case "VENT": {
      const base = balance.items.VENT.deltaTotal;
      return {
        deltaTotal: roundHundred(base * tierMultiplier),
        deltaShipHealth01: roundHundred(balance.items.VENT.deltaShip * shipMultiplier),
      };
    }
    case "EQUALIZER": {
      const base = isBelowGate
        ? balance.items.EQUALIZER.belowGate
        : balance.items.EQUALIZER.otherwise;
      return {
        deltaTotal: roundHundred(base * tierMultiplier),
        deltaShipHealth01: roundHundred(balance.items.EQUALIZER.deltaShip * shipMultiplier),
      };
    }
    default:
      return { deltaTotal: 0, deltaShipHealth01: 0 };
  }
};
