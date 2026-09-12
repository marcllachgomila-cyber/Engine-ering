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
    "Add forced induction. Turbo (and supercharged) give the biggest torque-per-liter boost, and power is just torque × RPM.",
    "Push the redline higher. Peak power lands around 80–90% of redline, so raising it moves both when and how much power peaks.",
    "Grow the displacement. Power scales roughly with displacement × aspiration multiplier.",
    "More cylinders help a little at the top end, but it's a small effect next to displacement and aspiration.",
  ],
  torque: [
    "Grow the displacement first. Peak torque scales almost directly with it.",
    "Choose turbocharging. It has the highest torque-per-liter multiplier of the three aspiration types here.",
    "Don't chase cylinder count for torque. It barely moves the number.",
    "Redline doesn't change peak torque much either. It lands around 45–55% of redline regardless of where the redline is set.",
  ],
  topspeed: [
    "Maximize peak power. Theoretical top speed is where drive force in top gear matches aerodynamic drag, so more power pushes that point higher.",
    "Raise the redline. It lets top gear pull to a higher road speed before hitting the limiter.",
    "Go turbo or supercharged. Forced induction is the most direct lever on power-per-liter, which is the most direct lever on top speed.",
    "Avoid the Wind condition. A headwind straight off the nose only ever adds drag, which caps top speed lower.",
  ],
  acceleration: [
    "Chase power-to-weight, not raw power. Vehicle weight is derived from your engine's own size, so a smaller, boosted engine often accelerates harder than a huge one with similar output.",
    "Mind the traction limit. Wheel force is capped by tire grip, so beyond a point extra torque just spins the tires off the line instead of adding acceleration.",
    "Go turbo. Its torque plateau kicks in earlier and holds through more of the rev range than a peaky NA curve, keeping wheel force high through every gear.",
    "Test in dry conditions. Wet and rain cut tire grip substantially, capping how much force you can put down.",
  ],
};

const RECOMMENDED: Record<Topic, string> = {
  power:
    "Turbocharged, 6–8L displacement, 9,000+ RPM redline, more cylinders (10–16) for a bit more top-end.",
  torque:
    "Turbocharged, push displacement toward 8.0L. Cylinder count and redline barely move this one, so spend your budget elsewhere.",
  topspeed:
    "Turbocharged or supercharged, 9,000+ RPM redline, 7–8 gears (keeps top gear pulling longer), Dry or Wet conditions (never Wind).",
  acceleration:
    "Wheel Spin at 10%, Traction Control On, Dry conditions, rear wheel diameter 28–30\" (more grip), front wheel diameter 20–22\" (less rotating mass), 5–6 gears (fewer, longer-pulling gears), Turbocharged aspiration.",
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
