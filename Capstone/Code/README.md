# Circuit — E-waste Collection Planner

Circuit helps choose **where to operate e-waste collection sites**. Given a list
of demand areas and possible collection sites, it selects sites that cover every
area while minimizing either the monthly operating cost or the number of sites.

The project demonstrates **sustainable e-waste collection planning using exact
set cover and a greedy approximation algorithm**. It compares their solutions,
shows coverage on a geographic diagram, and exports the selected sites as CSV.

## The problem in plain language

Suppose a city has 24 neighborhoods that need e-waste collection and 12 possible
collection points. Each point has a service radius and a monthly operating cost.
Opening all 12 may be unnecessary.

Circuit asks: **Which collection points should be opened so that every
neighborhood has a collection point within reach, at the lowest cost?**

This is a set-cover problem:

| Project concept | Set-cover equivalent |
| --- | --- |
| All demand areas | The universe of elements |
| Areas within one site's radius | A subset |
| Opening a collection site | Selecting a subset |
| Covering every area | Covering the universe |
| Monthly site operating cost | Subset weight |

The sustainability goal is to support access to e-waste collection with fewer
duplicated facilities or lower operating costs. The application does **not**
measure actual waste recovered, emissions avoided, or environmental impact.

## What the application does

- Loads demand areas and candidate sites from CSV.
- Computes which areas each site can serve using geographic coordinates.
- Lets users minimize **cost** or **site count**.
- Runs greedy approximation and exact branch-and-bound in a web worker.
- Compares selected sites, monthly cost, runtime, and solution status.
- Shows selected sites, service radii, and covered areas on a schematic map.
- Replays greedy choices one at a time.
- Exports the selected plan, dataset tables, and coverage relationships.
- Supports light and dark themes, with a saved browser preference.

The map is a coordinate-based diagram, **not a street map**. Data is processed
locally in the browser; there is no upload service, account system, or backend.

## Run locally

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

```sh
npm test           # Algorithm, CSV validation, and geometry checks
npm run build     # Type-check and create dist/
npm run preview   # Preview the production build
```

Deploy `dist/` to a static host at its domain root. No API keys are required.
Typography uses Google Fonts, with system font fallbacks if unavailable.

## Using the planner

1. Start with the included Chennai sample, or open **Data** to import your CSVs.
2. In **Planner**, choose **Minimum cost** or **Minimum sites**.
3. Adjust **Radius multiplier** if needed. `1.00×` uses each CSV radius as supplied.
4. Click **Run comparison**.
5. Select **Greedy** or **Exact** in the results table to display its plan.
6. Use **Replay** to inspect site additions, or **Export CSV** to save the full
   selected algorithm's plan. Export always includes the full result, even during replay.

The theme button in the header switches light/dark mode. On first visit the
application follows the system preference; a manual choice is saved locally.
Uploaded datasets and solver results are not persisted across page reloads.

## Inputs and dataset

The sample in `public/data/` contains **24 demand areas and 12 hypothetical sites
in central Chennai**. It is a synthetic demonstration benchmark:

- Locality names are real, with approximate representative coordinates.
- Collection sites are hypothetical, not verified operational facilities.
- Quantities and costs are illustrative, not official survey or quotation data.

See [`public/data/README.md`](public/data/README.md) for provenance and assumptions.

### `demand_areas.csv`

```csv
id,name,lat,lon,kg
A01,Anna Nagar West,13.0920,80.2020,210
```

| Column | Meaning |
| --- | --- |
| `id` | Unique area identifier |
| `name` | Area name |
| `lat`, `lon` | WGS84 latitude and longitude |
| `kg` | Estimated available e-waste per monthly collection cycle |

### `collection_sites.csv`

```csv
id,name,lat,lon,radius,cost
S01,Anna Nagar collection point,13.0870,80.2140,2.2,3400
```

| Column | Meaning |
| --- | --- |
| `id` | Unique site identifier |
| `name` | Site name |
| `lat`, `lon` | WGS84 latitude and longitude |
| `radius` | Service radius in kilometers, greater than zero |
| `cost` | Monthly operating cost in INR, greater than zero |

