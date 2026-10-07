"use client";

import {
  aeroKitAvailable,
  applyAeroKit,
  RIDE_HEIGHT_OFFSET_MAX_MM,
  RIDE_HEIGHT_OFFSET_MIN_MM,
  STOCK_AERO_KIT,
} from "@/lib/physics/aeroKit";
import { BODY_TYPE_PRESETS, defaultTyresFor } from "@/lib/physics/defaults";
import { REAL_CAR_PRESETS, RealCarPreset } from "@/lib/physics/realCars";
import { AeroKitConfig, BodyType, ChassisConfig, RearWing, TyreCompound, TyreType, Underbody } from "@/lib/physics/types";
import BodyTypeIcon from "./BodyTypeIcon";
import {
  ContinueButton,
  FOCUS_RING,
  formatUnitValue,
  OptionButton,
  SectionCard,
  Slider,
  StepHeader,
  ToggleSwitch,
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

const REAR_WING_LABELS: Record<RearWing, string> = {
  none: "None",
  low: "Low downforce",
  high: "High downforce",
};

const UNDERBODY_LABELS: Record<Underbody, string> = {
  standard: "Standard",
  diffuser: "Flat floor + diffuser",
};

const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;

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
  const kit = value.aeroKit ?? STOCK_AERO_KIT;
  const kitAero = applyAeroKit(preset, kit);
  const updateKit = (patch: Partial<AeroKitConfig>) => onChange({ ...value, aeroKit: { ...kit, ...patch } });

  const setBodyType = (bodyType: BodyType) => {
    onSelectRealCar(null);
    onChange({
      ...value,
      bodyType,
      weightKg: BODY_TYPE_PRESETS[bodyType].weightKg,
      activeAero: undefined,
      // Like weight, the aero setup starts from standard for a new body.
      aeroKit: undefined,
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

      <SectionCard title="Aero" tag="CHS-03">
        {!aeroKitAvailable(value.bodyType) ? (
          <p className="text-xs text-zinc-500">
            An F1 car&rsquo;s aero is its whole regulated package, already part of its coefficients - there&rsquo;s
            nothing to bolt on here.
          </p>
        ) : (
          <fieldset disabled={!!realCar} className={`space-y-6 ${realCar ? "opacity-50" : ""}`}>
            {realCar && (
              <p className="text-xs text-amber-400/90 -mb-2">
                Aero is locked to the standard {realCar.make} {realCar.model}. Choose &ldquo;Custom Build&rdquo;
                above to modify it.
              </p>
            )}
            <Slider
              label="Ride Height"
              value={kit.rideHeightOffsetMm}
              valueLabel={
                kit.rideHeightOffsetMm === 0
                  ? "Standard"
                  : `${kit.rideHeightOffsetMm > 0 ? "+" : ""}${kit.rideHeightOffsetMm} mm`
              }
              min={RIDE_HEIGHT_OFFSET_MIN_MM}
              max={RIDE_HEIGHT_OFFSET_MAX_MM}
              step={5}
              onChange={(v) => updateKit({ rideHeightOffsetMm: v })}
              minLabel={`${RIDE_HEIGHT_OFFSET_MIN_MM} mm`}
              maxLabel={`+${RIDE_HEIGHT_OFFSET_MAX_MM} mm`}
              recommended={0}
              helpText={`Ground clearance ${Math.round(preset.dimensions.rideHeightM * 1000 + kit.rideHeightOffsetMm)} mm (standard ${Math.round(preset.dimensions.rideHeightM * 1000)} mm). Also moves the centre of gravity.`}
            />
            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">Rear Wing</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(REAR_WING_LABELS) as RearWing[]).map((rearWing) => (
                  <OptionButton key={rearWing} active={kit.rearWing === rearWing} onClick={() => updateKit({ rearWing })}>
                    {REAR_WING_LABELS[rearWing]}
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">Underbody</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(UNDERBODY_LABELS) as Underbody[]).map((underbody) => (
                  <OptionButton
                    key={underbody}
                    active={kit.underbody === underbody}
                    onClick={() => updateKit({ underbody })}
                  >
                    {UNDERBODY_LABELS[underbody]}
                  </OptionButton>
                ))}
              </div>
            </div>
            <ToggleSwitch
              label="Front Splitter"
              checked={kit.frontSplitter}
              onChange={(frontSplitter) => updateKit({ frontSplitter })}
              description="Adds front downforce for very little drag"
            />
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 font-mono text-xs text-zinc-400">
              <div>
                Cd {preset.dragCoefficient.toFixed(2)} &rarr;{" "}
                <span className="text-zinc-100">{kitAero.dragCoefficient.toFixed(2)}</span> · Cl{" "}
                {signed(preset.liftCoefficient)} &rarr; <span className="text-zinc-100">{signed(kitAero.liftCoefficient)}</span>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">
                Representative estimates, applied to the simulation as well as the aero readout. Cl &gt; 0 is
                downforce.
              </div>
            </div>
          </fieldset>
        )}
      </SectionCard>

      <ContinueButton onClick={onContinue}>Continue to Engine &rarr;</ContinueButton>
    </div>
  );
}
