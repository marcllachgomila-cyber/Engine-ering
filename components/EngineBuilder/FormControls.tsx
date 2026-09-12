"use client";

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
      className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
        active
          ? "bg-amber-500 border-amber-500 text-zinc-950 font-semibold"
          : disabled
            ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
            : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </h2>
      {children}
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
      className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-lg py-4 transition-colors"
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
      <div className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-1">
        {step}
      </div>
      <h1 className="text-3xl font-bold text-zinc-50 tracking-tight">{title}</h1>
      <p className="text-zinc-400 mt-2">{description}</p>
    </div>
  );
}
