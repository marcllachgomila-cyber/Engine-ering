import carsData from "@/data/cars.json";
import { CarSpec, EngineConfig, MatchResult, SimulationResult } from "@/lib/physics/types";

const cars = carsData as CarSpec[];

interface DerivedStats {
  displacementL: number;
  cylinders: number;
  aspiration: string;
  layout: string;
  peakHp: number;
  peakTorqueNm: number;
  powerToWeightHpPerTonne: number;
  zeroToHundredS: number;
}

function statsFromCar(car: CarSpec): DerivedStats {
  return {
    displacementL: car.displacementL,
    cylinders: car.cylinders,
    aspiration: car.aspiration,
    layout: car.layout,
    peakHp: car.hp,
    peakTorqueNm: car.torqueNm,
    powerToWeightHpPerTonne: car.hp / (car.weightKg / 1000),
    zeroToHundredS: car.zeroToHundredS,
  };
}

function statsFromResult(
  engine: EngineConfig,
  result: SimulationResult,
): DerivedStats {
  return {
    displacementL: engine.displacementL,
    cylinders: engine.cylinders,
    aspiration: engine.aspiration,
    layout: engine.layout,
    peakHp: result.peakHp,
    peakTorqueNm: result.peakTorqueNm,
    powerToWeightHpPerTonne: result.powerToWeightHpPerTonne,
    zeroToHundredS: result.zeroToHundredS,
  };
}

type NumericKey =
  | "displacementL"
  | "cylinders"
  | "peakHp"
  | "peakTorqueNm"
  | "powerToWeightHpPerTonne"
  | "zeroToHundredS";

const NUMERIC_WEIGHTS: Record<NumericKey, number> = {
  displacementL: 1,
  cylinders: 1,
  peakHp: 1.5,
  peakTorqueNm: 1.2,
  powerToWeightHpPerTonne: 1.5,
  zeroToHundredS: 1.5,
};

const ASPIRATION_MISMATCH_PENALTY = 1.0;
const LAYOUT_MISMATCH_PENALTY = 0.5;

export function findClosestCars(
  engine: EngineConfig,
  result: SimulationResult,
  count = 5,
): MatchResult[] {
  const target = statsFromResult(engine, result);
  const carStats = cars.map(statsFromCar);
  const allStats = [target, ...carStats];

  const ranges = {} as Record<NumericKey, { min: number; max: number }>;
  (Object.keys(NUMERIC_WEIGHTS) as NumericKey[]).forEach((key) => {
    const values = allStats.map((s) => s[key]);
    ranges[key] = { min: Math.min(...values), max: Math.max(...values) };
  });

  const normalize = (key: NumericKey, value: number): number => {
    const { min, max } = ranges[key];
    if (max === min) return 0;
    return (value - min) / (max - min);
  };

  const results: MatchResult[] = cars.map((car, i) => {
    const stats = carStats[i];
    let distanceSq = 0;

    (Object.keys(NUMERIC_WEIGHTS) as NumericKey[]).forEach((key) => {
      const diff = normalize(key, target[key]) - normalize(key, stats[key]);
      distanceSq += NUMERIC_WEIGHTS[key] * diff * diff;
    });

    if (target.aspiration !== stats.aspiration) {
      distanceSq += ASPIRATION_MISMATCH_PENALTY;
    }
    if (target.layout !== stats.layout) {
      distanceSq += LAYOUT_MISMATCH_PENALTY;
    }

    return { car, distance: Math.sqrt(distanceSq) };
  });

  return results.sort((a, b) => a.distance - b.distance).slice(0, count);
}
