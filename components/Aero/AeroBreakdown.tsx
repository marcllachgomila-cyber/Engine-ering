"use client";

import { VehicleState } from "@/lib/physics/vehicleState";

export const signedCoefficient = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(2)}`;

// How the car's Cd and Cl were reached: the body type's own coefficients,
// then each aero-kit part's increment with the reason it moves them.
// Renders nothing for a car without a kit.
export default function AeroBreakdown({ vehicle, showTotal = false }: { vehicle: VehicleState; showTotal?: boolean }) {
  const { aero } = vehicle;
  if (aero.kitContributions.length === 0) return null;
  return (
    <ul className="space-y-0.5 border-l border-zinc-800 pl-2 leading-snug text-zinc-500">
      <li className="tabular-nums">
        {vehicle.identity.bodyType} body: Cd {aero.baseDragCoefficient.toFixed(2)} · Cl{" "}
        {signedCoefficient(aero.baseLiftCoefficient)}
      </li>
      {aero.kitContributions.map((part) => (
        <li key={part.label}>
          <span className="tabular-nums text-zinc-400">
            {part.label}: Cd {signedCoefficient(part.dCd)} · Cl {signedCoefficient(part.dCl)}
          </span>{" "}
          - {part.reason}
        </li>
      ))}
      {showTotal && (
        <li className="tabular-nums text-zinc-300">
          Total: Cd {aero.dragCoefficient.toFixed(2)} · Cl {signedCoefficient(aero.liftCoefficient)}
        </li>
      )}
    </ul>
  );
}
