"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface FormulaVar {
  symbol: string;
  desc: string;
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
              <div key={v.symbol} className="flex gap-3 text-sm leading-relaxed">
                <dt className="shrink-0 whitespace-nowrap font-mono text-amber-300">{v.symbol}</dt>
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
            { symbol: "v(t)", desc: "velocity at time t" },
            { symbol: "x(t)", desc: "position at time t" },
            { symbol: "a(t)", desc: "net acceleration at time t, as derived in the chapters below" },
            { symbol: "Δt", desc: "the fixed simulation time step" },
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
          (displacement, cylinder count, aspiration, fuel type, redline and rev limit), from which
          power is derived directly.
        </P>
        <H3>Peak torque</H3>
        <P>
          A theoretical peak torque is estimated from displacement, scaled by a torque-per-litre
          figure that depends on induction type (naturally aspirated, turbocharged, or
          supercharged — forced induction raises cylinder pressure and therefore torque-per-litre)
          and on fuel type (diesel&rsquo;s higher compression ratio and long-stroke design earn a
          multiplier over petrol), and finally adjusted by a mild cylinder-count factor that
          rewards smoother multi-cylinder combustion but tapers off at very high cylinder counts
          where per-cylinder friction starts eating the gain:
        </P>
        <Formula
          tex={String.raw`T_{\text{peak}} = D \cdot k_{\text{tpl}}(\text{aspiration}, \text{fuel}) \cdot f(n_{\text{cyl}})`}
          vars={[
            { symbol: "T_peak", desc: "theoretical peak crankshaft torque" },
            { symbol: "D", desc: "engine displacement" },
            { symbol: "k_tpl", desc: "torque-per-litre figure, set by aspiration and fuel type" },
            { symbol: "n_cyl", desc: "cylinder count" },
            { symbol: "f(n_cyl)", desc: "cylinder-count factor rewarding smoother combustion, tapering off at very high counts" },
          ]}
        />
        <H3>Curve shape</H3>
        <P>
          The torque curve across the rev range is modeled as an asymmetric bell curve (a
          Gaussian) centred on a peak-torque RPM, expressed as a fraction of redline. Where that
          fraction sits depends on aspiration and fuel — turbocharged and supercharged engines
          build peak cylinder pressure earlier in the rev range than naturally aspirated ones, and
          diesels peak earlier still and don&rsquo;t rev out:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
