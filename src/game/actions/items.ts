import type { ItemId, RoundState } from "../types";
import { getCachedBalanceConfig } from "../config";

export type ApplyItemContext = {
  isBelowGate?: boolean;
};

export type ApplyItemOptions = {
  round: Pick<RoundState, "totalAfterItems" | "gate">;
  itemId: ItemId;
  context?: ApplyItemContext;
};

export type ApplyItemResult = {
  deltaTotal: number;
  deltaShip: number;
};

export const applyItem = ({ round, itemId, context }: ApplyItemOptions): ApplyItemResult => {
  const balance = getCachedBalanceConfig();
  const isBelowGate = context?.isBelowGate ?? round.totalAfterItems < round.gate;

  switch (itemId) {
    case "BOOST":
      return {
        deltaTotal: balance.items.BOOST.deltaTotal,
        deltaShip: balance.items.BOOST.deltaShip,
      };
    case "VENT":
      return {
        deltaTotal: balance.items.VENT.deltaTotal,
        deltaShip: balance.items.VENT.deltaShip,
      };
    case "EQUALIZER":
      return {
        deltaTotal: isBelowGate ? balance.items.EQUALIZER.belowGate : balance.items.EQUALIZER.otherwise,
        deltaShip: balance.items.EQUALIZER.deltaShip,
      };
    default:
      return { deltaTotal: 0, deltaShip: 0 };
  }
};
