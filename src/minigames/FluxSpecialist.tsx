import React from "react";
import type { MinigameTier } from "../game/types";
import type { MinigameProps } from "./common";
import { clamp01 } from "./utils";

// Flux Specialist Minigame — v1.5
// Update: Reactor Energy now gives the PLAYER-CLICKED SPIKES large, visible
// left-right swings as they travel toward the left.
//
//   Reactor Energy Level →
//     - Wide sinusoidal swings left/right for spikes as they move left
//     - Spike tips wobble up/down (height jitter)
//     - Faster spike scroll speed
//     - More frequent spikes
//   Ship Health →
//     - Screen shake and electrical sparks (same as other minigames)
//
// Core mechanic:
// - Spikes travel across a flux line.
// - There is a vertical green stabilization zone.
// - When a spike passes through the zone, you tap it to "clip" (stabilize) it.
// - Missed spikes reduce your stability score.

const GAME_DURATION_MS = 10000; // 10 seconds

// Spike tuning (baseline)
const BASE_SPAWN_INTERVAL_MS = 900; // baseline time between spikes
const BASE_SCROLL_SPEED_PX = 90; // px/sec baseline scroll speed
const BASE_SPIKE_HEIGHT_PX = 35; // baseline height for spikes

// How erratic spikes get with energy
const SPIKE_X_JITTER_PER_SEC = 40; // px/sec random X movement at full energy (reduced, swing is main effect)
const SPIKE_HEIGHT_JITTER_PER_SEC = 40; // px/sec height jitter at full energy
const MAX_SPIKE_SWING_AMPLITUDE_PX = 80; // max left-right swing at full energy
const SPIKE_SWING_SPEED = 3.0; // rad/sec base for sinusoidal swing

// Wave tuning: calm backdrop; only lightly influenced by energy
const BASE_WAVE_AMPLITUDE_PX = 12; // smaller, calmer
const BASE_WAVE_SPEED = 0.8; // slower
const BASE_WAVE_JITTER_PX = 2; // minimal random noise
const BASE_ENDPOINT_DRIFT_PX = 6; // subtle up/down drift
const BASE_WAVE_X_WOBBLE_PX = 2; // very subtle horizontal wobble

// Visual / feel tuning
const MAX_SHAKE_PX = 10;
const MAX_SPARKS = 10;

// Canvas size
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 260;

// Stabilization zone
const HIT_ZONE_X = CANVAS_WIDTH * 0.35; // x-position of center of hit zone
const HIT_ZONE_HALF_WIDTH = 22; // tolerance left/right for timing
const TAP_HIT_RADIUS = 30; // px radius for tap proximity to spike body