x &= \frac{\text{rpm}}{\text{rpm}_{\text{redline}}} \\
T(\text{rpm}) &= T_{\text{peak}}\, \exp\!\left(-\frac{(x - x_{\text{peak}})^2}{2\sigma^2}\right)
\end{aligned}`}
          vars={[
            { symbol: "x", desc: "current RPM as a fraction of redline" },
            { symbol: "T(rpm)", desc: "torque output at a given RPM" },
            { symbol: "T_peak", desc: "theoretical peak torque" },
            { symbol: "x_peak", desc: "fraction of redline where peak torque occurs, set by aspiration and fuel" },
            { symbol: "σ", desc: "spread of the bell curve (asymmetric: one value below the peak, a wider one above it)" },
          ]}
        />
        <P>
          The spread <code>σ</code> is not symmetric: one value governs how sharply torque rises
          below the peak, a different (wider) value governs how gently it falls away above the
          peak, since real dyno curves build quickly to their peak and then decay more gradually.
          Forced-induction engines use a narrower, peakier shape than naturally aspirated ones. A
          small floor value keeps torque from ever computing to exactly zero far from the peak, so
          idle and near-limiter RPM still produce usable, if weak, torque. Torque is only evaluated
          between idle RPM and the hard rev limit — a car can be pushed past its tuned redline, up
          to the rev limit, with torque simply continuing to taper along the same falling curve
          into that over-rev zone.
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
            { symbol: "ω(rpm)", desc: "angular speed at a given RPM, in radians per second" },
            { symbol: "T(rpm)", desc: "torque at that RPM, from the curve above" },
            { symbol: "P(rpm)", desc: "power at that RPM, in watts" },
            { symbol: "P_hp", desc: "power converted to horsepower (1 hp = 745.7 W)" },
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
            { symbol: "T_fric(rpm)", desc: "internal friction torque (mechanical + pumping losses) at a given RPM" },
            { symbol: "k_fric", desc: "friction scale factor, growing with displacement D and cylinder count n_cyl" },
            { symbol: "rpm_max", desc: "the engine's maximum (rev-limit) RPM, used to normalize the ramp" },
            { symbol: "ramp(·)", desc: "an increasing, faster-than-linear function of normalized RPM" },
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
            { symbol: "T_comb(rpm)", desc: "torque the combustion process must actually produce" },
            { symbol: "T(rpm)", desc: "net output torque delivered at the crankshaft" },
            { symbol: "T_fric(rpm)", desc: "internal friction torque being consumed at that RPM" },
          ]}
        />
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
          normal load times a friction coefficient. Applied to a car sitting on its tyres, the
          normal load is (approximately) its own weight, so:
        </P>
        <Formula
          tex={String.raw`F_{\text{traction}} = \mu_{\text{eff}}\, m\, g`}
          vars={[
            { symbol: "F_traction", desc: "maximum horizontal force the driven tyres can transmit before slipping" },
            { symbol: "μ_eff", desc: "effective grip coefficient, built up below from tyre, condition and layout factors" },
            { symbol: "m", desc: "vehicle mass" },
            { symbol: "g", desc: "gravitational acceleration" },
          ]}
        />
        <P>
          where <code>m</code> is vehicle mass, <code>g</code> is gravitational acceleration, and{" "}
          <code>μ_eff</code> is an effective grip coefficient built up from every factor that
          changes how much rubber is actually gripping the road (below). Whenever the drivetrain
          tries to push more force through the driven wheels than this limit allows, the excess is
          simply unavailable — the wheels spin instead of the car accelerating any faster.
        </P>
        <H3>Building the effective grip coefficient</H3>
        <P>μ_eff is assembled by multiplying together every factor that scales grip up or down:</P>
        <Formula
          tex={String.raw`\begin{aligned}
