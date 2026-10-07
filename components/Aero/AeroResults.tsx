"use client";

import { useMemo } from "react";
import { compareWithStock, primaryMetric, TestMetric } from "@/lib/aero/aeroComparison";
import { aeroCoefficients, aeroForcesAt, AIR_DENSITY, downforceToWeight } from "@/lib/aero/forces";
import { aeroKitAvailable } from "@/lib/physics/aeroKit";
import { ChassisConfig, EngineConfig, GearboxConfig, RealCarPreset, SimulationResult, TestConfig } from "@/lib/physics/types";
import { G } from "@/lib/physics/vehicleDynamics";
import { VehicleState } from "@/lib/physics/vehicleState";
import { Panel, SectionCard } from "../EngineBuilder/FormControls";
import AeroBreakdown, { signedCoefficient } from "./AeroBreakdown";
import AeroForceChart, { ForceSeries } from "./AeroForceChart";
import WindTunnel2D from "./WindTunnel2D";

// The aerodynamics section of the results screen: the forces at this run's
// peak speed, drag and downforce across the speed range, what the aero
// setup changed in this very test (re-run with the stock body), the
// working behind the coefficients, the flow picture, and the assumptions.

// Validated against the panel surface with the dataviz palette checker:
// amber/grey (dashed) for setup vs stock, amber/blue for the two
// active-aero modes.
const SETUP_COLOR = "#f5a000";
const STOCK_COLOR = "#9e9b94";
const STRAIGHT_COLOR = "#4c8df6";

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Panel>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 whitespace-nowrap font-mono text-lg font-bold tabular-nums text-zinc-50">{value}</div>
      {detail && <div className="mt-0.5 font-mono text-xs text-zinc-500">{detail}</div>}
    </Panel>
  );
}

function formatMetric(m: TestMetric, value: number | null): string {
  return value === null ? "Did not finish" : `${value.toFixed(m.decimals)} ${m.unit}`;
}

function formatChange(m: TestMetric, from: number | null, to: number | null): string {
  if (from === null || to === null) return "-";
  const d = to - from;
  if (Math.abs(d) < Math.pow(10, -m.decimals) / 2) return "no change";
  const better = m.lowerIsBetter ? d < 0 : d > 0;
  return `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(m.decimals)} ${m.unit} (${better ? "better" : "worse"})`;
}

const kN = (n: number) => `${(n / 1000).toFixed(2)} kN`;

