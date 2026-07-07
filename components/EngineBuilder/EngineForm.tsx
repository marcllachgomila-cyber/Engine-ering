"use client";

import { EngineConfig, EngineLayout, FuelType, RoadCondition, TestConfig, TestType } from "@/lib/physics/types";
import { DIESEL_MAX_REDLINE_RPM } from "@/lib/physics/defaults";

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

const TEST_TYPE_LABELS: Record<TestType, string> = {
  zeroToHundred: "0–100 kph",
  tenSecond: "10-Second",
  drag500m: "500m Drag",
};

const CONDITION_LABELS: Record<RoadCondition, string> = {
  dry: "Dry",
  wet: "Wet",
  rain: "Rain",
  wind: "Headwind",
};

const GEAR_COUNT_OPTIONS = [5, 6, 7, 8];

interface EngineFormProps {
  value: EngineConfig;
  onChange: (config: EngineConfig) => void;
  test: TestConfig;
  onTestChange: (test: TestConfig) => void;
  onSubmit: () => void;
}

function OptionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
        active
          ? "bg-amber-500 border-amber-500 text-slate-950 font-semibold"
          : disabled
            ? "border-slate-800 text-slate-600 cursor-not-allowed"
            : "border-slate-700 text-slate-300 hover:border-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function EngineForm({
  value,
  onChange,
  test,
  onTestChange,
  onSubmit,
}: EngineFormProps) {
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
    onChange({ ...value, fuelType, redlineRpm });
  };

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-50 tracking-tight">
          Build Your Engine
        </h1>
        <p className="text-slate-400 mt-2">
          Configure every parameter, choose your test, and see which real cars
          come closest.
        </p>
      </div>

      <SectionCard title="Engine">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">
              Cylinders
            </label>
            <span className="text-lg font-mono text-amber-400">
              {value.cylinders}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CYLINDER_OPTIONS.map((c) => (
              <OptionButton
                key={c}
                active={value.cylinders === c}
                onClick={() => setCylinders(c)}
              >
                {c}
              </OptionButton>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Layout
          </label>
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
            <label className="text-sm font-medium text-slate-300">
              Displacement
            </label>
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
            onChange={(e) =>
              onChange({ ...value, displacementL: parseFloat(e.target.value) })
            }
            className="w-full accent-amber-500"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">
              Redline
            </label>
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
            onChange={(e) =>
              onChange({ ...value, redlineRpm: parseInt(e.target.value, 10) })
            }
            className="w-full accent-amber-500"
          />
          {value.fuelType === "diesel" && (
            <p className="text-xs text-slate-500 mt-1">
              Capped at {DIESEL_MAX_REDLINE_RPM.toLocaleString()} RPM - diesels
              don&apos;t rev like petrol engines.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Fuel
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FUEL_TYPE_LABELS) as FuelType[]).map((f) => (
              <OptionButton
                key={f}
                active={value.fuelType === f}
                onClick={() => setFuelType(f)}
              >
                {FUEL_TYPE_LABELS[f]}
              </OptionButton>
            ))}
          </div>
          {value.fuelType === "diesel" && (
            <p className="text-xs text-slate-500 mt-2">
              More torque per liter than petrol, but redline is capped low.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Aspiration
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ASPIRATION_LABELS) as EngineConfig["aspiration"][]).map(
              (a) => (
                <OptionButton
                  key={a}
                  active={value.aspiration === a}
                  onClick={() => onChange({ ...value, aspiration: a })}
                >
                  {ASPIRATION_LABELS[a]}
                </OptionButton>
              ),
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">
              Gears
            </label>
            <span className="text-lg font-mono text-amber-400">
              {test.gearCount}-speed
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GEAR_COUNT_OPTIONS.map((g) => (
              <OptionButton
                key={g}
                active={test.gearCount === g}
                onClick={() => onTestChange({ ...test, gearCount: g })}
              >
                {g}
              </OptionButton>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Test">
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Test Type
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEST_TYPE_LABELS) as TestType[]).map((t) => (
              <OptionButton
                key={t}
                active={test.testType === t}
                onClick={() => onTestChange({ ...test, testType: t })}
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
                active={test.condition === c}
                onClick={() => onTestChange({ ...test, condition: c })}
              >
                {CONDITION_LABELS[c]}
              </OptionButton>
            ))}
          </div>
          {test.condition === "wind" && (
            <p className="text-xs text-slate-500 mt-2">
              A steady headwind straight off the nose - it only ever adds drag.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-slate-300">
              Wheel Spin
            </label>
            <span className="text-lg font-mono text-amber-400">
              {test.wheelSpinPercent}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={test.wheelSpinPercent}
            onChange={(e) =>
              onTestChange({ ...test, wheelSpinPercent: parseInt(e.target.value, 10) })
            }
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Recommended: 10% - a little intentional slip uses the tire&apos;s
            peak grip; too little or too much both waste it.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Traction Control
          </label>
          <div className="flex flex-wrap gap-2">
            <OptionButton
              active={test.tractionControl}
              onClick={() => onTestChange({ ...test, tractionControl: true })}
            >
              On
            </OptionButton>
            <OptionButton
              active={!test.tractionControl}
              onClick={() => onTestChange({ ...test, tractionControl: false })}
            >
              Off
            </OptionButton>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Off risks wheelspin costing you grip once torque exceeds the
            tires&apos; limit.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
              Front Wheel
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">
                    Diameter
                  </label>
                  <span className="text-lg font-mono text-amber-400">
                    {test.frontWheelDiameterIn}&Prime;
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={32}
                  step={1}
                  value={test.frontWheelDiameterIn}
                  onChange={(e) =>
                    onTestChange({
                      ...test,
                      frontWheelDiameterIn: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">Recommended: 25&Prime;</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">
                    Width
                  </label>
                  <span className="text-lg font-mono text-amber-400">
                    {test.frontWheelWidthMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={185}
                  max={335}
                  step={5}
                  value={test.frontWheelWidthMm}
                  onChange={(e) =>
                    onTestChange({
                      ...test,
                      frontWheelWidthMm: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">Recommended: 235mm</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
              Rear Wheel
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">
                    Diameter
                  </label>
                  <span className="text-lg font-mono text-amber-400">
                    {test.rearWheelDiameterIn}&Prime;
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={32}
                  step={1}
                  value={test.rearWheelDiameterIn}
                  onChange={(e) =>
                    onTestChange({
                      ...test,
                      rearWheelDiameterIn: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">Recommended: 26&Prime;</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">
                    Width
                  </label>
                  <span className="text-lg font-mono text-amber-400">
                    {test.rearWheelWidthMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={185}
                  max={335}
                  step={5}
                  value={test.rearWheelWidthMm}
                  onChange={(e) =>
                    onTestChange({
                      ...test,
                      rearWheelWidthMm: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Recommended: 275mm - wider rear (drive) tires add grip.
                </p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Bigger wheels overall add rotating mass, which costs a little
          acceleration.
        </p>
      </SectionCard>

      <button
        type="button"
        onClick={onSubmit}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg py-4 transition-colors"
      >
        Start {TEST_TYPE_LABELS[test.testType]} Run
      </button>
    </div>
  );
}
