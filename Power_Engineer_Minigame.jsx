import React, { useEffect, useRef, useState } from "react";

// Power Engineer Minigame — v3
// - Smooth inertial movement (velocity + friction)
// - Random "wind" drift
// - Moving green band
// - Phone-style input: tap/press left/right side of the gauge
// - Tunable by two game-state factors passed from the main game:
//   * reactorEnergy:   0..1  (0 = low, 1 = very high)
//   * shipHealth:      0..1  (1 = perfect, 0 = critical)
//
// These factors influence:
//   - Needle acceleration & erratic movement (reactorEnergy)
//   - Band speed (reactorEnergy)
//   - Screen shake & VFX like sparks/arcs (shipHealth)

const GAME_DURATION_MS = 10000; // 10 seconds

// Base physics tuning (unmodified by reactorEnergy)
const BASE_INPUT_ACCEL = 2.8; // units/sec^2
const FRICTION = 3.0; // higher = more damping
const BASE_MAX_WIND = 1.8; // max random drift acceleration
const WIND_CHANGE_INTERVAL_MS = 700; // ms between drift direction changes

// Band tuning
const BAND_HALF_WIDTH = 0.16; // normalized half-width of safe band
const BAND_BASE_CENTER = 0.5; // center around which band oscillates
const BASE_BAND_AMPLITUDE = 0.28; // how far band center moves left/right
const BASE_BAND_SPEED = 1.0; // radians per second

// Visual effects tuning
const MAX_SHAKE_PX = 10; // max screen shake when shipHealth = 0
const MAX_SPARKS = 10; // max sparks per frame when shipHealth = 0

// NOTE: BASE_BAND_AMPLITUDE <= 0.5 - BAND_HALF_WIDTH so band stays on track

type InputDir = -1 | 0 | 1;

