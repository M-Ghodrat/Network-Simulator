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
  parameterMode?: "network" | "node"; // "network" (global sliders) or "node" (per-node properties)
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

export interface ParameterLimit {
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  label: string;
  description: string;
  unit?: string;
}

export interface SimulationLimitsConfig {
  T: ParameterLimit;
  gamma: ParameterLimit;
  theta: ParameterLimit;
  rv: ParameterLimit;
  epsilon: ParameterLimit;
  shockIntensity: ParameterLimit;
  interventionStrength: ParameterLimit;
}

export const DEFAULT_SIMULATION_LIMITS: SimulationLimitsConfig = {
  T: {
    min: 1,
    max: 50,
    step: 1,
    defaultVal: 10,
    label: "Simulation Waves (T)",
    description: "Maximum cascade propagation cycles / time horizons.",
    unit: "waves"
  },
  gamma: {
    min: 0.1,
    max: 5.0,
    step: 0.1,
    defaultVal: 1.5,
    label: "Centrality Dampening (γ)",
    description: "Scaling constant governing non-linear network centrality dampening.",
    unit: "multiplier"
  },
  theta: {
    min: 0.0,
    max: 0.4,
    step: 0.01,
    defaultVal: 0.2,
    label: "Failure Threshold (θ)",
    description: "Cumulative vulnerability score needed to trigger node collapse.",
    unit: "score"
  },
  rv: {
    min: 0.0,
    max: 0.1,
    step: 0.005,
    defaultVal: 0.05,
    label: "Passive Recovery (rv)",
    description: "Inherent self-healing rate per wave without active intervention.",
    unit: "rate"
  },
  epsilon: {
    min: 0.0001,
    max: 0.05,
    step: 0.0005,
    defaultVal: 0.001,
    label: "Convergence Tolerance (ε)",
    description: "Minimum state delta between waves to consider cascade converged.",
    unit: "delta"
  },
  shockIntensity: {
    min: 0.05,
    max: 1.0,
    step: 0.05,
    defaultVal: 0.4,
    label: "Shock Intensity (Δv)",
    description: "Initial perturbation severity injected into selected nodes.",
    unit: "intensity"
  },
  interventionStrength: {
    min: 0.05,
    max: 1.0,
    step: 0.05,
    defaultVal: 0.3,
    label: "Intervention Strength (iv)",
    description: "Mitigation power applied at designated waves to restore stability.",
    unit: "strength"
  }
};

export type AcademicSeason = "Spring" | "Summer" | "Fall" | "Winter";

export interface AppUserAccount {
  id: string; // clean lowercase username, e.g. "user1"
  username: string; // e.g. "user1"
  password: string; // password
  term?: string; // e.g. "Summer 2026" (not needed for admin)
  season?: AcademicSeason;
  year?: number; // e.g. 2026
  role: "user" | "admin";
  createdAt: string;
  updatedAt?: string;
}

export interface LearnVisibilityConfig {
  general: boolean;            // General Concepts
  network_concepts: boolean;   // Network Concepts
  simulation_concepts: boolean;// Simulation Concepts
  videos: boolean;             // Video Tutorials
  lab: boolean;                // Practice Lab
}

export const DEFAULT_LEARN_VISIBILITY: LearnVisibilityConfig = {
  general: true,
  network_concepts: true,
  simulation_concepts: true,
  videos: true,
  lab: true,
};

export const DEFAULT_USER_ACCOUNTS: AppUserAccount[] = [
  {
    id: "user1",
    username: "user1",
    password: "user1",
    term: "Summer 2026",
    season: "Summer",
    year: 2026,
    role: "user",
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "user2",
    username: "user2",
    password: "user2",
    term: "Summer 2026",
    season: "Summer",
    year: 2026,
    role: "user",
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "user3",
    username: "user3",
    password: "user3",
    term: "Summer 2026",
    season: "Summer",
    year: 2026,
    role: "user",
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "admin",
    username: "admin",
    password: "admin",
    role: "admin",
    createdAt: "2026-06-01T00:00:00.000Z"
  }
];

