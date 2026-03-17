# AgentExter: Generic Offline Rebuild Playbook (No-PS1 Default)

Use this as instructions for Codex to recreate this project in any new directory without network access. The deliverable is an offline-first single-page app: open `index.html` directly via `file://` and it works without internet.

Note: Keep names generic. Examples below describe roles (logic module, browser entry, bundle, output dir) rather than fixed filenames.

**Goals**
- Offline HTML entry page (no CDN, no remote fonts, no XHR/fetch).
- Core battle logic in a separate module under `src/`.
- Browser entry under `src/` that parses inputs, calls the logic, and renders results.
- PowerShell build script is required; Node-only commands are provided for reference.
- Minimal, dependency-free tests using Node's built-in `assert`.

**Environment**
- Node.js 18+ in `PATH`.
- Optional: PowerShell 5.1+ on Windows (only if you choose the optional PS1 builder).

**Directory Layout (example)**
- `src/` — TypeScript sources
  - core logic module (exports the battle computation)
  - browser entry module (reads inputs, calls logic, renders)
- `scripts/` — Node helpers
  - bundle script — strips ESM import/export and wraps in IIFE to produce a single browser bundle
  - scenario runner — generates markdown for fixed variants
  - calibration runner — larger batches across pairs
  - parameter search — grid search for model parameters
  - quick eval — fast Monte‑Carlo checks
- output directory (e.g., `dist/`) — compiled JS and the final single-file bundle
- `reports/` — generated markdown summaries
- `index.html` — offline UI that references the bundle via a relative path

**Configs**
- `package.json` (ESM):
  - `type: module`
  - scripts (names are examples):
    - `build`: `tsc -p tsconfig.json && node scripts/bundle.mjs`
    - `scenarios`: `node scripts/scenarios.mjs`
    - optionally `test`: `node tests/<test-file>.mjs`
- `tsconfig.json`:
  - `target/module: ES2020`, `moduleResolution: Node`, `rootDir: ./src`, `outDir: ./<output dir>`, `strict: true`, `skipLibCheck: true`, `lib: [ES2020, DOM]`, `esModuleInterop: true`.

**Implementation Notes**
- Logic module:
  - Deterministic RNG from a string seed; safe defaults when omitted.
  - Roll count from total units with a small-battle boost; thresholds clamped to [1,95].
  - Success comparison; tie-break by proximity to threshold; final slight bias on exact ties.
  - Survivor model using base rate from success-diff, ratio bonus, jitter; at least one survivor for the winner; loser has zero survivors.
- Browser entry:
  - Parse inputs (attacker, defender, optional seed). Call logic, render thresholds/successes/survivors, draw dice with success highlighting, presets, reroll.

**HTML (offline)**
- Single `index.html` with inline CSS; no external assets.
- Includes one script tag pointing to the bundled JS inside the project (relative path).
- Do not use `<script type="module">`; the bundle is a plain script that runs from `file://`.


**Build Pipeline (PowerShell builder is required)**
- Provide a Windows PowerShell build script at scripts/<builder>.ps1 that:
  1) Ensures configs exist (or creates minimal defaults) and the output directory is present.
  2) Ensures a local TypeScript compiler is available (see Offline Strategies), without hitting the network.
  3) Runs the TypeScript compiler against 	sconfig.json and writes compiled files to the output directory.
  4) Runs a Node bundler script to read the compiled logic + browser entry, remove ESM import/export, wrap in an IIFE, and write a single browser bundle to the output directory.
  5) Prints a concise summary of produced artifacts.
- Invoke on Windows: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/<builder>.ps1`n- Encoded invocation (UTF-16LE → Base64) is supported when ExecutionPolicy cannot be changed (see PowerShell Encoding section).

- Reference (Node-only, for parity and non-Windows environments):
  1) 	sc -p tsconfig.json`n  2) 
ode scripts/bundle.mjs`n  3) Or 
pm run build chaining both commands.

**CLI Utilities (optional but recommended)** (optional but recommended)**
- Scenario runner: generate a markdown table for a set of unit variants; supports `--count/-n`, `--random-seed`, `--seed-prefix`.
- Calibration: compute win rates and average survivors; write a report.
- Parameter search: explore parameter grids; report best fits.
- Quick eval: quick Monte‑Carlo rates for a few matchups.

**Tests (no extra deps)**
- Place a test file under `tests/` that imports the compiled logic module from the output directory and uses `node:assert` to verify:
  - Determinism (same seed → identical results).
  - Threshold bounds and roll count ≥ 2.
  - Winner survivors ≥ 1; loser survivors = 0.
  - Monotonic tendency across a small sequence when increasing defender vs fixed attacker.

**Build/Run Examples**
- Build: `npm run build` (Node-only chain) or manually run `tsc` then `node scripts/bundle.mjs`.
- Run scenarios: `npm run scenarios -- --count 30 --random-seed`.
- Open locally: double‑click `index.html` (verify it runs fully offline via `file://`).

**Offline Strategies**
- Vendor the compiler: copy an existing `node_modules/typescript` so a local `tsc` exists; `npx tsc` will use it offline.
- Local tarball: prefetch once online (`npm pack typescript@5.x`) and install from the `.tgz` path with `npm install --offline <path>`.
- Portable compiler: copy TypeScript `lib/tsc.js` and run via `node <local-path>/tsc.js -p tsconfig.json`.
- Ensure files are UTF‑8. Avoid network-reliant steps (no `npm audit`, no fetch).

**Validation Checklist**
- Output directory contains compiled files and a single browser bundle.
- Opening `index.html` via `file://` shows thresholds, rolls, successes, survivors; presets and reroll work.
- Scenario/calibration utilities produce markdown under `reports/`.
- Tests pass within a few seconds on typical hardware.

**Troubleshooting**
- Blank page: open devtools, check for bundle 404 or syntax errors; confirm ESM syntax was removed in the bundle.
- Unexpected network calls: ensure the compiler is vendored or installed from a local tarball; avoid commands that hit registries.
- Cross‑platform note: prefer the Node-only build chain in CI or on non‑Windows systems; PS1 is optional.

**Definition of “Same Project” (behavioral)**
- Deterministic, seedable RNG; success-count comparison with proximity tie-break and slight bias on exact ties.
- Survivor model based on success difference and relative size; winner has at least one survivor.
- Single-file browser bundle consumed by an offline `index.html`.

