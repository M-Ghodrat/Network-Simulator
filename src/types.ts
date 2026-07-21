export interface Domain {
  id: string; // "1", "2", ... or unique ID
  name: string;
}

export interface NodeIndicator {
  id: string; // e.g. "BI", "PF"
  abbr: string; // same as id
  full_name: string;
  domain_id: string; // "1" to "7"
  theta?: number; // threshold (theta_v)
  recovery_rate?: number; // recovery_rate (r_v)
}

export interface Edge {
  id: string; // unique ID
  source: string; // source node id (abbr)
  target: string; // target node id (abbr)
  weight?: number; // optional edge weight
}

export interface Intervention {
  node: string; // node abbreviation, e.g. "PF"
  wave: number; // wave index (0 to T-1)
  strength: number; // strength of intervention (i_v)
}

export interface Shock {
  node: string; // node abbreviation, e.g. "PF"
  intensity: number; // delta_v (0 to 1)
}

export interface SimulationResult {
  history: Record<string, number[]>; // node_abbr -> S_v list
  gsi: number[]; // global stability index per wave
  vnc: number[]; // vulnerable node count per wave
  vulnerable_nodes: string[][]; // list of vulnerable node abbreviations per wave
  cascade_depth: number; // wave where loop terminated
  domain_spillover: Record<string, number>[]; // per wave: domain_id -> fraction
  plots: string[]; // base64-encoded PNG strings for waves 0 to T
}

export interface SimulatorParams {
  id: string; // e.g., "default"
  T: number;
  theta: number;
  gamma: number;
  epsilon: number;
  rv: number;
  shocks: Shock[];
  interventions: Intervention[];
}

export interface SavedNetworkConfig {
  name: string;
  savedAt: string;
  domains: Domain[];
  nodes: NodeIndicator[];
  edges: Edge[];
  params: SimulatorParams;
}

