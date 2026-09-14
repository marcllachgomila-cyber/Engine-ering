"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCircuit } from "@/lib/physics/circuits";
import { buildEngineCurves } from "@/lib/physics/engineModel";
import {
  computeCruiseState,
  computeLaunchRpm,
  isClutchDumpLaunch,
  simulate,
} from "@/lib/physics/simulate";
import {
  ChassisConfig,
  EngineConfig,
  GearboxConfig,
  SimulationResult,
  Telemetry,
  TestConfig,
} from "@/lib/physics/types";
import { EngineAudioEngine } from "@/lib/audio/EngineAudioEngine";
import CircuitMap from "./CircuitMap";
import Gauges from "./Gauges";
import LiveStatsPanel from "./LiveStatsPanel";
import TimeSeriesGraph from "./TimeSeriesGraph";

interface SimulationRunnerProps {
  engine: EngineConfig;
  chassis: ChassisConfig;
  gearbox: GearboxConfig;
  test: TestConfig;
  audioEngine: EngineAudioEngine;
  onComplete: (result: SimulationResult) => void;
  onRestart: () => void;
}

const RUNNING_LABELS: Record<TestConfig["testType"], string> = {
  zeroToHundred: "Running 0–100 kph…",
  tenSecond: "Accelerating for 10s…",
  drag500m: "Running the 500m…",
  braking: "Braking to a stop…",
  hotLap: "Setting a hot lap…",
};

// Before a braking run actually starts, the car holds its speed so the
// driver hears the engine settled in - then a short countdown - before the
// brakes come on. Purely presentational: the recorded result only covers
// the braking phase itself.
const BRAKING_CRUISE_DURATION_MS = 5000;
const COUNTDOWN_STEP_MS = 1000;

type Phase = "cruise" | "countdown" | "running";

