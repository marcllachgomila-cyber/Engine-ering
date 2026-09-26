"use client";

import { useState } from "react";

type Topic = "power" | "torque" | "topspeed" | "acceleration";

const TOPIC_LABELS: Record<Topic, string> = {
  power: "Peak Power",
  torque: "Peak Torque",
  topspeed: "Theoretical Top Speed",
  acceleration: "Max Acceleration",
};

const TIPS: Record<Topic, string[]> = {
  power: [
    "Add boost. Torque comes from BMEP × displacement, and boost multiplies BMEP: about 12.5 bar NA, around 24 bar at 1 bar of boost. Power is just torque × RPM.",
    "Push the redline higher. Peak power lands near redline, so raising it moves both when and how much power peaks.",
    "Grow the displacement. At a given BMEP, torque scales directly with it.",
    "Cylinder count doesn't change torque. BMEP and displacement set it, and more cylinders only add friction and weight.",
    "Consider a rotary. Each rotor fires every revolution, so it sweeps twice its quoted displacement, and it peaks late, so it rewards a high redline.",
  ],
  torque: [
    "Grow the displacement first. Peak torque is BMEP × displacement / 4π, so it scales directly.",
    "Turn up the boost. Every extra bar of boost adds roughly another NA engine's worth of BMEP.",
    "Don't chase cylinder count for torque. It doesn't move the number.",
    "Redline doesn't change peak torque either. It only moves where in the rev range the torque arrives.",
  ],
  topspeed: [
    "Maximize peak power. Top speed is where wheel power only just covers drag, and drag power grows with speed cubed, so doubling power buys about 26% more speed.",
    "Leave the final drive on Recommended. It gears top gear to hit the power peak right at the drag limit; too short and you hit the rev limiter first.",
    "Go turbo or supercharged. Forced induction is the most direct lever on power-per-liter, which is the most direct lever on top speed.",
    "Avoid the Wind condition. A headwind straight off the nose only ever adds drag, which caps top speed lower.",
  ],
  acceleration: [
    "Chase power-to-weight, not raw power. Every kilogram of the weight you set has to be accelerated.",
    "Mind the traction limit. Wheel force is capped at grip × the load on the driven wheels, so beyond a point extra torque just spins the tyres off the line.",
    "Pick the drivetrain for the power. AWD puts the whole car's weight on driven wheels; RWD gains grip as weight shifts back under acceleration, while FWD loses it.",
    "Go turbo. Its torque plateau kicks in earlier and holds through more of the rev range than a peaky NA curve, keeping wheel force high through every gear.",
    "Test in dry conditions. Wet and rain cut tire grip substantially, capping how much force you can put down.",
    "Try a turbo rotary. Each rotor fires twice as often as a piston cylinder and the engine weighs far less, so a boosted 2–3 rotor makes big power for very little mass.",
  ],
};

const RECOMMENDED: Record<Topic, string> = {
  power:
    "Turbocharged with high boost, 6–8L displacement, 9,000+ RPM redline.",
  torque:
    "Turbocharged with high boost, push displacement toward 8.0L. Cylinder count and redline don't move this one, so spend your budget elsewhere.",
  topspeed:
    "Turbocharged or supercharged, 9,000+ RPM redline, 7–8 gears (keeps top gear pulling longer), Dry or Wet conditions (never Wind).",
  acceleration:
    "AWD, Traction Control On, Dry conditions, wide tyres (more grip), a dual-clutch gearbox (near-instant shifts), Turbocharged aspiration.",
};

export default function TipsBox() {
  const [topic, setTopic] = useState<Topic | null>(null);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md">
      <div className="px-5 py-3 border-b border-zinc-800/80">
        <span className="flex items-center gap-2 text-sm font-medium text-amber-400">
          <span aria-hidden>&#128161;</span> Tuning Tips
        </span>
      </div>
      <div className="px-5 py-5">
        {!topic ? (
          <>
            <p className="text-sm text-zinc-400 mb-3">
              What do you want to improve?
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-zinc-700 text-zinc-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
                >
                  {TOPIC_LABELS[t]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-zinc-200">
                Improving {TOPIC_LABELS[topic]}
              </p>
              <button
                type="button"
                onClick={() => setTopic(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Choose another
              </button>
            </div>
            <ul className="space-y-2">
              {TIPS[topic].map((tip) => (
                <li key={tip} className="text-sm text-zinc-300 flex gap-2">
                  <span className="text-amber-400 shrink-0" aria-hidden>
                    &bull;
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                Recommended Settings
              </div>
              <p className="text-sm text-zinc-300">{RECOMMENDED[topic]}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
