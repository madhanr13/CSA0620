export interface Area { id: string; name: string; lat: number; lon: number; kg: number }
export interface Site { id: string; name: string; lat: number; lon: number; radius: number; cost: number }
export interface Dataset { areas: Area[]; sites: Site[] }
export interface Step { site: number; added: number; cost: number }
export interface Result { selected: number[]; steps: Step[]; cost: number; covered: number; ms: number; optimal: boolean; timedOut: boolean; infeasible: boolean; nodes: number }
export interface SolveInput { masks: bigint[]; costs: number[]; count: number; limitMs?: number }
