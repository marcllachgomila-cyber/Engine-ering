"use client";

type BuildStep = "chassis" | "engine" | "test";

const STEPS: { key: BuildStep; label: string }[] = [
  { key: "chassis", label: "1. Chassis" },
  { key: "engine", label: "2. Engine" },
  { key: "test", label: "3. Test" },
];

interface StepNavProps {
  current: BuildStep;
  onNavigate: (step: BuildStep) => void;
}

export default function StepNav({ current, onNavigate }: StepNavProps) {
  return (
    <div className="flex gap-2 mb-6">
      {STEPS.map((step) => (
        <button
          key={step.key}
          type="button"
          onClick={() => onNavigate(step.key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
            current === step.key
              ? "bg-amber-500 border-amber-500 text-slate-950 font-semibold"
              : "border-slate-700 text-slate-300 hover:border-slate-500"
          }`}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}
