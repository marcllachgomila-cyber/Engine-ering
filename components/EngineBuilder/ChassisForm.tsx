"use client";

import { BODY_TYPE_PRESETS } from "@/lib/physics/defaults";
import { REAL_CAR_PRESETS, RealCarPreset } from "@/lib/physics/realCars";
import { BodyType, ChassisConfig, TyreCompound, TyreType } from "@/lib/physics/types";
import BodyTypeIcon from "./BodyTypeIcon";
import { ContinueButton, OptionButton, SectionCard, StepHeader } from "./FormControls";

const BODY_TYPE_LABELS: Record<BodyType, string> = {
  minivan: "Minivan",
  suv: "SUV",
  supercar: "Supercar",
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
    });
  };

  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 1 of 4"
        title="Design Your Chassis"
        description="Pick a body, set the weight, and dial in the wheels and tyres."
      />

      <SectionCard title="Body">
        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-3">
            Body Type
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(BODY_TYPE_LABELS) as BodyType[]).map((bodyType) => (
              <button
                key={bodyType}
                type="button"
                onClick={() => setBodyType(bodyType)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
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
          <div className="flex flex-wrap gap-2">
            <OptionButton active={!realCar} onClick={() => onSelectRealCar(null)}>
              Custom Build
            </OptionButton>
            {carsForBodyType.map((car) => (
              <OptionButton
                key={car.id}
                active={realCar?.id === car.id}
                onClick={() => onSelectRealCar(car)}
              >
                {car.make} {car.model}
              </OptionButton>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Picking a real car sets its engine, gearbox, weight, and wheels for
            you. Tyre type, compound, pressure, wheel spin, and traction
            control stay yours to tune.
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
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-sm font-medium text-zinc-300">Weight</label>
              <span className="text-lg font-mono text-amber-400">
                {value.weightKg.toLocaleString()} kg
              </span>
            </div>
            <input
              type="range"
              min={preset.weightMinKg}
              max={preset.weightMaxKg}
              step={10}
              value={value.weightKg}
              onChange={(e) => onChange({ ...value, weightKg: parseInt(e.target.value, 10) })}
              className="w-full accent-amber-500"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Recommended: {preset.weightKg.toLocaleString()} kg for a {BODY_TYPE_LABELS[value.bodyType].toLowerCase()}.
              The engine and wheels you pick add mass on top of this.
            </p>
          </div>
        </fieldset>
      </SectionCard>

      <SectionCard title="Wheels & Tyres">
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
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-zinc-300">Diameter</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.frontWheelDiameterIn}&Prime;
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={34}
                  step={1}
                  value={value.frontWheelDiameterIn}
                  onChange={(e) =>
                    onChange({ ...value, frontWheelDiameterIn: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Recommended: 25&Prime;</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-zinc-300">Width</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.frontWheelWidthMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={155}
                  max={355}
                  step={5}
                  value={value.frontWheelWidthMm}
                  onChange={(e) =>
                    onChange({ ...value, frontWheelWidthMm: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Recommended: 235mm</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Rear Wheel
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-zinc-300">Diameter</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.rearWheelDiameterIn}&Prime;
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={34}
                  step={1}
                  value={value.rearWheelDiameterIn}
                  onChange={(e) =>
                    onChange({ ...value, rearWheelDiameterIn: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Recommended: 26&Prime;</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-zinc-300">Width</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.rearWheelWidthMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={155}
                  max={355}
                  step={5}
                  value={value.rearWheelWidthMm}
                  onChange={(e) =>
                    onChange({ ...value, rearWheelWidthMm: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Recommended: 275mm - wider rear (drive) tires add grip.
                </p>
              </div>
            </div>
          </div>
        </div>
        </fieldset>
        <p className="text-xs text-zinc-500">
          Bigger wheels overall add rotating mass, which costs a little acceleration.
        </p>

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
          <p className="text-xs text-zinc-500 mt-2">
            Slicks (no tread, like an F1 dry tyre) grip harder in the dry but lose most of
            that grip the moment the road is wet. Standard tyres are the steadier
            all-weather choice.
          </p>
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
          <p className="text-xs text-zinc-500 mt-2">
            Soft grips hardest but fades soonest in the wet; hard is the most
            conservative dry compound. Intermediate and wet trade dry-weather grip for
            the ability to clear water once conditions turn damp or soaked.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-zinc-300">Tyre Pressure</label>
            <span className="text-lg font-mono text-amber-400">
              {value.tyrePressurePsi} psi
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={50}
            step={1}
            value={value.tyrePressurePsi}
            onChange={(e) =>
              onChange({ ...value, tyrePressurePsi: parseInt(e.target.value, 10) })
            }
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Recommended: 32 psi - too low or too high both cost grip.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-zinc-300">Wheel Spin</label>
            <span className="text-lg font-mono text-amber-400">
              {value.wheelSpinPercent}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value.wheelSpinPercent}
            onChange={(e) =>
              onChange({ ...value, wheelSpinPercent: parseInt(e.target.value, 10) })
            }
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Recommended: 10% - a little intentional slip uses the tire&apos;s peak
            grip; too little or too much both waste it.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">
            Traction Control
          </label>
          <div className="flex flex-wrap gap-2">
            <OptionButton
              active={value.tractionControl}
              onClick={() => onChange({ ...value, tractionControl: true })}
            >
              On
            </OptionButton>
            <OptionButton
              active={!value.tractionControl}
              onClick={() => onChange({ ...value, tractionControl: false })}
            >
              Off
            </OptionButton>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Off risks wheelspin costing you grip once torque exceeds the tires&apos;
            limit.
          </p>
        </div>
      </SectionCard>

      <ContinueButton onClick={onContinue}>Continue to Engine &rarr;</ContinueButton>
    </div>
  );
}
