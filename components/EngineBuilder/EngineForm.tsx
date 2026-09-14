"use client";

import { EngineConfig, EngineLayout, FuelType } from "@/lib/physics/types";
import { DIESEL_MAX_REDLINE_RPM } from "@/lib/physics/defaults";
import { RealCarPreset } from "@/lib/physics/realCars";
import { ContinueButton, OptionButton, SectionCard, StepHeader } from "./FormControls";

const CYLINDER_OPTIONS = [3, 4, 5, 6, 8, 10, 12, 16];

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
};

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
  const validLayouts = VALID_LAYOUTS[value.cylinders] ?? ["inline"];
  const redlineMax = value.fuelType === "diesel" ? DIESEL_MAX_REDLINE_RPM : 11000;

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

      <SectionCard title="Engine">
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
            {(["inline", "v", "flat", "w"] as EngineLayout[]).map((layout) => (
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

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Displacement</label>
            <span className="text-lg font-mono text-amber-400">
              {value.displacementL.toFixed(1)} L
            </span>
          </div>
          <input
            type="range"
            min={0.6}
            max={8.5}
            step={0.1}
            value={value.displacementL}
            onChange={(e) => onChange({ ...value, displacementL: parseFloat(e.target.value) })}
            className="w-full accent-amber-500"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Redline</label>
            <span className="text-lg font-mono text-amber-400">
              {value.redlineRpm.toLocaleString()} RPM
            </span>
          </div>
          <input
            type="range"
            min={4500}
            max={redlineMax}
            step={100}
            value={value.redlineRpm}
            onChange={(e) => setRedline(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500"
          />
          {value.fuelType === "diesel" && (
            <p className="text-xs text-zinc-500 mt-1">
              Capped at {DIESEL_MAX_REDLINE_RPM.toLocaleString()} RPM - diesels
              don&apos;t rev like petrol engines.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Max Rev</label>
            <span className="text-lg font-mono text-amber-400">
              {value.maxRevRpm.toLocaleString()} RPM
            </span>
          </div>
          <input
            type="range"
            min={value.redlineRpm}
            max={value.redlineRpm + MAX_REV_OVER_REDLINE_CAP}
            step={50}
            value={value.maxRevRpm}
            onChange={(e) => onChange({ ...value, maxRevRpm: parseInt(e.target.value, 10) })}
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-zinc-500 mt-1">
            The hard limiter - how far past redline you can push before each
            shift. Torque keeps tapering the further past redline you go.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Fuel</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FUEL_TYPE_LABELS) as FuelType[]).map((f) => (
              <OptionButton key={f} active={value.fuelType === f} onClick={() => setFuelType(f)}>
                {FUEL_TYPE_LABELS[f]}
              </OptionButton>
            ))}
          </div>
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

      </SectionCard>

      <ContinueButton onClick={onContinue}>
        Continue to Gearbox &rarr;
      </ContinueButton>
    </div>
  );
}
