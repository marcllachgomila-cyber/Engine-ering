"use client";

import { CornerMarks, FOCUS_RING } from "./FormControls";

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
  const progressPct =
    STEPS.length > 1 ? (currentIndex / (STEPS.length - 1)) * 100 : 0;

  return (
    <div className="relative mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md">
      <CornerMarks />
      <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-amber-400">
          {STEPS[currentIndex]?.label}
        </span>
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          Step {currentIndex + 1} of {STEPS.length}
        </span>
      </div>
      <div className="px-5 py-5">
        <ol className="relative flex items-start" aria-label="Build steps">
          <span
            aria-hidden
            className="absolute left-0 right-0 top-[13px] h-px bg-zinc-800"
            style={{
              marginLeft: `${100 / STEPS.length / 2}%`,
              marginRight: `${100 / STEPS.length / 2}%`,
            }}
          />
          <span
            aria-hidden
            className="absolute left-0 top-[13px] h-px bg-amber-500/60 transition-all duration-500 ease-out"
            style={{
              marginLeft: `${100 / STEPS.length / 2}%`,
              width: `calc(${progressPct}% * ${(STEPS.length - 1) / STEPS.length})`,
            }}
          />
          {STEPS.map((step, i) => {
            const isCurrent = step.key === current;
            const isDone = i < currentIndex;
            return (
              <li
                key={step.key}
                className="relative flex flex-1 flex-col items-center gap-2 last:flex-none"
              >
                <button
                  type="button"
                  onClick={() => onNavigate(step.key)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`group flex flex-col items-center gap-2 rounded-lg p-1 ${FOCUS_RING}`}
                >
                  <span
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-mono font-bold transition-all ${
                      isCurrent
                        ? "bg-amber-500 border-amber-500 text-zinc-950 shadow-[0_0_0_4px_rgba(245,158,11,0.15)]"
                        : isDone
                          ? "border-amber-500/60 bg-zinc-900 text-amber-400 group-hover:border-amber-400"
                          : "border-zinc-700 bg-zinc-900 text-zinc-500 group-hover:border-zinc-500 group-hover:text-zinc-300"
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/40" />
                    )}
                    <span className="relative">
                      {isDone ? <span aria-hidden>&#10003;</span> : i + 1}
                    </span>
                  </span>
                  <span
                    className={`hidden text-xs font-mono transition-colors sm:inline ${
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
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
