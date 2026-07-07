"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { EngineConfig, MatchResult, SimulationResult } from "@/lib/physics/types";
import { EngineAudioEngine } from "@/lib/audio/EngineAudioEngine";
import { findClosestCars } from "@/lib/matching/matchCars";
import {
  addFavorite,
  getFavoritesServerSnapshot,
  getFavoritesSnapshot,
  removeFavorite,
  subscribeFavorites,
} from "@/lib/favorites";
import EngineForm from "./EngineBuilder/EngineForm";
import EnginePreview from "./EngineBuilder/EnginePreview";
import TipsBox from "./EngineBuilder/TipsBox";
import SimulationRunner from "./Simulation/SimulationRunner";
import ResultsSummary from "./Simulation/ResultsSummary";
import MatchList from "./Matches/MatchList";
import FavoritesList from "./Favorites/FavoritesList";

type Step = "build" | "simulate" | "results" | "favorites";

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
  const [saved, setSaved] = useState(false);
  const [previousStep, setPreviousStep] = useState<Step>("build");

  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getFavoritesServerSnapshot,
  );

  const handleStart = useCallback(() => {
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
    setStep("build");
  }, [audioEngine]);

  const handleSaveFavorite = useCallback(() => {
    if (!result) return;
    addFavorite(engine, result, matches[0]?.car ?? null);
    setSaved(true);
  }, [engine, result, matches]);

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
        {step === "build" && (
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
            <EngineForm value={engine} onChange={setEngine} onSubmit={handleStart} />
            <div className="lg:sticky lg:top-8 space-y-6">
              <EnginePreview engine={engine} />
              <TipsBox />
            </div>
          </div>
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
