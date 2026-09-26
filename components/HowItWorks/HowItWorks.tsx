"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { FOCUS_RING } from "@/components/EngineBuilder/FormControls";

interface FormulaVar {
  // LaTeX source, exactly as it appears in the formula's own `tex` above -
  // rendered through KaTeX (not typed out separately) so the symbol shown in
  // the legend can never drift from the symbol actually used in the formula.
  symbol: string;
  desc: string;
}

function VarSymbol({ tex }: { tex: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: false, throwOnError: false, strict: "ignore" }),
    [tex],
  );
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Renders real LaTeX (KaTeX) so formulas are typeset the way a textbook or
// Wikipedia's math renderer would show them, instead of as plain ASCII text.
// An optional `vars` list renders as a collapsible legend beneath the
// formula, so the meaning of each symbol is one click away instead of
// requiring readers to hunt back through the surrounding prose.
function Formula({ tex, vars }: { tex: string; vars?: FormulaVar[] }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: true, throwOnError: false, strict: "ignore" }),
    [tex],
  );
  return (
    <div className="my-4 w-full">
      <div
        className="w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-5 py-4 text-[1.05rem] text-amber-100 [&_.katex-display]:my-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {vars && vars.length > 0 && (
        <details className="group mt-1.5 w-full rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-4 py-2 open:pb-3">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-amber-400">
            <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
              &#9656;
            </span>
            Variables
          </summary>
          <dl className="mt-2 space-y-1.5">
            {vars.map((v) => (
              <div key={v.symbol} className="flex items-baseline gap-3 text-sm leading-relaxed">
                <dt className="shrink-0 whitespace-nowrap text-amber-300">
                  <VarSymbol tex={v.symbol} />
                </dt>
                <dd className="text-zinc-400">{v.desc}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

// For the handful of places the model is genuinely a step-by-step procedure
// (a loop with a branch) rather than a single equation - kept as labeled
// pseudocode instead of forcing control flow into math notation.
function Pseudocode({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Algorithm
      </div>
      <pre className="font-mono text-[13px] leading-relaxed text-amber-200 whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-300 leading-relaxed mb-3">{children}</p>;
}

function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mt-6 mb-2 first:mt-0">
      {children}
    </h3>
  );
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="space-y-1.5 mb-3">{children}</ul>;
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="text-sm text-zinc-300 flex gap-2 leading-relaxed">
      <span className="text-amber-400 shrink-0" aria-hidden>
        &bull;
      </span>
      <span>{children}</span>
    </li>
  );
}

interface Chapter {
  id: string;
  num: string;
  title: string;
  render: () => ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    id: "overview",
    num: "00",
    title: "Overview & Conventions",
    render: () => (
      <>
        <P>
          Every build on this site — the engine, gearbox, chassis and tyres you configure — is
          reduced to a small set of physical parameters and then driven through the same
          time-stepped physics model regardless of which test you run. This document describes
          that model chapter by chapter: what quantity each formula computes, what it depends on,
          and where it is used. Numbers below are written as symbols, not the specific tuning
          constants baked into the simulator, so this reads as a description of the model rather
          than a lookup table of its calibration.
        </P>
        <H3>Units</H3>
        <P>
          Internally, everything is computed in SI base units — metres, seconds, kilograms,
          Newtons, and radians per second for angular speed — and only converted to the
          driver-facing units (km/h, hp, Nm, °C, psi, inches, mm) at the edges, for display.
        </P>
        <H3>Time stepping</H3>
        <P>
          Every test (acceleration, braking, hot lap) is simulated as a sequence of small,
          fixed-size time steps <code>Δt</code> rather than solved in closed form. At each step the
          model computes a single net acceleration <code>a</code>, then advances velocity and
          position with explicit (forward) Euler integration:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
v(t+\Delta t) &= v(t) + a(t)\,\Delta t \\
x(t+\Delta t) &= x(t) + v(t+\Delta t)\,\Delta t
\end{aligned}`}
          vars={[
            { symbol: String.raw`v(t)`, desc: "velocity at time t" },
            { symbol: String.raw`x(t)`, desc: "position at time t" },
            { symbol: String.raw`a(t)`, desc: "net acceleration at time t, as derived in the chapters below" },
            { symbol: String.raw`\Delta t`, desc: "the fixed simulation time step" },
          ]}
        />
        <P>
          Small enough steps make this a close approximation of the true (continuous)
          motion. Every chapter below describes how <code>a(t)</code> — the net acceleration at a
          given instant — is derived from the engine, gearbox, tyres and aerodynamics for that
          instant, and each test simply repeats this loop until its own stopping condition is met
          (a fixed duration, a target distance, a target speed, or a full stop).
        </P>
      </>
    ),
  },
  {
    id: "engine",
    num: "01",
    title: "Engine — Torque & Power",
    render: () => (
      <>
        <P>
          The engine is not simulated cylinder-by-cylinder; instead it is represented as a
          continuous torque curve <code>T(rpm)</code> shaped from the configuration you choose
          (displacement, aspiration, boost, fuel type, redline and rev limit), from which power is
          derived directly.
        </P>
        <H3>Peak torque from BMEP</H3>
        <P>
          Rather than inventing a torque figure, peak torque is worked out from displacement and
          brake mean effective pressure (BMEP) — the average cylinder pressure that ends up as
          useful work at the crankshaft. A four-stroke cylinder makes one power stroke every two
          revolutions, which gives:
        </P>
        <Formula
          tex={String.raw`T_{\text{peak}} = \frac{\text{BMEP} \cdot V_d}{4\pi}`}
          vars={[
            { symbol: String.raw`T_{\text{peak}}`, desc: "peak crankshaft torque, in N·m" },
            { symbol: String.raw`\text{BMEP}`, desc: "peak brake mean effective pressure, in Pa (1 bar = 10⁵ Pa)" },
            { symbol: String.raw`V_d`, desc: "swept volume (displacement), in m³" },
          ]}
        />
        <P>
          A naturally aspirated petrol engine manages about 12.5 bar. Boost raises the intake
          pressure from 1 bar to <code>1 + p_boost</code> bar absolute, and cylinder pressure scales
          with it, a little less than proportionally for petrol (charge heating and knock
          margin) and a little more for diesel, which has no knock limit:
        </P>
        <Formula
          tex={String.raw`\text{BMEP} = \text{BMEP}_{\text{NA}} \cdot (1 + p_{\text{boost}}) \cdot \eta_{\text{boost}}`}
          vars={[
            { symbol: String.raw`\text{BMEP}_{\text{NA}}`, desc: "unboosted BMEP: ≈12.5 bar petrol, ≈9 bar diesel" },
            { symbol: String.raw`p_{\text{boost}}`, desc: "boost pressure above atmospheric, in bar (0 for naturally aspirated)" },
            { symbol: String.raw`\eta_{\text{boost}}`, desc: "how well boost turns into cylinder pressure: 0.95 petrol, 1.15 diesel" },
          ]}
        />
        <P>
          That lands turbo petrol engines at 18–25 bar and turbo diesels at 20–25 bar, the ranges
          real engines run at. As a check, a Bugatti Chiron&rsquo;s 8.0 L at about 25 bar gives
          2.5×10⁶ × 0.008 / 4π ≈ 1,600 N·m, what the real car makes. Cylinder count doesn&rsquo;t
          appear at all: at the same BMEP and displacement, more cylinders make the same torque.
        </P>
        <H3>Curve shape</H3>
        <P>
          The torque curve across the rev range is a normalised shape <code>s(x)</code>, where 1
          means peak torque, as a function of RPM as a fraction of redline:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
x &= \frac{\text{rpm}}{\text{rpm}_{\text{redline}}} \
T(\text{rpm}) &= T_{\text{peak}}\, s(x)
\end{aligned}`}
          vars={[
            { symbol: String.raw`x`, desc: "current RPM as a fraction of redline" },
            { symbol: String.raw`T(\text{rpm})`, desc: "torque output at a given RPM" },
            { symbol: String.raw`s(x)`, desc: "normalised curve shape, set by aspiration and fuel" },
          ]}
        />
        <Ul>
          <Li>
            <b>Naturally aspirated</b> engines have one broad hump that peaks high in the band
            (about 72% of redline) and still makes about 90% of peak at redline, which is why NA
            power peaks right up near the limiter.
          </Li>
          <Li>
            <b>Turbocharged</b> engines make roughly their unboosted torque off boost. The turbo
            then spools up to a flat plateau from about a third of redline, and the plateau fades
            to about 85% by redline as the turbo runs out of flow.
          </Li>
          <Li>
            <b>Supercharged</b> engines are belt-driven, so their plateau starts much earlier.
          </Li>
          <Li>
            <b>Diesels</b> spool early and fade harder toward their low redline.
          </Li>
        </Ul>
        <P>
          Torque is only evaluated between idle RPM and the hard rev limit. A car can be pushed
          past its tuned redline, up to the rev limit, but torque falls away quickly enough there
          that power drops toward the limiter.
        </P>
        <H3>Power</H3>
        <P>
          Power is not an independent curve — it falls directly out of torque and angular speed,
          exactly as in a real engine:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
\omega(\text{rpm}) &= \text{rpm} \cdot \frac{2\pi}{60} \\
P(\text{rpm}) &= T(\text{rpm}) \cdot \omega(\text{rpm}) \\
P_{\text{hp}} &= \frac{P(\text{rpm})}{745.7}
\end{aligned}`}
          vars={[
            { symbol: String.raw`\omega(\text{rpm})`, desc: "angular speed at a given RPM, in radians per second" },
            { symbol: String.raw`T(\text{rpm})`, desc: "torque at that RPM, from the curve above" },
            { symbol: String.raw`P(\text{rpm})`, desc: "power at that RPM, in watts" },
            { symbol: String.raw`P_{\text{hp}}`, desc: "power converted to horsepower (1 hp = 745.7 W)" },
          ]}
        />
        <P>
          Because power keeps climbing as long as RPM grows faster than torque falls, peak power
          always lands at a higher RPM than peak torque — typically well above it — which matches
          the shape of a real dyno chart rather than power peaking at the same point torque does.
        </P>
        <H3>Internal friction & combustion torque</H3>
        <P>
          The torque curve above is the net (usable, output) torque at the crankshaft. Underneath
          it, the model separately tracks an internal friction torque — mechanical rubbing losses
          plus pumping losses through the intake and exhaust — which grows with engine size
          (displacement and cylinder count add more friction surfaces) and rises faster than
          linearly with RPM, since both reciprocating and pumping losses accelerate at high engine
          speed:
        </P>
        <Formula
          tex={String.raw`T_{\text{fric}}(\text{rpm}) = k_{\text{fric}}(D, n_{\text{cyl}}) \cdot \text{ramp}\!\left(\frac{\text{rpm}}{\text{rpm}_{\max}}\right)`}
          vars={[
            { symbol: String.raw`T_{\text{fric}}(\text{rpm})`, desc: "internal friction torque (mechanical + pumping losses) at a given RPM" },
            { symbol: String.raw`k_{\text{fric}}(D, n_{\text{cyl}})`, desc: "friction scale factor, growing with displacement D and cylinder count n_cyl" },
            { symbol: String.raw`\text{rpm}_{\max}`, desc: "the engine's maximum (rev-limit) RPM, used to normalize the ramp" },
            { symbol: String.raw`\text{ramp}(\cdot)`, desc: "an increasing, faster-than-linear function of normalized RPM" },
          ]}
        />
        <P>
          where <code>ramp</code> is an increasing function of normalized RPM that grows faster
          than linear. The torque the combustion process must actually produce is then the net
          output torque plus whatever this friction term is consuming:
        </P>
        <Formula
          tex={String.raw`T_{\text{comb}}(\text{rpm}) = T(\text{rpm}) + T_{\text{fric}}(\text{rpm})`}
          vars={[
            { symbol: String.raw`T_{\text{comb}}(\text{rpm})`, desc: "torque the combustion process must actually produce" },
            { symbol: String.raw`T(\text{rpm})`, desc: "net output torque delivered at the crankshaft" },
            { symbol: String.raw`T_{\text{fric}}(\text{rpm})`, desc: "internal friction torque being consumed at that RPM" },
          ]}
        />
        <H3>Rotary (Wankel) engines</H3>
        <P>
          A rotary replaces pistons with triangular rotors turning inside an epitrochoid housing.
          Each of a rotor&rsquo;s three faces completes a full intake-compression-power-exhaust
          cycle per rotor revolution, and the rotor turns at a third of the eccentric (output)
          shaft&rsquo;s speed — so every rotor delivers one power stroke per shaft revolution,
          where a four-stroke cylinder delivers one every two. Rotary displacement is
          conventionally quoted as a single chamber per rotor, so the swept volume that goes into
          the BMEP formula is twice the quoted figure: a &ldquo;1.3 L&rdquo; twin-rotor sweeps
          2.6 L per two revolutions. Its long, thin combustion chamber loses much of its heat to
          the housing and burns incompletely, which shows up as a lower BMEP:
        </P>
        <Formula
          tex={String.raw`T_{\text{peak}}^{\text{rotary}} = \frac{k_{\text{rotary}}\, \text{BMEP} \cdot 2 D}{4\pi}`}
          vars={[
            { symbol: String.raw`D`, desc: "quoted rotary displacement (one chamber per rotor)" },
            { symbol: String.raw`k_{\text{rotary}}`, desc: "rotary BMEP factor (≈0.82), calibrated against the Mazda RX-8's 211 N·m" },
          ]}
        />
        <P>
          With no valvetrain to limit breathing, a rotary&rsquo;s torque peak sits later in the rev
          range and falls away more gently above it, and because every moving part simply spins
          — nothing reciprocates — its friction rises only linearly with RPM. Rotaries are also
          much lighter per unit of output (see the weight breakdown), and they are petrol
          only: the chamber shape can&rsquo;t reach the compression ratio a diesel needs.
        </P>
        <H3>Locating the true peaks</H3>
        <P>
          Because the analytic curve shape is combined with RPM-dependent scaling to get power,
          nothing guarantees the mathematical peak of the shape function lines up exactly with the
          actual peak torque or peak power once displayed. Rather than solve that analytically, the
          model scans the full usable RPM range in a large number of small steps, evaluates torque
          and power at each, and simply keeps the highest values found and the RPM at which they
          occurred — the same way a dyno run reports whatever RPM the pulls actually peaked at.
        </P>
      </>
    ),
  },
  {
    id: "friction",
    num: "02",
    title: "Friction & Traction",
    render: () => (
      <>
        <P>
          Every point where two surfaces meet under load — tyre against road, brake pad against
          rotor, piston against cylinder wall — is a friction problem, and this simulator leans on
          one governing idea throughout: the maximum horizontal force a contact patch can transmit
          is proportional to the load pressing it down, capped by a coefficient of friction. This
          chapter covers how that idea is used for driving and cornering grip; braking-specific
          friction (pads and rotors) is covered in its own chapter.
        </P>
        <H3>The traction limit</H3>
        <P>
          The classic Coulomb friction model says the maximum force before a surface slips is the
          normal load times a friction coefficient. Only the driven wheels can push the car, so
          the load that counts is the load on the driven axle:
        </P>
        <Formula
          tex={String.raw`F_{\max} = \mu_{\text{eff}}\, N_{\text{driven}}`}
          vars={[
            { symbol: String.raw`F_{\max}`, desc: "maximum horizontal force the driven tyres can transmit before slipping" },
            { symbol: String.raw`\mu_{\text{eff}}`, desc: "effective grip coefficient, built up below from tyre and condition factors" },
            { symbol: String.raw`N_{\text{driven}}`, desc: "normal load on the driven axle (the whole car for all-wheel drive)" },
          ]}
        />
        <P>
          This is the number that decides 0–100 times. The load on each axle isn&rsquo;t fixed:
          under acceleration, weight transfers toward the rear:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
N_{\text{rear}} &= m g \frac{b}{L} + m a \frac{h}{L} \\
N_{\text{front}} &= m g \frac{L - b}{L} - m a \frac{h}{L}
\end{aligned}`}
          vars={[
            { symbol: String.raw`L`, desc: "wheelbase" },
            { symbol: String.raw`b`, desc: "distance from the centre of gravity to the front axle, so b/L is the static rear weight share" },
            { symbol: String.raw`h`, desc: "centre-of-gravity height" },
            { symbol: String.raw`a`, desc: "longitudinal acceleration" },
          ]}
        />
        <P>
          So rear-wheel drive gains grip as it accelerates, front-wheel drive loses it, and
          all-wheel drive uses the whole car&rsquo;s weight either way. Wheelbase, weight split
          and CG height are representative figures per body type: a mid-engined supercar carries
          59% of its weight over the rear axle, a front-driven minivan only 43%. At the traction
          limit the acceleration is set by the traction force itself,{" "}
          <code>a = (F − R) / m</code> with <code>R</code> the drag and rolling resistance, so the
          limit is solved in closed form:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
F_{\max}^{\text{RWD}} &= \frac{\mu \left(N_{\text{rear},0} - R\,h/L\right)}{1 - \mu h / L} \\[4pt]
F_{\max}^{\text{FWD}} &= \frac{\mu \left(N_{\text{front},0} + R\,h/L\right)}{1 + \mu h / L}
\end{aligned}`}
          vars={[
            { symbol: String.raw`N_{\text{rear},0},\ N_{\text{front},0}`, desc: "static axle loads, including any aero downforce or lift" },
            { symbol: String.raw`R`, desc: "drag plus rolling resistance" },
          ]}
        />
        <H3>Building the effective grip coefficient</H3>
        <P>μ_eff is assembled by multiplying together every factor that scales grip up or down:</P>
        <Formula
          tex={String.raw`\begin{aligned}
\mu_{\text{eff}} = \ & \mu_{\text{base}}(\text{width}, \text{pressure}) \\
& \times\, k_{\text{cond}}(\text{condition}) \\
& \times\, k_{\text{type}}(\text{condition}) \\
& \times\, k_{\text{compound}}(\text{condition})
\end{aligned}`}
          vars={[
            { symbol: String.raw`\mu_{\text{eff}}`, desc: "the final effective grip coefficient" },
            { symbol: String.raw`\mu_{\text{base}}`, desc: "base coefficient of a road tyre (≈1.15), adjusted for tyre width and pressure" },
            { symbol: String.raw`k_{\text{cond}}`, desc: "multiplier for road condition (dry, wet, rain, headwind)" },
            { symbol: String.raw`k_{\text{type}}`, desc: "multiplier for tyre type (slick vs. treaded) under that condition" },
            { symbol: String.raw`k_{\text{compound}}`, desc: "multiplier for tyre compound (soft/medium/hard/intermediate/wet) under that condition" },
          ]}
        />
        <P>
          The results sit where real tyres do: about 1.1–1.15 for a road tyre, about 1.2–1.3 for
          a wide performance tyre, about 1.5 or more for a slick, and about 0.6–0.7 for a road
          tyre on a wet road.
        </P>
        <Ul>
          <Li>
            <b>Tyre width</b> on the driven axle — wider tyres put a larger contact patch on the
            road, which raises the base coefficient; narrower tyres lower it.
          </Li>
          <Li>
            <b>Tyre pressure</b> — grip peaks near a recommended pressure and falls off roughly in
            proportion to how far pressure deviates from it in either direction (over- or
            under-inflated both cost grip).
          </Li>
          <Li>
            <b>Road condition</b> — a baseline multiplier for dry, wet, rain, or a headwind
            condition that behaves like dry underfoot but costs speed through drag instead.
          </Li>
          <Li>
            <b>Tyre type</b> — slick (no tread) versus a standard treaded tyre, each with its own
            multiplier per road condition (slicks are stronger in the dry, much weaker once wet,
            since there is nowhere for water to escape).
          </Li>
          <Li>
            <b>Tyre compound</b> — a soft/medium/hard dry-weather range plus dedicated
            intermediate/wet compounds, each again with its own per-condition multiplier (soft
            grips hardest in the dry but falls off fastest once wet; the wet-weather compounds
            trade dry-grip ceiling for the ability to clear water and keep working once the road
            is damp or soaked).
          </Li>
        </Ul>
        <H3>Wheel spin</H3>
        <P>
          Wheel spin is an output of the simulation, not a setting. A tyre needs some slip to make
          any force at all: slip rises roughly in proportion to how much of the grip is in use, up
          to the tyre&rsquo;s peak at about 10% slip. If the drivetrain asks for more than{" "}
          <code>F_max</code>, traction control holds the tyre at that 10% optimum. Without it, the
          extra torque just spins the wheels up, and at twice the available grip they&rsquo;re
          spinning freely. The results show the wheel-spin trace and its peak.
        </P>
        <H3>Uncontrolled wheelspin</H3>
        <P>
          When the drivetrain&rsquo;s demanded force exceeds the traction limit, a car with traction
          control simply has its force clamped to that limit — a smooth cap. A car without
          traction control instead only realizes a fraction of that limit once it breaks loose,
          because kinetic friction while a tyre is actively sliding is lower than the static peak
          traction control keeps you right at the edge of:
        </P>
        <Formula
          tex={String.raw`F_{\text{drive}} =
\begin{cases}
F_{\text{wheel}}, & F_{\text{wheel}} \le F_{\max} \\[2pt]
F_{\max}, & F_{\text{wheel}} > F_{\max} \text{ and traction control on} \\[2pt]
k_{\text{slip}}\, F_{\max}, & F_{\text{wheel}} > F_{\max} \text{ and traction control off}
\end{cases}
\quad (k_{\text{slip}} < 1)`}
          vars={[
            { symbol: String.raw`F_{\text{drive}}`, desc: "the force actually realized at the driven wheels" },
            { symbol: String.raw`F_{\text{wheel}}`, desc: "force demanded by the drivetrain, from the Gearbox chapter" },
            { symbol: String.raw`F_{\max}`, desc: "the traction limit from above" },
            { symbol: String.raw`k_{\text{slip}}`, desc: "kinetic-friction fraction realized once a tyre breaks loose without traction control" },
          ]}
        />
        <H3>Rolling resistance</H3>
        <P>
          Separately from peak traction, every rolling tyre also constantly sheds a small amount
          of force to rolling resistance — energy lost to deforming the tyre carcass and tread as
          it rotates under load. Unlike aerodynamic drag this does not grow with speed; it is
          modeled as a constant fraction of the normal load:
        </P>
        <Formula
          tex={String.raw`F_{\text{roll}} = C_{rr}\, m\, g`}
          vars={[
            { symbol: String.raw`F_{\text{roll}}`, desc: "rolling-resistance force opposing motion" },
            { symbol: String.raw`C_{rr}`, desc: "rolling-resistance coefficient" },
            { symbol: String.raw`m`, desc: "vehicle mass" },
            { symbol: String.raw`g`, desc: "gravitational acceleration" },
          ]}
        />
        <P>
          where <code>C_rr</code> is a rolling-resistance coefficient (0.012). This force opposes motion in
          every test — acceleration, braking, and lap simulation alike — the same way it does on a
          real road.
        </P>
      </>
    ),
  },
  {
    id: "aero",
    num: "03",
    title: "Aerodynamics",
    render: () => (
      <>
        <P>
          Aerodynamic drag is the other major force resisting motion, and it is modeled with the
          standard quadratic drag equation from fluid dynamics:
        </P>
        <Formula
          tex={String.raw`F_{\text{drag}} = \tfrac{1}{2}\, \rho_{\text{air}}\, C_d\, A\, v_{\text{rel}}^{2}`}
          vars={[
            { symbol: String.raw`\rho_{\text{air}}`, desc: "air density, the standard sea-level reference value used throughout" },
            {
              symbol: String.raw`C_d`,
              desc: "drag coefficient, set by body type (a boxy minivan or SUV carries a higher coefficient than a low, shaped supercar body; an open-wheel F1 car runs higher still)",
            },
            { symbol: String.raw`A`, desc: "frontal area, also set by body type" },
            { symbol: String.raw`v_{\text{rel}}`, desc: "speed relative to the surrounding air, not just speed relative to the road" },
          ]}
        />
        <P>
          Because drag grows with the <em>square</em> of relative airspeed, it is a minor
          resistance at low speed and the dominant one as a car approaches its top speed — which is
          exactly why top speed exists as a distinct number a bigger engine can only push so far.
        </P>
        <H3>Headwind</H3>
        <P>
          One road condition models a steady headwind blowing straight off the nose. It never
          contributes to grip or braking the way wet or rain conditions do — its only effect is to
          add directly onto the car&rsquo;s own speed when computing relative airspeed, which only ever
          increases drag:
        </P>
        <Formula
          tex={String.raw`v_{\text{rel}} = v_{\text{car}} + v_{\text{headwind}}`}
          vars={[
            { symbol: String.raw`v_{\text{rel}}`, desc: "airspeed used in the drag equation above" },
            { symbol: String.raw`v_{\text{car}}`, desc: "the car's own speed relative to the road" },
            { symbol: String.raw`v_{\text{headwind}}`, desc: "the steady headwind speed added under the headwind road condition" },
          ]}
        />
        <P>
          This is why a headwind condition can only ever cost top speed and straight-line
          performance, never help it — there is no equivalent tailwind condition that subtracts
          from relative airspeed.
        </P>
        <H3>Downforce</H3>
        <P>
          A body shape doesn&rsquo;t just resist the air moving past it — it also reacts against it
          vertically, and the hot lap model uses the same quadratic form as drag to capture that,
          using a lift coefficient instead of a drag coefficient:
        </P>
        <Formula
          tex={String.raw`F_{\text{downforce}} = \tfrac{1}{2}\, \rho_{\text{air}}\, C_l\, A\, v^{2}`}
          vars={[
            {
              symbol: String.raw`C_l`,
              desc: "lift coefficient, set by body type - positive is genuine downforce (a supercar's splitter/diffuser/wing package, or an F1 car's far larger one), negative is aerodynamic lift (a boxy minivan or SUV, which have neither)",
            },
            { symbol: String.raw`A`, desc: "frontal area, same value used for drag" },
            { symbol: String.raw`v`, desc: "road speed" },
          ]}
        />
        <P>
          This force adds directly onto the car&rsquo;s static weight to get its total tyre normal
          load, which is what the Friction chapter&rsquo;s traction limit and the Hot Lap chapter&rsquo;s
          cornering/braking limits actually scale with — not weight alone:
        </P>
        <Formula
          tex={String.raw`N = m\,g + F_{\text{downforce}}(v)`}
          vars={[
            { symbol: String.raw`N`, desc: "total normal load the tyres press onto the road with, at this speed" },
            { symbol: String.raw`m\,g`, desc: "the car's static weight" },
          ]}
        />
        <P>
          Because this term grows with the square of speed just like drag does, a high-downforce
          car gets more grip exactly where it matters most — fast corners and hard braking from top
          speed — while paying for it with extra drag the whole time. A boxy road car with negative
          C_l instead slowly loses tyre load as it speeds up, the same lift a plane wing produces
          just working against it here instead of for it.
        </P>
      </>
    ),
  },
  {
    id: "drivetrain",
    num: "04",
    title: "Gearbox & Drivetrain",
    render: () => (
      <>
        <P>
          The gearbox sits between the engine&rsquo;s torque curve and the wheels, multiplying torque up
          (at the cost of road speed per RPM) through each gear&rsquo;s ratio and a final-drive
          ratio.
        </P>
        <H3>Tyre rolling radius</H3>
        <P>
          The wheel rolls on its tyre, not its rim, so the rolling radius is the rim radius plus
          the tyre&rsquo;s sidewall. The sidewall is the tread width times the aspect ratio (the
          &ldquo;35&rdquo; in 285/35 R20), which is set per body type: about 30% for a supercar and
          50–60% for an SUV or minivan. F1 tyres are specified by outer diameter instead: 670 mm on
          13&Prime; rims, 720 mm on 18&Prime;.
        </P>
        <Formula
          tex={String.raw`r_w = \frac{d_{\text{rim}}}{2} + w_{\text{tyre}} \cdot \text{AR}`}
          vars={[
            { symbol: String.raw`r_w`, desc: "rolling radius of the driven wheel" },
            { symbol: String.raw`d_{\text{rim}}`, desc: "rim diameter" },
            { symbol: String.raw`w_{\text{tyre}}`, desc: "tyre tread width" },
            { symbol: String.raw`\text{AR}`, desc: "tyre aspect ratio (sidewall height / width)" },
          ]}
        />
        <P>
          The sidewall matters a lot: a 21&Prime; rim alone has a 267 mm radius, but with a 355/25
          tyre on it the wheel rolls on about 356 mm, a third more road per revolution.
        </P>
        <H3>RPM from road speed</H3>
        <P>
          At any instant, engine RPM is determined by road speed, the current gear ratio{" "}
          <code>i_g</code>, the final-drive ratio <code>i_0</code>, and the driven wheel&rsquo;s
          rolling radius <code>r_w</code> — the same relationship a real drivetrain enforces
          mechanically:
        </P>
        <Formula
          tex={String.raw`\text{rpm}(v) = \frac{v}{r_w} \, i_g \, i_0 \, \frac{60}{2\pi}`}
          vars={[
            { symbol: String.raw`\text{rpm}(v)`, desc: "engine RPM at a given road speed" },
            { symbol: String.raw`v`, desc: "road speed" },
            { symbol: String.raw`r_w`, desc: "driven wheel's rolling radius" },
            { symbol: String.raw`i_g`, desc: "current gear ratio" },
            { symbol: String.raw`i_0`, desc: "final-drive ratio" },
          ]}
        />
        <P>
          Inverting this relationship is how the model always knows what RPM the engine is turning
          at for any given speed and gear, without needing to separately track engine speed as its
          own simulated state.
        </P>
        <H3>Final drive</H3>
        <P>
          The final drive (differential) ratio <code>i_0</code> multiplies every gear. By default
          it&rsquo;s the ratio a manufacturer would pick: in top gear, the engine reaches its power
          peak exactly at the drag-limited top speed (see Straight-Line Simulation). Any shorter,
          and the car hits the rev limiter before it runs out of power. Any taller, and it never
          gets up onto its power peak. You can also set it yourself in the Gearbox step.
        </P>
        <Formula
          tex={String.raw`i_0 = \frac{\text{rpm}_{P_{\max}} \cdot 2\pi\, r_w}{60 \cdot v_{\text{drag}} \cdot i_N}`}
          vars={[
            { symbol: String.raw`\text{rpm}_{P_{\max}}`, desc: "RPM of peak power" },
            { symbol: String.raw`v_{\text{drag}}`, desc: "drag-limited top speed" },
            { symbol: String.raw`i_N`, desc: "top-gear ratio" },
          ]}
        />
        <P>
          Because the gear spread below is fixed, the final drive also absorbs what a real car
          would do with its individual ratios, so it ranges from about 2.5 (Chiron) to 6 (an
          8-speed family car), wider than the 3–4 typical of real cars.
        </P>
        <H3>Gear ratio spread</H3>
        <P>
          Gear ratios are generated as a geometric progression: a fixed, short launch ratio for
          gear one (maximizing torque multiplication off the line) down to a taller top-gear ratio,
          spaced evenly on a logarithmic scale across however many gears are chosen:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
i_k &= i_1 \left(\frac{i_N}{i_1}\right)^{\frac{k-1}{N-1}} \\
k &= 1, 2, \dots, N
\end{aligned}`}
          vars={[
            { symbol: String.raw`i_k`, desc: "ratio of gear k" },
            { symbol: String.raw`i_1`, desc: "short launch ratio of gear one" },
            { symbol: String.raw`i_N`, desc: "tallest ratio of the top gear (scales taller as N grows)" },
            { symbol: String.raw`N`, desc: "total number of gears chosen" },
          ]}
        />
        <P>
          The top-gear ratio itself is not fixed — it scales taller (numerically smaller) as more
          gears are chosen, so the same launch-to-top spread is stretched across more steps. This
          mirrors how a real gearbox with more ratios can also run a taller overdrive gear, and is
          what lets adding gears meaningfully raise a car&rsquo;s theoretical top speed rather than just
          adding closer-spaced ratios in between the same two endpoints.
        </P>
        <H3>Shift point and shift time</H3>
        <P>
          Manual gearboxes (and one automatic strategy) always shift right before the hard rev
          limiter, on the assumption of a driver who uses every available RPM in every gear. Two
          other automatic strategies short-shift instead: one shifts at the top of the torque
          band (the highest RPM still making nearly all of peak torque), the other at the RPM where
          power peaks.
        </P>
        <P>
          Each upshift cuts drive to the wheels for a moment: 0.05 s for a dual-clutch box, which
          has the next gear pre-selected, 0.15 s for a torque-converter automatic, and 0.3 s for a
          manual, which needs a clutch and a lever throw.
        </P>
        <H3>Wheel force</H3>
        <P>
          Torque at the engine is converted into a forward force at the contact patch by
          multiplying through the full driveline ratio and dividing by the driven wheel&rsquo;s rolling
          radius, with a drivetrain efficiency <code>η_t</code> for everything lost to friction
          between the crank and the road: about 0.90 for rear- or front-wheel drive, and 0.85 for
          all-wheel drive with its extra transfer case, front differential and propshaft:
        </P>
        <Formula
          tex={String.raw`F_{\text{wheel}} = \frac{T(\text{rpm}) \, i_g \, i_0 \, \eta_t}{r_w}`}
          vars={[
            { symbol: String.raw`F_{\text{wheel}}`, desc: "forward force delivered at the contact patch" },
            { symbol: String.raw`T(\text{rpm})`, desc: "engine torque at the current RPM" },
            { symbol: String.raw`i_g`, desc: "current gear ratio" },
            { symbol: String.raw`i_0`, desc: "final-drive ratio" },
            { symbol: String.raw`\eta_t`, desc: "drivetrain efficiency: 0.90 (RWD/FWD), 0.85 (AWD)" },
            { symbol: String.raw`r_w`, desc: "driven wheel's rolling radius" },
          ]}
        />
        <P>
          This wheel force is what gets compared against the traction limit from the Friction
          chapter — whichever is smaller actually accelerates the car.
        </P>
      </>
    ),
  },
  {
    id: "braking",
    num: "05",
    title: "Braking & Thermal Fade",
    render: () => (
      <>
        <P>
          Braking reuses the same tyre-grip ceiling as acceleration — a tyre can only ever supply
          so much horizontal force, whether that force is being asked to accelerate the car or
          decelerate it — but layers a brake-system model on top that can further limit how much of
          that grip ceiling is actually reached.
        </P>
        <H3>Peak braking force</H3>
        <Formula
          tex={String.raw`F_{\text{brake,max}} = \mu_{\text{eff}}\, m\, g`}
          vars={[
            { symbol: String.raw`F_{\text{brake,max}}`, desc: "idealized, perfect-ABS maximum braking force" },
            { symbol: String.raw`\mu_{\text{eff}}`, desc: "the same effective grip coefficient used for traction" },
            { symbol: String.raw`m`, desc: "vehicle mass" },
            { symbol: String.raw`g`, desc: "gravitational acceleration" },
          ]}
        />
        <P>
          This is the idealized, perfect-ABS maximum: the same Coulomb-friction ceiling used for
          traction, independent of the wheelspin-window tuning used for launches (braking is
          modeled as a clean, maximally-modulated stop, not a launch technique).
        </P>
        <H3>Brake material effectiveness</H3>
        <P>
          The fraction of that ceiling actually delivered depends on the brake material and its
          current temperature. Each material (steel, ceramic, carbon-ceramic) is modeled with its
          own effectiveness-versus-temperature curve:
        </P>
        <Formula
          tex={String.raw`F_{\text{brake}} = F_{\text{brake,max}} \cdot \text{effectiveness}(\text{material}, T)`}
          vars={[
            { symbol: String.raw`F_{\text{brake}}`, desc: "braking force actually delivered" },
            { symbol: String.raw`F_{\text{brake,max}}`, desc: "the idealized peak braking force from above" },
            { symbol: String.raw`T`, desc: "current brake (rotor/pad) temperature" },
            { symbol: String.raw`\text{effectiveness}(\text{material}, T)`, desc: "material-specific curve of how much of the ceiling is realized at that temperature" },
          ]}
        />
        <Ul>
          <Li>
            Some materials are strongest cold and fade as they overheat (e.g. steel, which loses
            effectiveness once pads and fluid get too hot).
          </Li>
          <Li>
            Others need some heat in them before they bite at full strength, hold a wide plateau at
            or near peak effectiveness across normal operating temperatures, and only fade once
            pushed well past that plateau — tolerating far higher sustained temperatures before
            doing so.
          </Li>
        </Ul>
        <H3>Thermal build-up</H3>
        <P>
          Braking is not treated as instantaneous — heat builds in the rotor/pad system over the
          course of a stop and feeds back into effectiveness. Each simulation step, the mechanical
          work the brakes just did (force times distance covered that step) is treated as heat
          added to a lumped thermal mass representing the rotor and pad&rsquo;s heat capacity:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
\Delta T &= \frac{F_{\text{brake}} \, \Delta d}{C_{\text{thermal}}} \\
T &\leftarrow T + \Delta T
\end{aligned}`}
          vars={[
            { symbol: String.raw`\Delta T`, desc: "temperature rise added this simulation step" },
            { symbol: String.raw`F_{\text{brake}}`, desc: "braking force delivered this step" },
            { symbol: String.raw`\Delta d`, desc: "distance covered this step" },
            { symbol: String.raw`C_{\text{thermal}}`, desc: "heat capacity of the lumped rotor/pad thermal mass" },
            { symbol: String.raw`T`, desc: "running brake temperature, updated each step" },
          ]}
        />
        <P>
          The updated temperature feeds into the effectiveness curve for the next step, which is
          how a long, hard stop can visibly fade a car&rsquo;s brakes partway through — exactly the
          real-world failure mode this model is standing in for.
        </P>
        <H3>ABS</H3>
        <P>
          With ABS enabled, braking force uses the full effectiveness value above. With ABS
          disabled, a flat penalty is applied on top: an unmanaged tyre will occasionally lock and
          slide, and a sliding tyre generates less stopping force than one held right at the edge
          of grip, so the realized braking force is always somewhat lower without it.
        </P>
      </>
    ),
  },
  {
    id: "mass",
    num: "06",
    title: "Vehicle Mass & Weight Transfer",
    render: () => (
      <>
        <P>
          The Weight setting is the car&rsquo;s total weight — engine, wheels, fuel and everything
          else included. Nothing is added on top of it, so a real car&rsquo;s published kerb
          weight can go straight in.
        </P>
        <H3>Weight breakdown</H3>
        <P>
          The results screen splits that total into an estimate of where it sits. The engine is
          sized from its cylinder count and displacement, forced induction adds its hardware, and
          the wheels and tyres are sized from their diameter and width. The drivetrain,
          suspension and brakes, interior and electrics, and fuel and fluids each take a typical
          share for the body type, and the body and chassis structure is whatever remains. It
          never drops below 10% of the total: a huge engine in a light car makes the other
          estimates shrink to fit.
        </P>
        <Formula
          tex={String.raw`m_{\text{body}} = m - m_{\text{engine}} - m_{\text{fi}} - m_{\text{wheels}} - \sum_{\text{systems}} s_i\, m`}
          vars={[
            { symbol: String.raw`m`, desc: "total weight, as set" },
            { symbol: String.raw`m_{\text{engine}}`, desc: "engine mass, from cylinder (or rotor) count and displacement" },
            { symbol: String.raw`m_{\text{fi}}`, desc: "turbocharger or supercharger hardware" },
            { symbol: String.raw`m_{\text{wheels}}`, desc: "wheel and tyre set, from diameter and width" },
            { symbol: String.raw`s_i`, desc: "typical share of the total for each remaining system, per body type" },
          ]}
        />
        <H3>Rotating mass</H3>
        <P>
          Everything that spins with the wheels — engine, flywheel, gearbox, driveshafts, wheels —
          has to be spun up along with the car, which acts like extra mass. That&rsquo;s the
          rotating-inertia factor <code>k</code>, used in the Straight-Line Simulation chapter.
          Engine-side inertia seen at the wheels grows with the square of the gear ratio, so{" "}
          <code>k</code> is about 1.3 in first gear and about 1.05 in top:
        </P>
        <Formula
          tex={String.raw`k = 1.05 + 0.25\,\frac{i_g^2 - i_N^2}{i_1^2 - i_N^2}`}
          vars={[
            { symbol: String.raw`k`, desc: "rotating-inertia factor for the current gear" },
            { symbol: String.raw`i_g,\ i_1,\ i_N`, desc: "current, first and top gear ratios" },
          ]}
        />
        <H3>Weight transfer</H3>
        <P>
          Under acceleration, weight shifts from the front axle to the rear, which is what makes
          rear-wheel drive grip harder and front-wheel drive lose grip exactly when they&rsquo;re
          asked to put the most force down. The full calculation is in the Friction &amp; Traction
          chapter.
        </P>
      </>
    ),
  },
  {
    id: "straightline",
    num: "07",
    title: "Straight-Line Simulation",
    render: () => (
      <>
        <P>
          The acceleration, top-speed, and drag-distance tests all run through the same
          step-by-step loop described in the Overview, applying the pieces from every chapter
          above at each time step.
        </P>
        <H3>Per-step sequence</H3>
        <Ul>
          <Li>Determine the current gear, shifting up a gear if RPM has crossed the shift point derived in the Gearbox chapter. For the shift time that follows, no drive reaches the wheels.</Li>
          <Li>Look up torque at the current RPM from the Engine model.</Li>
          <Li>Convert torque to wheel force through the gear ratio, final drive, and drivetrain efficiency.</Li>
          <Li>Work out the traction limit of the driven wheels, with weight transfer (Friction chapter).</Li>
          <Li>Take the smaller of the engine-limited and traction-limited acceleration, then integrate into velocity and distance as in the Overview.</Li>
        </Ul>
        <Formula
          tex={String.raw`a = \min\!\left(\frac{F_{\text{wheel}} - R}{m\,k},\ \frac{F_{\max} - R}{m}\right), \qquad R = F_{\text{drag}} + F_{\text{roll}}`}
          vars={[
            { symbol: String.raw`a`, desc: "net acceleration for this time step" },
            { symbol: String.raw`F_{\text{wheel}}`, desc: "engine force at the wheels (Gearbox chapter)" },
            { symbol: String.raw`F_{\max}`, desc: "traction limit of the driven wheels (Friction chapter)" },
            { symbol: String.raw`F_{\text{drag}}`, desc: "aerodynamic drag (Aerodynamics chapter)" },
            { symbol: String.raw`F_{\text{roll}}`, desc: "rolling resistance (Friction chapter)" },
            { symbol: String.raw`m`, desc: "vehicle mass" },
            { symbol: String.raw`k`, desc: "rotating-inertia factor for the current gear (Vehicle Mass chapter)" },
          ]}
        />
        <P>
          The rotating-inertia factor <code>k</code> only slows the car when the engine is the
          limit. When the tyres are the limit, the engine has torque to spare and spends it
          spinning up its own rotating parts, so the car accelerates at the full traction-limited
          rate.
        </P>
        <H3>Launches</H3>
        <P>
          A standing start never pulls away from idle. The driver feeds the clutch in (or the
          torque converter slips) with the engine held at 75% of its peak-torque RPM. With the
          Clutch-Dump Launch option, the engine is held at the full peak-torque RPM, as if the
          driver revved it up and dropped the clutch. Either way it&rsquo;s strictly a
          torque-lookup change. The resulting wheel force still runs through the same
          traction-limit check as every other step, and with traction control off, a dumped
          clutch makes the uncontrolled-slip penalty (Friction chapter) far more likely to bite in
          that opening moment. Once road speed&rsquo;s own RPM catches up to the held RPM, the
          clutch is treated as locked, and from then on RPM only ever follows road speed.
        </P>
        <H3>Stopping conditions</H3>
        <P>
          Each test type ends on its own condition, checked every step: a fixed duration, a target
          distance, a target speed, or (for braking) coming to a full stop — plus a safety ceiling
          on total simulated time so a build that&rsquo;s simply too weak (or, in braking, too strong) to
          reach its target still terminates rather than looping indefinitely.
        </P>
        <H3>Theoretical top speed</H3>
        <P>Top speed is whichever of two limits comes first:</P>
        <Formula
          tex={String.raw`\begin{aligned}
\text{drag-limited:}&\quad P_{\text{wheel}} = (F_{\text{drag}} + F_{\text{roll}})\, v \\
\text{gear-limited:}&\quad v = \frac{\text{rpm}_{\max} \cdot 2\pi\, r_w}{60 \cdot i_g \, i_0}
\end{aligned}`}
          vars={[
            { symbol: String.raw`P_{\text{wheel}}`, desc: "power at the wheels, after drivetrain losses" },
            { symbol: String.raw`\text{rpm}_{\max}`, desc: "hard rev limit" },
          ]}
        />
        <P>
          As a check, a Chiron with about 970 kW at the wheels and a drag area of 0.75 m² solves to
          roughly 128 m/s, about 460 km/h: the right range for a car that&rsquo;s electronically
          limited to 420 km/h. The model finds both limits at once by scanning the speed range in
          every gear and keeping the highest speed where some gear still has more drive force than
          resistance without passing the rev limit. It checks every gear because a tall overdrive
          top gear can pull less speed than the gear below it, and because torque isn&rsquo;t
          monotonic, the margin can dip negative at one speed and recover at a higher one.
        </P>
        <Pseudocode>{`for v in 0 … v_max_search:
    for each gear g:
        if rpm(v, g) > maxRevRpm: skip
        if F_wheel(v, g) > F_drag(v) + F_roll: lastValidSpeed = v
topSpeed = lastValidSpeed`}</Pseudocode>
      </>
    ),
  },
  {
    id: "hotlap",
    num: "08",
    title: "Hot Lap Simulation",
    render: () => (
      <>
        <P>
          The hot lap test calculates one theoretical lap of a chosen circuit from the
          track&rsquo;s own geometry and the car&rsquo;s physics — it does not look up or blend toward any
          real-world lap time, and no corner is ever assigned a hand-picked speed. The chain is:
          circuit geometry → tyre friction ellipse (with aerodynamics feeding into it) → a
          physically-constrained speed profile → per-point driver pedal/gear inputs → time
          integration. Each stage below feeds the next.
        </P>
        <P>
          Two start modes share that same chain. A <em>flying lap</em> crosses the start/finish
          line already at whatever speed the corner before it allows — a qualifying bomb lap,
          which is how the speed-profile solver treats the line by default (it&rsquo;s just another
          point on a closed loop). A <em>standing start</em> instead pins the line to a dead
          stop and launches from there, lights-out style, so the first sector is a genuine
          traction-limited getaway rather than a lap already in progress.
        </P>
        <H3>Circuit geometry: curvature from the track shape, not a lookup table</H3>
        <P>
          Every circuit is stored as its real centerline, surveyed from OpenStreetMap: a closed loop
          of GPS points, a metre apart through some corners and hundreds of metres apart down some
          straights. Measuring curvature straight off those points would turn every angle between
          two straight pieces into a fake hairpin, so a smooth closed curve (a periodic cubic
          smoothing spline) is fitted through them instead — its 5&nbsp;m smoothing length absorbs
          survey jitter but is far too short to round a real corner off. A hairpin traced as a
          single sharp point becomes the tightest arc a track can have: half its width.
        </P>
        <P>
          The car doesn&rsquo;t drive the centerline, though. Within the track width around it, the
          racing line is the path with the least total squared curvature — the one that straightens
          every corner and links every chicane as far as the kerbs allow — found by solving a small
          quadratic programme. Every 2&nbsp;m along that line, its heading and signed curvature
          (1 / radius) come straight from the curve&rsquo;s own derivatives:
        </P>
        <Formula
          tex={String.raw`\kappa = \frac{x'y'' - y'x''}{\left(x'^2 + y'^2\right)^{3/2}}`}
          vars={[
            { symbol: String.raw`x(t),\ y(t)`, desc: "the smooth racing line's coordinates along the lap; primes are derivatives along it" },
            { symbol: String.raw`\kappa`, desc: "signed curvature (positive = turning left); 1/\\kappa is the corner radius" },
          ]}
        />
        <H3>Cornering speed limit: the friction ellipse, not a fixed apex speed</H3>
        <P>
          A tyre has one finite grip budget it must split between cornering (lateral) and
          accelerating/braking (longitudinal) force — spending it all on one leaves nothing for the
          other. That&rsquo;s the friction-circle/ellipse constraint used throughout the hot lap:
        </P>
        <Formula
          tex={String.raw`\left(\frac{F_x}{F_{x,\max}}\right)^{2} + \left(\frac{F_y}{F_{y,\max}}\right)^{2} \le 1`}
          vars={[
            { symbol: String.raw`F_x`, desc: "longitudinal (accelerating or braking) force currently being asked of the tyre" },
            { symbol: String.raw`F_y`, desc: "lateral (cornering) force currently being asked of the tyre" },
            { symbol: String.raw`F_{x,\max},\ F_{y,\max}`, desc: String.raw`\mu_{\text{long}}N \text{ and } \mu_{\text{lat}}N \text{ - the tyre's separate longitudinal/lateral limits at normal load } N` },
          ]}
        />
        <P>
          Solving the pure-cornering case (F_x = 0) for the fastest speed a given curvature can be
          held at, using the total normal load from the Aerodynamics chapter (weight plus
          speed-dependent downforce) instead of static weight alone:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
m v^2 \lvert\kappa\rvert &\le \mu_{\text{lat}}\bigl(m g + \tfrac{1}{2}\rho_{\text{air}} C_l A v^2\bigr) \\
v_{\text{corner}} &= \sqrt{\dfrac{\mu_{\text{lat}}\, m\, g}{m\lvert\kappa\rvert - \mu_{\text{lat}}\cdot\tfrac{1}{2}\rho_{\text{air}} C_l A}}
\end{aligned}`}
          vars={[
            { symbol: String.raw`\kappa`, desc: "signed curvature at this point (from the geometry above); 1/\\kappa is the corner radius" },
            { symbol: String.raw`\mu_{\text{lat}}`, desc: "lateral grip coefficient (tyre compound/pressure/condition, from the Friction chapter)" },
          ]}
        />
        <P>
          Because downforce grows the right-hand side with the square of speed, more downforce
          raises high-speed cornering limits without this formula having to say so specially — it
          simply falls out of solving for v. A car with aerodynamic lift instead of downforce sees
          the opposite: its cornering limit erodes slightly as speed rises.
        </P>
        <H3>Speed profile: forward and backward passes, not average speed</H3>
        <P>
          Every point&rsquo;s pure cornering limit above ignores whether the car could actually have
          reached that speed, or can still shed it in time for what&rsquo;s ahead. Starting from that
          limit as an initial guess, repeated forward and backward sweeps around the closed lap
          enforce both:
        </P>
        <Pseudocode>{`for each pass:
  # forward: how fast could the car be going here, given how
  # fast it was going one step behind and the most it could
  # have accelerated since (engine force, capped by whatever
  # the friction ellipse leaves after this point's cornering
  # demand, minus drag and rolling resistance)?
  v[i+1] = min(v[i+1], sqrt(v[i]^2 + 2 * maxAccel(v[i], curvature[i]) * ds))

  # backward: how fast can the car afford to be going here,
  # given it must still be able to brake down (tyre force,
  # again ellipse-limited, plus drag, rolling resistance and
  # engine braking) to next step's speed in time?
  v[i] = min(v[i], sqrt(v[i+1]^2 + 2 * maxBrakeDecel(v[i+1], curvature[i+1]) * ds))`}</Pseudocode>
        <P>
          The backward sweep is what pushes a braking zone earlier than the corner entrance itself
          whenever one step of track isn&rsquo;t distance enough — this is the model&rsquo;s look-ahead: it
          anticipates a corner well before reaching it, the same way a real driver reads the track
          ahead rather than reacting at the apex. A few full sweeps are enough to converge on a
          closed lap, since the starting guess (each point&rsquo;s own cornering limit) is already close.
        </P>
        <H3>Driver inputs: pedal position from the converged trace</H3>
        <P>
          Once the profile has converged, comparing the actual speed change over each step to the
          <em> maximum possible</em> accel or brake there (the same functions the sweeps used) gives
          exactly how hard the driver must be pressing the pedal to produce that trace — full
          throttle or full brake where the car is running at its physical limit, and a softer,
          partial input wherever it isn&rsquo;t (corner entry, exit, or a kink that never demanded the
          whole tyre budget). This is what stands in for turn-in and trail braking, without a
          separate heuristic bolted on top of the physics.
        </P>
        <H3>Gear selection, shift time, and engine braking</H3>
        <P>
          Cruising and coasting elsewhere in the app pick the tallest gear that still keeps the
          engine above idle. A hot lap instead always uses the shortest gear that doesn&rsquo;t over-rev
          past the shift point — a driver who short-shifts nothing and takes every gear right up to
          its limit, which is what actually produces the fastest lap. Each gear change adds a fixed
          dead time straight onto the lap clock (a manual&rsquo;s clutch and lever throw take longer than
          a dual-clutch box&rsquo;s near-instant swap), and while braking, the engine&rsquo;s own internal
          friction (the Engine chapter&rsquo;s combustion-vs-friction split) contributes a small extra
          decelerating force on top of the brakes and tyres, exactly as engine braking does in a
          real car.
        </P>
        <H3>Lap time: integrated, not averaged</H3>
        <P>
          With the speed at every point on the track known, lap time is the sum of how long each
          small step of distance takes at that point&rsquo;s speed — never the track length divided by
          an assumed or average speed:
        </P>
        <Formula
          tex={String.raw`dt = \frac{ds}{v} \qquad \text{lap time} = \sum_i dt_i`}
          vars={[
            { symbol: String.raw`ds`, desc: "the (small, fixed) distance between consecutive sampled points" },
            { symbol: String.raw`v`, desc: "the converged speed at that point" },
          ]}
        />
        <P>
          Brake temperature is layered on afterward, evolving dynamically over this same
          integration (heating under braking, cooling everywhere else, exactly as in the Braking
          chapter) so its telemetry trace stays realistic — but the speed profile itself assumes
          brakes already at their configured starting temperature throughout, rather than
          re-solving the whole lap every time a temperature estimate changed.
        </P>
      </>
    ),
  },
  {
    id: "matching",
    num: "09",
    title: "Real-Car Matching",
    render: () => (
      <>
        <P>
          After a test completes, the build is compared against a reference set of real production
          cars to find the closest real-world equivalents, using a weighted distance metric over a
          handful of key stats.
        </P>
        <H3>Stats compared</H3>
        <P>
          Displacement, cylinder count, aspiration type, engine layout, peak horsepower, peak
          torque, and power-to-weight ratio (horsepower per tonne) are pulled from both your build&rsquo;s
          simulation result and each reference car&rsquo;s known specifications.
        </P>
        <H3>Normalization</H3>
        <P>
          Because these stats live on very different numeric scales (displacement in litres versus
          torque in newton-metres versus power-to-weight in hp/tonne), each numeric stat is
          min-max normalized to a common 0–1 range across the combined set of your build plus every
          reference car, so no single stat dominates the distance purely because of its units:
        </P>
        <Formula
          tex={String.raw`\hat{x} = \frac{x - \min(\text{allValues})}{\max(\text{allValues}) - \min(\text{allValues})}`}
          vars={[
            { symbol: String.raw`\hat{x}`, desc: "the normalized stat value, in 0–1" },
            { symbol: String.raw`x`, desc: "the raw stat value being normalized" },
            { symbol: String.raw`\min(\text{allValues}),\ \max(\text{allValues})`, desc: "the min and max of that stat across your build plus every reference car" },
          ]}
        />
        <H3>Weighted distance</H3>
        <P>
          The overall &ldquo;closeness&rdquo; between your build and a reference car is a weighted Euclidean
          distance over the normalized stats, with power output and power-to-weight ratio weighted
          more heavily than displacement or cylinder count (since they more directly capture how a
          car actually performs), plus a flat penalty added whenever a categorical property doesn&rsquo;t
          match at all:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
d^2 &= \sum_k w_k \left(\hat{t}_k - \hat{c}_k\right)^2 \;+\; w_a\,\mathbf{1}[\text{aspiration mismatch}] \;+\; w_\ell\,\mathbf{1}[\text{layout mismatch}] \\
d &= \sqrt{d^2}
\end{aligned}`}
          vars={[
            { symbol: String.raw`d`, desc: "overall distance (dissimilarity) between your build and a reference car" },
            { symbol: String.raw`w_k`, desc: "weight for stat k (power and power-to-weight weighted more heavily)" },
            { symbol: String.raw`\hat{t}_k,\ \hat{c}_k`, desc: "normalized stat k for your build and the reference car, respectively" },
            { symbol: String.raw`w_a,\ w_\ell`, desc: "flat penalty weights for an aspiration or layout mismatch" },
            { symbol: String.raw`\mathbf{1}[\cdot]`, desc: "indicator function: 1 if the mismatch condition holds, 0 otherwise" },
          ]}
        />
        <P>
          The reference cars are then sorted by ascending distance, and the closest handful are
          shown as the build&rsquo;s real-world matches — the smaller the distance, the more similar the
          two cars are across every stat considered.
        </P>
      </>
    ),
  },
];

