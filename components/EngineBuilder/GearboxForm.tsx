"use client";

import { useMemo } from "react";
import { recommendedGearRatios, MAX_GEAR_RATIO, MIN_GEAR_RATIO } from "@/lib/physics/gearRatios";
import { buildEngineCurves } from "@/lib/physics/engineModel";
import { deriveVehicle } from "@/lib/physics/vehicleModel";
import { computeTractiveForceData } from "@/lib/physics/tractiveForce";
import {
  AutoShiftStrategy,
  ChassisConfig,
  Drivetrain,
  EngineConfig,
  GearboxConfig,
  TransmissionType,
} from "@/lib/physics/types";
import { ContinueButton, OptionButton, SectionCard, StepHeader } from "./FormControls";
import TractiveForceGraph from "../Simulation/TractiveForceGraph";

const GEAR_COUNT_OPTIONS = [5, 6, 7, 8];

const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  manual: "Manual",
  auto: "Automatic",
};

const DRIVETRAIN_LABELS: Record<Drivetrain, string> = {
  fwd: "Front-Wheel Drive",
  rwd: "Rear-Wheel Drive",
};

const AUTO_SHIFT_LABELS: Record<AutoShiftStrategy, string> = {
  maxRpm: "Max RPM",
  maxTorque: "Max Torque",
  maxPower: "Max Power",
};

const AUTO_SHIFT_DESCRIPTIONS: Record<AutoShiftStrategy, string> = {
  maxRpm: "Holds every gear to the rev limiter before shifting - best for outright acceleration.",
  maxTorque: "Shifts as soon as peak torque passes - keeps the engine pulling hardest, at the cost of some top-end.",
  maxPower: "Shifts at peak power - the fastest way from one corner to the next.",
};

interface GearboxFormProps {
  value: GearboxConfig;
  onChange: (config: GearboxConfig) => void;
  onContinue: () => void;
  engine: EngineConfig;
  chassis: ChassisConfig;
}

export default function GearboxForm({ value, onChange, onContinue, engine, chassis }: GearboxFormProps) {
  const recommended = recommendedGearRatios(value.gearCount);

  const tractiveData = useMemo(() => {
    const curves = buildEngineCurves(engine);
    const vehicle = deriveVehicle(engine, curves, chassis, value);
    return computeTractiveForceData(curves, vehicle);
  }, [engine, chassis, value]);

  const setGearCount = (gearCount: number) => {
    onChange({ ...value, gearCount, gearRatios: recommendedGearRatios(gearCount) });
  };

  const setGearRatio = (index: number, ratio: number) => {
    const gearRatios = value.gearRatios.slice();
    gearRatios[index] = ratio;
    onChange({ ...value, gearRatios });
  };

  const resetGearRatios = () => {
    onChange({ ...value, gearRatios: recommendedGearRatios(value.gearCount) });
  };

  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 3 of 4"
        title="Choose Your Gearbox"
        description="Set the transmission, gear ratios, and which wheels put the power down."
      />

      <SectionCard title="Transmission">
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TRANSMISSION_LABELS) as TransmissionType[]).map((t) => (
              <OptionButton
                key={t}
                active={value.transmissionType === t}
                onClick={() => onChange({ ...value, transmissionType: t })}
              >
                {TRANSMISSION_LABELS[t]}
              </OptionButton>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Automatic lets you pick when it shifts below; manual assumes a
            driver who takes every gear to the limiter.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Clutch
          </label>
          <div className="flex flex-wrap gap-2">
            <OptionButton
              active={value.dualClutch}
              onClick={() => onChange({ ...value, dualClutch: true })}
            >
              Dual Clutch
            </OptionButton>
            <OptionButton
              active={!value.dualClutch}
              onClick={() => onChange({ ...value, dualClutch: false })}
            >
              Single Clutch
            </OptionButton>
          </div>
        </div>

        {value.transmissionType === "auto" && (
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Shift Strategy
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(AUTO_SHIFT_LABELS) as AutoShiftStrategy[]).map((s) => (
                <OptionButton
                  key={s}
                  active={value.autoShiftStrategy === s}
                  onClick={() => onChange({ ...value, autoShiftStrategy: s })}
                >
                  {AUTO_SHIFT_LABELS[s]}
                </OptionButton>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {AUTO_SHIFT_DESCRIPTIONS[value.autoShiftStrategy]}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Gearbox">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Gears</label>
            <span className="text-lg font-mono text-amber-400">{value.gearCount}-speed</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GEAR_COUNT_OPTIONS.map((g) => (
              <OptionButton
                key={g}
                active={value.gearCount === g}
                onClick={() => setGearCount(g)}
              >
                {g}
              </OptionButton>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Changing gear count resets the ratios below to the recommended spread.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Drivetrain
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DRIVETRAIN_LABELS) as Drivetrain[]).map((d) => (
              <OptionButton
                key={d}
                active={value.drivetrain === d}
                onClick={() => onChange({ ...value, drivetrain: d })}
              >
                {DRIVETRAIN_LABELS[d]}
              </OptionButton>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            RWD gets a traction boost from weight shifting onto the drive
            wheels under acceleration; FWD loses a little grip the same way.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Gear Ratios">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-zinc-500">
            Lower numbers are taller gears (higher top speed, less
            acceleration); higher numbers are shorter (more acceleration,
            lower top speed).
          </p>
          <button
            type="button"
            onClick={resetGearRatios}
            className="shrink-0 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Reset to Recommended
          </button>
        </div>
        <div className="space-y-4">
          {value.gearRatios.map((ratio, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-sm font-medium text-zinc-300">
                  Gear {i + 1}
                </label>
                <span className="text-lg font-mono text-amber-400">
                  {ratio.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={MIN_GEAR_RATIO}
                max={MAX_GEAR_RATIO}
                step={0.01}
                value={ratio}
                onChange={(e) => setGearRatio(i, parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Recommended: {recommended[i].toFixed(2)}
              </p>
            </div>
          ))}
        </div>
        <TractiveForceGraph data={tractiveData} />
      </SectionCard>

      <ContinueButton onClick={onContinue}>
        Continue to Test Specifications &rarr;
      </ContinueButton>
    </div>
  );
}