\mu_{\text{eff}} = \ & \mu_{\text{base}}(\text{width}, \text{pressure}, \text{layout}) \\
& \times\, k_{\text{cond}}(\text{condition}) \\
& \times\, k_{\text{type}}(\text{condition}) \\
& \times\, k_{\text{compound}}(\text{condition})
\end{aligned}`}
          vars={[
            { symbol: "μ_eff", desc: "the final effective grip coefficient" },
            { symbol: "μ_base", desc: "base coefficient from tyre width, pressure, and drivetrain layout" },
            { symbol: "k_cond", desc: "multiplier for road condition (dry, wet, rain, headwind)" },
            { symbol: "k_type", desc: "multiplier for tyre type (slick vs. treaded) under that condition" },
            { symbol: "k_compound", desc: "multiplier for tyre compound (soft/medium/hard/intermediate/wet) under that condition" },
          ]}
        />
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
            <b>Drivetrain layout</b> — see the weight-transfer note in the Vehicle Mass chapter:
            rear-wheel drive gets a boost under acceleration, front-wheel drive a penalty.
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
        <H3>Wheel slip and the optimal slip window</H3>
        <P>
          Real tyres don&rsquo;t produce their maximum longitudinal force at zero slip or at full
          spinning — they peak somewhere in between, where the contact patch is deforming just
          enough to grip hard without breaking fully loose. This is modeled as an efficiency
          function of commanded wheel-spin percentage, peaking at a small optimal slip value and
          falling off — floored at a minimum — the further the chosen slip is from that optimum in
          either direction:
        </P>
        <Formula
          tex={String.raw`\eta_{\text{slip}}(s) = \max\!\left(\eta_{\min},\ 1 - \frac{|s - s_{\text{opt}}|}{100}\right)`}
          vars={[
            { symbol: "η_slip(s)", desc: "traction efficiency at a given commanded wheel-spin percentage" },
            { symbol: "s", desc: "commanded wheel-spin percentage" },
            { symbol: "s_opt", desc: "optimal slip percentage where efficiency peaks" },
            { symbol: "η_min", desc: "floor efficiency, the minimum value this factor can fall to" },
          ]}
        />
        <P>This factor multiplies directly into the traction limit used for launches and hard acceleration.</P>
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
F_{\text{wheel}}, & F_{\text{wheel}} \le F_{\text{traction}} \\[2pt]
F_{\text{traction}}, & F_{\text{wheel}} > F_{\text{traction}} \text{ and traction control on} \\[2pt]
k_{\text{slip}}\, F_{\text{traction}}, & F_{\text{wheel}} > F_{\text{traction}} \text{ and traction control off}
\end{cases}
\quad (k_{\text{slip}} < 1)`}
          vars={[
            { symbol: "F_drive", desc: "the force actually realized at the driven wheels" },
            { symbol: "F_wheel", desc: "force demanded by the drivetrain, from the Gearbox chapter" },
            { symbol: "F_traction", desc: "the traction limit from above" },
            { symbol: "k_slip", desc: "kinetic-friction fraction realized once a tyre breaks loose without traction control" },
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
            { symbol: "F_roll", desc: "rolling-resistance force opposing motion" },
            { symbol: "C_rr", desc: "rolling-resistance coefficient" },
            { symbol: "m", desc: "vehicle mass" },
            { symbol: "g", desc: "gravitational acceleration" },
          ]}
        />
        <P>
          where <code>C_rr</code> is a rolling-resistance coefficient. This force opposes motion in
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
            { symbol: "ρ_air", desc: "air density, the standard sea-level reference value used throughout" },
            {
              symbol: "C_d",
              desc: "drag coefficient, set by body type (a boxy minivan or SUV carries a higher coefficient than a low, shaped supercar body)",
            },
            { symbol: "A", desc: "frontal area, also set by body type" },
            { symbol: "v_rel", desc: "speed relative to the surrounding air, not just speed relative to the road" },
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
            { symbol: "v_rel", desc: "airspeed used in the drag equation above" },
            { symbol: "v_car", desc: "the car's own speed relative to the road" },
            { symbol: "v_headwind", desc: "the steady headwind speed added under the headwind road condition" },
          ]}
        />
        <P>
          This is why a headwind condition can only ever cost top speed and straight-line
          performance, never help it — there is no equivalent tailwind condition that subtracts
          from relative airspeed.
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
          (at the cost of road speed per RPM) through each gear&rsquo;s ratio and a fixed final-drive
          ratio.
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
            { symbol: "rpm(v)", desc: "engine RPM at a given road speed" },
            { symbol: "v", desc: "road speed" },
            { symbol: "r_w", desc: "driven wheel's rolling radius" },
            { symbol: "i_g", desc: "current gear ratio" },
            { symbol: "i_0", desc: "final-drive ratio" },
          ]}
        />
        <P>
          Inverting this relationship is how the model always knows what RPM the engine is turning
          at for any given speed and gear, without needing to separately track engine speed as its
          own simulated state.
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
            { symbol: "i_k", desc: "ratio of gear k" },
            { symbol: "i_1", desc: "short launch ratio of gear one" },
            { symbol: "i_N", desc: "tallest ratio of the top gear (scales taller as N grows)" },
            { symbol: "N", desc: "total number of gears chosen" },
          ]}
        />
        <P>
          The top-gear ratio itself is not fixed — it scales taller (numerically smaller) as more
          gears are chosen, so the same launch-to-top spread is stretched across more steps. This
          mirrors how a real gearbox with more ratios can also run a taller overdrive gear, and is
          what lets adding gears meaningfully raise a car&rsquo;s theoretical top speed rather than just
          adding closer-spaced ratios in between the same two endpoints.
        </P>
        <H3>Shift point</H3>
        <P>
          Manual gearboxes (and one automatic strategy) always shift right before the hard rev
          limiter, on the assumption of a driver who uses every available RPM in every gear. Two
          other automatic strategies short-shift instead: one shifts at the RPM where torque peaks,
          the other at the RPM where power peaks — trading outright acceleration in the current
          gear for picking up the next gear&rsquo;s pull sooner.
        </P>
        <H3>Wheel force</H3>
        <P>
          Torque at the engine is converted into a forward force at the contact patch by
          multiplying through the full driveline ratio and dividing by the driven wheel&rsquo;s rolling
          radius, with a flat drivetrain efficiency factor <code>η_t</code> applied to represent
          everything lost to friction between the crank and the road (clutch, gears,
          differential):
        </P>
        <Formula
          tex={String.raw`F_{\text{wheel}} = \frac{T(\text{rpm}) \, i_g \, i_0 \, \eta_t}{r_w}`}
          vars={[
            { symbol: "F_wheel", desc: "forward force delivered at the contact patch" },
            { symbol: "T(rpm)", desc: "engine torque at the current RPM" },
            { symbol: "i_g", desc: "current gear ratio" },
            { symbol: "i_0", desc: "final-drive ratio" },
            { symbol: "η_t", desc: "flat drivetrain efficiency (clutch, gears, differential losses)" },
            { symbol: "r_w", desc: "driven wheel's rolling radius" },
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
            { symbol: "F_brake,max", desc: "idealized, perfect-ABS maximum braking force" },
            { symbol: "μ_eff", desc: "the same effective grip coefficient used for traction" },
            { symbol: "m", desc: "vehicle mass" },
            { symbol: "g", desc: "gravitational acceleration" },
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
            { symbol: "F_brake", desc: "braking force actually delivered" },
            { symbol: "F_brake,max", desc: "the idealized peak braking force from above" },
            { symbol: "T", desc: "current brake (rotor/pad) temperature" },
            { symbol: "effectiveness(·)", desc: "material-specific curve of how much of the ceiling is realized at that temperature" },
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
            { symbol: "ΔT", desc: "temperature rise added this simulation step" },
            { symbol: "F_brake", desc: "braking force delivered this step" },
            { symbol: "Δd", desc: "distance covered this step" },
            { symbol: "C_thermal", desc: "heat capacity of the lumped rotor/pad thermal mass" },
            { symbol: "T", desc: "running brake temperature, updated each step" },
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
          Total vehicle mass is not a single input — it is built up from the chassis and every
          component choice that adds real physical weight, since a bigger engine or bigger wheels
          are not free in a real car either.
        </P>
        <H3>Mass build-up</H3>
        <Formula
          tex={String.raw`\begin{aligned}
m = \ & m_{\text{chassis}}(\text{bodyType}) \\
& + \, n_{\text{cyl}}\, k_{\text{cyl}} \;+\; D\, k_D \\
& + \bigl(\text{turbo or supercharger} \;?\; m_{\text{fi}} : 0\bigr) \\
& + \sum_{\text{axles}} \Delta(\text{diameter})\, k_{\text{dia}} \;+\; \Delta(\text{width})\, k_{\text{width}}
\end{aligned}`}
          vars={[
            { symbol: "m", desc: "total vehicle mass" },
            { symbol: "m_chassis", desc: "base chassis mass, set by body type (minivan, SUV, supercar)" },
            { symbol: "n_cyl", desc: "cylinder count" },
            { symbol: "k_cyl", desc: "mass added per cylinder" },
            { symbol: "D", desc: "engine displacement" },
            { symbol: "k_D", desc: "mass added per unit of displacement" },
            { symbol: "m_fi", desc: "fixed hardware mass added when turbocharged or supercharged" },
            { symbol: "Δ(diameter)", desc: "wheel diameter delta from the reference dimension, per axle" },
            { symbol: "Δ(width)", desc: "tyre width delta from the reference dimension, per axle" },
            { symbol: "k_dia, k_width", desc: "mass added per unit of diameter/width delta" },
          ]}
        />
        <P>
          Base chassis mass comes from the chosen body type (minivan, SUV, or supercar, each with
          its own realistic mass range). Engine mass grows with both cylinder count and
          displacement — more metal, more reciprocating parts. Forced induction adds fixed hardware
          mass for the turbocharger or supercharger and its plumbing. Wheel and tyre mass is
          expressed as a delta from reference wheel dimensions: larger diameter or width than the
          reference adds mass (and smaller removes it), on both axles independently.
        </P>
        <H3>Rotating mass</H3>
        <P>
          Wheel and tyre mass is treated as behaving like extra <em>effective</em>{" "}
          mass under acceleration, beyond just adding to the car&rsquo;s static weight — spinning up a heavier wheel
          and tyre assembly takes additional energy on top of simply moving its mass down the
          road, which the model approximates by folding a per-inch/per-mm mass penalty directly
          into the same total mass used everywhere else (acceleration, braking, cornering).
        </P>
        <H3>Weight transfer and drivetrain layout</H3>
        <P>
          Under hard acceleration, weight dynamically shifts toward the rear axle — this model
          doesn&rsquo;t simulate that transfer as a continuous pitch/weight calculation, but applies its
          net effect directly to grip depending on which axle is actually driven:
        </P>
        <Ul>
          <Li>
            <b>Rear-wheel drive</b> — the driven wheels are the ones weight shifts <em>onto</em>{" "}
            under acceleration, so RWD carries no penalty (grip is highest exactly when
            accelerating hardest).
          </Li>
          <Li>
            <b>Front-wheel drive</b> — the driven wheels are the ones weight shifts{" "}
            <em>away from</em> under acceleration, so FWD carries a flat traction penalty applied
            to its grip coefficient, reflecting that the drive wheels are lightest exactly when
            asked to put down the most force.
          </Li>
        </Ul>
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
          <Li>Determine the current gear, shifting up a gear if RPM has crossed the shift point derived in the Gearbox chapter.</Li>
          <Li>Look up torque at the current RPM from the Engine model.</Li>
          <Li>Convert torque to wheel force through the gear ratio, final drive, and drivetrain efficiency.</Li>
          <Li>Compare that force against the traction limit from the Friction chapter, producing the drive force <code>F_drive</code> from the piecewise rule in that chapter.</Li>
          <Li>Subtract aerodynamic drag (Aerodynamics chapter) and rolling resistance (Friction chapter) to get net force.</Li>
          <Li>Divide by mass for net acceleration, then integrate into velocity and distance as in the Overview.</Li>
        </Ul>
        <Formula
          tex={String.raw`a = \frac{F_{\text{drive}} - F_{\text{drag}} - F_{\text{roll}}}{m}`}
          vars={[
            { symbol: "a", desc: "net acceleration for this time step" },
            { symbol: "F_drive", desc: "drive force realized at the wheels (Friction chapter)" },
            { symbol: "F_drag", desc: "aerodynamic drag (Aerodynamics chapter)" },
            { symbol: "F_roll", desc: "rolling resistance (Friction chapter)" },
            { symbol: "m", desc: "vehicle mass" },
          ]}
        />
        <H3>Stopping conditions</H3>
        <P>
          Each test type ends on its own condition, checked every step: a fixed duration, a target
          distance, a target speed, or (for braking) coming to a full stop — plus a safety ceiling
          on total simulated time so a build that&rsquo;s simply too weak (or, in braking, too strong) to
          reach its target still terminates rather than looping indefinitely.
        </P>
        <H3>Theoretical top speed</H3>
        <P>
          Top speed is not read off the accel loop — it needs its own search, because torque isn&rsquo;t
          monotonic across the rev range: in a tall top gear, the drive-force-minus-resistance
          margin can dip negative at one speed (a weak point in the torque curve) and then recover
          at a higher speed once RPM climbs back into a stronger part of the band. The model
          instead scans the full speed range in the top gear and keeps the highest speed at which
          drive force still exceeds resistance, stopping only once the rev limiter itself becomes
          the true limiter:
        </P>
        <Pseudocode>{`for v in 0 … v_max_search:
    if rpm(v, topGear) > maxRevRpm: stop
    if F_wheel(v) > F_drag(v) + F_roll: lastValidSpeed = v
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
          The hot lap test simulates one theoretical flying lap of a chosen circuit, modeled as a
          sequence of straight and corner segments (each corner carrying its own radius), using the
          same look-ahead braking technique real lap-time simulators use, built on top of the
          straight-line model above.
        </P>
        <H3>Corner apex speed</H3>
        <P>
          A tyre negotiating a corner needs to supply centripetal force to hold its radius, and
          that force is capped by the exact same friction ceiling used for traction and braking.
          Setting the friction ceiling equal to the required centripetal force and solving for
          speed gives the fastest speed a given corner can be taken at:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
F_c &= \frac{m v^2}{r} \quad \text{(centripetal force required)} \\
F_c &\le \mu_{\text{eff}}\, m\, g \quad \text{(friction ceiling)} \\
v_{\text{apex}} &= \sqrt{\mu_{\text{eff}}\, g\, r}
\end{aligned}`}
          vars={[
            { symbol: "F_c", desc: "centripetal force required to hold the corner radius" },
            { symbol: "m", desc: "vehicle mass" },
            { symbol: "v", desc: "cornering speed" },
            { symbol: "r", desc: "corner radius" },
            { symbol: "μ_eff", desc: "effective grip coefficient (Friction chapter)" },
            { symbol: "g", desc: "gravitational acceleration" },
            { symbol: "v_apex", desc: "fastest speed the corner can be taken at" },
          ]}
        />
        <H3>Look-ahead braking</H3>
        <P>
          Rather than braking reactively at the corner entry, the model continuously checks, on
          every straight, how much distance would be needed to shed speed from the current speed
          down to the next corner&rsquo;s apex speed while braking at the tyre&rsquo;s maximum deceleration:
        </P>
        <Formula
          tex={String.raw`\begin{aligned}
a_{\text{brake}} &= \mu_{\text{eff}}\, g \\
d_{\text{brake}} &= \frac{v^2 - v_{\text{apex}}^2}{2\, a_{\text{brake}}}
\end{aligned}`}
          vars={[
            { symbol: "a_brake", desc: "tyre's maximum braking deceleration" },
            { symbol: "d_brake", desc: "distance needed to shed speed down to the apex speed" },
            { symbol: "v", desc: "current speed" },
            { symbol: "v_apex", desc: "target apex speed for the upcoming corner" },
          ]}
        />
        <P>
          Once the remaining distance to the corner is less than or equal to that braking distance,
          the car brakes at the limit; otherwise it keeps accelerating exactly as in the
          straight-line model (gear selection, engine force, traction limit, and drag all apply
          identically). Inside a corner segment itself, the car holds the apex speed — braking down
          to it if still too fast, or gently regathering speed toward it once under the limit,
          rather than trying to accelerate freely mid-corner.
        </P>
        <H3>Gear selection on a hot lap</H3>
        <P>
          Cruising and coasting elsewhere in the app pick the tallest gear that still keeps the
          engine above idle. A hot lap instead always uses the shortest gear that doesn&rsquo;t over-rev
          past the shift point — mirroring a driver who short-shifts nothing and takes every gear
          right up to its limit, which is what actually produces the fastest lap.
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
            { symbol: "x̂", desc: "the normalized stat value, in 0–1" },
            { symbol: "x", desc: "the raw stat value being normalized" },
            { symbol: "min/max(allValues)", desc: "the min and max of that stat across your build plus every reference car" },
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
            { symbol: "d", desc: "overall distance (dissimilarity) between your build and a reference car" },
            { symbol: "w_k", desc: "weight for stat k (power and power-to-weight weighted more heavily)" },
            { symbol: "t̂_k, ĉ_k", desc: "normalized stat k for your build and the reference car, respectively" },
            { symbol: "w_a, w_ℓ", desc: "flat penalty weights for an aspiration or layout mismatch" },
            { symbol: "𝟙[·]", desc: "indicator function: 1 if the mismatch condition holds, 0 otherwise" },
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
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-lg backdrop-blur-md transition-colors hover:border-amber-500 hover:text-amber-400"
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
                <div className="text-xs uppercase tracking-wider text-amber-400">
                  Technical Specification
                </div>
                <div className="font-mono text-sm font-bold text-zinc-100 sm:text-base">
                  Engine Builder — Simulation Model
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
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
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors sm:shrink ${
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

              <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
                <div className="mx-auto max-w-3xl">
                  <div className="mb-1 font-mono text-xs text-zinc-500">{active.num}</div>
                  <h2 className="mb-5 text-xl font-bold text-zinc-100">{active.title}</h2>
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
