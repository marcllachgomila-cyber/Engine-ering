"use client";

// Units that read naturally glued to the number (no space): percentages,
// degree-prefixed units (°C), and prime marks for inches/feet.
const NO_SPACE_UNIT_PATTERN = /^(%|″|′|°)/;

// Shared keyboard-focus treatment for every interactive control in the app,
// so tabbing through a form shows one consistent amber ring instead of each
// browser's mismatched default outline.
export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70";

/**
 * Formats a number with its unit using one consistent convention across
 * the app: thousands separators by default, fixed decimals when asked for,
 * and a space before the unit except for %, ″/′, and °-prefixed units.
 */
export function formatUnitValue(value: number, unit: string, decimals = 0): string {
  const formatted = decimals > 0 ? value.toFixed(decimals) : value.toLocaleString();
  if (!unit) return formatted;
  return NO_SPACE_UNIT_PATTERN.test(unit) ? `${formatted}${unit}` : `${formatted} ${unit}`;
}

export function OptionButton({
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-all ${FOCUS_RING} ${
        active
          ? "bg-amber-500 border-amber-500 text-zinc-950 font-semibold shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]"
          : disabled
            ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
            : "border-zinc-700 text-zinc-300 hover:border-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

/**
 * A slider styled like a calibrated instrument dial: a digital LCD-style
 * readout, a graduated scale under the track, and an optional notch marking
 * a recommended/factory setting.
 */
export function Slider({
  label,
  value,
  valueLabel,
  min,
  max,
  step,
  onChange,
  minLabel,
  maxLabel,
  recommended,
  helpText,
  disabled,
}: {
  label: string;
  value: number;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
  recommended?: number;
  helpText?: string;
  disabled?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const recPct =
    recommended !== undefined ? ((recommended - min) / (max - min)) * 100 : null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-sm font-medium text-zinc-300">{label}</label>
        <span className="rounded-md border border-zinc-700 bg-black/40 px-2 py-0.5 font-mono text-base text-amber-400 tabular-nums shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)]">
          {valueLabel}
        </span>
      </div>
      <div className="relative py-2">
        <div className="relative h-1.5 rounded-full bg-zinc-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-amber-500/80"
            style={{ width: `${pct}%` }}
          />
          {recPct !== null && (
            <span
              aria-hidden
              className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-400/70"
              style={{ left: `${recPct}%` }}
            />
          )}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed focus-visible:outline-none [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[10px] [&::-moz-range-thumb]:rounded-[2px] [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-amber-200/60 [&::-moz-range-thumb]:bg-amber-400 [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-7px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[2px] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-amber-200/60 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgba(0,0,0,0.7)] [&::-webkit-slider-thumb]:transition-shadow focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(245,158,11,0.45),0_1px_2px_rgba(0,0,0,0.7)] focus-visible:[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(245,158,11,0.45)]"
        />
        <div className="mt-2.5 flex items-start justify-between" aria-hidden>
          {Array.from({ length: 11 }).map((_, i) => (
            <span
              key={i}
              className={`w-px ${i % 5 === 0 ? "h-2 bg-zinc-600" : "h-1 bg-zinc-800"}`}
            />
          ))}
        </div>
      </div>
      {(minLabel !== undefined || maxLabel !== undefined) && (
        <div className="-mt-1 flex justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-600">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      {helpText && <p className="text-xs text-zinc-500 mt-1">{helpText}</p>}
    </div>
  );
}

/**
 * A rocker-style ON/OFF switch for boolean settings, in place of a plain
 * checkbox, so binary flags read like a panel toggle rather than a form field.
 */
export function ToggleSwitch({
  label,
  checked,
  onChange,
  onLabel = "ON",
  offLabel = "OFF",
  description,
  disabled,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`${disabled ? "opacity-50" : ""} ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono font-bold tracking-wider transition-colors ${
              checked ? "text-zinc-600" : "text-zinc-300"
            }`}
          >
            {offLabel}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${FOCUS_RING} ${
              disabled ? "cursor-not-allowed" : ""
            } ${checked ? "border-amber-500/70 bg-amber-500/15" : "border-zinc-700 bg-zinc-950"}`}
          >
            <span
              className={`absolute inset-y-0.5 w-5 rounded-full bg-gradient-to-b transition-all ${
                checked
                  ? "left-[calc(100%-1.375rem)] from-amber-300 to-amber-500 shadow-[0_0_8px_rgba(253,181,36,0.55)]"
                  : "left-0.5 from-zinc-500 to-zinc-600"
              }`}
            />
          </button>
          <span
            className={`text-[10px] font-mono font-bold tracking-wider transition-colors ${
              checked ? "text-amber-400" : "text-zinc-600"
            }`}
          >
            {onLabel}
          </span>
        </div>
      </div>
      {description && <p className="text-xs text-zinc-500 mt-1.5">{description}</p>}
    </div>
  );
}

/**
 * Four L-shaped register marks in a panel's corners, like the alignment
 * marks on a technical drawing or PCB silkscreen. Parent must be `relative`.
 */
export function CornerMarks({ className = "border-zinc-600/50" }: { className?: string }) {
  const base = "absolute h-2.5 w-2.5 pointer-events-none";
  return (
    <>
      <span aria-hidden className={`${base} left-2.5 top-2.5 border-l border-t ${className}`} />
      <span aria-hidden className={`${base} right-2.5 top-2.5 border-r border-t ${className}`} />
      <span aria-hidden className={`${base} left-2.5 bottom-2.5 border-l border-b ${className}`} />
      <span aria-hidden className={`${base} right-2.5 bottom-2.5 border-r border-b ${className}`} />
    </>
  );
}

// Faint graph-paper ruling, applied as a background image rather than a
// visible grid - it should read as paper texture, not a drawn grid.
const BLUEPRINT_GRID =
  "bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:18px_18px]";

export function SectionCard({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md p-6 ${BLUEPRINT_GRID}`}
    >
      <CornerMarks />
      <div className="flex items-baseline justify-between gap-3 border-b border-zinc-800/70 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </h2>
        {tag && (
          <span className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-600">
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * A plain instrument-panel card (rounded, bordered, blurred) for grouping a
 * single stat, gauge, or graph - the same surface `SectionCard` uses, minus
 * its title bar, for places that need the surface without a heading.
 */
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md px-5 py-4 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/**
 * An amber tick + label + fading rule, used to break a long stack of panels
 * into named sections without the visual weight of a full `SectionCard`.
 */
export function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="h-px w-4 bg-amber-400/60" />
      <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-zinc-700 to-transparent" />
    </div>
  );
}

export function ContinueButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-lg py-4 transition-colors ${FOCUS_RING}`}
    >
      {children}
    </button>
  );
}

export function StepHeader({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden className="h-px w-4 bg-amber-400/60" />
        <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
          {step}
        </span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-amber-400/40 to-transparent" />
      </div>
      <h1 className="text-3xl font-bold text-zinc-50 tracking-tight">{title}</h1>
      <p className="text-zinc-400 mt-2">{description}</p>
    </div>
  );
}
