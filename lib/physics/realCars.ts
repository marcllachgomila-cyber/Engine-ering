import { BodyType, ChassisConfig, EngineConfig, GearboxConfig } from "./types";
import { recommendedGearRatios } from "./gearRatios";

// Picking a real car sets the engine and gearbox outright, plus everything
// in the chassis except the tyre/traction settings (tyre type, compound,
// pressure, wheel spin, traction control) - those stay driver-adjustable
// the same way they would on a real car. Gear ratios are re-derived from
// the recommended spread for the car's gear count rather than hand-modeled
// per car, matching how the custom-build gearbox step already works.
//
// Specs below are representative approximations of each real car's engine
// and chassis layout (like BODY_TYPE_PRESETS elsewhere in this file) rather
// than exact manufacturer figures - some real-world values (drivetrain,
// gear count, weight) are nudged to fit within this simulator's supported
// ranges (fwd/rwd/awd, 5-8 speed gearboxes, per-body-type weight bounds).

export interface RealCarPreset {
  id: string;
  make: string;
  model: string;
  category: BodyType;
  engine: EngineConfig;
  gearbox: Omit<GearboxConfig, "gearRatios">;
  chassis: Pick<
    ChassisConfig,
    | "weightKg"
    | "frontWheelDiameterIn"
    | "rearWheelDiameterIn"
    | "frontWheelWidthMm"
    | "rearWheelWidthMm"
  >;
}

function preset(p: RealCarPreset): RealCarPreset {
  return p;
}

