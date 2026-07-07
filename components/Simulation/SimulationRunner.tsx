"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { simulate } from "@/lib/physics/simulate";
import { EngineConfig, SimulationResult, Telemetry } from "@/lib/physics/types";
import { EngineAudioEngine } from "@/lib/audio/EngineAudioEngine";
import Gauges from "./Gauges";
import LiveStatsPanel from "./LiveStatsPanel";

interface SimulationRunnerProps {
  engine: EngineConfig;
  audioEngine: EngineAudioEngine;
  onComplete: (result: SimulationResult) => void;
}

export default function SimulationRunner({
  engine,
  audioEngine,
  onComplete,
}: SimulationRunnerProps) {
  const result = useMemo(() => simulate(engine), [engine]);
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

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold text-slate-50">
        Running 0–100 kph&hellip;
      </h2>
      <Gauges
        rpm={current?.rpm ?? 0}
        redlineRpm={engine.redlineRpm}
        speedKph={current?.speedKph ?? 0}
      />
      <LiveStatsPanel telemetry={current} />
    </div>
  );
}