export default function HowItWorks() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(CHAPTERS[0].id);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const active = CHAPTERS.find((c) => c.id === activeId) ?? CHAPTERS[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How It Works"
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-lg backdrop-blur-md transition-colors hover:border-amber-500 hover:text-amber-400 ${FOCUS_RING}`}
      >
        <span aria-hidden>&#128295;</span>
        <span className="hidden sm:inline">How It Works</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full flex-col overflow-hidden border-zinc-800 bg-zinc-950/98 sm:h-[85vh] sm:max-w-6xl sm:rounded-2xl sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4 sm:items-center sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span aria-hidden className="h-px w-4 bg-amber-400/60" />
                  <span className="text-xs uppercase tracking-wider text-amber-400">
                    Technical Specification
                  </span>
                </div>
                <div className="font-mono text-sm font-bold text-zinc-100 sm:text-base">
                  Engine Builder — Simulation Model
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className={`shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 ${FOCUS_RING}`}
              >
                &#10005;
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
              <nav className="shrink-0 overflow-x-auto border-b border-zinc-800 sm:w-64 sm:overflow-y-auto sm:overflow-x-hidden sm:border-b-0 sm:border-r">
                <div className="flex gap-1 p-2 sm:flex-col sm:p-3">
                  {CHAPTERS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors sm:shrink ${FOCUS_RING} ${
                        c.id === activeId
                          ? "bg-amber-500 text-zinc-950 font-medium"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                      }`}
                    >
                      <span className="font-mono text-xs opacity-70">{c.num}</span>
                      <span className="whitespace-nowrap sm:whitespace-normal">{c.title}</span>
                    </button>
                  ))}
                </div>
              </nav>

              <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
                <div className="mx-auto max-w-3xl">
                  <div className="flex items-baseline gap-2 border-b border-zinc-800/70 pb-3 mb-5">
                    <span className="font-mono text-xs text-amber-400/80">{active.num}</span>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">{active.title}</h2>
                  </div>
                  {active.render()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
