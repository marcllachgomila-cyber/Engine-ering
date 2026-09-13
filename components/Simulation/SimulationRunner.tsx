"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCircuit } from "@/lib/physics/circuits";
import { computeCruiseState, simulate } from "@/lib/physics/simulate";
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
const BRAKING_COUNTDOWN_STEP_MS = 1000;

type Phase = "cruise" | "countdown" | "running";

export default function SimulationRunner({
  engine,
  chassis,
  gearbox,
  test,
  audioEngine,
  onComplete,
}: SimulationRunnerProps) {
  const result = useMemo(
    () => simulate(engine, chassis, gearbox, test),
    [engine, chassis, gearbox, test],
  );
  const isBraking = test.testType === "braking";
  const isHotLap = test.testType === "hotLap";
  const circuit = useMemo(() => (isHotLap ? getCircuit(test.circuitId) : null), [isHotLap, test.circuitId]);
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

  const [phase, setPhase] = useState<Phase>(isBraking ? "cruise" : "running");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [current, setCurrent] = useState<Telemetry | null>(result.telemetry[0] ?? null);
  const rafRef = useRef<number | null>(null);

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

  // Countdown: 3, 2, 1, 0 - then the braking run itself starts.
  useEffect(() => {
    if (!isBraking || phase !== "countdown") return;
    const timers = [1, 2, 3].map((step) =>
      setTimeout(() => setCountdown(3 - step), step * BRAKING_COUNTDOWN_STEP_MS),
    );
    const finish = setTimeout(() => {
      setCountdown(null);
      setPhase("running");
    }, 3 * BRAKING_COUNTDOWN_STEP_MS + BRAKING_COUNTDOWN_STEP_MS * 0.6);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [isBraking, phase]);

  useEffect(() => {
    if (isBraking && phase !== "running") return;

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
      if (startTime === null) startTime = now;
      const elapsedS = (now - startTime) / 1000;

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
  }, [result, isBraking, phase]);

  // A hot lap's final speed is just wherever the last corner leaves off, not
  // the fastest point on track - size the gauge off the lap's actual top
  // speed instead so it doesn't clip the straights.
  const referenceSpeedKph = isHotLap
    ? Math.max(...result.telemetry.map((s) => s.speedKph), result.finalSpeedKph)
    : result.finalSpeedKph;
  const maxSpeedKph = Math.max(180, Math.ceil((referenceSpeedKph * 1.15) / 20) * 20);
  const displaySample = phase === "running" ? current : cruiseSample;

  const headline =
    phase === "cruise"
      ? `Cruising at ${test.initialSpeedKph} kph…`
      : phase === "countdown"
        ? "Get ready to brake…"
        : RUNNING_LABELS[test.testType];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold text-zinc-50">{headline}</h2>
      {phase === "countdown" && countdown !== null && (
        <div className="text-8xl font-mono font-black text-amber-400 tabular-nums -mt-4">
          {countdown === 0 ? "BRAKE!" : countdown}
        </div>
      )}
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
      <LiveStatsPanel telemetry={displaySample} />
      <TimeSeriesGraph
        telemetry={result.telemetry}
        currentT={displaySample?.t ?? 0}
        getValue={(s) => s.hp}
        peakValue={result.peakHp}
        color="#9085e9"
        label="Power (hp)"
      />
    </div>
  );
}
