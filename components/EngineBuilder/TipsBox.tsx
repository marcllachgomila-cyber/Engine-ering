"use client";

import { useState } from "react";

type Topic = "power" | "torque" | "topspeed";

const TOPIC_LABELS: Record<Topic, string> = {
  power: "Peak Power",
  torque: "Peak Torque",
  topspeed: "Theoretical Top Speed",
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
    "Don't worry about the extra weight from a bigger build. It mainly hurts acceleration and launch traction, not top speed.",
  ],
};

export default function TipsBox() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-amber-400">
          <span aria-hidden>&#128161;</span> Tuning Tips
        </span>
        <span className="text-slate-500 text-sm">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          {!topic ? (
            <>
              <p className="text-sm text-slate-400 mb-3">
                What do you want to improve?
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    className="px-3 py-1.5 rounded-lg text-sm border border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
                  >
                    {TOPIC_LABELS[t]}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-200">
                  Improving {TOPIC_LABELS[topic]}
                </p>
                <button
                  type="button"
                  onClick={() => setTopic(null)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Choose another
                </button>
              </div>
              <ul className="space-y-2">
                {TIPS[topic].map((tip) => (
                  <li key={tip} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-amber-400 shrink-0" aria-hidden>
                      &bull;
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