interface PowerEngineerMinigameProps {
  /** 0..1, where 0 = very low, 1 = dangerously high reactor output */
  reactorEnergy?: number;
  /** 0..1, where 1 = perfect condition, 0 = heavily damaged */
  shipHealth?: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const PowerEngineerMinigame: React.FC<PowerEngineerMinigameProps> = ({
  reactorEnergy = 0.5,
  shipHealth = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // We keep the current input direction in a ref so the animation loop
  // always sees the latest value without re-subscribing effects.
  const inputDirRef = useRef<InputDir>(0);
  const [inputDir, setInputDir] = useState<InputDir>(0); // for UI/debug only

  // Normalize and clamp incoming game factors once per render
  const energy01 = clamp01(reactorEnergy);
  const health01 = clamp01(shipHealth);
  const damage01 = 1 - health01; // 0 = perfect, 1 = critical

  // Derived tuning from game factors
  // Reactor energy boosts input acceleration, wind jitter, and band speed.
  const inputAccelFactor = 0.6 + energy01 * 1.4; // 0.6x .. 2.0x
  const maxWindFactor = 0.4 + energy01 * 2.0; // 0.4x .. 2.4x
  const bandSpeedFactor = 0.7 + energy01 * 2.0; // 0.7x .. 2.7x

  const effectiveInputAccel = BASE_INPUT_ACCEL * inputAccelFactor;
  const effectiveMaxWind = BASE_MAX_WIND * maxWindFactor;
  const effectiveBandSpeed = BASE_BAND_SPEED * bandSpeedFactor;

  // Ship damage increases VFX (shake & sparks)
  const shakeAmplitudePx = damage01 * MAX_SHAKE_PX;
  const sparkCount = Math.round(damage01 * MAX_SPARKS);

  // Keyboard input (desktop prototype fallback)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        inputDirRef.current = -1;
        setInputDir(-1);
      } else if (e.key === "ArrowRight") {
        inputDirRef.current = 1;
        setInputDir(1);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && inputDirRef.current === -1) {
        inputDirRef.current = 0;
        setInputDir(0);
      } else if (e.key === "ArrowRight" && inputDirRef.current === 1) {
        inputDirRef.current = 0;
        setInputDir(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Pointer/touch input for phone-style controls
  const handlePointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const dir: InputDir = x < width / 2 ? -1 : 1;
    inputDirRef.current = dir;
    setInputDir(dir);
  };

  const handlePointerUp = (): void => {
    inputDirRef.current = 0;
    setInputDir(0);
  };

  // Main animation loop
  useEffect(() => {
    if (!running) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let startTime = performance.now();
    let lastTime = startTime;

    // Needle state
    let needlePos = 0.5; // normalized 0..1
    let needleVel = 0; // in normalized units/sec

    // Band motion
    let bandPhase = 0; // radians

    // Random drift ("wind")
    let windAccel = 0; // normalized units/sec^2
    let timeSinceWindChange = 0;

    // Stability tracking
    let timeInBandMs = 0;

    let animationFrameId: number;
    let stopped = false;

    const drawFrame = (
      needle: number,
      bandCenter: number,
      remainingMs: number,
      timeInBand: number
    ) => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Apply screen shake based on damage
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

      const trackY = h * 0.5;
      const margin = w * 0.08;
      const trackStartX = margin;
      const trackEndX = w - margin;

      // Track
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#1f2937"; // gray-800
      ctx.beginPath();
      ctx.moveTo(trackStartX, trackY);
      ctx.lineTo(trackEndX, trackY);
      ctx.stroke();

      // Moving safe band
      const bandMinNorm = bandCenter - BAND_HALF_WIDTH;
      const bandMaxNorm = bandCenter + BAND_HALF_WIDTH;
      const bandStartX = trackStartX + bandMinNorm * (trackEndX - trackStartX);
      const bandEndX = trackStartX + bandMaxNorm * (trackEndX - trackStartX);

      ctx.lineWidth = 12;
      ctx.strokeStyle = "#16a34a"; // green-600
      ctx.beginPath();
      ctx.moveTo(bandStartX, trackY);
      ctx.lineTo(bandEndX, trackY);
      ctx.stroke();

      // Needle
      const needleX = trackStartX + needle * (trackEndX - trackStartX);
      ctx.strokeStyle = "#facc15"; // yellow-400
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(needleX, trackY - 25);
      ctx.lineTo(needleX, trackY + 25);
      ctx.stroke();

      // Needle knob
      ctx.fillStyle = "#f97316"; // orange-500
      ctx.beginPath();
      ctx.arc(needleX, trackY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Sparks / arcs based on damage
      if (sparkCount > 0) {
        ctx.strokeStyle = "#facc15"; // bright yellow
        ctx.lineWidth = 2;
        for (let i = 0; i < sparkCount; i++) {
          const sx = needleX + (Math.random() - 0.5) * 40;
          const sy = trackY + (Math.random() - 0.5) * 40;
          const ex = sx + (Math.random() - 0.5) * 20;
          const ey = sy + (Math.random() - 0.5) * 20;
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
      ctx.fillText(`Time Left: ${secondsLeft.toFixed(1)}s`, margin, h * 0.15);

      const ratio = timeInBand / GAME_DURATION_MS;
      const pct = Math.round(ratio * 100);
      ctx.fillText(`Stability: ${pct}% in moving band`, margin, h * 0.22);

      // Show current factors for debugging/feel tuning
      ctx.fillText(
        `Reactor: ${(energy01 * 100).toFixed(0)}%  Hull: ${(health01 * 100).toFixed(0)}%`,
        margin,
        h * 0.29
      );

      ctx.textAlign = "right";
      ctx.fillText("Tap / Press Left or Right", w - margin, h * 0.15);

      ctx.restore();
    };

    const step = (now: number) => {
      if (stopped) return;

      const dtMs = now - lastTime;
      lastTime = now;
      const dtSec = dtMs / 1000;

      const elapsed = now - startTime;
      const remaining = Math.max(GAME_DURATION_MS - elapsed, 0);

      // Update wind
      timeSinceWindChange += dtMs;
      if (timeSinceWindChange >= WIND_CHANGE_INTERVAL_MS) {
        timeSinceWindChange = 0;
        // New random acceleration in [-effectiveMaxWind, effectiveMaxWind]
        windAccel = (Math.random() * 2 - 1) * effectiveMaxWind;
      }

      // Needle physics
      const inputAccel = inputDirRef.current * effectiveInputAccel;

      // Apply input + wind
      needleVel += (inputAccel + windAccel) * dtSec;

      // Friction (exponential damping)
      const damping = Math.exp(-FRICTION * dtSec);
      needleVel *= damping;

      // Integrate position
      needlePos += needleVel * dtSec;

      // Clamp 0..1 and bounce a bit if we hit edges
      if (needlePos < 0) {
        needlePos = 0;
        needleVel = Math.abs(needleVel) * 0.4; // bounce inward
      } else if (needlePos > 1) {
        needlePos = 1;
        needleVel = -Math.abs(needleVel) * 0.4;
      }

      // Moving band center; amplitude is kept constant for now, but you could
      // also modulate it by energy01 if you want an even trickier game.
      bandPhase += effectiveBandSpeed * dtSec;
      const bandCenter =
        BAND_BASE_CENTER + BASE_BAND_AMPLITUDE * Math.sin(bandPhase);

      const bandMinNorm = bandCenter - BAND_HALF_WIDTH;
      const bandMaxNorm = bandCenter + BAND_HALF_WIDTH;

      // Track time in band
      if (needlePos >= bandMinNorm && needlePos <= bandMaxNorm) {
        timeInBandMs += dtMs;
      }

      // Draw
      drawFrame(needlePos, bandCenter, remaining, timeInBandMs);

      // End condition
      if (remaining <= 0) {
        // Final result
        const ratio = timeInBandMs / GAME_DURATION_MS;
        const pct = Math.round(ratio * 100);
        let outcome: string;
        if (ratio >= 0.7) {
          outcome = `SUCCESS: ${pct}% in band (Grants +1 Stability, optional +1 Buffer)`;
        } else if (ratio >= 0.4) {
          outcome = `PARTIAL: ${pct}% in band (Grants +1 Stability)`;
        } else {
          outcome = `FAIL: ${pct}% in band (0 Stability)`;
        }
        setResult(outcome);
        setRunning(false);
        return;
      }

      animationFrameId = requestAnimationFrame(step);
    };

    // Initial draw (before any time passes)
    drawFrame(needlePos, BAND_BASE_CENTER, GAME_DURATION_MS, 0);
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
    effectiveInputAccel,
    effectiveMaxWind,
    effectiveBandSpeed,
    shakeAmplitudePx,
    sparkCount,
  ]);

  const handleStart = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    inputDirRef.current = 0;
    setInputDir(0);
    setResult(null);
    setRunning(true);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-lg max-w-xl mx-auto">
      <h2 className="text-xl font-semibold tracking-tight">
        Power Engineer Minigame — Reactor Tuning (v3)
      </h2>
      <p className="text-sm text-slate-300 text-center max-w-lg">
        Keep the control needle inside the
        <span className="text-green-400 font-semibold"> moving green band</span>
        as much as possible. On a phone, tap or press on the left or right side
        of the gauge to pull the needle in that direction. On desktop, you can
        also use the <span className="font-mono">Left / Right</span> arrow keys
        as a fallback. Movement has momentum, unpredictable reactor drift, and
        visual feedback that escalates with ship damage and reactor energy.
      </p>
      <div className="border border-slate-700 rounded-xl overflow-hidden bg-black touch-none">
        <canvas
          ref={canvasRef}
          width={480}
          height={220}
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
      <div className="text-xs text-slate-400 mt-1">
        Input: {inputDir === -1 ? "Left" : inputDir === 1 ? "Right" : "Neutral"}
      </div>
      {result && (
        <div className="text-sm text-center bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 w-full">
          {result}
        </div>
      )}
    </div>
  );
};

export default PowerEngineerMinigame;
