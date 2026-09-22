"use client";

import { BRAKE_MATERIALS, BRAKE_TEMP_MAX_C, BRAKE_TEMP_MIN_C } from "@/lib/physics/brakeModel";
import { CIRCUITS } from "@/lib/physics/circuits";
import { BrakeMaterial, ChassisConfig, LapStartMode, RoadCondition, TestConfig, TestType } from "@/lib/physics/types";
import { CircuitOutlineIcon } from "../Simulation/CircuitMap";
import {
  ContinueButton,
  FOCUS_RING,
  formatUnitValue,
  OptionButton,
  SectionCard,
  Slider,
  StepHeader,
  ToggleSwitch,
} from "./FormControls";

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

const LAP_START_MODE_LABELS: Record<LapStartMode, string> = {
  flying: "Flying Lap",
  standing: "Standing Start",
};

const MAX_SPEED_KPH = 150;
const MAX_BRAKING_SPEED_KPH = 400;

interface TestFormProps {
  value: TestConfig;
  onChange: (test: TestConfig) => void;
  onSubmit: () => void;
  skipHotLapAnimation: boolean;
  onSkipHotLapAnimationChange: (skip: boolean) => void;
  chassis: ChassisConfig;
  onChassisChange: (chassis: ChassisConfig) => void;
}

export default function TestForm({
  value,
  onChange,
  onSubmit,
  skipHotLapAnimation,
  onSkipHotLapAnimationChange,
  chassis,
  onChassisChange,
}: TestFormProps) {
  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 4 of 4"
        title="Test Specifications"
        description="Choose the test and the conditions to run it under."
      />

      <SectionCard title="Test" tag="TST-01">
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

        <ToggleSwitch
          label="Traction Control"
          checked={chassis.tractionControl}
          onChange={(checked) => onChassisChange({ ...chassis, tractionControl: checked })}
          description="Off risks wheelspin."
        />

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
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${FOCUS_RING} ${
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
                    {circuit.country} · {formatUnitValue(circuit.lengthM / 1000, "km", 3)} ·{" "}
                    {circuit.corners} corners
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">
                Start
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LAP_START_MODE_LABELS) as LapStartMode[]).map((mode) => (
                  <OptionButton
                    key={mode}
                    active={value.lapStartMode === mode}
                    onClick={() => onChange({ ...value, lapStartMode: mode })}
                  >
                    {LAP_START_MODE_LABELS[mode]}
                  </OptionButton>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Flying lap crosses the line at speed; standing start launches from a stop.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <ToggleSwitch
                label="Skip live simulation"
                checked={skipHotLapAnimation}
                onChange={onSkipHotLapAnimationChange}
                description="Jump straight to the results."
              />
            </div>
          </div>
        )}

        {(value.testType === "zeroToHundred" ||
          value.testType === "drag500m" ||
          value.testType === "tenSecond") && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <ToggleSwitch
              label="Clutch-Dump Launch"
              checked={value.clutchDump}
              disabled={value.initialSpeedKph > 0}
              onChange={(checked) => onChange({ ...value, clutchDump: checked })}
              description={`A stronger getaway, with more wheelspin risk if traction control is off.${
                value.initialSpeedKph > 0 ? " Only applies from a standing start." : ""
              }`}
            />
          </div>
        )}

        {value.testType === "braking" && (
          <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <ToggleSwitch
              label="ABS"
              checked={value.absEnabled}
              onChange={(checked) => onChange({ ...value, absEnabled: checked })}
              description="Off risks lock-up."
            />

            <Slider
              label="Initial Brake Temperature"
              value={value.initialBrakeTempC}
              valueLabel={formatUnitValue(value.initialBrakeTempC, "°C")}
              min={BRAKE_TEMP_MIN_C}
              max={BRAKE_TEMP_MAX_C}
              step={10}
              onChange={(v) => onChange({ ...value, initialBrakeTempC: v })}
              minLabel={formatUnitValue(BRAKE_TEMP_MIN_C, "°C")}
              maxLabel={formatUnitValue(BRAKE_TEMP_MAX_C, "°C")}
              helpText="How hot the brakes already are going into the stop."
            />

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
            <p className="text-xs text-zinc-500 mt-2">Only ever adds drag.</p>
          )}
        </div>

        {value.testType !== "hotLap" && (
          <Slider
            label={value.testType === "braking" ? "Braking Speed" : "Initial Velocity"}
            value={value.initialSpeedKph}
            valueLabel={formatUnitValue(value.initialSpeedKph, "kph")}
            min={0}
            max={value.testType === "braking" ? MAX_BRAKING_SPEED_KPH : MAX_SPEED_KPH}
            step={5}
            onChange={(v) => onChange({ ...value, initialSpeedKph: v })}
            minLabel={formatUnitValue(0, "kph")}
            maxLabel={formatUnitValue(
              value.testType === "braking" ? MAX_BRAKING_SPEED_KPH : MAX_SPEED_KPH,
              "kph",
            )}
            helpText={
              value.testType === "braking"
                ? "Speed to brake from to a full stop."
                : "0 for a standing-start test."
            }
          />
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