export const REAL_CAR_PRESETS: Record<BodyType, RealCarPreset[]> = {
  minivan: [
    preset({
      id: "honda-odyssey",
      make: "Honda",
      model: "Odyssey",
      category: "minivan",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 3.5,
        redlineRpm: 6600,
        maxRevRpm: 6800,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "fwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2010,
        frontWheelDiameterIn: 19,
        rearWheelDiameterIn: 19,
        frontWheelWidthMm: 235,
        rearWheelWidthMm: 235,
      },
    }),
    preset({
      id: "toyota-sienna",
      make: "Toyota",
      model: "Sienna",
      category: "minivan",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 3.5,
        redlineRpm: 6500,
        maxRevRpm: 6700,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "fwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2000,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 235,
        rearWheelWidthMm: 235,
      },
    }),
    preset({
      id: "chrysler-pacifica",
      make: "Chrysler",
      model: "Pacifica",
      category: "minivan",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 3.6,
        redlineRpm: 6400,
        maxRevRpm: 6600,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "fwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2030,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 235,
        rearWheelWidthMm: 235,
      },
    }),
    preset({
      id: "kia-carnival",
      make: "Kia",
      model: "Carnival",
      category: "minivan",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 3.5,
        redlineRpm: 6300,
        maxRevRpm: 6500,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "fwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2020,
        frontWheelDiameterIn: 19,
        rearWheelDiameterIn: 19,
        frontWheelWidthMm: 235,
        rearWheelWidthMm: 235,
      },
    }),
    preset({
      id: "dodge-grand-caravan",
      make: "Dodge",
      model: "Grand Caravan",
      category: "minivan",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 3.6,
        redlineRpm: 6350,
        maxRevRpm: 6550,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 6,
        drivetrain: "fwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 1980,
        frontWheelDiameterIn: 17,
        rearWheelDiameterIn: 17,
        frontWheelWidthMm: 225,
        rearWheelWidthMm: 225,
      },
    }),
  ],
  suv: [
    preset({
      id: "toyota-rav4",
      make: "Toyota",
      model: "RAV4",
      category: "suv",
      engine: {
        cylinders: 4,
        layout: "inline",
        displacementL: 2.5,
        redlineRpm: 6600,
        maxRevRpm: 6800,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "fwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 1700,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 225,
        rearWheelWidthMm: 225,
      },
    }),
    preset({
      id: "ford-explorer",
      make: "Ford",
      model: "Explorer",
      category: "suv",
      engine: {
        cylinders: 4,
        layout: "inline",
        displacementL: 2.3,
        redlineRpm: 6000,
        maxRevRpm: 6300,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2050,
        frontWheelDiameterIn: 20,
        rearWheelDiameterIn: 20,
        frontWheelWidthMm: 255,
        rearWheelWidthMm: 255,
      },
    }),
    preset({
      id: "jeep-grand-cherokee",
      make: "Jeep",
      model: "Grand Cherokee",
      category: "suv",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 3.6,
        redlineRpm: 6400,
        maxRevRpm: 6600,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2100,
        frontWheelDiameterIn: 20,
        rearWheelDiameterIn: 20,
        frontWheelWidthMm: 265,
        rearWheelWidthMm: 265,
      },
    }),
    preset({
      id: "chevrolet-tahoe",
      make: "Chevrolet",
      model: "Tahoe",
      category: "suv",
      engine: {
        cylinders: 8,
        layout: "v",
        displacementL: 5.3,
        redlineRpm: 5600,
        maxRevRpm: 5900,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2570,
        frontWheelDiameterIn: 20,
        rearWheelDiameterIn: 20,
        frontWheelWidthMm: 275,
        rearWheelWidthMm: 275,
      },
    }),
    preset({
      id: "bmw-x5",
      make: "BMW",
      model: "X5",
      category: "suv",
      engine: {
        cylinders: 6,
        layout: "inline",
        displacementL: 3.0,
        redlineRpm: 6500,
        maxRevRpm: 6800,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxTorque",
      },
      chassis: {
        weightKg: 2145,
        frontWheelDiameterIn: 20,
        rearWheelDiameterIn: 20,
        frontWheelWidthMm: 255,
        rearWheelWidthMm: 285,
      },
    }),
  ],
  supercar: [
    preset({
      id: "bugatti-chiron",
      make: "Bugatti",
      model: "Chiron",
      category: "supercar",
      engine: {
        cylinders: 16,
        layout: "w",
        displacementL: 8.0,
        redlineRpm: 6700,
        maxRevRpm: 6900,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 7,
        drivetrain: "rwd",
        dualClutch: true,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 1900,
        frontWheelDiameterIn: 20,
        rearWheelDiameterIn: 21,
        frontWheelWidthMm: 285,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "ferrari-f8-tributo",
      make: "Ferrari",
      model: "F8 Tributo",
      category: "supercar",
      engine: {
        cylinders: 8,
        layout: "v",
        displacementL: 3.9,
        redlineRpm: 8000,
        maxRevRpm: 8200,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 7,
        drivetrain: "rwd",
        dualClutch: true,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 1435,
        frontWheelDiameterIn: 20,
        rearWheelDiameterIn: 20,
        frontWheelWidthMm: 245,
        rearWheelWidthMm: 305,
      },
    }),
    preset({
      id: "lamborghini-huracan",
      make: "Lamborghini",
      model: "Huracan",
      category: "supercar",
      engine: {
        cylinders: 10,
        layout: "v",
        displacementL: 5.2,
        redlineRpm: 8500,
        maxRevRpm: 8700,
        aspiration: "na",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 7,
        drivetrain: "rwd",
        dualClutch: true,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 1422,
        frontWheelDiameterIn: 19,
        rearWheelDiameterIn: 20,
        frontWheelWidthMm: 245,
        rearWheelWidthMm: 305,
      },
    }),
    preset({
      id: "mclaren-720s",
      make: "McLaren",
      model: "720S",
      category: "supercar",
      engine: {
        cylinders: 8,
        layout: "v",
        displacementL: 4.0,
        redlineRpm: 8100,
        maxRevRpm: 8300,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 7,
        drivetrain: "rwd",
        dualClutch: true,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 1419,
        frontWheelDiameterIn: 19,
        rearWheelDiameterIn: 20,
        frontWheelWidthMm: 235,
        rearWheelWidthMm: 295,
      },
    }),
    preset({
      id: "porsche-911-turbo-s",
      make: "Porsche",
      model: "911 Turbo S",
      category: "supercar",
      engine: {
        cylinders: 6,
        layout: "flat",
        displacementL: 3.8,
        redlineRpm: 7200,
        maxRevRpm: 7500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: true,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 1640,
        frontWheelDiameterIn: 20,
        rearWheelDiameterIn: 21,
        frontWheelWidthMm: 255,
        rearWheelWidthMm: 315,
      },
    }),
  ],
  // Every season here runs the same 1.6L turbo V6 hybrid power unit and
  // 8-speed seamless-shift gearbox mandated since 2014 - this sim has no
  // field for the electric (MGU-K/MGU-H) half of the power unit, so these
  // are ICE-only approximations, same caveat as everywhere else in this
  // file. What actually changes season to season is what the regulations
  // changed: minimum weight crept up nearly every year as hybrid hardware
  // got heavier, and the wheels jumped from 13" to 18" for the 2022
  // ground-effect rules (13" is below this simulator's wheel-diameter
  // floor, so pre-2022 seasons are nudged up to 15"; the real 405mm rear
  // tyre width is likewise nudged down to this simulator's 355mm ceiling).
  f1: [
    preset({
      id: "f1-2017",
      make: "Formula 1",
      model: "2017 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 728,
        frontWheelDiameterIn: 15,
        rearWheelDiameterIn: 15,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2018",
      make: "Formula 1",
      model: "2018 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 733,
        frontWheelDiameterIn: 15,
        rearWheelDiameterIn: 15,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2019",
      make: "Formula 1",
      model: "2019 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 743,
        frontWheelDiameterIn: 15,
        rearWheelDiameterIn: 15,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2020",
      make: "Formula 1",
      model: "2020 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 746,
        frontWheelDiameterIn: 15,
        rearWheelDiameterIn: 15,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2021",
      make: "Formula 1",
      model: "2021 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 752,
        frontWheelDiameterIn: 15,
        rearWheelDiameterIn: 15,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2022",
      make: "Formula 1",
      model: "2022 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 798,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2023",
      make: "Formula 1",
      model: "2023 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 798,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2024",
      make: "Formula 1",
      model: "2024 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 798,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2025",
      make: "Formula 1",
      model: "2025 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        redlineRpm: 10500,
        maxRevRpm: 11500,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        weightKg: 800,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
    preset({
      id: "f1-2026",
      make: "Formula 1",
      model: "2026 Season",
      category: "f1",
      engine: {
        cylinders: 6,
        layout: "v",
        displacementL: 1.6,
        // New-generation power unit: roughly 50/50 electric/combustion
        // split and no MGU-H, but the ICE stays a 1.6L V6 turbo - modeled
        // here as revving slightly higher, up against this simulator's
        // redline ceiling.
        redlineRpm: 11000,
        maxRevRpm: 12000,
        aspiration: "turbo",
        fuelType: "petrol",
      },
      gearbox: {
        transmissionType: "auto",
        gearCount: 8,
        drivetrain: "rwd",
        dualClutch: false,
        autoShiftStrategy: "maxPower",
      },
      chassis: {
        // New-generation cars are mandated smaller and lighter than the
        // 2022-2025 ground-effect era.
        weightKg: 768,
        frontWheelDiameterIn: 18,
        rearWheelDiameterIn: 18,
        frontWheelWidthMm: 305,
        rearWheelWidthMm: 355,
      },
    }),
  ],
};

export function findRealCarPreset(id: string): RealCarPreset | undefined {
  for (const category of Object.values(REAL_CAR_PRESETS)) {
    const found = category.find((car) => car.id === id);
    if (found) return found;
  }
  return undefined;
}

export function gearboxFromPreset(preset: RealCarPreset): GearboxConfig {
  return {
    ...preset.gearbox,
    gearRatios: recommendedGearRatios(preset.gearbox.gearCount),
  };
}
