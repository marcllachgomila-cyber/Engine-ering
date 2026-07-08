"use client";

import { BODY_TYPE_PRESETS } from "@/lib/physics/defaults";
import { BodyType, ChassisConfig } from "@/lib/physics/types";
import BodyTypeIcon from "./BodyTypeIcon";
import { ContinueButton, OptionButton, SectionCard, StepHeader } from "./FormControls";

const BODY_TYPE_LABELS: Record<BodyType, string> = {
  minivan: "Minivan",
  suv: "SUV",
  supercar: "Supercar",
};

interface ChassisFormProps {
  value: ChassisConfig;
  onChange: (chassis: ChassisConfig) => void;
  onContinue: () => void;
}

export default function ChassisForm({ value, onChange, onContinue }: ChassisFormProps) {
  const preset = BODY_TYPE_PRESETS[value.bodyType];

  const setBodyType = (bodyType: BodyType) => {
    onChange({
      ...value,
      bodyType,
      weightKg: BODY_TYPE_PRESETS[bodyType].weightKg,
    });
  };

  return (
    <div className="w-full space-y-8">
      <StepHeader
        step="Step 1 of 3"
        title="Design Your Chassis"
        description="Pick a body, set the weight, and dial in the wheels and tyres."
      />

      <SectionCard title="Body">
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-3">
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
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                <BodyTypeIcon bodyType={bodyType} className="w-full h-10" />
                <span className="text-sm font-mono">{BODY_TYPE_LABELS[bodyType]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-slate-300">Weight</label>
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
          <p className="text-xs text-slate-500 mt-1">
            Recommended: {preset.weightKg.toLocaleString()} kg for a {BODY_TYPE_LABELS[value.bodyType].toLowerCase()}.
            The engine and wheels you pick add mass on top of this.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Wheels & Tyres">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
              Front Wheel
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">Diameter</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.frontWheelDiameterIn}&Prime;
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={32}
                  step={1}
                  value={value.frontWheelDiameterIn}
                  onChange={(e) =>
                    onChange({ ...value, frontWheelDiameterIn: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">Recommended: 25&Prime;</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">Width</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.frontWheelWidthMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={185}
                  max={335}
                  step={5}
                  value={value.frontWheelWidthMm}
                  onChange={(e) =>
                    onChange({ ...value, frontWheelWidthMm: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">Recommended: 235mm</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">
              Rear Wheel
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">Diameter</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.rearWheelDiameterIn}&Prime;
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={32}
                  step={1}
                  value={value.rearWheelDiameterIn}
                  onChange={(e) =>
                    onChange({ ...value, rearWheelDiameterIn: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">Recommended: 26&Prime;</p>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-sm font-medium text-slate-300">Width</label>
                  <span className="text-lg font-mono text-amber-400">
                    {value.rearWheelWidthMm}mm
                  </span>
                </div>
                <input
                  type="range"
                  min={185}
                  max={335}
                  step={5}
                  value={value.rearWheelWidthMm}
                  onChange={(e) =>
                    onChange({ ...value, rearWheelWidthMm: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Recommended: 275mm - wider rear (drive) tires add grip.
                </p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Bigger wheels overall add rotating mass, which costs a little acceleration.
        </p>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-slate-300">Tyre Pressure</label>
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
          <p className="text-xs text-slate-500 mt-1">
            Recommended: 32 psi - too low or too high both cost grip.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-sm font-medium text-slate-300">Wheel Spin</label>
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
          <p className="text-xs text-slate-500 mt-1">
            Recommended: 10% - a little intentional slip uses the tire&apos;s peak
            grip; too little or too much both waste it.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
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
          <p className="text-xs text-slate-500 mt-2">
            Off risks wheelspin costing you grip once torque exceeds the tires&apos;
            limit.
          </p>
        </div>
      </SectionCard>

      <ContinueButton onClick={onContinue}>Continue to Engine &rarr;</ContinueButton>
    </div>
  );
}
