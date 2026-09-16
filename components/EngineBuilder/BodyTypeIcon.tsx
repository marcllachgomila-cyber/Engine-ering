import { BodyType } from "@/lib/physics/types";

interface BodyTypeIconProps {
  bodyType: BodyType;
  className?: string;
}

function Wheels({ cx1, cx2, r = 7 }: { cx1: number; cx2: number; r?: number }) {
  return (
    <>
      <circle cx={cx1} cy={38} r={r} stroke="currentColor" strokeWidth={2} />
      <circle cx={cx1} cy={38} r={2.5} fill="currentColor" />
      <circle cx={cx2} cy={38} r={r} stroke="currentColor" strokeWidth={2} />
      <circle cx={cx2} cy={38} r={2.5} fill="currentColor" />
    </>
  );
}

// A sportier spoked wheel for the supercar - same ring-and-hub shape as
// `Wheels`, plus four short cardinal spokes.
function SpokedWheel({ cx }: { cx: number }) {
  const cy = 38;
  const r = 7;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={2} fill="currentColor" />
      <line x1={cx} y1={cy - r + 1} x2={cx} y2={cy - 3} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
      <line x1={cx} y1={cy + r - 1} x2={cx} y2={cy + 3} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
      <line x1={cx - r + 1} y1={cy} x2={cx - 3} y2={cy} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
      <line x1={cx + r - 1} y1={cy} x2={cx + 3} y2={cy} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
    </>
  );
}

export default function BodyTypeIcon({ bodyType, className }: BodyTypeIconProps) {
  switch (bodyType) {
    case "minivan":
      return (
        <svg viewBox="0 0 100 50" className={className} fill="none">
          <path
            d="M8 38 L8 20 Q8 14 16 14 L70 14 Q80 14 84 22 L90 30 L90 38 Z"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <line x1="34" y1="14" x2="34" y2="30" stroke="currentColor" strokeWidth={1.5} />
          <line x1="58" y1="14" x2="58" y2="30" stroke="currentColor" strokeWidth={1.5} />
          <line x1="8" y1="30" x2="90" y2="30" stroke="currentColor" strokeWidth={1.5} />
          {/* Side mirror */}
          <path
            d="M68 20 L72 18 L72 22 Z"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Door handles */}
          <line x1="42" y1="33" x2="46" y2="33" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          <line x1="62" y1="33" x2="66" y2="33" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          {/* Rear light */}
          <line x1="11" y1="33" x2="11" y2="37" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <Wheels cx1={26} cx2={72} />
        </svg>
      );
    case "suv":
      return (
        <svg viewBox="0 0 100 50" className={className} fill="none">
          <path
            d="M10 38 L10 24 L20 24 L28 16 L64 16 L74 24 L92 24 L92 38 Z"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <line x1="46" y1="16" x2="46" y2="24" stroke="currentColor" strokeWidth={1.5} />
          <line x1="20" y1="24" x2="92" y2="24" stroke="currentColor" strokeWidth={1.5} />
          {/* Roof rail */}
          <line x1="30" y1="15" x2="62" y2="15" stroke="currentColor" strokeWidth={1} />
          {/* Side mirror */}
          <path
            d="M66 22 L70 20 L70 24 Z"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Door handles */}
          <line x1="36" y1="29" x2="40" y2="29" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          <line x1="56" y1="29" x2="60" y2="29" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          {/* Rear light */}
          <line x1="13" y1="27" x2="13" y2="31" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <Wheels cx1={28} cx2={76} r={7.5} />
        </svg>
      );
    case "supercar":
      return (
        <svg viewBox="0 0 100 50" className={className} fill="none">
          <path
            d="M6 38 L10 32 L22 20 Q30 15 42 15 L58 15 Q66 16 72 22 L90 30 L94 38 Z"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <path
            d="M28 20 L38 20 L44 28 L24 28 Z"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Side mirror */}
          <path
            d="M20 21 L24 19 L24 23 Z"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Door handle */}
          <line x1="32" y1="31" x2="37" y2="31" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          {/* Side intake */}
          <line x1="48" y1="27" x2="55" y2="33" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
          {/* Rear spoiler */}
          <path
            d="M88 23 L94 21 L94 27"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Front splitter */}
          <line x1="8" y1="34" x2="14" y2="35" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          <SpokedWheel cx={24} />
          <SpokedWheel cx={78} />
        </svg>
      );
    case "f1":
      return (
        <svg viewBox="0 0 100 50" className={className} fill="none">
          {/* Chassis: pointed nose rising to a cockpit peak, sloping back
              over the engine cover to a low, flat-floored tail. */}
          <path
            d="M4 36 L4 34 L30 25 L40 20 L48 18 L56 21 L70 24 L82 30 L86 34 L86 37 L60 37 L30 37 Z"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* Halo, arcing over the cockpit opening */}
          <path
            d="M42 19 Q50 8 58 19"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          {/* Front wing */}
          <path
            d="M2 37 L2 33 L16 32 L16 36 Z"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Rear wing on its endplate */}
          <path
            d="M90 14 L90 31 M90 18 L75 18"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={20} cy={37} r={8} stroke="currentColor" strokeWidth={2.5} />
          <circle cx={20} cy={37} r={2} fill="currentColor" />
          <circle cx={80} cy={37} r={8} stroke="currentColor" strokeWidth={2.5} />
          <circle cx={80} cy={37} r={2} fill="currentColor" />
        </svg>
      );
  }
}
