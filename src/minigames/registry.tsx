import type React from "react";
import type { Job } from "../game/types";
import type { MinigameProps } from "./common";
import { CoolantTechMinigame } from "./CoolantTech";
import { FluxSpecialistMinigame } from "./FluxSpecialist";
import { PowerEngineerMinigame } from "./PowerEngineer";

const registry: Record<Job, React.FC<MinigameProps>> = {
  PowerEngineer: PowerEngineerMinigame,
  CoolantTech: CoolantTechMinigame,
  FluxSpecialist: FluxSpecialistMinigame,
};

export const getMinigameForJob = (job: Job): React.FC<MinigameProps> => {
  return registry[job] ?? PowerEngineerMinigame;
};

export { PowerEngineerMinigame, CoolantTechMinigame, FluxSpecialistMinigame };