export default function AeroResults({
  vehicle,
  chassis,
  engine,
  gearbox,
  realCar,
  test,
  result,
}: {
  vehicle: VehicleState;
  chassis: ChassisConfig;
  engine: EngineConfig;
  gearbox: GearboxConfig;
  realCar: RealCarPreset | null;
  test: TestConfig;
  result: SimulationResult;
}) {
  const massKg = vehicle.mass.totalKg;
  const weightN = massKg * G;
  const hasKit = vehicle.aero.kitContributions.length > 0;
  const activeAero = vehicle.aero.activeAero;

  // Only worth re-simulating when there's a kit to compare against.
  const comparison = useMemo(
    () => (hasKit ? compareWithStock(chassis, engine, gearbox, realCar, test) : null),
    [hasKit, chassis, engine, gearbox, realCar, test],
  );

  const peakKph = Math.max(result.finalSpeedKph, ...result.telemetry.map((s) => s.speedKph));
  const forces = aeroForcesAt(aeroCoefficients(vehicle), peakKph);
  const rollingN = vehicle.tyres.rollingResistanceCoefficient * weightN;
  const dragShare = forces.dragN / (forces.dragN + rollingN);
  const lift = forces.downforceN < 0;

  const chartMaxKph = Math.max(
    100,
    Math.ceil(Math.max(peakKph, result.theoreticalTopSpeedKph, comparison?.stock.result.theoreticalTopSpeedKph ?? 0) / 50) * 50,
  );

  const forceSeries = (pick: "dragN" | "downforceN"): ForceSeries[] => {
    if (comparison) {
      return [
        { label: "Your setup", color: SETUP_COLOR, forceAt: (v) => aeroForcesAt(aeroCoefficients(vehicle), v)[pick] },
        {
          label: "Stock body",
          color: STOCK_COLOR,
          dashed: true,
          forceAt: (v) => aeroForcesAt(aeroCoefficients(comparison.stock.vehicle), v)[pick],
        },
      ];
    }
    if (activeAero) {
      return [
        { label: "Corner mode", color: SETUP_COLOR, forceAt: (v) => aeroForcesAt(aeroCoefficients(vehicle, "corner"), v)[pick] },
        {
          label: "Straight mode",
          color: STRAIGHT_COLOR,
          forceAt: (v) => aeroForcesAt(aeroCoefficients(vehicle, "straight"), v)[pick],
        },
      ];
    }
    return [{ label: "This car", color: SETUP_COLOR, forceAt: (v) => aeroForcesAt(aeroCoefficients(vehicle), v)[pick] }];
  };
  const downSeries = forceSeries("downforceN");
  // Show the car's weight as a reference once downforce gets near it.
  const maxDown = Math.max(...downSeries.map((s) => s.forceAt(chartMaxKph)));
  const showWeight = maxDown >= 0.4 * weightN;

  const metric = comparison ? primaryMetric(comparison.setup.result) : null;
  const stockMetric = comparison ? primaryMetric(comparison.stock.result) : null;
  const kitHint = !hasKit && aeroKitAvailable(vehicle.identity.bodyType) && !realCar;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <SectionCard title="Aerodynamics" tag="AER-01">
        <div>
          <div className="mb-2 text-xs text-zinc-400">
            At this run&rsquo;s peak speed, <span className="font-mono text-zinc-200">{Math.round(peakKph)} km/h</span>
            {activeAero && " (corner-mode coefficients)"}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Dyn. pressure" value={`${(forces.dynamicPressurePa / 1000).toFixed(2)} kPa`} detail="q = ½ρV²" />
            <Stat label="Drag" value={kN(forces.dragN)} detail={`Cd ${aeroCoefficients(vehicle).dragCoefficient.toFixed(2)}`} />
            <Stat
              label={lift ? "Lift" : "Downforce"}
              value={kN(Math.abs(forces.downforceN))}
              detail={`${Math.abs(downforceToWeight(forces, massKg) * 100).toFixed(0)}% of weight`}
            />
            <Stat label="Drag power" value={`${forces.dragPowerKw.toFixed(0)} kW`} detail="P = drag × V" />
            <Stat
              label="Aero share"
              value={`${(dragShare * 100).toFixed(0)}%`}
              detail="of total resistance"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel>
            <AeroForceChart title="Drag vs speed" series={forceSeries("dragN")} maxSpeedKph={chartMaxKph} />
          </Panel>
          <Panel>
            <AeroForceChart
              title={lift && !comparison && !activeAero ? "Lift vs speed (negative = lift)" : "Downforce vs speed"}
              series={downSeries}
              maxSpeedKph={chartMaxKph}
              reference={showWeight ? { label: `car weight ${kN(weightN)}`, forceN: weightN } : undefined}
            />
          </Panel>
        </div>

        {comparison && metric && stockMetric && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-zinc-300">What your aero setup changed in this test</div>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-500">
                    <th className="py-1.5 pr-3 font-normal">Measure</th>
                    <th className="py-1.5 pr-3 font-normal">Stock body</th>
                    <th className="py-1.5 pr-3 font-normal">Your setup</th>
                    <th className="py-1.5 font-normal">Change</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums text-zinc-200">
                  <tr className="border-b border-zinc-800/60">
                    <td className="py-1.5 pr-3 text-zinc-400">{metric.label}</td>
                    <td className="py-1.5 pr-3">{formatMetric(stockMetric, stockMetric.value)}</td>
                    <td className="py-1.5 pr-3">{formatMetric(metric, metric.value)}</td>
                    <td className="py-1.5">{formatChange(metric, stockMetric.value, metric.value)}</td>
                  </tr>
                  <tr className="border-b border-zinc-800/60">
                    <td className="py-1.5 pr-3 text-zinc-400">Theoretical top speed</td>
                    <td className="py-1.5 pr-3">{comparison.stock.result.theoreticalTopSpeedKph.toFixed(0)} km/h</td>
                    <td className="py-1.5 pr-3">{comparison.setup.result.theoreticalTopSpeedKph.toFixed(0)} km/h</td>
                    <td className="py-1.5">
                      {formatChange(
                        { label: "", unit: "km/h", value: null, decimals: 0, lowerIsBetter: false },
                        comparison.stock.result.theoreticalTopSpeedKph,
                        comparison.setup.result.theoreticalTopSpeedKph,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 text-zinc-400">Cd · Cl</td>
                    <td className="py-1.5 pr-3">
                      {comparison.stock.vehicle.aero.dragCoefficient.toFixed(2)} ·{" "}
                      {signedCoefficient(comparison.stock.vehicle.aero.liftCoefficient)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {vehicle.aero.dragCoefficient.toFixed(2)} · {signedCoefficient(vehicle.aero.liftCoefficient)}
                    </td>
                    <td className="py-1.5 text-zinc-500">see breakdown</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-zinc-400">
              {comparison.explanations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="text-xs">
              <div className="mb-1 text-zinc-500">How the coefficients were reached</div>
              <AeroBreakdown vehicle={vehicle} showTotal />
            </div>
          </div>
        )}
        {kitHint && (
          <p className="text-xs text-zinc-500">
            Standard aero for this body type. Fit a wing, splitter or diffuser, or change the ride height, in the
            chassis step to see what it does to this test.
          </p>
        )}

        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Flow picture</div>
          <div className="relative h-[24rem] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
            <WindTunnel2D vehicle={vehicle} showReadout={false} />
          </div>
        </div>

        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">Force model &amp; assumptions</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 leading-relaxed">
            <li>
              Forces use F = ½ρV²·C·A with the same coefficients, frontal area ({vehicle.aero.frontalAreaM2.toFixed(2)}{" "}
              m²) and air density ({AIR_DENSITY} kg/m³, ISA sea level) the simulation uses, in still air. They&rsquo;re
              representative estimates for the body type, not measured data for any car.
            </li>
            <li>
              Aero share = drag ÷ (drag + rolling resistance); rolling resistance is{" "}
              {vehicle.tyres.rollingResistanceCoefficient} × weight × g = {kN(rollingN)}, the same constant the
              simulation uses.
            </li>
            <li>
              Aero-kit parts are representative force-area increments (the same wing makes the same force on any
              car); ride height also moves the centre of gravity. Part masses aren&rsquo;t modelled.
            </li>
            <li>
              The comparison re-runs this exact test with the aero kit removed, through the same simulation - the
              difference is the kit&rsquo;s alone.
            </li>
            <li>
              No front/rear downforce split exists in the data, so there&rsquo;s no aero balance; coefficients
              don&rsquo;t vary with speed or yaw.
            </li>
            <li>The flow picture is an illustrative 2D model (see its own notes) and doesn&rsquo;t feed these numbers. Not CFD.</li>
          </ul>
        </details>
      </SectionCard>
    </div>
  );
}