type Spike = {
  x: number; // base X position (scrolls left)
  renderX: number; // actual on-screen X including swing
  height: number; // px
  upwards: boolean; // if true, spike goes up, else down from baseline
  active: boolean;
  hit: boolean;
  phase: number; // per-spike swing phase offset
};
export const FluxSpecialistMinigame: React.FC<MinigameProps> = ({
  reactorEnergy,
  shipHealth,
  onComplete,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  // Game factors normalized
  const energy01 = clamp01(reactorEnergy);
  const health01 = clamp01(shipHealth);
  const damage01 = 1 - health01;

  // ===== Reactor energy → spike behavior =====

  // Spike spawning: from chill (~1600ms) to chaotic (~450ms)
  const spawnIntervalMs = 1600 - energy01 * 1150; // 1600 .. 450 ms

  // Spike scroll speed: from ~0.7x to ~3x base
  const scrollSpeedPx = BASE_SCROLL_SPEED_PX * (0.7 + energy01 * 2.3); // ~63 .. ~297 px/sec

  // Spike height baseline slightly scales with energy
  const spikeHeightBase = BASE_SPIKE_HEIGHT_PX * (0.9 + energy01 * 1.2); // ~0.9x..2.1x

  // ===== Wave behavior → calm backdrop (lightly affected by energy) =====

  const waveAmplitudePx = BASE_WAVE_AMPLITUDE_PX * (0.8 + energy01 * 0.4);
  const waveSpeed = BASE_WAVE_SPEED * (0.6 + energy01 * 0.8);
  const waveJitterPx = BASE_WAVE_JITTER_PX * (0.8 + energy01 * 0.6);
  const endpointDriftPx = BASE_ENDPOINT_DRIFT_PX * (0.8 + energy01 * 0.6);
  const waveXWobblePx = BASE_WAVE_X_WOBBLE_PX * (0.8 + energy01 * 0.8);

  // Wave color from cool cyan at low energy to moderately warmer teal at high energy
  const waveHue = 190 - energy01 * 40; // 190 → 150
  const waveColor = `hsl(${waveHue}, 100%, 60%)`;

  // Ship damage → VFX
  const shakeAmplitudePx = damage01 * MAX_SHAKE_PX;
  const sparkCount = Math.round(damage01 * MAX_SPARKS);

  // Simulation refs
  const spikesRef = React.useRef<Spike[]>([]);
  const totalSpikesRef = React.useRef(0);
  const stabilizedSpikesRef = React.useRef(0);
  const missedSpikesRef = React.useRef(0);

  // For debug/UI
  const [lastTapInfo, setLastTapInfo] = React.useState<string | null>(null);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setLastTapInfo(`x=${x.toFixed(0)}, y=${y.toFixed(0)}`);

    const spikes = spikesRef.current;
    const baselineY = CANVAS_HEIGHT * 0.6;

    // Find the closest spike that is currently near the hit zone and not yet hit
    let bestIndex = -1;
    let bestDistSq = Infinity;

    for (let i = 0; i < spikes.length; i++) {
      const spike = spikes[i];
      if (!spike.active || spike.hit) continue;

      const centerX = spike.renderX; // use rendered X including swing

      // Only consider spikes within the timing window
      if (Math.abs(centerX - HIT_ZONE_X) > HIT_ZONE_HALF_WIDTH) continue;

      // Approximate spike's center for tap detection
      const tipY = spike.upwards
        ? baselineY - spike.height
        : baselineY + spike.height;
      const centerY = (baselineY + tipY) / 2;

      const dx = centerX - x;
      const dy = centerY - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= TAP_HIT_RADIUS * TAP_HIT_RADIUS && distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      const spike = spikes[bestIndex];
      spike.hit = true;
      stabilizedSpikesRef.current += 1;
    }
  };

  const handlePointerUp = (): void => {
    // No continuous input needed; taps are discrete.
  };

  const handleStart = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    spikesRef.current = [];
    totalSpikesRef.current = 0;
    stabilizedSpikesRef.current = 0;
    missedSpikesRef.current = 0;
    setResult(null);
    setLastTapInfo(null);
    setRunning(true);
  }, []);

  React.useEffect(() => {
    if (!running) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset state
    spikesRef.current = [];
    totalSpikesRef.current = 0;
    stabilizedSpikesRef.current = 0;
    missedSpikesRef.current = 0;

    let startTime = performance.now();
    let lastTime = startTime;
    let timeSinceSpawn = 0;
    let stopped = false;
    let animationFrameId: number;

    const baselineY = CANVAS_HEIGHT * 0.6;
    let wavePhase = 0; // controls overall wave motion

    const drawWave = (elapsedSec: number) => {
      const w = CANVAS_WIDTH;
      const marginX = 24;
      const innerWidth = w - marginX * 2;

      // Endpoint offsets depend on time and reactor energy (subtle)
      const t = elapsedSec;
      const leftOffset = Math.sin(t * (0.4 + energy01 * 0.6)) * endpointDriftPx;
      const rightOffset =
        Math.sin(t * (0.6 + energy01 * 0.4) + 1.7) * endpointDriftPx;

      const segments = 64;
      ctx.beginPath();
      for (let i = 0; i < segments; i++) {
        const tNorm = i / (segments - 1);

        // Base X along the line
        const xBase = marginX + tNorm * innerWidth;

        // Mild horizontal wobble
        const wobblePhase = wavePhase * 0.4 + t * 0.7 + tNorm * Math.PI * 2;
        const xWobble = Math.sin(wobblePhase) * waveXWobblePx;
        const x = xBase + xWobble;

        // Blend endpoint offsets for vertical baseline
        const endpointBlend = leftOffset + (rightOffset - leftOffset) * tNorm;
        const baseLine = baselineY + endpointBlend;

        // Core wave shape
        const waveValue =
          Math.sin(tNorm * Math.PI * 4 + wavePhase) * waveAmplitudePx;

        // Jitter (small noise)
        const jitter = (Math.random() - 0.5) * 2 * waveJitterPx;

        const y = baseLine + waveValue + jitter;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const drawFrame = (remainingMs: number, elapsedSec: number) => {
      const w = CANVAS_WIDTH;
      const h = CANVAS_HEIGHT;

      ctx.clearRect(0, 0, w, h);

      // Screen shake
      const shakeX = shakeAmplitudePx
        ? (Math.random() - 0.5) * 2 * shakeAmplitudePx
        : 0;
      const shakeY = shakeAmplitudePx
        ? (Math.random() - 0.5) * 2 * shakeAmplitudePx
        : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Background
      ctx.fillStyle = "#020617"; // slate-950
      ctx.fillRect(0, 0, w, h);

      // Baseline
      ctx.strokeStyle = "#1f2937"; // gray-800
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(24, baselineY);
      ctx.lineTo(w - 24, baselineY);
      ctx.stroke();

      // Flux wave (mostly calm backdrop)
      drawWave(elapsedSec);

      // Hit zone (vertical band)
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)"; // emerald-500 alpha
      ctx.fillRect(
        HIT_ZONE_X - HIT_ZONE_HALF_WIDTH,
        baselineY - 80,
        HIT_ZONE_HALF_WIDTH * 2,
        160
      );
      ctx.strokeStyle = "#10b981"; // emerald-500
      ctx.lineWidth = 2;
      ctx.strokeRect(
        HIT_ZONE_X - HIT_ZONE_HALF_WIDTH,
        baselineY - 80,
        HIT_ZONE_HALF_WIDTH * 2,
        160
      );

      // Draw spikes (now with wide swing behavior)
      const spikes = spikesRef.current;
      for (const spike of spikes) {
        if (!spike.active) continue;

        const x = spike.renderX;
        const height = spike.height;
        const tipY = spike.upwards ? baselineY - height : baselineY + height;

        // Trail / glow
        ctx.strokeStyle = spike.hit ? "#22c55e" : "#f97316"; // green if hit, orange otherwise
        ctx.lineWidth = spike.hit ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x, baselineY);
        ctx.lineTo(x, tipY);
        ctx.stroke();

        // Tip orb
        ctx.beginPath();
        ctx.arc(x, tipY, spike.hit ? 6 : 5, 0, Math.PI * 2);
        ctx.fillStyle = spike.hit ? "#bbf7d0" : "#fed7aa"; // soft green / orange
        ctx.fill();
      }

      // Sparks / arcs based on damage
      if (sparkCount > 0) {
        ctx.strokeStyle = "#facc15"; // yellow
        ctx.lineWidth = 2;
        for (let i = 0; i < sparkCount; i++) {
          const sx = 24 + Math.random() * (w - 48);
          const sy = baselineY + (Math.random() - 0.5) * 120;
          const ex = sx + (Math.random() - 0.5) * 30;
          const ey = sy + (Math.random() - 0.5) * 30;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }

      // HUD
      ctx.fillStyle = "#e5e7eb"; // gray-200
      ctx.font =
        "16px system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
      ctx.textAlign = "left";

      const secondsLeft = Math.max(0, remainingMs) / 1000;
      ctx.fillText(`Time Left: ${secondsLeft.toFixed(1)}s`, 16, 26);

      const total = totalSpikesRef.current || 1;
      const stabilized = stabilizedSpikesRef.current;
      const missed = missedSpikesRef.current;
      const ratio = stabilized / total;
      const pct = Math.round(ratio * 100);

      ctx.fillText(`Flux Stability: ${pct}% spikes stabilized`, 16, 48);
      ctx.fillText(`Stabilized: ${stabilized}  Missed: ${missed}`, 16, 70);

      ctx.fillText(
        `Reactor: ${(energy01 * 100).toFixed(0)}%  Hull: ${(health01 * 100).toFixed(0)}%`,
        16,
        92
      );

      ctx.textAlign = "right";
      ctx.fillText("Tap spikes in the green zone", w - 16, 26);

      ctx.restore();
    };

    const step = (now: number) => {
      if (stopped) return;

      const dtMs = now - lastTime;
      lastTime = now;
      const dtSec = dtMs / 1000;

      const elapsedMs = now - startTime;
      const remaining = Math.max(GAME_DURATION_MS - elapsedMs, 0);
      const elapsedSec = elapsedMs / 1000;

      const spikes = spikesRef.current;

      // Advance wave phase (gentle motion)
      wavePhase += waveSpeed * dtSec;

      // Move spikes and apply energy-driven swing + jitter
      const swingAmp = MAX_SPIKE_SWING_AMPLITUDE_PX * energy01;
      const swingSpeed = SPIKE_SWING_SPEED * (0.6 + energy01 * 1.4);

      for (const spike of spikes) {
        if (!spike.active) continue;

        // Base leftward scroll
        spike.x -= scrollSpeedPx * dtSec;

        // Erratic horizontal jitter (scaled by energy)
        const jitterX =
          (Math.random() - 0.5) * 2 * SPIKE_X_JITTER_PER_SEC * energy01 * dtSec;
        spike.x += jitterX;

        // Height jitter (tip wobble up/down)
        const dHeight =
          (Math.random() - 0.5) * 2 * SPIKE_HEIGHT_JITTER_PER_SEC * energy01 * dtSec;
        const minHeight = BASE_SPIKE_HEIGHT_PX * 0.5;
        const maxHeight = spikeHeightBase * 2.3;
        spike.height = Math.max(minHeight, Math.min(maxHeight, spike.height + dHeight));

        // Sinusoidal left-right swing around the base X
        const phase = spike.phase + elapsedSec * swingSpeed;
        spike.renderX = spike.x + Math.sin(phase) * swingAmp;

        // If it has moved fully off-screen on the left (considering swing), count miss if not hit
        if (spike.x + swingAmp < -40) {
          spike.active = false;
          if (!spike.hit) {
            missedSpikesRef.current += 1;
          }
        }
      }

      // Spawn new spikes
      timeSinceSpawn += dtMs;
      while (timeSinceSpawn >= spawnIntervalMs) {
        timeSinceSpawn -= spawnIntervalMs;

        const marginRight = 40;
        const spawnX = CANVAS_WIDTH + marginRight;
        const upwards = Math.random() < 0.5;

        const heightVariation = spikeHeightBase * 0.5;
        const baseHeight = spikeHeightBase * 0.7;
        const height = baseHeight + Math.random() * heightVariation; // some variability

        const phase = Math.random() * Math.PI * 2; // random swing phase per spike

        spikes.push({
          x: spawnX,
          renderX: spawnX,
          height,
          upwards,
          active: true,
          hit: false,
          phase,
        });
        totalSpikesRef.current += 1;
      }

      drawFrame(remaining, elapsedSec);

      // End condition
      if (remaining <= 0) {
        const total = totalSpikesRef.current;
        const stabilized = stabilizedSpikesRef.current;
        const missed = missedSpikesRef.current;
        const safeTotal = total || 1;
        const ratio = clamp01(stabilized / safeTotal);
        const pct = Math.round(ratio * 100);

        let outcome: string;
        let tier: MinigameTier;
        if (ratio >= 0.7 && missed === 0) {
          tier = "success";
          outcome = `SUCCESS: ${pct}% spikes stabilized (0 missed) — +1 Stability, ±2 Equalizer bonus.`;
        } else if (ratio >= 0.4 && missed <= 3) {
          tier = "partial";
          outcome = `PARTIAL: ${pct}% spikes stabilized (${missed} missed) — +1 Stability.`;
        } else {
          tier = "fail";
          outcome = `FAIL: ${pct}% spikes stabilized (${missed} missed) — 0 Stability.`;
        }

        if (!stopped) {
          setResult(outcome);
          setRunning(false);
          onComplete(tier, ratio);
        }
        return;
      }

      animationFrameId = requestAnimationFrame(step);
    };

    // Initial draw
    drawFrame(GAME_DURATION_MS, 0);
    animationFrameId = requestAnimationFrame(step);

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    running,
    energy01,
    health01,
    damage01,
    spawnIntervalMs,
    scrollSpeedPx,
    spikeHeightBase,
    waveAmplitudePx,
    waveSpeed,
    waveJitterPx,
    endpointDriftPx,
    waveXWobblePx,
    shakeAmplitudePx,
    sparkCount,
    waveColor,
    onComplete,
  ]);

  return (
    <div className="w-full flex flex-col items-center gap-4 p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-lg max-w-xl mx-auto">
      <h2 className="text-xl font-semibold tracking-tight">
        Flux Specialist Minigame — Wave Balancing (v1.5)
      </h2>
      <p className="text-sm text-slate-300 text-center max-w-lg">
        Energy spikes travel across the flux line. As reactor energy rises, those spikes
        swing in wide arcs left and right while rushing toward the left, and their tips
        wobble up and down. Tap spikes inside the green stabilization zone to clip and
        stabilize them. The background wave shows the overall flux, while the spikes
        themselves reflect the reactor's volatility. Ship damage adds shake and
        electrical noise.
      </p>
      <div className="border border-slate-700 rounded-xl overflow-hidden bg-black touch-none">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <button
        onClick={handleStart}
        disabled={running}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
          running
            ? "bg-slate-700 border-slate-600 text-slate-300 cursor-not-allowed"
            : "bg-emerald-600 border-emerald-500 hover:bg-emerald-500"
        }`}
      >
        {running ? "Stabilizing..." : "Start"}
      </button>
      {lastTapInfo && (
        <div className="text-xs text-slate-400 mt-1">Last tap: {lastTapInfo}</div>
      )}
      {result && (
        <div className="text-sm text-center bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 w-full">
          {result}
        </div>
      )}
    </div>
  );
};
