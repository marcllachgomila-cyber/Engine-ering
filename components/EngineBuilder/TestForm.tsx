"use client";

import { RoadCondition, TestConfig, TestType } from "@/lib/physics/types";
import { ContinueButton, OptionButton, SectionCard, StepHeader } from "./FormControls";

const TEST_TYPE_LABELS: Record<TestType, string> = {
  zeroToHundred: "0–100 kph",
  tenSecond: "10-Second",
  drag500m: "500m Drag",
  braking: "Braking Test",
};

const CONDITION_LABELS: Record<RoadCondition, string> = {
  dry: "Dry",
  wet: "Wet",
  rain: "Rain",
  wind: "Headwind",
};

interface TestFormProps {
  value: TestConfig;
  onChange: (test: TestConfig) => void;
  onSubmit: () => void;
}

export default function TestForm({ value, onChange, onSubmit }: TestFormProps) {
  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 3 of 3"
        title="Test Specifications"
        description="Choose the test and the conditions to run it under."
      />

      <SectionCard title="Test">
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Test Type
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEST_TYPE_LABELS) as TestType[]).map((t) => (
              <OptionButton
                key={t}
                active={value.testType === t}
                onClick={() => onChange({ ...value, testType: t })}
              >
                {TEST_TYPE_LABELS[t]}
              </OptionButton>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
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
            <p className="text-xs text-slate-500 mt-2">
              A steady headwind straight off the nose - it only ever adds drag.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-slate-300">
              {value.testType === "braking" ? "Braking Speed" : "Initial Velocity"}
            </label>
            <span className="text-lg font-mono text-amber-400">
              {value.initialSpeedKph} kph
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={150}
            step={5}
            value={value.initialSpeedKph}
            onChange={(e) =>
              onChange({ ...value, initialSpeedKph: parseInt(e.target.value, 10) })
            }
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            {value.testType === "braking"
              ? "Speed to brake from in a straight line - the test measures time and distance to a full stop."
              : "Start the run already rolling instead of from a standstill - 0 for a normal standing-start test."}
          </p>
        </div>
      </SectionCard>

      <ContinueButton onClick={onSubmit}>
        Start {TEST_TYPE_LABELS[value.testType]} Run
      </ContinueButton>
    </div>
  );
}
