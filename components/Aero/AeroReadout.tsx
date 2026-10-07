"use client";

import { useState } from "react";
import {
  aeroCoefficients,
  aeroForcesAt,
  AIR_DENSITY,
  downforceToWeight,
  speedForDownforceEqualWeightKph,
} from "@/lib/aero/forces";
import { AeroMode } from "@/lib/physics/types";
import { VehicleState } from "@/lib/physics/vehicleState";
import { FOCUS_RING, OptionButton } from "../EngineBuilder/FormControls";

const MIN_SPEED_KPH = 50;
const MAX_SPEED_KPH = 350;

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className="tabular-nums text-xs text-zinc-100">{value}</div>
      {detail && <div className="tabular-nums text-zinc-500">{detail}</div>}
    </div>
  );
}

// The basic aero force model (lib/aero/forces.ts) at a chosen speed: the
// same coefficients, air density and equations the simulation uses.
export default function AeroReadout({ vehicle }: { vehicle: VehicleState }) {
  const [speedKph, setSpeedKph] = useState(200);
  const [selectedMode, setSelectedMode] = useState<AeroMode>("corner");
  const hasActiveAero = !!vehicle.aero.activeAero;
  const mode: AeroMode = hasActiveAero ? selectedMode : "corner";

  const c = aeroCoefficients(vehicle, mode);
  const f = aeroForcesAt(c, speedKph);
  const massKg = vehicle.mass.totalKg;
  const ratio = downforceToWeight(f, massKg);
  const equalWeightKph = speedForDownforceEqualWeightKph(c, massKg);
  const makesLift = f.downforceN < 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="aero-speed" className="shrink-0 text-zinc-400">
          Speed
        </label>
        <input
          id="aero-speed"
          type="range"
          min={MIN_SPEED_KPH}
          max={MAX_SPEED_KPH}
          step={10}
          value={speedKph}
          onChange={(e) => setSpeedKph(Number(e.target.value))}
          className={`min-w-0 flex-1 accent-amber-500 ${FOCUS_RING}`}
        />
        <span className="w-16 shrink-0 text-right tabular-nums text-xs text-zinc-100">{speedKph} km/h</span>
      </div>
      {hasActiveAero && (
        <div className="flex items-center gap-1" role="group" aria-label="Active aero mode">
          <span className="mr-1 text-zinc-400">Active aero</span>
          {(["corner", "straight"] as const).map((m) => (
            <OptionButton
              key={m}
              active={mode === m}
              onClick={() => setSelectedMode(m)}
              className="px-1.5! py-0! text-[10px]! capitalize"
            >
              {m}
            </OptionButton>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="q" value={`${(f.dynamicPressurePa / 1000).toFixed(2)} kPa`} />
        <Stat label="Drag" value={`${(f.dragN / 1000).toFixed(2)} kN`} />
        <Stat
          label={makesLift ? "Lift" : "Downforce"}
          value={`${(Math.abs(f.downforceN) / 1000).toFixed(2)} kN`}
          detail={`${Math.abs(ratio * 100).toFixed(0)}% of weight`}
        />
        <Stat label="Drag power" value={`${f.dragPowerKw.toFixed(0)} kW`} />
      </div>
      <div className="leading-snug text-zinc-500">
        <div>
          F = ½ρV²·C·A · Cd {c.dragCoefficient.toFixed(2)} · Cl {c.liftCoefficient > 0 ? "+" : ""}
          {c.liftCoefficient.toFixed(2)} · A {c.frontalAreaM2.toFixed(2)} m² · ρ {AIR_DENSITY} kg/m³
        </div>
        <div>
          {equalWeightKph
            ? `Downforce equals the car's weight at ${equalWeightKph.toFixed(0)} km/h`
            : "This body makes lift, not downforce, at every speed"}
        </div>
      </div>
    </div>
  );
}
