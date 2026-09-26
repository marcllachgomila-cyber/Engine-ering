"use client";

import { BODY_TYPE_PRESETS, defaultTyresFor } from "@/lib/physics/defaults";
import { REAL_CAR_PRESETS, RealCarPreset } from "@/lib/physics/realCars";
import { BodyType, ChassisConfig, TyreCompound, TyreType } from "@/lib/physics/types";
import BodyTypeIcon from "./BodyTypeIcon";
import {
  ContinueButton,
  FOCUS_RING,
  formatUnitValue,
  OptionButton,
  SectionCard,
  Slider,
  StepHeader,
} from "./FormControls";
import { RealCarPresetCard } from "./RealCarPresetCard";

const BODY_TYPE_LABELS: Record<BodyType, string> = {
  minivan: "Minivan",
  suv: "SUV",
  supercar: "Supercar",
  f1: "F1",
};

const TYRE_TYPE_LABELS: Record<TyreType, string> = {
  slick: "Slick",
  standard: "Standard",
};

const TYRE_COMPOUND_LABELS: Record<TyreCompound, string> = {
  soft: "Soft",
  medium: "Medium",
  hard: "Hard",
  intermediate: "Intermediate",
  wet: "Wet",
};

interface ChassisFormProps {
  value: ChassisConfig;
  onChange: (chassis: ChassisConfig) => void;
  onContinue: () => void;
  realCar: RealCarPreset | null;
  onSelectRealCar: (car: RealCarPreset | null) => void;
}

