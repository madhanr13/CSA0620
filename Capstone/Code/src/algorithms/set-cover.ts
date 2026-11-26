import type { Result, SolveInput, Step } from '../lib/types';
export function popcount(n: bigint): number { let c = 0; while (n) { n &= n - 1n; c++; } return c; }
export function greedy(input: SolveInput): Result {
  const start = performance.now(), { masks, costs, count } = input;
  const full = (1n << BigInt(count)) - 1n;
  let covered = 0n, cost = 0;
  const selected: number[] = [], steps: Step[] = [];
  while (covered !== full) {
    let best = -1, ratio = Infinity, gain = 0;
    for (let i = 0; i < masks.length; i++) {
      const added = popcount(masks[i] & ~covered & full);
      if (added && costs[i] / added < ratio) { best = i; ratio = costs[i] / added; gain = added; }
    }
    if (best < 0) break;
    selected.push(best); steps.push({ site: best, added: gain, cost: costs[best] });
    covered |= masks[best] & full; cost += costs[best];
  }
  return { selected, steps, cost, covered: popcount(covered), ms: performance.now() - start, optimal: false, timedOut: false, infeasible: covered !== full, nodes: 0 };
}
export function exact(input: SolveInput): Result {
  const start = performance.now(), { masks, costs, count } = input;
  const full = (1n << BigInt(count)) - 1n;
  let best = greedy(input);
  if (best.infeasible) return best;
  let incumbent = best.cost, answer = best.selected, timedOut = false, nodes = 0;
  const seen = new Map<bigint, number>();
  const candidates = Array.from({ length: count }, (_, b) => masks.map((m, i) => (m & (1n << BigInt(b))) ? i : -1).filter(i => i >= 0));
  function visit(covered: bigint, cost: number, chosen: number[]) {
    nodes++;
    if (performance.now() - start > (input.limitMs ?? 4000)) { timedOut = true; return; }
    if (cost >= incumbent) return;
    if (covered === full) { incumbent = cost; answer = [...chosen]; return; }
    if ((seen.get(covered) ?? Infinity) <= cost) return;
    // Bound memory independently of the time budget.
    if (seen.size < 200_000) seen.set(covered, cost);
    const remaining = full & ~covered;
    let minRatio = Infinity, branch: number[] = [];
    for (let i = 0; i < masks.length; i++) {
      const gain = popcount(masks[i] & remaining);
      if (gain) minRatio = Math.min(minRatio, costs[i] / gain);
    }
    if (cost + minRatio * popcount(remaining) >= incumbent - 1e-9) return;
    let fewest = Infinity;
    for (let b = 0; b < count; b++) if (remaining & (1n << BigInt(b))) {
      const options = candidates[b].filter(i => cost + costs[i] < incumbent);
      if (!options.length) return;
      if (options.length < fewest) { fewest = options.length; branch = options; }
    }
    branch.sort((a, b) => costs[a] / popcount(masks[a] & remaining) - costs[b] / popcount(masks[b] & remaining));
    for (const i of branch) {
      visit(covered | masks[i], cost + costs[i], [...chosen, i]);
      if (timedOut) return;
    }
  }
  visit(0n, 0, []);
  let covered = 0n;
  const steps = answer.map(site => { const added = popcount(masks[site] & ~covered); covered |= masks[site]; return { site, added, cost: costs[site] }; });
  return { ...best, selected: answer, steps, cost: incumbent, optimal: !timedOut, timedOut, nodes, ms: performance.now() - start };
}
