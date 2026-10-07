# Engine Builder

Engine Builder is an interactive car-engine and vehicle simulation built with Next.js. Configure a chassis, build an engine, choose a gearbox, pick a test, and inspect the simulated results.

## Features

- Choose a minivan, SUV, supercar, or F1 chassis and tune its weight, wheels, tyres, pressure, wheel spin, and traction control.
- Pick a real car preset - actual production and F1 models across all four body types - to set its engine, gearbox, weight, and wheels outright, while still tuning tyres and traction yourself.
- Configure cylinder count and layout, displacement, redline, rev limit, fuel, and aspiration.
- Choose the gear count and drivetrain (front- or rear-wheel drive).
- Run a 0-100 kph, 10-second, 500 m drag, braking, or hot lap test in dry, wet, rain, or headwind conditions.
- In the braking test, hold a cruising speed for 5s, then brake to a full stop after a 3-2-1-0 countdown, with the transmission downshifting through the gears as the car slows.
- In the hot lap test, pick one of the 24 circuits on the 2025 F1 calendar - built from real track geometry, correctly oriented with start/finish - and watch a theoretical flying lap play out live, with a dot tracking the car's position around the track.
- View peak power, torque, power-to-weight ratio, estimated weight, theoretical top speed, live gear, and test telemetry.
- Explore RPM, power, torque, combustion/friction, and tractive-force graphs.
- Compare the result with reference cars from `data/cars.json`.
- Save and remove favorite configurations in the browser using `localStorage`.

## Getting Started

### Prerequisites

- Node.js with npm

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Available Scripts

```bash
npm run dev    # Start the development server
npm run lint   # Run ESLint
npm run build  # Create a production build
npm run start  # Serve the production build
```

## Deployment

The app is a fully client-side static export (no API routes or server actions), so it's hosted on GitHub Pages. Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds the site with `npm run build` (`output: "export"` in [next.config.ts](next.config.ts)) and publishes the `out/` folder via GitHub's Pages Actions deployment.

Live at: https://marcllachgomila-cyber.github.io/Engine-ering/

## How It Works

1. Set up the chassis and tyres.
2. Configure the engine. The form adjusts valid layouts and diesel redline limits as needed.
3. Choose the gearbox: gear count and drivetrain.
4. Select a test (including a braking test that measures stopping time and distance) and road conditions, then start the run.
5. Review the simulation summary, graphs, and closest reference-car matches.
6. Save completed runs from the results screen. Favorites are stored locally in the current browser and are not synced to an account.

## Project Structure

- `app/` - Next.js app entry point and global styles.
- `components/EngineBuilder/` - Chassis, engine, gearbox, test, preview, and navigation UI.
- `components/Simulation/` - Simulation runner, live gauges, results, and graphs.
- `components/Matches/` - Reference-car matching UI.
- `components/Favorites/` - Saved configuration UI.
- `lib/physics/` - Engine, tyre, brake, aero, and vehicle-dynamics models, the drag/braking/hot-lap simulations, and circuit/real-car data (`circuitData/`, `carData/`).
- `lib/audio/` - Browser engine-audio simulation.
- `lib/matching/` - Reference-car matching logic.
- `data/cars.json` - Reference-car dataset used for result comparisons.
- `scripts/generate-car-data.mjs` - Builds `lib/physics/carData.generated.ts` from the JSON files under `lib/physics/carData/` (runs automatically via `predev`/`prebuild`).

## Adding a Dedicated 3D Model

The vehicle viewer shows each body type's generic model unless a real-car preset has its own. To give a preset one:

1. Put the GLB in `public/models/` with a lowercase kebab-case name (e.g. `mclaren-720s.glb`), under 5 MB. Compress it with meshopt (e.g. `gltf-transform meshopt`); Draco isn't used, because its decoder would be fetched from a third-party CDN at runtime.
2. Add a `model3d` entry to the preset's JSON:

   ```json
   "model3d": {
     "file": "mclaren-720s.glb",
     "yawDeg": 0,
     "credit": {
       "title": "Model title",
       "author": "Author name",
       "sourceUrl": "https://where-it-came-from",
       "license": "CC-BY-4.0"
     }
   }
   ```

   `yawDeg` turns the model so its nose faces forward (+X). It's then scaled to the preset's body length and set down on the ground automatically.

`npm run generate:cars` (run before every dev/build) rejects a model that is missing, too large, missing credit fields, or under a licence not known to allow redistribution (accepted: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-3.0`, `CC-BY-SA-4.0`, `MIT`, `own-work`). Don't use manufacturer CAD or models whose terms don't allow redistribution. The viewer shows the credit with a link to the source, loads the model only while that preset is selected, and falls back to the generic model if it fails to load.

## Technology

The project uses [Next.js](https://nextjs.org), [React](https://react.dev), [TypeScript](https://www.typescriptlang.org), [Tailwind CSS](https://tailwindcss.com), and [Three.js](https://threejs.org) through React Three Fiber for the engine preview.

No environment variables are required for local development.

## Author

Created by Marc Llach Gomila.

## License

Licensed under the [Mozilla Public License 2.0](LICENSE) (MPL-2.0). You're free to use, modify, and distribute this code, including commercially, as long as changes to MPL-licensed files are shared back under the same license and the original copyright notice is preserved.
