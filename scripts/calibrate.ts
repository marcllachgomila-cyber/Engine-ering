// Runs real-car presets through the straight-line simulation and compares
// 0-100 km/h times, top speed, peak power and torque against the real
// cars' published figures. Run with: npx tsx scripts/calibrate.ts
import { findRealCarPreset, gearboxFromPreset } from "../lib/physics/realCars";
import { simulate } from "../lib/physics/simulate";
import { DEFAULT_CHASSIS, DEFAULT_TEST_CONFIG } from "../lib/physics/defaults";
import { buildEngineCurves } from "../lib/physics/engineModel";
import { deriveVehicle } from "../lib/physics/vehicleModel";
import { ChassisConfig } from "../lib/physics/types";

// Manufacturer figures. Top speeds marked "limited" are electronically
// capped on the real car, so the model should land at or above them.
const REFERENCE: { id: string; zeroToHundredS: number; topSpeedKph: number; hp: number; torqueNm: number; limited?: boolean }[] = [
  { id: "toyota-rav4", zeroToHundredS: 8.4, topSpeedKph: 180, hp: 203, torqueNm: 250, limited: true },
  { id: "honda-odyssey", zeroToHundredS: 7.3, topSpeedKph: 180, hp: 280, torqueNm: 355, limited: true },
  { id: "bmw-x5", zeroToHundredS: 5.5, topSpeedKph: 243, hp: 335, torqueNm: 450, limited: true },
  { id: "chevrolet-tahoe", zeroToHundredS: 7.4, topSpeedKph: 180, hp: 355, torqueNm: 519, limited: true },
  { id: "lamborghini-huracan", zeroToHundredS: 3.2, topSpeedKph: 325, hp: 602, torqueNm: 560 },
  { id: "mclaren-720s", zeroToHundredS: 2.9, topSpeedKph: 341, hp: 710, torqueNm: 770 },
  { id: "ferrari-f8-tributo", zeroToHundredS: 2.9, topSpeedKph: 340, hp: 710, torqueNm: 770 },
  { id: "porsche-911-turbo-s", zeroToHundredS: 2.7, topSpeedKph: 330, hp: 641, torqueNm: 800 },
  { id: "bugatti-chiron", zeroToHundredS: 2.4, topSpeedKph: 420, hp: 1479, torqueNm: 1600, limited: true },
  { id: "f1-2024", zeroToHundredS: 2.6, topSpeedKph: 350, hp: 1000, torqueNm: 0 },
];

const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(
  ["car".padEnd(22), pad("0-100", 6), pad("real", 5), pad("Vmax", 5), pad("real", 5), pad("hp", 5), pad("real", 5), pad("Nm", 5), pad("real", 5), pad("FD", 5), pad("spin", 5)].join(" "),
);
for (const ref of REFERENCE) {
  const car = findRealCarPreset(ref.id);
  if (!car) throw new Error(`missing preset ${ref.id}`);
  const chassis: ChassisConfig = {
    ...DEFAULT_CHASSIS,
    ...car.chassis,
    bodyType: car.category,
    tyreType: car.category === "f1" ? "slick" : "standard",
    tyreCompound: car.category === "f1" ? "soft" : "medium",
  };
  const gearbox = gearboxFromPreset(car);
  const result = simulate(car.engine, chassis, gearbox, { ...DEFAULT_TEST_CONFIG, testType: "zeroToHundred" });
  const curves = buildEngineCurves(car.engine);
  const vehicle = deriveVehicle(car.engine, curves, chassis, gearbox);
  console.log(
    [
      car.id.padEnd(22),
      pad(result.reachedHundredAtS?.toFixed(2) ?? "--", 6),
      pad(ref.zeroToHundredS.toFixed(1), 5),
      pad(Math.round(result.theoreticalTopSpeedKph), 5),
      pad(ref.topSpeedKph + (ref.limited ? "L" : ""), 5),
      pad(Math.round(result.peakHp), 5),
      pad(ref.hp, 5),
      pad(Math.round(result.peakTorqueNm), 5),
      pad(ref.torqueNm || "-", 5),
      pad(vehicle.finalDrive.toFixed(2), 5),
      pad(Math.round(result.peakWheelSpinPercent), 5),
    ].join(" "),
  );
}
