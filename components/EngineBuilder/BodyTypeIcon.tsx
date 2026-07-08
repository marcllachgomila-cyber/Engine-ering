import { BodyType } from "@/lib/physics/types";

interface BodyTypeIconProps {
  bodyType: BodyType;
  className?: string;
}

function Wheels({ cx1, cx2 }: { cx1: number; cx2: number }) {
  return (
    <>
      <circle cx={cx1} cy={38} r={7} fill="currentColor" />
      <circle cx={cx2} cy={38} r={7} fill="currentColor" />
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
          <Wheels cx1={28} cx2={76} />
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
          <Wheels cx1={24} cx2={78} />
        </svg>
      );
  }
}
