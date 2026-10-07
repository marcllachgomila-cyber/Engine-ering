"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
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
  defaultTyresFor,
} from "@/lib/physics/defaults";
import { buildVehicleState } from "@/lib/physics/vehicleState";
import { gearboxFromPreset, RealCarPreset } from "@/lib/physics/realCars";
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
import { CornerMarks, FOCUS_RING, OptionButton } from "./EngineBuilder/FormControls";
import EngineForm from "./EngineBuilder/EngineForm";
import GearboxForm from "./EngineBuilder/GearboxForm";
import TestForm from "./EngineBuilder/TestForm";
import EnginePreview from "./EngineBuilder/EnginePreview";
import VehiclePreview from "./EngineBuilder/vehicle3d/VehiclePreview";
import WindTunnel2D from "./Aero/WindTunnel2D";
import AeroResults from "./Aero/AeroResults";
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
  const [realCar, setRealCar] = useState<RealCarPreset | null>(null);
  const [test, setTest] = useState<TestConfig>(DEFAULT_TEST_CONFIG);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [audioEngine, setAudioEngine] = useState<EngineAudioEngine | null>(null);
  const [saved, setSaved] = useState(false);
  const [previousStep, setPreviousStep] = useState<Step>("chassis");
  const [skipHotLapAnimation, setSkipHotLapAnimation] = useState(false);
  const [previewMode, setPreviewMode] = useState<"engine" | "vehicle" | "aero">("engine");

  // The whole car as currently configured - one derived snapshot for
  // anything that reads across chassis/engine/gearbox (see vehicleState.ts).
  const vehicle = useMemo(
    () => buildVehicleState(chassis, engine, gearbox, realCar),
    [chassis, engine, gearbox, realCar],
  );

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

  const handleSelectRealCar = useCallback(
    (car: RealCarPreset | null) => {
      setRealCar(car);
      // Active aero belongs to the preset that has it - drop it as soon as
      // that preset is deselected, so a custom build never inherits it.
      if (!car) {
        setChassis((prev) => ({ ...prev, activeAero: undefined }));
        return;
      }
      setChassis((prev) => ({
        ...prev,
        bodyType: car.category,
        weightKg: car.chassis.weightKg,
        frontWheelDiameterIn: car.chassis.frontWheelDiameterIn,
        rearWheelDiameterIn: car.chassis.rearWheelDiameterIn,
        frontWheelWidthMm: car.chassis.frontWheelWidthMm,
        rearWheelWidthMm: car.chassis.rearWheelWidthMm,
        activeAero: car.chassis.activeAero,
        // Presets are the standard car - no bolt-on aero.
        aeroKit: undefined,
        ...defaultTyresFor(car.category),
      }));
      setEngine(car.engine);
      setGearbox(gearboxFromPreset(car));
    },
    [],
  );

  const handleRunTest = useCallback(() => {
    // A hot lap's whole result is already computed up front (the live run
    // just replays its telemetry in real time) - skipping straight to the
    // results screen is just skipping that replay, not re-simulating.
    if (test.testType === "hotLap" && skipHotLapAnimation) {
      audioEngine?.dispose();
      setAudioEngine(null);
      setSaved(false);
      handleComplete(simulate(engine, chassis, gearbox, test));
      return;
    }
    // Dispose the previous run's audio engine (and its AudioContext) up
    // front instead of waiting on its own fade-out timer - re-running a
    // test back-to-back from the results screen would otherwise try to
    // spin up a second AudioContext before the first one finished closing.
    audioEngine?.dispose();
    const audio = new EngineAudioEngine(engine);
    audio.start();
    setAudioEngine(audio);
    setSaved(false);
    setStep("simulate");
  }, [engine, chassis, gearbox, test, skipHotLapAnimation, handleComplete, audioEngine]);

  const handleRestartTest = useCallback(() => {
    audioEngine?.dispose();
    setAudioEngine(null);
    setStep("test");
  }, [audioEngine]);

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
        <div className="flex items-baseline gap-2 font-mono tracking-tight">
          <span className="font-bold text-zinc-50">Engine Builder</span>
          <span className="hidden sm:inline text-xs text-zinc-500">
            by Marc Llach Gomila
          </span>
        </div>
        <button
          type="button"
          onClick={openFavorites}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${FOCUS_RING} ${
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
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
            <div className="order-2 lg:order-1 w-full max-w-3xl mx-auto lg:mx-0">
              <StepNav current={step} onNavigate={(s) => setStep(s)} />
              {step === "chassis" && (
                <ChassisForm
                  value={chassis}
                  onChange={setChassis}
                  onContinue={() => setStep("engine")}
                  realCar={realCar}
                  onSelectRealCar={handleSelectRealCar}
                />
              )}
              {step === "engine" && (
                <EngineForm
                  value={engine}
                  onChange={setEngine}
                  onContinue={() => setStep("gearbox")}
                  realCar={realCar}
                />
              )}
              {step === "gearbox" && (
                <GearboxForm
                  value={gearbox}
                  onChange={setGearbox}
                  onContinue={() => setStep("test")}
                  engine={engine}
                  chassis={chassis}
                  realCar={realCar}
                />
              )}
              {step === "test" && (
                <TestForm
                  value={test}
                  onChange={setTest}
                  onSubmit={handleRunTest}
                  skipHotLapAnimation={skipHotLapAnimation}
                  onSkipHotLapAnimationChange={setSkipHotLapAnimation}
                  chassis={chassis}
                  onChassisChange={setChassis}
                />
              )}
            </div>
            <div className="order-1 lg:order-2 lg:sticky lg:top-8 space-y-6">
              <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md overflow-hidden shadow-[0_0_60px_-12px_rgba(245,158,11,0.5)]">
                <CornerMarks className="border-amber-500/40" />
                <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between gap-3">
                  <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium text-amber-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    Live Preview
                  </span>
                  <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Preview mode">
                    {(["engine", "vehicle", "aero"] as const).map((mode) => (
                      <OptionButton
                        key={mode}
                        active={previewMode === mode}
                        onClick={() => setPreviewMode(mode)}
                        className="px-2! py-0.5! text-xs! capitalize"
                      >
                        {mode}
                      </OptionButton>
                    ))}
                  </div>
                  {/* With three mode buttons there's little room left; the
                      wind tunnel titles itself, and phones skip the label. */}
                  {previewMode !== "aero" && (
                    <span className="hidden min-w-0 text-xs text-zinc-500 uppercase tracking-wider truncate sm:inline">
                      {previewMode === "engine" ? vehicle.engine.sizeLabel : vehicle.identity.displayName}
                    </span>
                  )}
                </div>
                {/* The wind tunnel carries its readout under the flow picture, so
                    it gets a taller panel than the 3D previews. */}
                <div className={`w-full relative ${previewMode === "aero" ? "h-[38rem]" : "h-[26rem]"}`}>
                  {/* Only one preview is mounted at a time, so there's only
                      ever one WebGL context on the page (the wind tunnel
                      uses plain 2D canvas, no WebGL at all). */}
                  {previewMode === "engine" && (
                    <>
                      <div className="absolute inset-x-8 bottom-4 h-8 rounded-full bg-black/50 blur-xl" />
                      <EnginePreview engine={engine} />
                    </>
                  )}
                  {previewMode === "vehicle" && <VehiclePreview vehicle={vehicle} />}
                  {previewMode === "aero" && <WindTunnel2D vehicle={vehicle} />}
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
            onRestart={handleRestartTest}
          />
        )}
        {step === "results" && result && (
          <div className="w-full flex flex-col items-center gap-10">
            <ResultsSummary engine={engine} result={result} />
            <AeroResults
              vehicle={vehicle}
              chassis={chassis}
              engine={engine}
              gearbox={gearbox}
              realCar={realCar}
              test={test}
              result={result}
            />
            <MatchList matches={matches} />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSaveFavorite}
                disabled={saved}
                className={`rounded-xl px-6 py-3 font-medium transition-colors ${FOCUS_RING} ${
                  saved
                    ? "border border-zinc-700 text-zinc-500 cursor-default"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                }`}
              >
                {saved ? "★ Saved to Favorites" : "☆ Save to Favorites"}
              </button>
              <button
                type="button"
                onClick={() => setStep("test")}
                className={`rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-6 py-3 font-medium transition-colors ${FOCUS_RING}`}
              >
                ↻ Run Another Test
              </button>
              <button
                type="button"
                onClick={handleReset}
                className={`rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-6 py-3 font-medium transition-colors ${FOCUS_RING}`}
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
              className={`rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-200 px-6 py-3 font-medium transition-colors ${FOCUS_RING}`}
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
