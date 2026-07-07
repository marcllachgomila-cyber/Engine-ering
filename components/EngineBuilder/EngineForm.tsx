"use client";

import { EngineConfig, EngineLayout } from "@/lib/physics/types";

const CYLINDER_OPTIONS = [3, 4, 5, 6, 8, 10, 12, 16];

const VALID_LAYOUTS: Record<number, EngineLayout[]> = {
  3: ["inline"],
  4: ["inline", "flat"],
  5: ["inline"],
  6: ["inline", "v", "flat"],
  8: ["v"],
  10: ["v"],
  12: ["v"],
  16: ["v"],
};

const LAYOUT_LABELS: Record<EngineLayout, string> = {
  inline: "Inline",
  v: "V",
  flat: "Flat / Boxer",
};

const ASPIRATION_LABELS: Record<EngineConfig["aspiration"], string> = {
  na: "Naturally Aspirated",
  turbo: "Turbocharged",
  supercharged: "Supercharged",
};

interface EngineFormProps {
  value: EngineConfig;
  onChange: (config: EngineConfig) => void;
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

export default function EngineForm({ value, onChange, onSubmit }: EngineFormProps) {
  const validLayouts = VALID_LAYOUTS[value.cylinders] ?? ["inline"];

  const setCylinders = (cylinders: number) => {
    const layouts = VALID_LAYOUTS[cylinders] ?? ["inline"];
    const layout = layouts.includes(value.layout) ? value.layout : layouts[0];
    onChange({ ...value, cylinders, layout });
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-50 tracking-tight">
          Build Your Engine
        </h1>
        <p className="text-slate-400 mt-2">
          Configure every parameter, then run a 10-second acceleration test
          and see which real cars come closest.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
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
            {(["inline", "v", "flat"] as EngineLayout[]).map((layout) => (
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
            max={11000}
            step={100}
            value={value.redlineRpm}
            onChange={(e) =>
              onChange({ ...value, redlineRpm: parseInt(e.target.value, 10) })
            }
            className="w-full accent-amber-500"
          />
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
      </div>

      <button
        type="button"
        onClick={onSubmit}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg py-4 transition-colors"
      >
        Start 10s Acceleration Run
      </button>
    </div>
  );
}