export default function ChassisForm({
  value,
  onChange,
  onContinue,
  realCar,
  onSelectRealCar,
}: ChassisFormProps) {
  const preset = BODY_TYPE_PRESETS[value.bodyType];
  const carsForBodyType = REAL_CAR_PRESETS[value.bodyType];

  const setBodyType = (bodyType: BodyType) => {
    onSelectRealCar(null);
    onChange({
      ...value,
      bodyType,
      weightKg: BODY_TYPE_PRESETS[bodyType].weightKg,
      activeAero: undefined,
      ...defaultTyresFor(bodyType),
    });
  };

  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 1 of 4"
        title="Design Your Chassis"
        description="Pick a body, set the weight, and dial in the wheels and tyres."
      />

      <SectionCard title="Body" tag="CHS-01">
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-3">
            Body Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(BODY_TYPE_LABELS) as BodyType[]).map((bodyType) => (
              <button
                key={bodyType}
                type="button"
                onClick={() => setBodyType(bodyType)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${FOCUS_RING} ${
                  value.bodyType === bodyType
                    ? "bg-amber-500/10 border-amber-500 text-amber-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                <BodyTypeIcon bodyType={bodyType} className="w-full h-10" />
                <span className="text-sm font-mono">{BODY_TYPE_LABELS[bodyType]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-3">
            Start From
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onSelectRealCar(null)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-center transition-colors ${FOCUS_RING} ${
                !realCar
                  ? "bg-amber-500/10 border-amber-500 text-amber-400"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              <span className="font-semibold">Custom Build</span>
              <span className="text-[10px] text-zinc-500">Set everything yourself</span>
            </button>
            {carsForBodyType.map((car) => (
              <RealCarPresetCard
                key={car.id}
                car={car}
                active={realCar?.id === car.id}
                onClick={() => onSelectRealCar(car)}
              />
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Sets engine, gearbox, weight, and wheels. Tyres stay yours to tune.
          </p>
        </div>

        <fieldset
          disabled={!!realCar}
          className={`space-y-6 ${realCar ? "opacity-50" : ""}`}
        >
          {realCar && (
            <p className="text-xs text-amber-400/90 -mb-2">
              Weight and wheels are locked to the {realCar.make} {realCar.model}.
              Choose &ldquo;Custom Build&rdquo; above to set them yourself.
            </p>
          )}
          <Slider
            label="Weight"
            value={value.weightKg}
            valueLabel={formatUnitValue(value.weightKg, "kg")}
            min={preset.weightMinKg}
            max={preset.weightMaxKg}
            step={10}
            onChange={(v) => onChange({ ...value, weightKg: v })}
            minLabel={formatUnitValue(preset.weightMinKg, "kg")}
            maxLabel={formatUnitValue(preset.weightMaxKg, "kg")}
            recommended={preset.weightKg}
            helpText={`Total weight, engine and everything else included. Recommended: ${formatUnitValue(preset.weightKg, "kg")}`}
          />
        </fieldset>
      </SectionCard>

      <SectionCard title="Wheels & Tyres" tag="CHS-02">
        <fieldset
          disabled={!!realCar}
          className={realCar ? "opacity-50" : undefined}
        >
        {realCar && (
          <p className="text-xs text-amber-400/90 mb-4">
            Wheel size is locked to the {realCar.make} {realCar.model}. Choose
            &ldquo;Custom Build&rdquo; in Step 1 to set it yourself.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Front Wheel
            </h3>
            <div className="space-y-4">
              <Slider
                label="Diameter"
                value={value.frontWheelDiameterIn}
                valueLabel={formatUnitValue(value.frontWheelDiameterIn, "″")}
                min={10}
                max={25}
                step={1}
                onChange={(v) => onChange({ ...value, frontWheelDiameterIn: v })}
                minLabel={formatUnitValue(10, "″")}
                maxLabel={formatUnitValue(25, "″")}
                recommended={20}
                helpText={`Recommended: ${formatUnitValue(20, "″")}`}
              />
              <Slider
                label="Width"
                value={value.frontWheelWidthMm}
                valueLabel={formatUnitValue(value.frontWheelWidthMm, "mm")}
                min={155}
                max={355}
                step={5}
                onChange={(v) => onChange({ ...value, frontWheelWidthMm: v })}
                minLabel={formatUnitValue(155, "mm")}
                maxLabel={formatUnitValue(355, "mm")}
                recommended={235}
                helpText={`Recommended: ${formatUnitValue(235, "mm")}`}
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Rear Wheel
            </h3>
            <div className="space-y-4">
              <Slider
                label="Diameter"
                value={value.rearWheelDiameterIn}
                valueLabel={formatUnitValue(value.rearWheelDiameterIn, "″")}
                min={10}
                max={25}
                step={1}
                onChange={(v) => onChange({ ...value, rearWheelDiameterIn: v })}
                minLabel={formatUnitValue(10, "″")}
                maxLabel={formatUnitValue(25, "″")}
                recommended={21}
                helpText={`Recommended: ${formatUnitValue(21, "″")}`}
              />
              <Slider
                label="Width"
                value={value.rearWheelWidthMm}
                valueLabel={formatUnitValue(value.rearWheelWidthMm, "mm")}
                min={155}
                max={355}
                step={5}
                onChange={(v) => onChange({ ...value, rearWheelWidthMm: v })}
                minLabel={formatUnitValue(155, "mm")}
                maxLabel={formatUnitValue(355, "mm")}
                recommended={275}
                helpText={`Recommended: ${formatUnitValue(275, "mm")}`}
              />
            </div>
          </div>
        </div>
        </fieldset>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Tyre Type</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYRE_TYPE_LABELS) as TyreType[]).map((tyreType) => (
              <OptionButton
                key={tyreType}
                active={value.tyreType === tyreType}
                onClick={() => onChange({ ...value, tyreType })}
              >
                {TYRE_TYPE_LABELS[tyreType]}
              </OptionButton>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Tyre Compound
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYRE_COMPOUND_LABELS) as TyreCompound[]).map((tyreCompound) => (
              <OptionButton
                key={tyreCompound}
                active={value.tyreCompound === tyreCompound}
                onClick={() => onChange({ ...value, tyreCompound })}
              >
                {TYRE_COMPOUND_LABELS[tyreCompound]}
              </OptionButton>
            ))}
          </div>
        </div>

        <Slider
          label="Tyre Pressure"
          value={value.tyrePressurePsi}
          valueLabel={formatUnitValue(value.tyrePressurePsi, "psi")}
          min={20}
          max={50}
          step={1}
          onChange={(v) => onChange({ ...value, tyrePressurePsi: v })}
          minLabel={formatUnitValue(20, "psi")}
          maxLabel={formatUnitValue(50, "psi")}
          recommended={preset.optimalTyrePressurePsi}
          helpText={`Recommended: ${formatUnitValue(preset.optimalTyrePressurePsi, "psi")}`}
        />
      </SectionCard>

      <ContinueButton onClick={onContinue}>Continue to Engine &rarr;</ContinueButton>
    </div>
  );
}
