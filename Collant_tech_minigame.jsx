import React, { useEffect, useRef, useState } from "react";

// Coolant Tech Minigame — v1.2
// Update: leaks now require rapid tapping to shrink.
// - Tapping a leak no longer instantly fixes it.
// - Each tap reduces the leak's radius by a fixed amount.
// - When a leak's radius is reduced below a minimum threshold, it is considered patched.
// - Leaks continue to grow over time, so you must tap quickly to keep up.
//
// Visual layout:
// - Two horizontal coolant tubes (upper & lower), thick enough to read as pipes.
// - Leaks spawn along either tube.
//
// Tuning via game factors:
//   reactorEnergy: 0..1  (0 = low, 1 = dangerously high)
//     - Controls leak spawn interval & growth speed.
//   shipHealth:    0..1  (1 = perfect, 0 = critical)
//     - Controls screen shake & spark density.

const GAME_DURATION_MS = 10000; // 10 seconds

// Leak tuning
const BASE_SPAWN_INTERVAL_MS = 1000; // baseline time between leaks
const BASE_GROWTH_RATE_PX = 12; // px/sec radius growth
const MAX_LEAK_RADIUS_PX = 30; // when exceeded, leak overflows
const TAP_SHRINK_PX = 8; // how much radius shrinks per successful tap
const MIN_LEAK_RADIUS_PX = 4; // when shrunk below this, leak is considered patched

// Visual / feel tuning
const MAX_SHAKE_PX = 10;
const MAX_SPARKS = 10;

// Canvas size (you can tweak to match other minigames)
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 260;

interface CoolantTechMinigameProps {
  /** 0..1, where 0 = very low, 1 = dangerously high reactor output */
  reactorEnergy?: number;
  /** 0..1, where 1 = perfect condition, 0 = heavily damaged */
  shipHealth?: number;
}

