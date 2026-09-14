"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  ChassisConfig,
  EngineConfig,
  GearboxConfig,
  MatchResult,
  SimulationResult,
  TestConfig,
} from "@/lib/physics/types";
import {
  DEFAULT_CHASSIS,
  DEFAULT_ENGINE,
  DEFAULT_GEARBOX,
  DEFAULT_TEST_CONFIG,
} from "@/lib/physics/defaults";
import { EngineAudioEngine } from "@/lib/audio/EngineAudioEngine";
import { findClosestCars } from "@/lib/matching/matchCars";
import { simulate } from "@/lib/physics/simulate";
import {
  addFavorite,
  getFavoritesServerSnapshot,
  getFavoritesSnapshot,
  removeFavorite,
  subscribeFavorites,
} from "@/lib/favorites";
import ChassisForm from "./EngineBuilder/ChassisForm";
import EngineForm from "./EngineBuilder/EngineForm";
import GearboxForm from "./EngineBuilder/GearboxForm";
import TestForm from "./EngineBuilder/TestForm";
import EnginePreview from "./EngineBuilder/EnginePreview";
import TipsBox from "./EngineBuilder/TipsBox";
import StepNav from "./EngineBuilder/StepNav";
import SimulationRunner from "./Simulation/SimulationRunner";
import ResultsSummary from "./Simulation/ResultsSummary";
import MatchList from "./Matches/MatchList";
import FavoritesList from "./Favorites/FavoritesList";
import HowItWorks from "./HowItWorks/HowItWorks";

type Step = "chassis" | "engine" | "gearbox" | "test" | "simulate" | "results" | "favorites";

export default function EngineBuilderApp() {
  const [step, setStep] = useState<Step>("chassis");
  const [chassis, setChassis] = useState<ChassisConfig>(DEFAULT_CHASSIS);
  const [engine, setEngine] = useState<EngineConfig>(DEFAULT_ENGINE);
  const [gearbox, setGearbox] = useState<GearboxConfig>(DEFAULT_GEARBOX);
  const [test, setTest] = useState<TestConfig>(DEFAULT_TEST_CONFIG);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [audioEngine, setAudioEngine] = useState<EngineAudioEngine | null>(null);
  const [saved, setSaved] = useState(false);
  const [previousStep, setPreviousStep] = useState<Step>("chassis");
  const [skipHotLapAnimation, setSkipHotLapAnimation] = useState(false);

  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getFavoritesServerSnapshot,
  );

  const handleComplete = useCallback(
    (simResult: SimulationResult) => {
      setResult(simResult);
      setMatches(findClosestCars(engine, simResult));
      setStep("results");
    },
    [engine],
  );

  const handleRunTest = useCallback(() => {
    // A hot lap's whole result is already computed up front (the live run
    // just replays its telemetry in real time) - skipping straight to the
    // results screen is just skipping that replay, not re-simulating.
    if (test.testType === "hotLap" && skipHotLapAnimation) {
      setSaved(false);
      handleComplete(simulate(engine, chassis, gearbox, test));
      return;
    }
    const audio = new EngineAudioEngine(engine);
    audio.start();
    setAudioEngine(audio);
    setSaved(false);
    setStep("simulate");
  }, [engine, chassis, gearbox, test, skipHotLapAnimation, handleComplete]);

  const handleReset = useCallback(() => {
    audioEngine?.dispose();
    setAudioEngine(null);
    setResult(null);
    setMatches([]);
    setStep("chassis");
  }, [audioEngine]);

  const handleSaveFavorite = useCallback(() => {
    if (!result) return;
    addFavorite(engine, chassis, gearbox, test, result, matches[0]?.car ?? null);
    setSaved(true);
  }, [engine, chassis, gearbox, test, result, matches]);

  const handleRemoveFavorite = useCallback((id: string) => {
    removeFavorite(id);
  }, []);

  const openFavorites = useCallback(() => {
    setPreviousStep(step === "favorites" ? previousStep : step);
    setStep("favorites");
  }, [step, previousStep]);

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/10 bg-zinc-950/45 backdrop-blur-md">
        <div className="font-mono font-bold text-zinc-200 tracking-tight">
          Engine Builder - Marc Llach Gomila
        </div>
        <button
          type="button"
          onClick={openFavorites}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            step === "favorites"
              ? "bg-amber-500 border-amber-500 text-zinc-950"
              : "border-zinc-700 text-zinc-300 hover:border-zinc-500 bg-zinc-900/40"
          }`}
        >
          &#9733; Favorites ({favorites.length})
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {(step === "chassis" || step === "engine" || step === "gearbox" || step === "test") && (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
            <div className="w-full max-w-3xl mx-auto lg:mx-0">
              <StepNav current={step} onNavigate={(s) => setStep(s)} />
              {step === "chassis" && (
                <ChassisForm
                  value={chassis}
                  onChange={setChassis}
                  onContinue={() => setStep("engine")}
                />
              )}
              {step === "engine" && (
                <EngineForm
                  value={engine}
                  onChange={setEngine}
                  onContinue={() => setStep("gearbox")}
                />
              )}
              {step === "gearbox" && (
                <GearboxForm
                  value={gearbox}
                  onChange={setGearbox}
                  onContinue={() => setStep("test")}
                />
              )}
              {step === "test" && (
                <TestForm
                  value={test}
                  onChange={setTest}
                  onSubmit={handleRunTest}
                  skipHotLapAnimation={skipHotLapAnimation}
                  onSkipHotLapAnimationChange={setSkipHotLapAnimation}
                />
              )}
            </div>
            <div className="lg:sticky lg:top-8 space-y-6">
              <div className="flex flex-col items-center">
                <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
                  Live Preview
                </div>
                <div className="w-full h-72 relative">
                  <div className="absolute inset-x-8 bottom-4 h-8 rounded-full bg-black/50 blur-xl" />
                  <EnginePreview engine={engine} />
                </div>
              </div>
              {(step === "chassis" || step === "engine") && <TipsBox />}
            </div>
          </div>
        )}

        {step === "simulate" && audioEngine && (
          <SimulationRunner
            engine={engine}
            chassis={chassis}
            gearbox={gearbox}
            test={test}
            audioEngine={audioEngine}
            onComplete={handleComplete}
          />
        )}
        {step === "results" && result && (
          <div className="w-full flex flex-col items-center gap-10">
            <ResultsSummary engine={engine} chassis={chassis} gearbox={gearbox} result={result} />
            <MatchList matches={matches} />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSaveFavorite}
                disabled={saved}
                className={`rounded-xl px-6 py-3 font-medium transition-colors ${
                  saved
                    ? "border border-zinc-700 text-zinc-500 cursor-default"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                }`}
              >
                {saved ? "★ Saved to Favorites" : "☆ Save to Favorites"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-200 px-6 py-3 font-medium transition-colors"
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
              className="rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-200 px-6 py-3 font-medium transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
      <footer className="px-4 sm:px-8 py-4 text-center text-xs text-zinc-500 border-t border-white/10">
        Built by Marc Llach Gomila
      </footer>
      <HowItWorks />
    </div>
  );
}
