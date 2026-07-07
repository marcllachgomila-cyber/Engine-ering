"use client";

import { EngineConfig, EngineLayout } from "@/lib/physics/types";

interface Bank {
  angleDeg: number;
  count: number;
}

function splitEvenly(total: number, banks: number): number[] {
  const base = Math.floor(total / banks);
  const remainder = total - base * banks;
  return Array.from({ length: banks }, (_, i) => base + (i < remainder ? 1 : 0));
}

function computeBanks(cylinders: number, layout: EngineLayout): Bank[] {
  switch (layout) {
    case "inline":
      return [{ angleDeg: -90, count: cylinders }];
    case "flat": {
      const [a, b] = splitEvenly(cylinders, 2);
      return [
        { angleDeg: 180, count: a },
        { angleDeg: 0, count: b },
      ];
    }
    case "v": {
      const [a, b] = splitEvenly(cylinders, 2);
      return [
        { angleDeg: -122, count: a },
        { angleDeg: -58, count: b },
      ];
    }
    case "w": {
      const [a, b, c, d] = splitEvenly(cylinders, 4);
      return [
        { angleDeg: -138, count: a },
        { angleDeg: -106, count: b },
        { angleDeg: -74, count: c },
        { angleDeg: -42, count: d },
      ];
    }
  }
}

const LAYOUT_CODE: Record<EngineLayout, string> = {
  inline: "I",
  v: "V",
  flat: "F",
  w: "W",
};

const ASPIRATION_LABEL: Record<EngineConfig["aspiration"], string> = {
  na: "N/A",
  turbo: "TURBO",
  supercharged: "S/C",
};

const ORIGIN_X = 150;
const ORIGIN_Y = 220;
const CYLINDER_SPACING = 21;
const FIRST_CYLINDER_DIST = 34;
const CYLINDER_RADIUS = 9;

export default function EnginePreview({ engine }: { engine: EngineConfig }) {
  const banks = computeBanks(engine.cylinders, engine.layout);
  const spinDuration = Math.max(0.4, 3.2 - engine.redlineRpm / 4200);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
        Live Preview
      </div>
      <svg viewBox="0 0 300 260" className="w-full h-auto">
        {banks.map((bank, bankIndex) => {
          const angleRad = (bank.angleDeg * Math.PI) / 180;
          const dx = Math.cos(angleRad);
          const dy = Math.sin(angleRad);
          const lastDist = FIRST_CYLINDER_DIST + (bank.count - 1) * CYLINDER_SPACING;
          return (
            <g key={bankIndex}>
              <line
                x1={ORIGIN_X}
                y1={ORIGIN_Y}
                x2={ORIGIN_X + dx * (lastDist + CYLINDER_RADIUS)}
                y2={ORIGIN_Y + dy * (lastDist + CYLINDER_RADIUS)}
                stroke="#3f4652"
                strokeWidth={18}
                strokeLinecap="round"
              />
              {Array.from({ length: bank.count }, (_, i) => {
                const dist = FIRST_CYLINDER_DIST + i * CYLINDER_SPACING;
                const cx = ORIGIN_X + dx * dist;
                const cy = ORIGIN_Y + dy * dist;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={CYLINDER_RADIUS}
                    fill="#1a1d23"
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          );
        })}

        <circle cx={ORIGIN_X} cy={ORIGIN_Y} r={16} fill="#0d0f13" stroke="#52545c" strokeWidth={2} />
        <g style={{ transformOrigin: `${ORIGIN_X}px ${ORIGIN_Y}px` }}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${ORIGIN_X} ${ORIGIN_Y}`}
            to={`360 ${ORIGIN_X} ${ORIGIN_Y}`}
            dur={`${spinDuration}s`}
            repeatCount="indefinite"
          />
          <line
            x1={ORIGIN_X}
            y1={ORIGIN_Y}
            x2={ORIGIN_X}
            y2={ORIGIN_Y - 12}
            stroke="#f59e0b"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div className="flex items-center justify-between mt-2">
        <div className="font-mono font-bold text-lg text-slate-50">
          {LAYOUT_CODE[engine.layout]}
          {engine.cylinders}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{engine.displacementL.toFixed(1)}L</span>
          <span aria-hidden>&middot;</span>
          <span>{engine.redlineRpm.toLocaleString()} RPM</span>
          {engine.aspiration !== "na" && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold">
              {ASPIRATION_LABEL[engine.aspiration]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
