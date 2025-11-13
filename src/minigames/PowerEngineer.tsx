import React from "react";
import { MinigameCard, type MinigameProps } from "./common";

export const PowerEngineerMinigame: React.FC<MinigameProps> = ({
  reactorEnergy,
  shipHealth,
  onComplete,
}) => (
  <MinigameCard
    title="Power Conduit"
    subtitle="Power Engineer • BOOST/OVERDRIVE"
    description={`Ride the meter in the green band. Load ${Math.round(reactorEnergy * 100)}%, Hull ${Math.round(
      shipHealth * 100
    )}%.`}
    onSuccess={() => onComplete("success", 1, 0, 0)}
    onPartial={() => onComplete("partial", 0.6, 0, 0)}
    onFail={() => onComplete("fail", 0.2, 0, 0)}
  />
);