type Leak = {
  x: number; // px
  y: number; // px (anchored near tube center)
  radius: number; // px
  active: boolean;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const CoolantTechMinigame: React.FC<CoolantTechMinigameProps> = ({
  reactorEnergy = 0.5,
  shipHealth = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Game factors normalized
  const energy01 = clamp01(reactorEnergy);
  const health01 = clamp01(shipHealth);
  const damage01 = 1 - health01;

  // Derived tuning
  // Higher energy = faster spawn and growth
  const spawnIntervalMs =
    BASE_SPAWN_INTERVAL_MS * (1.2 - energy01 * 0.7); // ~1200ms .. ~500ms
  const growthRatePx =
    BASE_GROWTH_RATE_PX * (0.7 + energy01 * 2.0); // ~8.4 .. ~38.4 px/sec

  // Ship damage → VFX
  const shakeAmplitudePx = damage01 * MAX_SHAKE_PX;
  const sparkCount = Math.round(damage01 * MAX_SPARKS);

  // Persistent refs for simulation state
  const leaksRef = useRef<Leak[]>([]);
  const totalLeaksRef = useRef(0);
  const patchedLeaksRef = useRef(0);
  const overflowLeaksRef = useRef(0);

  // For UI/debug
  const [lastTapSide, setLastTapSide] = useState<"left" | "right" | "center" | null>(
    null
  );

  const handlePointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const side: "left" | "right" | "center" =
      x < rect.width / 3
        ? "left"
        : x > (2 * rect.width) / 3
        ? "right"
        : "center";
    setLastTapSide(side);

    // Find the closest active leak within its radius (plus a small padding)
    const leaks = leaksRef.current;
    let bestIndex = -1;
    let bestDistSq = Infinity;

    for (let i = 0; i < leaks.length; i++) {
      const leak = leaks[i];
      if (!leak.active) continue;
      const dx = leak.x - x;
      const dy = leak.y - y;
      const distSq = dx * dx + dy * dy;
      const maxReach = leak.radius + 14; // clickable padding
      if (distSq <= maxReach * maxReach && distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      const leak = leaks[bestIndex];
      // Shrink leak radius with each tap
      leak.radius = Math.max(0, leak.radius - TAP_SHRINK_PX);
      // If it's now below minimum, consider it patched
      if (leak.radius <= MIN_LEAK_RADIUS_PX) {
        leak.active = false;
        patchedLeaksRef.current += 1;
      }
    }
  };

  const handlePointerUp = (): void => {
    // No continuous interaction needed right now.
  };

  useEffect(() => {
    if (!running) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset simulation state at the start of a run
    leaksRef.current = [];
    totalLeaksRef.current = 0;
    patchedLeaksRef.current = 0;
    overflowLeaksRef.current = 0;

    let startTime = performance.now();
    let lastTime = startTime;
    let timeSinceSpawn = 0;
    let stopped = false;
    let animationFrameId: number;

    // Tube layout
    const tubeMarginX = CANVAS_WIDTH * 0.08;
    const tubeStartX = tubeMarginX;
    const tubeEndX = CANVAS_WIDTH - tubeMarginX;
    const tubeGap = 40; // vertical distance between tube centers
    const tubeCenterY = CANVAS_HEIGHT * 0.55;
    const upperTubeY = tubeCenterY - tubeGap / 2;
    const lowerTubeY = tubeCenterY + tubeGap / 2;
    const tubeThickness = 22; // visual thickness of tube

    const drawFrame = (remainingMs: number) => {
      const w = CANVAS_WIDTH;
      const h = CANVAS_HEIGHT;

      ctx.clearRect(0, 0, w, h);

      // Screen shake based on damage
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

      // Draw two thick tubes (upper & lower)
      const drawTube = (y: number) => {
        // Outer darker shell
        ctx.strokeStyle = "#020617"; // very dark outline
        ctx.lineWidth = tubeThickness + 6;
        ctx.beginPath();
        ctx.moveTo(tubeStartX, y);
        ctx.lineTo(tubeEndX, y);
        ctx.stroke();

        // Main tube body
        ctx.strokeStyle = "#1f2937"; // gray-800
        ctx.lineWidth = tubeThickness;
        ctx.beginPath();
        ctx.moveTo(tubeStartX, y);
        ctx.lineTo(tubeEndX, y);
        ctx.stroke();

        // Subtle highlight line
        ctx.strokeStyle = "#4b5563"; // gray-600
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tubeStartX, y - tubeThickness * 0.25);
        ctx.lineTo(tubeEndX, y - tubeThickness * 0.25);
        ctx.stroke();
      };

      drawTube(upperTubeY);
      drawTube(lowerTubeY);

      // Draw leaks
      const leaks = leaksRef.current;
      for (const leak of leaks) {
        if (!leak.active) continue;

        // Outer glow-ish ring
        ctx.beginPath();
        ctx.arc(leak.x, leak.y, leak.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(56, 189, 248, 0.25)"; // sky-400 with alpha
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(leak.x, leak.y, leak.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#0ea5e9"; // sky-500
        ctx.fill();

        // Inner bright spot
        ctx.beginPath();
        ctx.arc(leak.x, leak.y, Math.max(3, leak.radius * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = "#e0f2fe"; // sky-100
        ctx.fill();
      }

      // Sparks / electrical arcs (ship damage)
      if (sparkCount > 0) {
        ctx.strokeStyle = "#facc15"; // yellow
        ctx.lineWidth = 2;
        for (let i = 0; i < sparkCount; i++) {
          const useUpper = Math.random() < 0.5;
          const baseY = useUpper ? upperTubeY : lowerTubeY;
          const sx =
            tubeStartX + Math.random() * (tubeEndX - tubeStartX);
          const sy = baseY + (Math.random() - 0.5) * tubeThickness;
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
      ctx.font = "16px system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif";
      ctx.textAlign = "left";

      const secondsLeft = Math.max(0, remainingMs) / 1000;
      ctx.fillText(`Time Left: ${secondsLeft.toFixed(1)}s`, 16, 26);

      const total = totalLeaksRef.current || 1;
      const patched = patchedLeaksRef.current;
      const overflow = overflowLeaksRef.current;
      const ratio = patched / total;
      const pct = Math.round(ratio * 100);

      ctx.fillText(`Coolant Stability: ${pct}% leaks fully patched`, 16, 48);
      ctx.fillText(
        `Patched: ${patched}  Overflow: ${overflow}`,
        16,
        70
      );

      ctx.fillText(
        `Reactor: ${(energy01 * 100).toFixed(0)}%  Hull: ${(health01 * 100).toFixed(0)}%`,
        16,
        92
      );

      ctx.textAlign = "right";
      ctx.fillText("Tap leaks repeatedly to shrink", w - 16, 26);

      ctx.restore();
    };

    const step = (now: number) => {
      if (stopped) return;

      const dtMs = now - lastTime;
      lastTime = now;
      const dtSec = dtMs / 1000;

      const elapsed = now - startTime;
      const remaining = Math.max(GAME_DURATION_MS - elapsed, 0);

      const leaks = leaksRef.current;

      // Grow existing leaks
      for (const leak of leaks) {
        if (!leak.active) continue;
        leak.radius += growthRatePx * dtSec;
        if (leak.radius >= MAX_LEAK_RADIUS_PX) {
          leak.active = false;
          overflowLeaksRef.current += 1;
        }
      }

      // Spawn new leaks based on interval and energy
      timeSinceSpawn += dtMs;
      while (timeSinceSpawn >= spawnIntervalMs) {
        timeSinceSpawn -= spawnIntervalMs;

        const margin = 40;
        const x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);
        // Randomly choose upper or lower tube, with a little jitter vertically
        const useUpper = Math.random() < 0.5;
        const baseY = useUpper ? upperTubeY : lowerTubeY;
        const y = baseY + (Math.random() - 0.5) * (tubeThickness * 0.6);

        leaks.push({
          x,
          y,
          radius: 4 + Math.random() * 4,
          active: true,
        });
        totalLeaksRef.current += 1;
      }

      drawFrame(remaining);

      // End condition
      if (remaining <= 0) {
        // Compute final outcome
        const total = totalLeaksRef.current;
        const patched = patchedLeaksRef.current;
        const overflow = overflowLeaksRef.current;
        const safeTotal = total || 1;
        const ratio = patched / safeTotal;
        const pct = Math.round(ratio * 100);

        let outcome: string;
        if (ratio >= 0.7 && overflow === 0) {
          outcome = `SUCCESS: ${pct}% leaks fully patched (0 overflow) — +1 Stability, optional -1 energy buffer.`;
        } else if (ratio >= 0.4 && overflow <= 2) {
          outcome = `PARTIAL: ${pct}% leaks fully patched (${overflow} overflow) — +1 Stability.`;
        } else {
          outcome = `FAIL: ${pct}% leaks fully patched (${overflow} overflow) — 0 Stability.`;
        }

        setResult(outcome);
        setRunning(false);
        return;
      }

      animationFrameId = requestAnimationFrame(step);
    };

    // Initial draw
    drawFrame(GAME_DURATION_MS);
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
    growthRatePx,
    shakeAmplitudePx,
    sparkCount,
  ]);

  const handleStart = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    leaksRef.current = [];
    totalLeaksRef.current = 0;
    patchedLeaksRef.current = 0;
    overflowLeaksRef.current = 0;
    setResult(null);
    setRunning(true);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-lg max-w-xl mx-auto">
      <h2 className="text-xl font-semibold tracking-tight">
        Coolant Tech Minigame — Leak Control (v1.2)
      </h2>
      <p className="text-sm text-slate-300 text-center max-w-lg">
        Twin coolant tubes run across the panel. Glowing leaks appear along
        them; tap directly on a leak repeatedly to shrink it until it seals.
        If a leak grows too large, it overflows and damages stability. Reactor
        energy increases leak spawn and growth, while ship damage adds shake
        and sparks.
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
        {running ? "Running..." : "Start Minigame"}
      </button>
      {lastTapSide && (
        <div className="text-xs text-slate-400 mt-1">
          Last tap: {lastTapSide}
        </div>
      )}
      {result && (
        <div className="text-sm text-center bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 w-full">
          {result}
        </div>
      )}
    </div>
  );
};

export default CoolantTechMinigame;
