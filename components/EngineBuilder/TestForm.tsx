"use client";

import { BRAKE_MATERIALS, BRAKE_TEMP_MAX_C, BRAKE_TEMP_MIN_C } from "@/lib/physics/brakeModel";
import { CIRCUITS } from "@/lib/physics/circuits";
import { BrakeMaterial, RoadCondition, TestConfig, TestType } from "@/lib/physics/types";
import { CircuitOutlineIcon } from "../Simulation/CircuitMap";
import { ContinueButton, OptionButton, SectionCard, StepHeader } from "./FormControls";

const TEST_TYPE_LABELS: Record<TestType, string> = {
  zeroToHundred: "0–100 kph",
  tenSecond: "10-Second",
  drag500m: "500m Drag",
  braking: "Braking Test",
  hotLap: "Hot Lap",
};

const CONDITION_LABELS: Record<RoadCondition, string> = {
  dry: "Dry",
  wet: "Wet",
  rain: "Rain",
  wind: "Headwind",
};

const MAX_SPEED_KPH = 150;
const MAX_BRAKING_SPEED_KPH = 400;

interface TestFormProps {
  value: TestConfig;
  onChange: (test: TestConfig) => void;
  onSubmit: () => void;
  skipHotLapAnimation: boolean;
  onSkipHotLapAnimationChange: (skip: boolean) => void;
}

export default function TestForm({
  value,
  onChange,
  onSubmit,
  skipHotLapAnimation,
  onSkipHotLapAnimationChange,
}: TestFormProps) {
  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 4 of 4"
        title="Test Specifications"
        description="Choose the test and the conditions to run it under."
      />

      <SectionCard title="Test">
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Test Type
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEST_TYPE_LABELS) as TestType[]).map((t) => (
              <OptionButton
                key={t}
                active={value.testType === t}
                onClick={() =>
                  onChange({
                    ...value,
                    testType: t,
                    initialSpeedKph:
                      t === "braking"
                        ? value.initialSpeedKph
                        : Math.min(value.initialSpeedKph, MAX_SPEED_KPH),
                  })
                }
              >
                {TEST_TYPE_LABELS[t]}
              </OptionButton>
            ))}
          </div>
        </div>

        {value.testType === "hotLap" && (
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Circuit
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CIRCUITS.map((circuit) => (
                <button
                  key={circuit.id}
                  type="button"
                  onClick={() => onChange({ ...value, circuitId: circuit.id })}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                    value.circuitId === circuit.id
                      ? "bg-amber-500 border-amber-500 text-zinc-950"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  <CircuitOutlineIcon circuit={circuit} className="w-full h-12" />
                  <span className="text-xs font-semibold leading-tight">{circuit.name}</span>
                  <span
                    className={`text-[10px] font-mono ${
                      value.circuitId === circuit.id ? "text-zinc-800" : "text-zinc-500"
                    }`}
                  >
                    {circuit.country} · {(circuit.lengthM / 1000).toFixed(3)} km · {circuit.corners} corners
                  </span>
                </button>
              ))}
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={skipHotLapAnimation}
                onChange={(e) => onSkipHotLapAnimationChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span>
                <span className="text-sm font-medium text-zinc-300 block">
                  Skip live simulation
                </span>
                <span className="text-xs text-zinc-500">
                  Jump straight to the results instead of watching the lap play out in
                  real time.
                </span>
              </span>
            </label>
          </div>
        )}

        {value.testType === "braking" && (
          <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">
                ABS
              </label>
              <div className="flex flex-wrap gap-2">
                <OptionButton
                  active={value.absEnabled}
                  onClick={() => onChange({ ...value, absEnabled: true })}
                >
                  On
                </OptionButton>
                <OptionButton
                  active={!value.absEnabled}
                  onClick={() => onChange({ ...value, absEnabled: false })}
                >
                  Off
                </OptionButton>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Off risks lock-up - a sliding tyre grips worse than one held right
                at the edge of traction.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-sm font-medium text-zinc-300">
                  Initial Brake Temperature
                </label>
                <span className="text-lg font-mono text-amber-400">
                  {value.initialBrakeTempC}°C
                </span>
              </div>
              <input
                type="range"
                min={BRAKE_TEMP_MIN_C}
                max={BRAKE_TEMP_MAX_C}
                step={10}
                value={value.initialBrakeTempC}
                onChange={(e) =>
                  onChange({ ...value, initialBrakeTempC: parseInt(e.target.value, 10) })
                }
                className="w-full accent-amber-500"
              />
              <p className="text-xs text-zinc-500 mt-1">
                How hot the brakes already are going into the stop - cold or
                overheated, both can cost effectiveness depending on material.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">
                Brake Material
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BRAKE_MATERIALS) as BrakeMaterial[]).map((m) => (
                  <OptionButton
                    key={m}
                    active={value.brakeMaterial === m}
                    onClick={() => onChange({ ...value, brakeMaterial: m })}
                  >
                    {BRAKE_MATERIALS[m].label}
                  </OptionButton>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Steel bites hard from cold but fades under sustained heat; ceramic
                trades a little cold bite for a much wider comfort zone; carbon is
                weak until it&apos;s properly hot, then out-brakes both.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Conditions
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CONDITION_LABELS) as RoadCondition[]).map((c) => (
              <OptionButton
                key={c}
                active={value.condition === c}
                onClick={() => onChange({ ...value, condition: c })}
              >
                {CONDITION_LABELS[c]}
              </OptionButton>
            ))}
          </div>
          {value.condition === "wind" && (
            <p className="text-xs text-zinc-500 mt-2">
              A steady headwind straight off the nose - it only ever adds drag.
            </p>
          )}
        </div>

        {value.testType !== "hotLap" && (
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-sm font-medium text-zinc-300">
                {value.testType === "braking" ? "Braking Speed" : "Initial Velocity"}
              </label>
              <span className="text-lg font-mono text-amber-400">
                {value.initialSpeedKph} kph
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={value.testType === "braking" ? MAX_BRAKING_SPEED_KPH : MAX_SPEED_KPH}
              step={5}
              value={value.initialSpeedKph}
              onChange={(e) =>
                onChange({ ...value, initialSpeedKph: parseInt(e.target.value, 10) })
              }
              className="w-full accent-amber-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {value.testType === "braking"
                ? "Speed to brake from in a straight line - the test measures time and distance to a full stop."
                : "Start the run already rolling instead of from a standstill - 0 for a normal standing-start test."}
            </p>
          </div>
        )}
      </SectionCard>

      <ContinueButton onClick={onSubmit}>
        {value.testType === "hotLap" && skipHotLapAnimation
          ? "Show Hot Lap Results"
          : `Start ${TEST_TYPE_LABELS[value.testType]} Run`}
      </ContinueButton>
    </div>
  );
}
