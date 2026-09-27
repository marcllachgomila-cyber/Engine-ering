"use client";

import { useMemo } from "react";
import { recommendedGearRatios, MAX_GEAR_RATIO, MIN_GEAR_RATIO } from "@/lib/physics/gearRatios";
import { buildEngineCurves } from "@/lib/physics/engineModel";
import { deriveVehicle, MAX_FINAL_DRIVE, MIN_FINAL_DRIVE } from "@/lib/physics/vehicleModel";
import { computeTractiveForceData } from "@/lib/physics/tractiveForce";
import {
  AutoShiftStrategy,
  ChassisConfig,
  Drivetrain,
  EngineConfig,
  GearboxConfig,
  TransmissionType,
} from "@/lib/physics/types";
import { RealCarPreset } from "@/lib/physics/realCars";
import {
  ContinueButton,
  FOCUS_RING,
  formatUnitValue,
  OptionButton,
  SectionCard,
  Slider,
  StepHeader,
} from "./FormControls";
import TractiveForceGraph from "../Simulation/TractiveForceGraph";

const GEAR_COUNT_OPTIONS = [5, 6, 7, 8];

const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  manual: "Manual",
  auto: "Automatic",
};

const DRIVETRAIN_LABELS: Record<Drivetrain, string> = {
  fwd: "Front-Wheel Drive",
  rwd: "Rear-Wheel Drive",
  awd: "All-Wheel Drive",
};

const AUTO_SHIFT_LABELS: Record<AutoShiftStrategy, string> = {
  maxRpm: "Max RPM",
  maxTorque: "Max Torque",
  maxPower: "Max Power",
};

const AUTO_SHIFT_DESCRIPTIONS: Record<AutoShiftStrategy, string> = {
  maxRpm: "Holds every gear to the limiter - best acceleration.",
  maxTorque: "Shifts at peak torque - keeps the strongest pull.",
  maxPower: "Shifts at peak power - fastest corner to corner.",
};

interface GearboxFormProps {
  value: GearboxConfig;
  onChange: (config: GearboxConfig) => void;
  onContinue: () => void;
  engine: EngineConfig;
  chassis: ChassisConfig;
  realCar: RealCarPreset | null;
}

