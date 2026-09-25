"use client";

import { useMemo } from "react";
import { EngineConfig, EngineLayout, FuelType } from "@/lib/physics/types";
import {
  DEFAULT_ENGINE,
  DEFAULT_ROTARY_ENGINE,
  DIESEL_MAX_REDLINE_RPM,
} from "@/lib/physics/defaults";
import {
  isRotary,
  ROTARY_MAX_L_PER_ROTOR,
  ROTARY_MIN_L_PER_ROTOR,
  ROTOR_OPTIONS,
} from "@/lib/physics/engineLayout";
import { RealCarPreset } from "@/lib/physics/realCars";
import { buildEngineCurves } from "@/lib/physics/engineModel";
import CombustionFrictionGraph from "../Simulation/CombustionFrictionGraph";
import {
  ContinueButton,
  formatUnitValue,
  OptionButton,
  SectionCard,
  Slider,
  StepHeader,
} from "./FormControls";

const CYLINDER_OPTIONS = [3, 4, 5, 6, 8, 10, 12, 16];

// Piston layouts only - "rotary" is chosen via the engine type toggle.
const PISTON_LAYOUTS: EngineLayout[] = ["inline", "v", "flat", "w"];

const VALID_LAYOUTS: Record<number, EngineLayout[]> = {
  3: ["inline"],
  4: ["inline", "flat"],
  5: ["inline"],
  6: ["inline", "v", "flat"],
  8: ["v"],
  10: ["v"],
  12: ["v"],
  16: ["v", "w"],
};

const LAYOUT_LABELS: Record<EngineLayout, string> = {
  inline: "Inline",
  v: "V",
  flat: "Flat / Boxer",
  w: "W",
  rotary: "Rotary",
};

type EngineType = "piston" | "rotary";

const ENGINE_TYPE_LABELS: Record<EngineType, string> = {
  piston: "Piston",
  rotary: "Rotary (Wankel)",
};

const PISTON_DISPLACEMENT_MIN_L = 0.6;
const PISTON_DISPLACEMENT_MAX_L = 8.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

const ASPIRATION_LABELS: Record<EngineConfig["aspiration"], string> = {
  na: "Naturally Aspirated",
  turbo: "Turbocharged",
  supercharged: "Supercharged",
};

const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
};

const MAX_REV_OVER_REDLINE_CAP = 1500;

interface EngineFormProps {
  value: EngineConfig;
  onChange: (config: EngineConfig) => void;
  onContinue: () => void;
  realCar: RealCarPreset | null;
}

