import { simulate } from "../physics/simulate";
import { G } from "../physics/vehicleDynamics";
import {
  ChassisConfig,
  EngineConfig,
  GearboxConfig,
  RealCarPreset,
  SimulationResult,
  TestConfig,
  TestType,
} from "../physics/types";
import { buildVehicleState, VehicleState } from "../physics/vehicleState";
import { aeroCoefficients, aeroForcesAt } from "./forces";

// "What did the aero setup do?" - the same car and test run twice, once as
// built and once with the aero kit removed (the body type as standard), so
// any difference is the kit's alone. Both runs go through the same
// simulate() call, so they're like-for-like.

export interface TestMetric {
  label: string;
  unit: string;
  // Null when the run didn't finish (e.g. never reached 100 km/h).
  value: number | null;
  decimals: number;
  lowerIsBetter: boolean;
}

// The one number each test is judged on.
export function primaryMetric(result: SimulationResult): TestMetric {
  const testType: TestType = result.testType;
  switch (testType) {
    case "hotLap":
      return { label: "Lap time", unit: "s", value: result.elapsedS, decimals: 2, lowerIsBetter: true };
    case "zeroToHundred":
      return { label: "0-100 km/h", unit: "s", value: result.timedOut ? null : result.elapsedS, decimals: 2, lowerIsBetter: true };
    case "tenSecond":
      return { label: "Speed after 10 s", unit: "km/h", value: result.finalSpeedKph, decimals: 0, lowerIsBetter: false };
    case "drag500m":
      return { label: "500 m time", unit: "s", value: result.timedOut ? null : result.elapsedS, decimals: 2, lowerIsBetter: true };
    case "braking":
      return {
        label: "Stopping distance",
        unit: "m",
        value: result.timedOut ? null : result.finalDistanceM,
        decimals: 1,
        lowerIsBetter: true,
      };
  }
}

export interface AeroComparison {
  stock: { vehicle: VehicleState; result: SimulationResult };
  setup: { vehicle: VehicleState; result: SimulationResult };
  // Plain-language, number-backed explanations of the differences.
  explanations: string[];
}

const pct = (from: number, to: number) => ((to - from) / Math.abs(from)) * 100;
const signedPct = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(0)}%`;

export function compareWithStock(
  chassis: ChassisConfig,
  engine: EngineConfig,
  gearbox: GearboxConfig,
  realCar: RealCarPreset | null,
  test: TestConfig,
): AeroComparison {
  const stockChassis: ChassisConfig = { ...chassis, aeroKit: undefined };
  const stockVehicle = buildVehicleState(stockChassis, engine, gearbox, realCar);
  const setupVehicle = buildVehicleState(chassis, engine, gearbox, realCar);
  const stockResult = simulate(engine, stockChassis, gearbox, test);
  const setupResult = simulate(engine, chassis, gearbox, test);

  const explanations: string[] = [];
  const stockCdA = stockVehicle.aero.dragAreaM2;
  const setupCdA = setupVehicle.aero.dragAreaM2;
  const topStock = stockResult.theoreticalTopSpeedKph;
  const topSetup = setupResult.theoreticalTopSpeedKph;
  if (Math.abs(setupCdA - stockCdA) > 1e-6) {
    // At a drag-limited top speed, power = drag x speed = 1/2 rho CdA V^3,
    // so with the same power V scales with CdA^(-1/3).
    const estimate = pct(1, Math.pow(stockCdA / setupCdA, 1 / 3));
    explanations.push(
      `Drag area Cd·A ${setupCdA > stockCdA ? "rose" : "fell"} ${signedPct(pct(stockCdA, setupCdA))} (${stockCdA.toFixed(2)} → ${setupCdA.toFixed(2)} m²) with the same engine power. ` +
        `If drag were the only resistance, top speed would change by the cube root of that, ${signedPct(estimate)}; ` +
        `the simulation, which also counts rolling resistance and gearing, gives ${signedPct(pct(topStock, topSetup))} (${topStock.toFixed(0)} → ${topSetup.toFixed(0)} km/h).`,
    );
  }
  const stockClA = stockVehicle.aero.liftAreaM2;
  const setupClA = setupVehicle.aero.liftAreaM2;
  if (Math.abs(setupClA - stockClA) > 1e-6) {
    const refKph = 150;
    const dDown = aeroForcesAt(aeroCoefficients(setupVehicle), refKph).downforceN - aeroForcesAt(aeroCoefficients(stockVehicle), refKph).downforceN;
    const share = dDown / (setupVehicle.mass.totalKg * G);
    explanations.push(
      `Cl·A ${setupClA > stockClA ? "rose" : "fell"} from ${stockClA.toFixed(2)} to ${setupClA.toFixed(2)} m²: at ${refKph} km/h that's ${dDown >= 0 ? "+" : "−"}${Math.abs(dDown / 1000).toFixed(2)} kN ` +
        `(${Math.abs(share * 100).toFixed(0)}% of the car's weight) ${dDown >= 0 ? "more" : "less"} load on the tyres, so ${dDown >= 0 ? "more" : "less"} grip in corners and under braking.`,
    );
  }
  const stockCg = stockVehicle.mass.cgHeightM;
  const setupCg = setupVehicle.mass.cgHeightM;
  if (Math.abs(setupCg - stockCg) > 1e-9) {
    explanations.push(
      `Centre of gravity ${setupCg < stockCg ? "lowered" : "raised"} ${Math.abs((setupCg - stockCg) * 1000).toFixed(0)} mm with the ride height, ${setupCg < stockCg ? "reducing" : "increasing"} weight transfer under acceleration and braking.`,
    );
  }

  return {
    stock: { vehicle: stockVehicle, result: stockResult },
    setup: { vehicle: setupVehicle, result: setupResult },
    explanations,
  };
}