export default function SimulationRunner({
  engine,
  chassis,
  gearbox,
  test,
  audioEngine,
  onComplete,
  onRestart,
}: SimulationRunnerProps) {
  const result = useMemo(
    () => simulate(engine, chassis, gearbox, test),
    [engine, chassis, gearbox, test],
  );
  const isBraking = test.testType === "braking";
  const isHotLap = test.testType === "hotLap";
  const isClutchDump = isClutchDumpLaunch(test);
  const circuit = useMemo(() => (isHotLap ? getCircuit(test.circuitId) : null), [isHotLap, test.circuitId]);
  const hasBrakeTemp = useMemo(
    () => result.telemetry.some((s) => s.brakeTempC !== undefined),
    [result.telemetry],
  );
  const peakBrakeTempC = useMemo(
    () => Math.max(0, ...result.telemetry.map((s) => s.brakeTempC ?? 0)),
    [result.telemetry],
  );
  const cruiseState = useMemo(
    () =>
      isBraking ? computeCruiseState(engine, chassis, gearbox, test.initialSpeedKph) : null,
    [isBraking, engine, chassis, gearbox, test.initialSpeedKph],
  );
  const cruiseSample: Telemetry | null = cruiseState && {
    t: 0,
    speedKph: test.initialSpeedKph,
    rpm: cruiseState.rpm,
    gear: cruiseState.gear,
    hp: 0,
    torqueNm: 0,
    gForce: 0,
    distanceM: 0,
    brakeTempC: test.initialBrakeTempC,
  };

  // While a clutch-dump launch counts down, the engine is held revved at
  // launch rpm (clutch slipping, wheels still at a standstill) rather than
  // idling - the tach, audio, and stat panel should all reflect that hold.
  const curves = useMemo(() => buildEngineCurves(engine), [engine]);
  const launchRpm = useMemo(() => computeLaunchRpm(curves), [curves]);
  const revSample: Telemetry | null = isClutchDump
    ? {
        t: 0,
        speedKph: 0,
        rpm: launchRpm,
        gear: 1,
        hp: curves.powerAt(launchRpm),
        torqueNm: curves.torqueAt(launchRpm),
        gForce: 0,
        distanceM: 0,
      }
    : null;

  const showsCountdown = isBraking || isClutchDump;

  const [phase, setPhase] = useState<Phase>(
    isBraking ? "cruise" : isClutchDump ? "countdown" : "running",
  );
  const [countdown, setCountdown] = useState<number | null>(isClutchDump ? 3 : null);
  const [current, setCurrent] = useState<Telemetry | null>(result.telemetry[0] ?? null);
  const [isPaused, setIsPaused] = useState(false);
  const rafRef = useRef<number | null>(null);
  // How far into the "running" phase's telemetry playback we'd gotten when
  // paused, so resuming picks up from there instead of jumping back to 0.
  const elapsedRef = useRef(0);

  // Lead-in: hold the cruise speed and let the engine note settle for a few
  // seconds, then kick off the countdown.
  useEffect(() => {
    if (!isBraking || phase !== "cruise" || !cruiseSample) return;
    audioEngine.update(cruiseSample.rpm, engine.redlineRpm);
    const timer = setTimeout(() => {
      setCountdown(3);
      setPhase("countdown");
    }, BRAKING_CRUISE_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBraking, phase, cruiseState]);

  // Held revs: a clutch-dump launch skips straight into the countdown (no
  // cruise lead-in - the car is stationary, clutch in, engine revved to
  // launch rpm) and keeps the audio pinned there for as long as it lasts.
  useEffect(() => {
    if (!isClutchDump || phase !== "countdown") return;
    audioEngine.update(launchRpm, engine.redlineRpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClutchDump, phase, launchRpm]);

  // Countdown: 3, 2, 1, then GO!/BRAKE! and the run itself start in the same
  // instant - no lag between the readout hitting zero and the car actually
  // moving. The readout is left up there a moment longer purely for
  // legibility; that lingering doesn't delay the run, which already started.
  useEffect(() => {
    if (!showsCountdown || phase !== "countdown") return;
    const timers = [1, 2].map((step) =>
      setTimeout(() => setCountdown(3 - step), step * COUNTDOWN_STEP_MS),
    );
    const launch = setTimeout(() => {
      setCountdown(0);
      setPhase("running");
    }, 3 * COUNTDOWN_STEP_MS);
    const clearReadout = setTimeout(
      () => setCountdown(null),
      3 * COUNTDOWN_STEP_MS + COUNTDOWN_STEP_MS * 0.6,
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(launch);
      clearTimeout(clearReadout);
    };
  }, [showsCountdown, phase]);

  useEffect(() => {
    if (showsCountdown && phase !== "running") return;
    if (isPaused) return;

    const telemetry = result.telemetry;
    if (telemetry.length === 0) {
      audioEngine.stop();
      onComplete(result);
      return;
    }

    const totalDurationS = telemetry[telemetry.length - 1].t;
    let startTime: number | null = null;
    let completed = false;

    const tick = (now: number) => {
      // Resume from wherever we left off if this run was paused mid-way.
      if (startTime === null) startTime = now - elapsedRef.current * 1000;
      const elapsedS = (now - startTime) / 1000;
      elapsedRef.current = elapsedS;

      const index = Math.min(
        telemetry.length - 1,
        Math.max(0, Math.round((elapsedS / totalDurationS) * (telemetry.length - 1))),
      );
      const sample = telemetry[index];
      setCurrent(sample);
      audioEngine.update(sample.rpm, engine.redlineRpm);

      if (elapsedS < totalDurationS) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!completed) {
        completed = true;
        audioEngine.stop();
        onComplete(result);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, showsCountdown, phase, isPaused]);

  const handleTogglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) audioEngine.pause();
      else audioEngine.resume();
      return next;
    });
  };

  // A hot lap's final speed is just wherever the last corner leaves off, not
  // the fastest point on track - size the gauge off the lap's actual top
  // speed instead so it doesn't clip the straights.
  const referenceSpeedKph = isHotLap
    ? Math.max(...result.telemetry.map((s) => s.speedKph), result.finalSpeedKph)
    : result.finalSpeedKph;
  const maxSpeedKph = Math.max(180, Math.ceil((referenceSpeedKph * 1.15) / 20) * 20);
  const displaySample = phase === "running" ? current : (cruiseSample ?? revSample);

  const headline =
    phase === "cruise"
      ? `Cruising at ${test.initialSpeedKph} kph…`
      : phase === "countdown"
        ? isClutchDump
          ? "Revving, clutch held…"
          : "Get ready to brake…"
        : RUNNING_LABELS[test.testType];

  const countdownLabel = isClutchDump ? "GO!" : "BRAKE!";

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold text-zinc-50">{headline}</h2>
      {countdown !== null && (
        <div className="text-8xl font-mono font-black text-amber-400 tabular-nums -mt-4">
          {countdown === 0 ? countdownLabel : countdown}
        </div>
      )}
      <div className="flex gap-2 -mt-2">
        <button
          type="button"
          onClick={handleTogglePause}
          disabled={phase !== "running"}
          className="px-4 py-1.5 rounded-lg text-sm font-mono border border-zinc-700 text-zinc-300 bg-zinc-900/40 backdrop-blur-sm transition-colors hover:border-amber-500 hover:text-amber-400 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-6 py-3 font-medium transition-colors"
        >
          ↻ Restart
        </button>
      </div>
      <Gauges
        rpm={displaySample?.rpm ?? 0}
        redlineRpm={engine.redlineRpm}
        speedKph={displaySample?.speedKph ?? 0}
        maxSpeedKph={maxSpeedKph}
        gear={displaySample?.gear}
      />
      {isHotLap && circuit && (
        <CircuitMap
          circuit={circuit}
          progress={(displaySample?.distanceM ?? 0) / circuit.lengthM}
        />
      )}
      <LiveStatsPanel telemetry={displaySample} useLapTimeFormat={isHotLap} />
      <TimeSeriesGraph
        telemetry={result.telemetry}
        currentT={displaySample?.t ?? 0}
        getValue={(s) => s.speedKph}
        peakValue={referenceSpeedKph}
        color="#22d3ee"
        label="Speed (kph)"
      />
      <TimeSeriesGraph
        telemetry={result.telemetry}
        currentT={displaySample?.t ?? 0}
        getValue={(s) => s.hp}
        peakValue={result.peakHp}
        color="#9085e9"
        label="Power (hp)"
      />
      {hasBrakeTemp && (
        <TimeSeriesGraph
          telemetry={result.telemetry}
          currentT={displaySample?.t ?? 0}
          getValue={(s) => s.brakeTempC ?? 0}
          peakValue={peakBrakeTempC}
          color="#fb923c"
          label="Brake Temp (°C)"
        />
      )}
    </div>
  );
}