export default function EngineForm({ value, onChange, onContinue, realCar }: EngineFormProps) {
  const rotary = isRotary(value);
  const validLayouts = VALID_LAYOUTS[value.cylinders] ?? ["inline"];
  const redlineMax = value.fuelType === "diesel" ? DIESEL_MAX_REDLINE_RPM : 13500;
  const displacementMin = rotary
    ? roundToTenth(ROTARY_MIN_L_PER_ROTOR * value.cylinders)
    : PISTON_DISPLACEMENT_MIN_L;
  const displacementMax = rotary
    ? roundToTenth(ROTARY_MAX_L_PER_ROTOR * value.cylinders)
    : PISTON_DISPLACEMENT_MAX_L;
  const curves = useMemo(() => buildEngineCurves(value), [value]);

  // Switching type swaps in that type's default architecture (count,
  // layout, displacement, redline) but keeps aspiration - the rest of the
  // piston/rotary ranges don't overlap well enough to carry over.
  const setEngineType = (type: EngineType) => {
    if (type === (rotary ? "rotary" : "piston")) return;
    const base = type === "rotary" ? DEFAULT_ROTARY_ENGINE : DEFAULT_ENGINE;
    onChange({
      ...value,
      cylinders: base.cylinders,
      layout: base.layout,
      displacementL: base.displacementL,
      redlineRpm: base.redlineRpm,
      maxRevRpm: base.maxRevRpm,
      fuelType: "petrol",
    });
  };

  // Keeps the per-rotor chamber size when adding/removing rotors, the way
  // Mazda built its 2/3/4-rotor engines from the same 654cc rotor.
  const setRotors = (rotors: number) => {
    const perRotorL = value.displacementL / value.cylinders;
    const displacementL = clamp(
      roundToTenth(perRotorL * rotors),
      roundToTenth(ROTARY_MIN_L_PER_ROTOR * rotors),
      roundToTenth(ROTARY_MAX_L_PER_ROTOR * rotors),
    );
    onChange({ ...value, cylinders: rotors, displacementL });
  };

  const setCylinders = (cylinders: number) => {
    const layouts = VALID_LAYOUTS[cylinders] ?? ["inline"];
    const layout = layouts.includes(value.layout) ? value.layout : layouts[0];
    onChange({ ...value, cylinders, layout });
  };

  const setFuelType = (fuelType: FuelType) => {
    const redlineRpm =
      fuelType === "diesel"
        ? Math.min(value.redlineRpm, DIESEL_MAX_REDLINE_RPM)
        : value.redlineRpm;
    const maxRevRpm = Math.max(value.maxRevRpm, redlineRpm);
    onChange({ ...value, fuelType, redlineRpm, maxRevRpm });
  };

  const setRedline = (redlineRpm: number) => {
    const maxRevRpm = Math.max(value.maxRevRpm, redlineRpm);
    onChange({ ...value, redlineRpm, maxRevRpm });
  };

  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 2 of 4"
        title="Build Your Engine"
        description="Configure the powerplant that goes under the hood."
      />

      <SectionCard title="Engine" tag="ENG-01">
        {realCar && (
          <p className="text-xs text-amber-400/90">
            Engine specs are locked to the {realCar.make} {realCar.model}. Go
            back to Step 1 and choose &ldquo;Custom Build&rdquo; to edit them
            yourself.
          </p>
        )}
        <fieldset
          disabled={!!realCar}
          className={`space-y-8 ${realCar ? "opacity-50" : ""}`}
        >
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Engine Type</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ENGINE_TYPE_LABELS) as EngineType[]).map((type) => (
              <OptionButton
                key={type}
                active={(rotary ? "rotary" : "piston") === type}
                onClick={() => setEngineType(type)}
              >
                {ENGINE_TYPE_LABELS[type]}
              </OptionButton>
            ))}
          </div>
          {rotary && (
            <p className="text-xs text-zinc-500 mt-2">
              Each rotor fires once per shaft turn, twice as often as a piston cylinder, so a
              1.3L rotary pulls like a much bigger piston engine. It&rsquo;s also light and loves
              to rev, but low-end torque is weak.
            </p>
          )}
        </div>

        {rotary ? (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-medium text-zinc-300">Rotors</label>
              <span className="text-lg font-mono text-amber-400">{value.cylinders}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ROTOR_OPTIONS.map((r) => (
                <OptionButton key={r} active={value.cylinders === r} onClick={() => setRotors(r)}>
                  {r}
                </OptionButton>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300">Cylinders</label>
                <span className="text-lg font-mono text-amber-400">{value.cylinders}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CYLINDER_OPTIONS.map((c) => (
                  <OptionButton key={c} active={value.cylinders === c} onClick={() => setCylinders(c)}>
                    {c}
                  </OptionButton>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">Layout</label>
              <div className="flex flex-wrap gap-2">
                {PISTON_LAYOUTS.map((layout) => (
                  <OptionButton
                    key={layout}
                    active={value.layout === layout}
                    disabled={!validLayouts.includes(layout)}
                    onClick={() => onChange({ ...value, layout })}
                  >
                    {LAYOUT_LABELS[layout]}
                  </OptionButton>
                ))}
              </div>
            </div>
          </>
        )}

        <Slider
          label="Displacement"
          value={value.displacementL}
          valueLabel={formatUnitValue(value.displacementL, "L", 1)}
          min={displacementMin}
          max={displacementMax}
          step={0.1}
          onChange={(v) => onChange({ ...value, displacementL: v })}
          minLabel={formatUnitValue(displacementMin, "L", 1)}
          maxLabel={formatUnitValue(displacementMax, "L", 1)}
          helpText={
            rotary
              ? `${formatUnitValue(Math.round((value.displacementL / value.cylinders) * 1000), "cc")} per rotor. Mazda's 13B is 654cc.`
              : undefined
          }
        />

        <Slider
          label="Redline"
          value={value.redlineRpm}
          valueLabel={formatUnitValue(value.redlineRpm, "RPM")}
          min={4500}
          max={redlineMax}
          step={100}
          onChange={setRedline}
          minLabel={formatUnitValue(4500, "RPM")}
          maxLabel={formatUnitValue(redlineMax, "RPM")}
          helpText={
            value.fuelType === "diesel"
              ? `Capped at ${formatUnitValue(DIESEL_MAX_REDLINE_RPM, "RPM")} - diesels don't rev like petrol engines.`
              : undefined
          }
        />

        <Slider
          label="Max Rev"
          value={value.maxRevRpm}
          valueLabel={formatUnitValue(value.maxRevRpm, "RPM")}
          min={value.redlineRpm}
          max={value.redlineRpm + MAX_REV_OVER_REDLINE_CAP}
          step={50}
          onChange={(v) => onChange({ ...value, maxRevRpm: v })}
          minLabel={formatUnitValue(value.redlineRpm, "RPM")}
          maxLabel={formatUnitValue(value.redlineRpm + MAX_REV_OVER_REDLINE_CAP, "RPM")}
          helpText="How far past redline you can push before each shift."
        />

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Fuel</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FUEL_TYPE_LABELS) as FuelType[]).map((f) => (
              <OptionButton
                key={f}
                active={value.fuelType === f}
                disabled={rotary && f === "diesel"}
                onClick={() => setFuelType(f)}
              >
                {FUEL_TYPE_LABELS[f]}
              </OptionButton>
            ))}
          </div>
          {rotary && (
            <p className="text-xs text-zinc-500 mt-2">
              Petrol only. A rotary&rsquo;s long, thin chamber can&rsquo;t reach the compression
              a diesel needs to self-ignite.
            </p>
          )}
          {value.fuelType === "diesel" && (
            <p className="text-xs text-zinc-500 mt-2">
              More torque per liter than petrol, but redline is capped low.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Aspiration</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ASPIRATION_LABELS) as EngineConfig["aspiration"][]).map((a) => (
              <OptionButton
                key={a}
                active={value.aspiration === a}
                onClick={() => onChange({ ...value, aspiration: a })}
              >
                {ASPIRATION_LABELS[a]}
              </OptionButton>
            ))}
          </div>
        </div>
        </fieldset>

        <div className="pt-2 border-t border-zinc-800">
          <CombustionFrictionGraph curves={curves} />
        </div>

      </SectionCard>

      <ContinueButton onClick={onContinue}>
        Continue to Gearbox &rarr;
      </ContinueButton>
    </div>
  );
}
