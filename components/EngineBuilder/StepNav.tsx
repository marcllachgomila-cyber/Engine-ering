"use client";

type BuildStep = "chassis" | "engine" | "gearbox" | "test";

const STEPS: { key: BuildStep; label: string }[] = [
  { key: "chassis", label: "Chassis" },
  { key: "engine", label: "Engine" },
  { key: "gearbox", label: "Gearbox" },
  { key: "test", label: "Test" },
];

interface StepNavProps {
  current: BuildStep;
  onNavigate: (step: BuildStep) => void;
}

export default function StepNav({ current, onNavigate }: StepNavProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center mb-8" aria-label="Build steps">
      {STEPS.map((step, i) => {
        const isCurrent = step.key === current;
        const isDone = i < currentIndex;
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              onClick={() => onNavigate(step.key)}
              aria-current={isCurrent ? "step" : undefined}
              className="group flex items-center gap-2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-mono font-bold transition-colors ${
                  isCurrent
                    ? "bg-amber-500 border-amber-500 text-zinc-950"
                    : isDone
                      ? "border-amber-500/60 text-amber-400 group-hover:border-amber-400"
                      : "border-zinc-700 bg-zinc-900/40 text-zinc-500 group-hover:border-zinc-500"
                }`}
              >
                {isDone ? <span aria-hidden>&#10003;</span> : i + 1}
              </span>
              <span
                className={`hidden text-sm font-mono transition-colors sm:inline ${
                  isCurrent
                    ? "font-semibold text-zinc-100"
                    : isDone
                      ? "text-amber-400/90"
                      : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              >
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`mx-3 h-px flex-1 ${i < currentIndex ? "bg-amber-500/50" : "bg-zinc-800"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
