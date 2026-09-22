"use client";

import { useMemo } from "react";
import { buildEngineCurves } from "@/lib/physics/engineModel";
import { RealCarPreset } from "@/lib/physics/realCars";
import { EngineLayout } from "@/lib/physics/types";
import { FOCUS_RING, formatUnitValue } from "./FormControls";

const LAYOUT_TAGS: Record<EngineLayout, string> = {
  inline: "I",
  v: "V",
  flat: "Flat-",
  w: "W",
};

const DRIVETRAIN_LABELS: Record<RealCarPreset["gearbox"]["drivetrain"], string> = {
  fwd: "FWD",
  rwd: "RWD",
  awd: "AWD",
};

function engineSummary(engine: RealCarPreset["engine"]): string {
  const cylTag = `${LAYOUT_TAGS[engine.layout]}${engine.cylinders}`;
  const dispTag = `${engine.displacementL.toFixed(1)}L`;
  const aspTag =
    engine.aspiration === "turbo"
      ? "Turbo"
      : engine.aspiration === "supercharged"
        ? "Supercharged"
        : "";
  return [cylTag, dispTag, aspTag].filter(Boolean).join(" ");
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-black/30 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-xs font-mono font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

export function RealCarPresetCard({
  car,
  active,
  onClick,
}: {
  car: RealCarPreset;
  active: boolean;
  onClick: () => void;
}) {
  const peakPowerHp = useMemo(() => buildEngineCurves(car.engine).peakPowerHp, [car.engine]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-colors ${FOCUS_RING} ${
        active
          ? "bg-amber-500/10 border-amber-500"
          : "border-zinc-700 hover:border-zinc-500"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className={`text-[10px] uppercase tracking-wider ${
              active ? "text-amber-400/80" : "text-zinc-500"
            }`}
          >
            {car.make}
          </div>
          <div
            className={`font-semibold truncate ${active ? "text-amber-400" : "text-zinc-100"}`}
          >
            {car.model}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${
            active ? "border-amber-500/60 text-amber-400" : "border-zinc-700 text-zinc-500"
          }`}
        >
          {DRIVETRAIN_LABELS[car.gearbox.drivetrain]}
        </span>
      </div>

      <div className="text-xs text-zinc-400 mt-1.5 font-mono truncate">
        {engineSummary(car.engine)}
        {car.engine.hybridBoostKw ? " Hybrid" : ""}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
        <MiniStat label="Power" value={formatUnitValue(Math.round(peakPowerHp), "hp")} />
        <MiniStat label="Weight" value={formatUnitValue(car.chassis.weightKg, "kg")} />
      </div>
    </button>
  );
}
