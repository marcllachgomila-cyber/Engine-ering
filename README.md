# Engine Builder

Engine Builder is an interactive car-engine and vehicle simulation built with Next.js. Configure a chassis, build an engine, choose a test, and inspect the simulated results.

## Features

- Choose a minivan, SUV, or supercar chassis and tune its weight, wheels, tyres, pressure, wheel spin, and traction control.
- Configure cylinder count and layout, displacement, redline, rev limit, fuel, aspiration, gears, and drivetrain.
- Run a 0-100 kph, 10-second, 500 m drag, or braking test in dry, wet, rain, or headwind conditions.
- In the braking test, hold a cruising speed for 5s, then brake to a full stop after a 3-2-1-0 countdown, with the transmission downshifting through the gears as the car slows.
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

## How It Works

1. Set up the chassis and tyres.
2. Configure the engine and drivetrain. The form adjusts valid layouts and diesel redline limits as needed.
3. Select a test (including a braking test that measures stopping time and distance) and road conditions, then start the run.
4. Review the simulation summary, graphs, and closest reference-car matches.
5. Save completed runs from the results screen. Favorites are stored locally in the current browser and are not synced to an account.

## Project Structure

- `app/` - Next.js app entry point and global styles.
- `components/EngineBuilder/` - Chassis, engine, test, preview, and navigation UI.
- `components/Simulation/` - Simulation runner, live gauges, results, and graphs.
- `components/Matches/` - Reference-car matching UI.
- `components/Favorites/` - Saved configuration UI.
- `lib/physics/` - Engine curves, vehicle calculations, simulation, and tractive-force models.
- `lib/audio/` - Browser engine-audio simulation.
- `lib/matching/` - Reference-car matching logic.
- `data/cars.json` - Reference-car dataset used for result comparisons.

## Technology

The project uses [Next.js](https://nextjs.org), [React](https://react.dev), [TypeScript](https://www.typescriptlang.org), [Tailwind CSS](https://tailwindcss.com), and [Three.js](https://threejs.org) through React Three Fiber for the engine preview.

No environment variables are required for local development.