export default function GearboxForm({
  value,
  onChange,
  onContinue,
  engine,
  chassis,
  realCar,
}: GearboxFormProps) {
  const recommended = recommendedGearRatios(value.gearCount);

  const { tractiveData, recommendedFinalDrive } = useMemo(() => {
    const curves = buildEngineCurves(engine);
    const vehicle = deriveVehicle(engine, curves, chassis, value);
    const recommendedVehicle = deriveVehicle(engine, curves, chassis, {
      ...value,
      finalDrive: undefined,
    });
    return {
      tractiveData: computeTractiveForceData(curves, vehicle),
      recommendedFinalDrive: recommendedVehicle.finalDrive,
    };
  }, [engine, chassis, value]);
  const finalDrive = value.finalDrive ?? recommendedFinalDrive;

  const setGearCount = (gearCount: number) => {
    onChange({ ...value, gearCount, gearRatios: recommendedGearRatios(gearCount) });
  };

  const setGearRatio = (index: number, ratio: number) => {
    const gearRatios = value.gearRatios.slice();
    gearRatios[index] = ratio;
    onChange({ ...value, gearRatios });
  };

  const resetGearRatios = () => {
    onChange({ ...value, gearRatios: recommendedGearRatios(value.gearCount) });
  };

  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 3 of 4"
        title="Choose Your Gearbox"
        description="Set the transmission, gear ratios, and which wheels put the power down."
      />

      {realCar && (
        <p className="text-xs text-amber-400/90">
          Gearbox specs are locked to the {realCar.make} {realCar.model}. Go
          back to Step 1 and choose &ldquo;Custom Build&rdquo; to edit them
          yourself.
        </p>
      )}
      <fieldset
        disabled={!!realCar}
        className={`space-y-8 ${realCar ? "opacity-50" : ""}`}
      >
      <SectionCard title="Transmission" tag="GBX-01">
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TRANSMISSION_LABELS) as TransmissionType[]).map((t) => (
              <OptionButton
                key={t}
                active={value.transmissionType === t}
                onClick={() =>
                  onChange({
                    ...value,
                    transmissionType: t,
                    // A dual-clutch box is always computer-shifted, so manual forces single.
                    dualClutch: t === "manual" ? false : value.dualClutch,
                  })
                }
              >
                {TRANSMISSION_LABELS[t]}
              </OptionButton>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Manual takes every gear to the limiter.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Clutch
          </label>
          <div className="flex flex-wrap gap-2">
            <OptionButton
              active={value.dualClutch}
              disabled={value.transmissionType === "manual"}
              onClick={() => onChange({ ...value, dualClutch: true })}
            >
              Dual Clutch
            </OptionButton>
            <OptionButton
              active={!value.dualClutch}
              onClick={() => onChange({ ...value, dualClutch: false })}
            >
              Single Clutch
            </OptionButton>
          </div>
          {value.transmissionType === "manual" && (
            <p className="text-xs text-zinc-500 mt-2">
              Dual clutch needs an automatic &mdash; there&rsquo;s no manual version.
            </p>
          )}
        </div>

        {value.transmissionType === "auto" && (
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Shift Strategy
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(AUTO_SHIFT_LABELS) as AutoShiftStrategy[]).map((s) => (
                <OptionButton
                  key={s}
                  active={value.autoShiftStrategy === s}
                  onClick={() => onChange({ ...value, autoShiftStrategy: s })}
                >
                  {AUTO_SHIFT_LABELS[s]}
                </OptionButton>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {AUTO_SHIFT_DESCRIPTIONS[value.autoShiftStrategy]}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Gearbox" tag="GBX-02">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Gears</label>
            <span className="text-lg font-mono text-amber-400">{value.gearCount}-speed</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {GEAR_COUNT_OPTIONS.map((g) => (
              <OptionButton
                key={g}
                active={value.gearCount === g}
                onClick={() => setGearCount(g)}
              >
                {g}
              </OptionButton>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Changing gear count resets the ratios below to the recommended spread.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Drivetrain
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DRIVETRAIN_LABELS) as Drivetrain[]).map((d) => (
              <OptionButton
                key={d}
                active={value.drivetrain === d}
                onClick={() => onChange({ ...value, drivetrain: d })}
              >
                {DRIVETRAIN_LABELS[d]}
              </OptionButton>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            AWD puts the whole car&rsquo;s weight on driven wheels but loses more to
            the drivetrain (85% vs 90% efficient). RWD gains grip as weight shifts back
            under acceleration; FWD loses it.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Gear Ratios" tag="GBX-03">
        <div>
          <Slider
            label="Final Drive"
            value={finalDrive}
            valueLabel={`${formatUnitValue(finalDrive, "", 2)}${value.finalDrive === undefined ? " (auto)" : ""}`}
            min={MIN_FINAL_DRIVE}
            max={MAX_FINAL_DRIVE}
            step={0.01}
            onChange={(v) => onChange({ ...value, finalDrive: v })}
            minLabel={formatUnitValue(MIN_FINAL_DRIVE, "", 2)}
            maxLabel={formatUnitValue(MAX_FINAL_DRIVE, "", 2)}
            recommended={recommendedFinalDrive}
            helpText={`Recommended: ${formatUnitValue(recommendedFinalDrive, "", 2)}. Multiplies every gear. Recommended gears top gear to reach peak power right at the drag-limited top speed.`}
          />
          {value.finalDrive !== undefined && (
            <button
              type="button"
              onClick={() => onChange({ ...value, finalDrive: undefined })}
              className={`mt-2 rounded text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors ${FOCUS_RING}`}
            >
              Use Recommended Final Drive
            </button>
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-zinc-500">
            Lower = taller (top speed); higher = shorter (acceleration).
          </p>
          <button
            type="button"
            onClick={resetGearRatios}
            className={`shrink-0 rounded text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors ${FOCUS_RING}`}
          >
            Reset to Recommended
          </button>
        </div>
        <div className="space-y-4">
          {value.gearRatios.map((ratio, i) => (
            <Slider
              key={i}
              label={`Gear ${i + 1}`}
              value={ratio}
              valueLabel={formatUnitValue(ratio, "", 2)}
              min={MIN_GEAR_RATIO}
              max={MAX_GEAR_RATIO}
              step={0.01}
              onChange={(v) => setGearRatio(i, v)}
              minLabel={formatUnitValue(MIN_GEAR_RATIO, "", 2)}
              maxLabel={formatUnitValue(MAX_GEAR_RATIO, "", 2)}
              recommended={recommended[i]}
              helpText={`Recommended: ${formatUnitValue(recommended[i], "", 2)}`}
            />
          ))}
        </div>
        <TractiveForceGraph data={tractiveData} />
      </SectionCard>
      </fieldset>

      <ContinueButton onClick={onContinue}>
        Continue to Test Specifications &rarr;
      </ContinueButton>
    </div>
  );
}
