import type { Job } from "../game/types";

export const jobLabel = (job: Job): string => {
  switch (job) {
    case "PowerEngineer":
      return "Power Engineer";
    case "CoolantTech":
      return "Coolant Tech";
    case "FluxSpecialist":
      return "Flux Specialist";
    default:
      return job;
  }
};

export const jobAccentClasses = (job: Job): string => {
  switch (job) {
    case "PowerEngineer":
      return "border-red-400/60 bg-red-500/10 text-red-300";
    case "CoolantTech":
      return "border-sky-400/60 bg-sky-500/10 text-sky-300";
    case "FluxSpecialist":
      return "border-emerald-400/60 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-slate-500/60 bg-slate-500/10 text-slate-200";
  }
};

export const energyLabel = (value: number): string => {
  if (value < 0.25) return "LOW";
  if (value < 0.6) return "MED";
  return "HIGH";
};
