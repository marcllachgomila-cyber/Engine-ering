"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  ChassisConfig,
  EngineConfig,
  MatchResult,
  SimulationResult,
  TestConfig,
} from "@/lib/physics/types";
import { DEFAULT_CHASSIS, DEFAULT_ENGINE, DEFAULT_TEST_CONFIG } from "@/lib/physics/defaults";
import { EngineAudioEngine } from "@/lib/audio/EngineAudioEngine";
import { findClosestCars } from "@/lib/matching/matchCars";
import {
  addFavorite,
  getFavoritesServerSnapshot,
  getFavoritesSnapshot,
  removeFavorite,
  subscribeFavorites,
} from "@/lib/favorites";
import ChassisForm from "./EngineBuilder/ChassisForm";
import EngineForm from "./EngineBuilder/EngineForm";
import TestForm from "./EngineBuilder/TestForm";
import EnginePreview from "./EngineBuilder/EnginePreview";
import TipsBox from "./EngineBuilder/TipsBox";
import SimulationRunner from "./Simulation/SimulationRunner";
import ResultsSummary from "./Simulation/ResultsSummary";
import MatchList from "./Matches/MatchList";
import FavoritesList from "./Favorites/FavoritesList";

type Step = "chassis" | "engine" | "test" | "simulate" | "results" | "favorites";

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-2"
    >
      &larr; {children}
    </button>
  );
}

export default function EngineBuilderApp() {
  const [step, setStep] = useState<Step>("chassis");
  const [chassis, setChassis] = useState<ChassisConfig>(DEFAULT_CHASSIS);
  const [engine, setEngine] = useState<EngineConfig>(DEFAULT_ENGINE);
  const [test, setTest] = useState<TestConfig>(DEFAULT_TEST_CONFIG);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [audioEngine, setAudioEngine] = useState<EngineAudioEngine | null>(null);
  const [saved, setSaved] = useState(false);
  const [previousStep, setPreviousStep] = useState<Step>("chassis");

  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getFavoritesServerSnapshot,
  );

  const handleRunTest = useCallback(() => {
    const audio = new EngineAudioEngine(engine);
    audio.start();
    setAudioEngine(audio);
    setSaved(false);
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
    setStep("chassis");
  }, [audioEngine]);

  const handleSaveFavorite = useCallback(() => {
    if (!result) return;
    addFavorite(engine, chassis, test, result, matches[0]?.car ?? null);
    setSaved(true);
  }, [engine, chassis, test, result, matches]);

  const handleRemoveFavorite = useCallback((id: string) => {
    removeFavorite(id);
  }, []);

  const openFavorites = useCallback(() => {
    setPreviousStep(step === "favorites" ? previousStep : step);
    setStep("favorites");
  }, [step, previousStep]);

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/5">
        <div className="font-mono font-bold text-slate-200 tracking-tight">
          Engine Builder
        </div>
        <button
          type="button"
          onClick={openFavorites}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            step === "favorites"
              ? "bg-amber-500 border-amber-500 text-slate-950"
              : "border-slate-700 text-slate-300 hover:border-slate-500"
          }`}
        >
          &#9733; Favorites ({favorites.length})
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {step === "chassis" && (
          <div className="w-full max-w-3xl">
            <ChassisForm
              value={chassis}
              onChange={setChassis}
              onContinue={() => setStep("engine")}
            />
          </div>
        )}

        {step === "engine" && (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
            <div>
              <BackLink onClick={() => setStep("chassis")}>Back to Chassis</BackLink>
              <EngineForm
                value={engine}
                onChange={setEngine}
                onContinue={() => setStep("test")}
              />
            </div>
            <div className="lg:sticky lg:top-8 space-y-6">
              <div className="flex flex-col items-center">
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Live Preview
                </div>
                <div className="w-full h-96 relative">
                  <div className="absolute inset-x-8 bottom-4 h-8 rounded-full bg-black/50 blur-xl" />
                  <EnginePreview engine={engine} />
                </div>
              </div>
              <TipsBox />
            </div>
          </div>
        )}

        {step === "test" && (
          <div className="w-full max-w-3xl">
            <BackLink onClick={() => setStep("engine")}>Back to Engine</BackLink>
            <TestForm value={test} onChange={setTest} onSubmit={handleRunTest} />
          </div>
        )}

        {step === "simulate" && audioEngine && (
          <SimulationRunner
            engine={engine}
            chassis={chassis}
            test={test}
            audioEngine={audioEngine}
            onComplete={handleComplete}
          />
        )}
        {step === "results" && result && (
          <div className="w-full flex flex-col items-center gap-10">
            <ResultsSummary engine={engine} result={result} />
            <MatchList matches={matches} />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSaveFavorite}
                disabled={saved}
                className={`rounded-xl px-6 py-3 font-medium transition-colors ${
                  saved
                    ? "border border-slate-700 text-slate-500 cursor-default"
                    : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                }`}
              >
                {saved ? "★ Saved to Favorites" : "☆ Save to Favorites"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 px-6 py-3 font-medium transition-colors"
              >
                Build Another Engine
              </button>
            </div>
          </div>
        )}
        {step === "favorites" && (
          <div className="w-full flex flex-col items-center gap-8">
            <FavoritesList favorites={favorites} onRemove={handleRemoveFavorite} />
            <button
              type="button"
              onClick={() => setStep(previousStep)}
              className="rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 px-6 py-3 font-medium transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
