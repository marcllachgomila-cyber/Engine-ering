"use client";

import { useCallback, useState } from "react";
import { EngineConfig, MatchResult, SimulationResult } from "@/lib/physics/types";
import { EngineAudioEngine } from "@/lib/audio/EngineAudioEngine";
import { findClosestCars } from "@/lib/matching/matchCars";
import EngineForm from "./EngineBuilder/EngineForm";
import SimulationRunner from "./Simulation/SimulationRunner";
import ResultsSummary from "./Simulation/ResultsSummary";
import MatchList from "./Matches/MatchList";

type Step = "build" | "simulate" | "results";

const DEFAULT_ENGINE: EngineConfig = {
  cylinders: 4,
  layout: "inline",
  displacementL: 2.0,
  redlineRpm: 7000,
  aspiration: "na",
};

export default function EngineBuilderApp() {
  const [step, setStep] = useState<Step>("build");
  const [engine, setEngine] = useState<EngineConfig>(DEFAULT_ENGINE);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [audioEngine, setAudioEngine] = useState<EngineAudioEngine | null>(null);

  const handleStart = useCallback(() => {
    const audio = new EngineAudioEngine(engine);
    audio.start();
    setAudioEngine(audio);
    setStep("simulate");
  }, [engine]);

  const handleComplete = useCallback(
    (simResult: SimulationResult) => {
      setResult(simResult);
      setMatches(findClosestCars(engine, simResult));
      setStep("results");
    },
    [engine],
  );

  const handleReset = useCallback(() => {
    audioEngine?.dispose();
    setAudioEngine(null);
    setResult(null);
    setMatches([]);
    setStep("build");
  }, [audioEngine]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      {step === "build" && (
        <EngineForm value={engine} onChange={setEngine} onSubmit={handleStart} />
      )}
      {step === "simulate" && audioEngine && (
        <SimulationRunner
          engine={engine}
          audioEngine={audioEngine}
          onComplete={handleComplete}
        />
      )}
      {step === "results" && result && (
        <div className="w-full flex flex-col items-center gap-10">
          <ResultsSummary engine={engine} result={result} />
          <MatchList matches={matches} />
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 px-6 py-3 font-medium transition-colors"
          >
            Build Another Engine
          </button>
        </div>
      )}
    </div>
  );
}
