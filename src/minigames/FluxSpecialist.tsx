import React from "react";
import { MinigameCard, type MinigameProps } from "./common";

export const FluxSpecialistMinigame: React.FC<MinigameProps> = ({
  reactorEnergy,
  shipHealth,
  onComplete,
}) => (
  <MinigameCard
    title="Flux Spikes"
    subtitle="Flux • EQUALIZER/STABILIZER"
    description={`Trim swinging spikes. Load ${Math.round(reactorEnergy * 100)}%, Hull ${Math.round(
      shipHealth * 100
    )}%.`}
    onSuccess={() => onComplete("success", 1, 0, 0)}
    onPartial={() => onComplete("partial", 0.6, 0, 0)}
    onFail={() => onComplete("fail", 0.2, 0, 0)}
  />
);