Imports accept up to **500 areas**, **200 sites**, and **1 MB per file**.
Validation checks required fields, numeric values, coordinate ranges, duplicate
IDs, and row lengths. Demand must be nonnegative. Importing a file replaces its
corresponding table; import both files when changing the study area.

### Derived coverage

The haversine formula calculates straight-line distance using an Earth radius
of 6,371 km. Area `i` is covered by site `j` when:

```text
distance(area[i], site[j]) <= site[j].radius × radiusMultiplier
```

Use **Coverage CSV** in the Data tab to export all covered site-area pairs.
Coverage is recalculated when the dataset or radius multiplier changes.

## Algorithms

### Greedy approximation

At each step, select the site with the smallest:

```text
site cost / number of newly covered areas
```

Repeat until all areas are covered or no site can add coverage. Ties follow CSV
input order. For **Minimum sites**, every site's optimization cost is set to 1;
the interface still reports the actual INR operating cost.

This algorithm is fast, but not always optimal. For a feasible instance with
positive costs, its approximation factor is bounded by the harmonic number
`H_n ≤ 1 + ln(n)`, where `n` is the number of areas.

### Exact branch-and-bound

The exact solver searches alternative site combinations. It uses:

- BigInt bitsets for compact coverage operations.
- A greedy solution as the initial upper bound.
- A cost-per-gain lower bound to prune uncompetitive branches.
- Branching on an uncovered area with few candidate sites.
- A state-cost cache capped at 200,000 entries.

Worst-case runtime is exponential. Search stops after approximately **4 seconds**:

| Status | Meaning |
| --- | --- |
| Optimal | Search finished and proved the minimum objective |
| Approximate | Greedy result; optimality is not claimed |
| Time limit | Best exact-search solution so far, without an optimality proof |
| Incomplete | At least one area is outside all candidate sites' reach |

Both algorithms run in a web worker to keep the interface responsive.
**Cancel** terminates the worker and preserves any completed greedy result.
No partial exact-search result is sent on manual cancellation.

## Understanding the results

- **Coverage:** Percentage and count of areas served by selected sites.
- **Selected sites:** Number of selected candidate sites.
- **Monthly cost:** Sum of actual INR costs for those sites.
- **Covered demand:** Sum of `kg` for covered areas, counted once per area.
- **Runtime:** Computation time for each solver, excluding page rendering.

Demand quantities do not weight site selection: the objective is to cover
**every area**, regardless of its waste quantity. Covered kilograms represent
potential access, not measured waste collection.

At the default radius and minimum-cost objective, the included sample produces:

| Algorithm | Sites | Monthly cost | Area coverage |
| --- | ---: | ---: | ---: |
| Greedy | 9 | ₹27,400 | 100% |
| Exact | 6 | ₹20,800 | 100% |

Runtime varies by device. The exact solution costs ₹6,600 less in this scenario.

## Project structure

```text
src/
  app/main.ts               Workspace state, rendering, and interaction
  algorithms/set-cover.ts   Greedy and exact solvers
  components/map.ts         SVG geographic coverage diagram
  lib/
    coverage.ts             Geographic distance and coverage masks
    csv.ts                  CSV parsing, validation, and export
    theme.ts                System and saved theme preferences
    types.ts                Shared data contracts
  styles/main.css           Responsive layout and light/dark tokens
  workers/solver.ts          Background algorithm execution
public/data/                CSV benchmark and data documentation
tests/algorithms.test.ts    Solver, CSV, and distance tests
```

Built with TypeScript and Vite, without a UI framework or mapping dependency.
Algorithm tests compare exact results against exhaustive subset enumeration on
100 deterministic small weighted instances.

## Scope and limitations

This project is a facility-selection planning model, not a complete collection
operations system. It does not model road travel, traffic, site capacity,
vehicle routes, schedules, licensing, or actual waste processing.

Use verified demand, facility locations, costs, and service assumptions before
making operational decisions. Changing the radius changes the coverage model;
it does not change the costs supplied in the CSV.
