import { exact, greedy } from '../algorithms/set-cover';
import type { SolveInput } from '../lib/types';
self.onmessage = (event: MessageEvent<SolveInput>) => {
  try {
    self.postMessage({ kind: 'greedy', result: greedy(event.data) });
    self.postMessage({ kind: 'exact', result: exact(event.data) });
  } catch (e) { self.postMessage({kind:'error', message: e instanceof Error ? e.message : 'Solver failed.'}); }
};
