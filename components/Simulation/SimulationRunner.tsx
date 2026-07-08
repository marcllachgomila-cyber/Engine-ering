"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { simulate } from "@/lib/physics/simulate";
import { ChassisConfig, EngineConfig, SimulationResult, Telemetry, TestConfig } from "@/lib/physics/types";
import { EngineAudioEngine } from "@/lib/audio/EngineAudioEngine";
import Gauges from "./Gauges";
import LiveStatsPanel from "./LiveStatsPanel";
import PowerGraph from "./PowerGraph";

interface SimulationRunnerProps {
  engine: EngineConfig;
  chassis: ChassisConfig;
  test: TestConfig;
  audioEngine: EngineAudioEngine;
  onComplete: (result: SimulationResult) => void;
}

const RUNNING_LABELS: Record<TestConfig["testType"], string> = {
  zeroToHundred: "Running 0–100 kph…",
  tenSecond: "Accelerating for 10s…",
  drag500m: "Running the 500m…",
};

export default function SimulationRunner({
  engine,
  chassis,
  test,
  audioEngine,
  onComplete,
}: SimulationRunnerProps) {
  const result = useMemo(() => simulate(engine, chassis, test), [engine, chassis, test]);
  const [current, setCurrent] = useState<Telemetry | null>(
    result.telemetry[0] ?? null,
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
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
  }, [result]);

  const maxSpeedKph = Math.max(180, Math.ceil((result.finalSpeedKph * 1.15) / 20) * 20);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold text-slate-50">
        {RUNNING_LABELS[test.testType]}
      </h2>
      <Gauges
        rpm={current?.rpm ?? 0}
        redlineRpm={engine.redlineRpm}
        speedKph={current?.speedKph ?? 0}
        maxSpeedKph={maxSpeedKph}
      />
      <LiveStatsPanel telemetry={current} />
      <PowerGraph
        telemetry={result.telemetry}
        currentT={current?.t ?? 0}
        peakHp={result.peakHp}
      />
    </div>
  );
}
