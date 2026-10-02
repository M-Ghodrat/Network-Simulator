import { useState, useMemo, useEffect, useRef } from "react";
import { 
  Network, 
  Layers, 
  PlayCircle, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  BookOpen, 
  Share2, 
  ShieldAlert, 
  Compass, 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Info, 
  Radio, 
  BarChart3, 
  GitBranch, 
  Cpu, 
  Sliders, 
  Zap, 
  Activity, 
  Clock, 
  ShieldCheck, 
  RotateCcw, 
  Target, 
  Flame, 
  Percent,
  Play,
  Pause,
  EyeOff,
  ExternalLink
} from "lucide-react";
import PracticeLab from "./PracticeLab";
import SimulationConceptsDeck from "./SimulationConceptsDeck";
import { dataService } from "../dataService";
import { LearnVisibilityConfig, DEFAULT_LEARN_VISIBILITY } from "../types";

// Math Formatting Helper: Converts sub/superscript notations and math operators to publication-grade typography
export function formatMathHtml(text: string): string {
  if (!text) return "";
  let out = text;

  // Real coordinate and set spaces
  out = out.replace(/R\^\(([^)]+)\)/g, "ℝ<sup>$1</sup>");
  out = out.replace(/R\^([a-zA-Z0-9]+)/g, "ℝ<sup>$1</sup>");
  out = out.replace(/R\^N/g, "ℝ<sup>N</sup>");

  // Carets / superscripts: ^{...}, ^(-1), ^(-d), ^T, ^k, etc.
  out = out.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
  out = out.replace(/\^\(([^)]+)\)/g, "<sup>$1</sup>");
  out = out.replace(/\^([a-zA-Z0-9\+\-]+)/g, "<sup>$1</sup>");

  // Subscripts: _{...}, _(...), _word
  out = out.replace(/_\{([^}]+)\}/g, "<sub>$1</sub>");
  out = out.replace(/_\(([^)]+)\)/g, "<sub>$1</sub>");
  // Match identifiers: letter/digits/commas (like D,in or D,out or uv or max) without consuming trailing punctuation
  out = out.replace(/_([a-zA-Z0-9\+\-≠]+(?:,[a-zA-Z0-9\+\-≠]+)*)/g, "<sub>$1</sub>");

  // Clean mathematical minus in exponents
  out = out.replace(/<sup>-1<\/sup>/g, "<sup>−1</sup>");
  out = out.replace(/<sup>-d<\/sup>/g, "<sup>−d</sup>");
  out = out.replace(/<sup>-<\/sup>/g, "<sup>−</sup>");

  return out;
}

export function MathText({ 
  children, 
  className = "" 
}: { 
  children: string; 
  className?: string; 
}) {
  const html = formatMathHtml(children);
  return (
    <span 
      className={`font-mono tracking-wide [&>sub]:text-[0.74em] [&>sub]:align-sub [&>sub]:leading-none [&>sup]:text-[0.72em] [&>sup]:align-super [&>sup]:leading-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type MainTab = "general" | "network_concepts" | "simulation_concepts" | "videos" | "lab";


interface ConceptDefinition {
  id: string;
  term: string;
  symbol: string;
  category: "Fundamentals" | "Graph Structures" | "Node Metrics" | "Dynamics & Resilience";
  shortSummary: string;
  formalDefinition: string;
  formula?: string;
  formulaExplanation?: string;
  keyProperties: string[];
  urbanExample: string;
  generalExample: string;
}

const GENERAL_DEFINITIONS: ConceptDefinition[] = [
  {
    id: "graph-definition",
    term: "Network / Graph",
    symbol: "G = (V, E)",
    category: "Fundamentals",
    shortSummary: "The overarching mathematical structure representing interconnected components and their relational dependencies.",
    formalDefinition: "A graph G is an ordered pair (V, E) comprising a set V of vertices (nodes) and a set E of edges (links) that connect pairs of vertices.",
    formula: "G = (V, E),  |V| = N,  |E| = M",
    formulaExplanation: "N represents the total number of nodes in the system, while M denotes the total count of active operational connections.",
    keyProperties: [
      "Defines the global topology of the entire infrastructure system.",
      "Can be directed or undirected, weighted or unweighted.",
      "Forms the substrate over which physical flows and failure cascades propagate."
    ],
    urbanExample: "An entire metropolitan infrastructure network comprising power stations, water treatment plants, telecommunication hubs, and transit links.",
    generalExample: "A social communication network connecting individuals through messaging channels or academic collaboration relationships."
  },
  {
    id: "vertices-definition",
    term: "Vertices & Nodes",
    symbol: "V = {v_1, v_2, ..., v_n}",
    category: "Fundamentals",
    shortSummary: "The discrete structural units, physical assets, or agents operating within a network.",
    formalDefinition: "Vertices represent the fundamental entities in a network that hold internal states, receive inputs, process resources, and transmit outputs to adjacent entities.",
    formula: "v ∈ V,  x_v(t) ∈ [0, 1]",
    formulaExplanation: "x_v(t) denotes the operational health or state of node v at discrete simulation wave or time step t.",
    keyProperties: [
      "Characterized by capacity, failure threshold, recovery rate, and local centrality.",
      "Can suffer localized shock and initiate cascading propagation.",
      "Possess independent attributes such as geographical coordinates and sector classification."
    ],
    urbanExample: "A power generation substation, water reservoir, acute care hospital, or traffic intersection.",
    generalExample: "An individual scholar in a citation network, a computer server in a data center, or an airport terminal."
  },
  {
    id: "edges-definition",
    term: "Edges & Links",
    symbol: "E ⊆ V × V",
    category: "Fundamentals",
    shortSummary: "The directional or bidirectional pathways that facilitate physical flow, resource transfer, or failure propagation.",
    formalDefinition: "An edge e = (u, v) is a connection between an origin node u and a target node v representing a structural dependency or flow channel.",
    formula: "e_uv = (u, v) ∈ E",
    formulaExplanation: "In directed systems, (u, v) signifies that node v depends directly on the output or operational stability of node u.",
    keyProperties: [
      "In directed graphs, e = (u, v) implies transmission from u to v.",
      "Can carry continuous weights W_uv representing flow capacity or coupling strength.",
      "Failure of an edge severs dependency pathways and reroutes flows."
    ],
    urbanExample: "High-voltage transmission lines connecting a power plant to a water pump station.",
    generalExample: "A hyperlinked URL between web pages or a peer-to-peer advisory interaction between researchers."
  },
  {
    id: "adjacency-matrix",
    term: "Adjacency Matrix",
    symbol: "A ∈ R^(N × N)",
    category: "Graph Structures",
    shortSummary: "The algebraic matrix representation encoding all pairwise connectivity across the network.",
    formalDefinition: "A square matrix A where entry A_uv = 1 (or weight W_uv) if an edge exists from node u to node v, and 0 otherwise.",
    formula: "A_uv = 1 if (u, v) ∈ E else 0",
    formulaExplanation: "For undirected graphs, A is symmetric (A = A^T); for directed dependency graphs, A is generally asymmetric.",
    keyProperties: [
      "Powers of the matrix A^k quantify the exact number of walks of length k between nodes.",
      "Spectral properties (eigenvalues and eigenvectors) dictate diffusion rates and synchronization dynamics.",
      "Enables high-speed vectorized matrix multiplication for multi-wave shock simulations."
    ],
    urbanExample: "The complete routing table mapping all physical pipeline and power dependencies across city districts.",
    generalExample: "A user-interaction matrix recording direct messaging pairs across an online community."
  },
  {
    id: "paths-geodesics",
    term: "Path & Geodesic Distance",
    symbol: "d(u, v)",
    category: "Graph Structures",
    shortSummary: "The shortest sequence of non-repeating edges connecting an origin node to a destination node.",
    formalDefinition: "A path is a sequence of distinct adjacent vertices. The geodesic distance d(u, v) is the minimum number of edges (or minimum sum of weights) required to traverse from u to v.",
    formula: "d(u, v) = min_{P_uv} ∑ w(e)",
    formulaExplanation: "If no path connects u to v, the distance is defined as d(u, v) = ∞.",
    keyProperties: [
      "Determines latency, transport efficiency, and communication speed.",
      "The maximum geodesic distance across all reachable pairs is the graph Diameter D.",
      "Crucial for calculating Closeness Centrality and Betweenness Centrality."
    ],
    urbanExample: "The shortest emergency vehicle route from a central fire station to an outlying residential zone.",
    generalExample: "The degrees of separation between two professionals on a career networking platform."
  },
  {
    id: "subgraphs-components",
    term: "Connected Components & Subgraphs",
    symbol: "G' = (V', E') ⊆ G",
    category: "Graph Structures",
    shortSummary: "Subsets of nodes and edges that remain mutually reachable through continuous paths.",
    formalDefinition: "A connected component is a maximal subgraph in which any two vertices are connected to each other by paths.",
    formula: "∀ u, v ∈ V', ∃ path P_uv ⊆ G'",
    formulaExplanation: "In directed graphs, we differentiate Strongly Connected Components (bidirectional reachability) and Weakly Connected Components.",
    keyProperties: [
      "Severe cascading shocks can fracture a single connected network into isolated components.",
      "The Giant Component size measures overall structural integrity under targeted attacks.",
      "Percolation threshold defines the critical fraction of removed nodes that causes total network breakdown."
    ],
    urbanExample: "A city power grid fracturing into isolated regional power islands (islanding) during an extreme storm.",
    generalExample: "Isolated project working groups within a distributed remote company."
  },
  {
    id: "degree-concept",
    term: "Node Degree",
    symbol: "k_v = deg(v)",
    category: "Node Metrics",
    shortSummary: "The total number of direct incident connections attached to a given node.",
    formalDefinition: "In undirected graphs, the degree k_v is the count of edges incident to node v. In directed graphs, it splits into In-Degree (incoming) and Out-Degree (outgoing).",
    formula: "k_v = ∑_{u} A_uv + ∑_{w} A_vw",
    formulaExplanation: "Total degree equals the sum of in-degree and out-degree in directed dependency graphs.",
    keyProperties: [
      "Simplest and most intuitive local measure of connectivity.",
      "Nodes with exceptionally high degree are referred to as Network Hubs.",
      "Degree distribution P(k) characterizes whether a network is scale-free (power-law) or random."
    ],
    urbanExample: "A major multimodal transit interchange connecting subways, commuter rail, and bus lines.",
    generalExample: "A key team lead who communicates directly with both client stakeholders and internal developers."
  },
  {
    id: "cascade-mechanics",
    term: "Cascading Failure & Thresholds",
    symbol: "θ_v, ΔS_v",
    category: "Dynamics & Resilience",
    shortSummary: "The mechanism where localized disruptions propagate step-by-step through network dependencies.",
    formalDefinition: "A dynamic process where a node fails if the accumulated shock from upstream neighbors exceeds its internal failure threshold θ_v, in turn propagating new shocks downstream.",
    formula: "Node v fails if ∑_{u ∈ In(v)} ΔS_u · A_uv > θ_v",
    formulaExplanation: "Upstream shocks ΔS_u transmit along dependency edges, accumulating at node v and potentially overcoming its structural threshold θ_v.",
    keyProperties: [
      "Non-linear avalanche dynamics: small initial perturbations can trigger widespread systemic collapse.",
      "Dampening factors γ and passive recovery r_v act as stabilizers to halt cascade progression.",
      "Critical infrastructure networks exhibit high vulnerability to targeted hub attacks."
    ],
    urbanExample: "A blackout at an electric substation causing water pumps to shut down, which subsequently disables industrial cooling systems.",
    generalExample: "Supply chain disruptions where a shortage of microchips delays automobile manufacturing and delivery logistics."
  }
];

interface SimulationSlide {
  id: string;
  num: string;
  tab: string;
  title: string;
  eyebrow: string;
  slug: string;
}

const SIMULATION_SLIDES: SimulationSlide[] = [
  { id: "title", num: "00", tab: "Intro", title: "Walkthrough Intro", eyebrow: "Overview", slug: "intro" },
  { id: "stability", num: "01", tab: "Stability", title: "Node Stability — the health score", eyebrow: "Concept", slug: "stability" },
  { id: "shock", num: "02", tab: "Shock", title: "Shock — the initial hit", eyebrow: "Concept", slug: "shock" },
  { id: "waves", num: "03", tab: "Waves (T)", title: "Simulation Waves — the clock, in steps (T)", eyebrow: "Concept", slug: "waves" },
  { id: "intensity", num: "04", tab: "Shock Intensity", title: "Shock Intensity (δ_v)", eyebrow: "Parameter", slug: "intensity" },
  { id: "threshold", num: "05", tab: "Threshold (θ)", title: "Failure Threshold (θ) — a stability-first view", eyebrow: "Parameter", slug: "threshold" },
  { id: "centrality", num: "06", tab: "Dampening (γ)", title: "Centrality Dampening (γ)", eyebrow: "Parameter", slug: "centrality" },
  { id: "recovery", num: "07", tab: "Recovery (r_v)", title: "Passive Recovery (r_v)", eyebrow: "Parameter", slug: "recovery" },
  { id: "tolerance", num: "08", tab: "Tolerance (ε)", title: "Tolerance (ε) — when to stop", eyebrow: "Parameter", slug: "tolerance" },
  { id: "intervention", num: "09", tab: "Intervention & Boost", title: "Interventions & the Boost (+i_v)", eyebrow: "Concept + Parameter", slug: "intervention" }
];

interface VideoLesson {
  id: string;
  title: string;
  src: string;
  category: string;
  duration: string;
  synopsis: string;
  takeaways: string[];
  formula: string;
  tags: string[];
}

const POSTED_VIDEOS: VideoLesson[] = [
  {
    id: "indegree-video",
    title: "In-Degree Centrality",
    src: "/indegree.mp4",
    category: "Centrality Metrics",
    duration: "Lesson 01",
    synopsis: "Explores how In-Degree Centrality quantifies incoming structural dependencies, prestige, and vulnerability pathways in directed network systems.",
    takeaways: [
      "Counts the total number of incoming edges pointing into a specific node: C_D,in(v) = ∑ A_uv.",
      "Identifies convergence points that depend on multiple upstream providers or services.",
      "Reveals high-vulnerability targets susceptible to upstream cascading disruptions."
    ],
    formula: "C_D,in(v) = ∑ A_uv",
    tags: ["In-Degree", "Vulnerability", "Dependencies"]
  },
  {
    id: "outdegree-video",
    title: "Out-Degree Centrality",
    src: "/outdegree.mp4",
    category: "Centrality Metrics",
    duration: "Lesson 02",
    synopsis: "Examines Out-Degree Centrality as a measure of outgoing influence, resource distribution power, and potential shock propagation radius.",
    takeaways: [
      "Counts the total number of outgoing edges leaving a node: C_D,out(v) = ∑ A_vu.",
      "Identifies primary initiators and key resource distributors across the network.",
      "Highlights critical nodes whose failure directly transmits widespread downstream shocks."
    ],
    formula: "C_D,out(v) = ∑ A_vu",
    tags: ["Out-Degree", "Propagation", "Influence"]
  },
  {
    id: "betweenness-video",
    title: "Betweenness Centrality",
    src: "/betweenness.mp4",
    category: "Path & Structural Centrality",
    duration: "Lesson 03",
    synopsis: "Analyzes how Betweenness Centrality identifies bridge nodes, structural bottlenecks, and critical pathways connecting disparate network clusters.",
    takeaways: [
      "Measures the fraction of all shortest paths between node pairs that pass through node v.",
      "Pinpoints crucial topological bridges whose removal fragments the graph into disconnected components.",
      "Quantifies control over informational and physical flow across systemic boundaries."
    ],
    formula: "C_B(v) = ∑ (σ_st(v) / σ_st)",
    tags: ["Betweenness", "Bottlenecks", "Shortest Paths"]
  }
];

interface LearnPageProps {
  isAdmin?: boolean;
}

export default function LearnPage({ isAdmin = false }: LearnPageProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("general");
  const [visibility, setVisibility] = useState<LearnVisibilityConfig>(dataService.getLearnVisibility());

  useEffect(() => {
    const unsub = dataService.subscribeLearnVisibility((vis) => {
      setVisibility(vis);
    });
    return () => unsub();
  }, []);

  // Guarantee non-admin users switch if their active tab is hidden
  useEffect(() => {
    if (!isAdmin) {
      if (!visibility[activeMainTab]) {
        const tabOrder: MainTab[] = ["general", "network_concepts", "simulation_concepts", "videos", "lab"];
        const nextVisible = tabOrder.find((t) => visibility[t]);
        if (nextVisible) {
          setActiveMainTab(nextVisible);
        }
      }
    }
  }, [visibility, isAdmin, activeMainTab]);
  
  // General Concepts State
  const [generalSearch, setGeneralSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expandedConceptIds, setExpandedConceptIds] = useState<string[]>(["graph-definition", "vertices-definition"]);

  // Network Concepts Sub-filter Dropdown
  const [networkConceptFilter, setNetworkConceptFilter] = useState<"all" | "degree" | "path" | "eigen" | "global">("all");

  // Video Section State
  const [selectedVideoId, setSelectedVideoId] = useState<string>("indegree-video");

  // Filtered general concepts
  const filteredConcepts = useMemo(() => {
    return GENERAL_DEFINITIONS.filter((item) => {
      const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
      const q = generalSearch.toLowerCase();
      const matchesSearch = 
        !q || 
        item.term.toLowerCase().includes(q) || 
        item.symbol.toLowerCase().includes(q) || 
        item.shortSummary.toLowerCase().includes(q) || 
        item.formalDefinition.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [generalSearch, selectedCategory]);

  const toggleConceptExpand = (id: string) => {
    setExpandedConceptIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const expandAllConcepts = () => {
    setExpandedConceptIds(filteredConcepts.map((c) => c.id));
  };

  const collapseAllConcepts = () => {
    setExpandedConceptIds([]);
  };

  const currentVideo = POSTED_VIDEOS.find((v) => v.id === selectedVideoId) || POSTED_VIDEOS[0];

  const tabMetadata: {
    id: MainTab;
    label: string;
    icon: any;
    colorActive: string;
    badge?: number;
    badgeClass?: string;
  }[] = [
    {
      id: "general",
      label: "General Concepts",
      icon: BookOpen,
      colorActive: "text-[#5C9EE8]"
    },
    {
      id: "network_concepts",
      label: "Network Concepts",
      icon: TrendingUp,
      colorActive: "text-[#5C9EE8]"
    },
    {
      id: "simulation_concepts",
      label: "Simulation Concepts",
      icon: Cpu,
      colorActive: "text-[#5C9EE8]",
      badge: SIMULATION_SLIDES.length,
      badgeClass: "bg-[#5C9EE8]/20 text-[#5C9EE8] border-[#5C9EE8]/40"
    },
    {
      id: "videos",
      label: "Video Tutorials",
      icon: PlayCircle,
      colorActive: "text-rose-400",
      badge: POSTED_VIDEOS.length,
      badgeClass: "bg-rose-900/50 text-rose-300 border-rose-700/50"
    },
    {
      id: "lab",
      label: "Practice Lab",
      icon: Network,
      colorActive: "text-[#3fb950]"
    }
  ];

  const visibleTabs = isAdmin 
    ? tabMetadata 
    : tabMetadata.filter((tab) => visibility[tab.id]);

  // Navigation Tabs Bar (aligned with Simulation Concepts pill design)
  const renderMainNavigation = () => {
    if (!isAdmin && visibleTabs.length === 0) {
      return null;
    }

    return (
      <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-2 flex items-center gap-1.5 overflow-x-auto shadow-sm mb-8 scrollbar-none" id="learn-navigation-tabs">
        {visibleTabs.map((tab, idx) => {
          const isActive = activeMainTab === tab.id;
          const isHiddenFromUsers = !visibility[tab.id];
          const IconComp = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-[#EDEBE6] text-[#25262B] font-bold shadow-xs"
                  : "text-[#A6A7AB] hover:text-[#EDEBE6] hover:bg-white/5"
              }`}
              id={`learn-nav-${tab.id}`}
            >
              <span className={`font-mono text-[10px] ${isActive ? "text-[#25262B]" : "opacity-70"}`}>
                0{idx + 1}
              </span>
              <IconComp size={14} className={isActive ? "text-[#25262B]" : ""} />
              <span>{tab.label}</span>
              
              {tab.badge !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                  isActive ? "bg-[#25262B]/15 text-[#25262B]" : "bg-[#1E1F23] text-[#A6A7AB] border border-[#42454E]"
                }`}>
                  {tab.badge}
                </span>
              )}

              {/* Admin visibility indicator badge */}
              {isAdmin && isHiddenFromUsers && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#F5C24C]/20 text-[#F5C24C] text-[9px] font-mono rounded-md font-bold border border-[#F5C24C]/40 flex items-center gap-0.5" title="Hidden from standard users">
                  <EyeOff size={9} />
                  <span>Hidden</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // 1. GENERAL CONCEPTS: Clickable list of expandable definitions (aligned with Simulation Concepts design)
  const renderGeneralConceptsTab = () => {
    const categories = ["All", "Fundamentals", "Graph Structures", "Node Metrics", "Dynamics & Resilience"];

    return (
      <div className="space-y-6 animate-in fade-in duration-300" id="general-concepts-accordion-view">
        {/* Top Control Bar with Search & Category Filters */}
        <div className="bg-[#2E3036] p-5 rounded-2xl border border-[#42454E] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6C8CFF] shadow-[0_0_8px_#6C8CFF] animate-pulse" />
              <span className="font-bold text-sm text-[#F1F3F5] tracking-tight">
                URSA Graph & Network Dictionary
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={expandAllConcepts}
                className="px-3 py-1.5 text-xs font-semibold text-[#EDEBE6] hover:text-white bg-[#1E1F23] hover:bg-[#383A42] rounded-xl transition-all border border-[#42454E] cursor-pointer"
              >
                Expand All
              </button>
              <button
                onClick={collapseAllConcepts}
                className="px-3 py-1.5 text-xs font-semibold text-[#EDEBE6] hover:text-white bg-[#1E1F23] hover:bg-[#383A42] rounded-xl transition-all border border-[#42454E] cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A7AB]" size={15} />
            <input
              type="text"
              placeholder="Search graph terms, mathematical formulas, symbols, keywords..."
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              className="w-full pl-9 pr-14 py-2.5 text-xs bg-[#25262B] border border-[#42454E] rounded-xl focus:border-[#6C8CFF] focus:outline-none transition-all text-[#EDEBE6] placeholder:text-[#A6A7AB]"
            />
            {generalSearch && (
              <button 
                onClick={() => setGeneralSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#A6A7AB] hover:text-[#EDEBE6] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#42454E]/70">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#A6A7AB] mr-1">
              Category:
            </span>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#EDEBE6] text-[#25262B] font-bold shadow-xs"
                      : "bg-[#25262B] text-[#A6A7AB] hover:text-[#EDEBE6] hover:bg-[#383A42] border border-[#42454E] font-medium"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* List of Definitions */}
        <div className="space-y-4" id="definitions-accordion-container">
          {filteredConcepts.length === 0 ? (
            <div className="bg-[#2E3036] rounded-2xl p-10 text-center border border-[#42454E] space-y-2">
              <Info className="mx-auto text-[#A6A7AB]" size={30} />
              <p className="text-sm font-bold text-[#F1F3F5]">No matching concepts found</p>
              <p className="text-xs text-[#A6A7AB]">Try adjusting your search terms or selecting a different category.</p>
            </div>
          ) : (
            filteredConcepts.map((item, idx) => {
              const isExpanded = expandedConceptIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`bg-[#2E3036] rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                    isExpanded ? "border-[#6C8CFF]/60 shadow-md" : "border-[#42454E] hover:border-[#565A66]"
                  }`}
                >
                  {/* Clickable Header Accordion Trigger */}
                  <button
                    onClick={() => toggleConceptExpand(item.id)}
                    className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-[#383A42]/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                        isExpanded 
                          ? "bg-[#6C8CFF]/20 text-[#6C8CFF] border-[#6C8CFF]/40" 
                          : "bg-[#25262B] text-[#A6A7AB] border-[#42454E]"
                      }`}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-2 py-0.5 rounded-md text-[10px] font-mono">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-xs font-bold text-[#6C8CFF] bg-[#25262B] px-2 py-0.5 rounded-md border border-[#42454E]">
                            <MathText>{item.symbol}</MathText>
                          </span>
                          <span className="text-[10px] font-mono text-[#A6A7AB] uppercase">
                            · {item.category}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-[#F1F3F5] tracking-tight">
                          {item.term}
                        </h3>
                        <p className="text-xs text-[#D0D3D7] line-clamp-1 leading-normal">
                          {item.shortSummary}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 text-xs font-mono font-semibold text-[#6C8CFF] bg-[#25262B] px-3 py-1.5 rounded-xl border border-[#42454E]">
                      <span className="hidden sm:inline">{isExpanded ? "Hide" : "Details"}</span>
                      <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {/* Expanded Content Body */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t border-[#42454E] space-y-4 bg-[#2E3036] animate-in fade-in duration-200">
                      {/* Formal Definition */}
                      <div className="space-y-1.5">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#6C8CFF]">
                          Formal Definition & Mathematical Concept
                        </div>
                        <p className="text-xs sm:text-sm text-[#D0D3D7] leading-relaxed font-sans bg-[#25262B] p-4 rounded-xl border border-[#42454E] m-0">
                          {item.formalDefinition}
                        </p>
                      </div>

                      {/* Formula Box if available */}
                      {item.formula && (
                        <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-4 font-mono text-xs space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-[#A6A7AB]">
                            <span className="font-bold tracking-wider uppercase text-[#6C8CFF]">Formula & Standard Notation</span>
                            <span className="text-[10px]">Mathematical Expression</span>
                          </div>
                          <div className="text-sm font-bold text-[#6C8CFF] bg-[#1E1F23] p-3 rounded-lg border border-[#42454E] tracking-wide">
                            <MathText>{item.formula}</MathText>
                          </div>
                          {item.formulaExplanation && (
                            <p className="text-[11px] text-[#A6A7AB] font-sans leading-relaxed m-0">
                              <MathText className="font-sans text-[11px]">{item.formulaExplanation}</MathText>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Key Properties & Characteristics (Callout Chips) */}
                      <div className="space-y-1.5">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#A6A7AB]">
                          Key Topological Properties
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                          {item.keyProperties.map((prop, pIdx) => (
                            <div key={pIdx} className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1">
                              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#4ED9A0] flex items-center gap-1.5">
                                <span>▲</span>
                                <span>Key Property</span>
                              </div>
                              <p className="text-xs text-[#D0D3D7] leading-relaxed m-0 font-sans">
                                {prop}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Real-World & Urban Examples (Analogy Box style) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="border-l-2 border-[#6C8CFF] bg-[#6C8CFF]/10 rounded-r-xl p-3.5 text-xs text-[#D6DAE2] leading-relaxed space-y-1">
                          <b className="text-[#6C8CFF] font-semibold flex items-center gap-1.5">
                            <Compass size={13} />
                            <span>Urban Infrastructure Application</span>
                          </b>
                          <p className="m-0 text-xs text-[#D0D3D7] leading-relaxed font-sans">
                            {item.urbanExample}
                          </p>
                        </div>

                        <div className="border-l-2 border-[#F5C24C] bg-[#F5C24C]/10 rounded-r-xl p-3.5 text-xs text-[#D6DAE2] leading-relaxed space-y-1">
                          <b className="text-[#F5C24C] font-semibold flex items-center gap-1.5">
                            <Share2 size={13} />
                            <span>Applied & Organizational Context</span>
                          </b>
                          <p className="m-0 text-xs text-[#D0D3D7] leading-relaxed font-sans">
                            {item.generalExample}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // 2. NETWORK CONCEPTS: Metrics & Topologies (aligned with Simulation Concepts 2-column card architecture)
  const renderNetworkConceptsTab = () => {
    return (
      <div className="space-y-8 animate-in fade-in duration-300" id="network-concepts-merged-view">
        {/* Top Control Bar with Glowing Indicator & Compact Pill Tabs */}
        <div className="bg-[#2E3036] p-4 rounded-2xl border border-[#42454E] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4ED9A0] shadow-[0_0_8px_#4ED9A0] animate-pulse shrink-0" />
            <span className="font-bold text-sm text-[#F1F3F5] tracking-tight truncate">
              URSA Network Centrality & Structural Metrics
            </span>
            <span className="text-xs text-[#A6A7AB] font-mono hidden xl:inline">
              • Topological formulations & metrics
            </span>
          </div>

          {/* Compact Filter Pills: guaranteed 100% visible on all viewports */}
          <div className="flex items-center gap-1 bg-[#1E1F23] p-1 rounded-xl border border-[#42454E] shrink-0 flex-wrap">
            {[
              { id: "all", label: "All", tip: "All Topological & Centrality Metrics" },
              { id: "degree", label: "Degree", tip: "In-Degree & Out-Degree Centrality" },
              { id: "path", label: "Paths", tip: "Betweenness & Closeness Centrality" },
              { id: "eigen", label: "Spectral", tip: "Eigenvector, PageRank, Katz & HITS Centrality" },
              { id: "global", label: "Topology", tip: "Global Macro Topology, Density & Clustering" },
            ].map((f) => {
              const isSelected = networkConceptFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setNetworkConceptFilter(f.id as any)}
                  title={f.tip}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#383A42] text-[#F1F3F5] shadow-xs"
                      : "text-[#A6A7AB] hover:text-[#F1F3F5]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* --- 1. IN-DEGREE CENTRALITY --- */}
        {(networkConceptFilter === "all" || networkConceptFilter === "degree") && (
          <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 sm:p-8 shadow-sm hover:border-[#565A66] transition-all space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#42454E] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#25262B] text-[#6C8CFF] rounded-xl border border-[#42454E]">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#A6A7AB]">
                    <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-2 py-0.5 rounded-md text-[10px]">01</span>
                    <span>Centrality Metric</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#F1F3F5] mt-0.5">
                    In-Degree Centrality — Incoming Structural Dependencies
                  </h3>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-3 py-1.5 bg-[#25262B] text-[#6C8CFF] rounded-xl border border-[#42454E] self-start sm:self-auto">
                <MathText>{"C_D,in(v) = ∑ A_uv"}</MathText>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4 text-left">
                <p className="text-sm text-[#D0D3D7] leading-relaxed">
                  In a directed network graph, the <strong>in-degree</strong> of node v counts the total number of incoming edges pointing into it. In infrastructural and systemic modeling, high in-degree signifies that an asset relies on multiple upstream suppliers or feeder nodes to maintain continuous operation.
                </p>

                {/* Formula Box */}
                <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-4 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#A6A7AB]">
                    <span className="font-bold tracking-wider uppercase text-[#6C8CFF]">Mathematical Formula</span>
                    <span className="text-[10px]">Standard Formulation</span>
                  </div>
                  <div className="text-sm text-[#6C8CFF] font-bold bg-[#1E1F23] p-3 rounded-lg border border-[#42454E] tracking-wide">
                    <MathText>{"C_D,in(v) = deg_in(v) = ∑_u A_uv"}</MathText>
                  </div>
                  <p className="text-[11px] text-[#A6A7AB] font-sans leading-relaxed m-0">
                    Where A_uv is the adjacency matrix entry representing a direct connection from node u into node v.
                  </p>
                </div>

                {/* Callout Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#4ED9A0] flex items-center gap-1.5">
                      <span>▼</span>
                      <span>Low In-Degree</span>
                    </div>
                    <p className="text-xs text-[#D0D3D7] leading-relaxed m-0">
                      Independent or source asset — operates autonomously without heavy reliance on upstream infrastructure feeds.
                    </p>
                  </div>
                  <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#F2643C] flex items-center gap-1.5">
                      <span>▲</span>
                      <span>High In-Degree</span>
                    </div>
                    <p className="text-xs text-[#D0D3D7] leading-relaxed m-0">
                      Convergence bottleneck — disruption in any single feeder can propagate cascading stress into the node.
                    </p>
                  </div>
                </div>

                {/* Analogy Box */}
                <div className="border-l-2 border-[#6C8CFF] bg-[#6C8CFF]/10 rounded-r-xl p-3.5 text-xs text-[#D6DAE2] leading-relaxed space-y-1">
                  <b className="text-[#6C8CFF] font-semibold flex items-center gap-1.5">
                    <Compass size={13} />
                    <span>Urban Infrastructure Application:</span>
                  </b>
                  <p className="m-0 text-xs text-[#D0D3D7] leading-relaxed">
                    An acute care hospital or emergency trauma center relies simultaneously on the municipal power grid, potable water pumping, telecommunications backbones, and road access. Its high in-degree indicates multiple dependency pathways where an upstream outage in any feeder compromises the facility.
                  </p>
                </div>
              </div>

              {/* Visual Diagram Frame */}
              <div className="lg:col-span-5 w-full">
                <div className="w-full h-[280px] sm:h-[320px] bg-[#25262B] border border-[#42454E] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#6C8CFF]">
                    <span className="w-2 h-2 rounded-full bg-[#6C8CFF] animate-pulse"></span>
                    <MathText>{"k_in = 4 (Convergence)"}</MathText>
                  </div>

                  <svg viewBox="0 0 320 220" className="w-full max-w-[260px] h-auto">
                    <defs>
                      <marker id="in-arrow-blue" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#6C8CFF" />
                      </marker>
                      <filter id="glow-target" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>

                    {/* Dependency lines with directional arrows */}
                    <line x1="50" y1="45" x2="160" y2="110" stroke="#6C8CFF" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#in-arrow-blue)" />
                    <line x1="50" y1="175" x2="160" y2="110" stroke="#6C8CFF" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#in-arrow-blue)" />
                    <line x1="270" y1="45" x2="160" y2="110" stroke="#6C8CFF" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#in-arrow-blue)" />
                    <line x1="270" y1="175" x2="160" y2="110" stroke="#6C8CFF" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#in-arrow-blue)" />

                    {/* Animated flow particle dots */}
                    <circle r="3.5" fill="#4ED9A0">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path="M50,45 L160,110" />
                    </circle>
                    <circle r="3.5" fill="#4ED9A0">
                      <animateMotion dur="2.2s" begin="0.5s" repeatCount="indefinite" path="M50,175 L160,110" />
                    </circle>
                    <circle r="3.5" fill="#4ED9A0">
                      <animateMotion dur="2.2s" begin="1.0s" repeatCount="indefinite" path="M270,45 L160,110" />
                    </circle>
                    <circle r="3.5" fill="#4ED9A0">
                      <animateMotion dur="2.2s" begin="1.5s" repeatCount="indefinite" path="M270,175 L160,110" />
                    </circle>

                    {/* Feeder Nodes */}
                    <g transform="translate(50, 45)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Power</text>
                    </g>
                    <g transform="translate(50, 175)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Water</text>
                    </g>
                    <g transform="translate(270, 45)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Telecom</text>
                    </g>
                    <g transform="translate(270, 175)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Transit</text>
                    </g>

                    {/* Center Target Node */}
                    <g transform="translate(160, 110)">
                      <circle r="24" fill="#2E3036" stroke="#6C8CFF" strokeWidth="3" filter="url(#glow-target)">
                        <animate attributeName="r" values="23;26;23" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fontWeight="700" fill="#6C8CFF">Hospital</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 2. OUT-DEGREE CENTRALITY --- */}
        {(networkConceptFilter === "all" || networkConceptFilter === "degree") && (
          <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 sm:p-8 shadow-sm hover:border-[#565A66] transition-all space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#42454E] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#25262B] text-[#F2643C] rounded-xl border border-[#42454E]">
                  <Share2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#A6A7AB]">
                    <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-2 py-0.5 rounded-md text-[10px]">02</span>
                    <span>Centrality Metric</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#F1F3F5] mt-0.5">
                    Out-Degree Centrality — Reach, Influence & Blast Radius
                  </h3>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-3 py-1.5 bg-[#25262B] text-[#F2643C] rounded-xl border border-[#42454E] self-start sm:self-auto">
                <MathText>{"C_D,out(v) = ∑ A_vu"}</MathText>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4 text-left">
                <p className="text-sm text-[#D0D3D7] leading-relaxed">
                  The <strong>out-degree</strong> of node v counts the total number of outgoing edges leaving it and directing influence into other nodes. In failure propagation models, nodes with elevated out-degree represent primary shock transmitters that can initiate severe cascading damage across downstream clusters.
                </p>

                {/* Formula Box */}
                <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-4 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#A6A7AB]">
                    <span className="font-bold tracking-wider uppercase text-[#F2643C]">Mathematical Formula</span>
                    <span className="text-[10px]">Standard Formulation</span>
                  </div>
                  <div className="text-sm text-[#F2643C] font-bold bg-[#1E1F23] p-3 rounded-lg border border-[#42454E] tracking-wide">
                    <MathText>{"C_D,out(v) = deg_out(v) = ∑_u A_vu"}</MathText>
                  </div>
                  <p className="text-[11px] text-[#A6A7AB] font-sans leading-relaxed m-0">
                    Where A_vu is the matrix entry for edges originating at node v and transmitting directly into node u.
                  </p>
                </div>

                {/* Callout Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#4ED9A0] flex items-center gap-1.5">
                      <span>▼</span>
                      <span>Low Out-Degree</span>
                    </div>
                    <p className="text-xs text-[#D0D3D7] leading-relaxed m-0">
                      Terminal consumer — local shocks remain contained within the node without downstream propagation.
                    </p>
                  </div>
                  <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#F2643C] flex items-center gap-1.5">
                      <span>▲</span>
                      <span>High Out-Degree</span>
                    </div>
                    <p className="text-xs text-[#D0D3D7] leading-relaxed m-0">
                      Primary shock distributor — outage transmits immediate cascading failures to all downstream facilities.
                    </p>
                  </div>
                </div>

                {/* Analogy Box */}
                <div className="border-l-2 border-[#F2643C] bg-[#F2643C]/10 rounded-r-xl p-3.5 text-xs text-[#D6DAE2] leading-relaxed space-y-1">
                  <b className="text-[#F2643C] font-semibold flex items-center gap-1.5">
                    <Compass size={13} />
                    <span>Urban Infrastructure Application:</span>
                  </b>
                  <p className="m-0 text-xs text-[#D0D3D7] leading-relaxed">
                    A primary electric power generating substation or central water distribution hub provides essential service to dozens of municipal facilities. A sudden shock or outage at this node immediately broadcasts failure shocks to all connected downstream consumers.
                  </p>
                </div>
              </div>

              {/* Visual Diagram Frame */}
              <div className="lg:col-span-5 w-full">
                <div className="w-full h-[280px] sm:h-[320px] bg-[#25262B] border border-[#42454E] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#F2643C]">
                    <span className="w-2 h-2 rounded-full bg-[#F2643C] animate-pulse"></span>
                    <MathText>{"k_out = 4 (Blast Radius)"}</MathText>
                  </div>

                  <svg viewBox="0 0 320 220" className="w-full max-w-[260px] h-auto">
                    <defs>
                      <marker id="out-arrow-orange" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#F2643C" />
                      </marker>
                      <filter id="glow-source" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>

                    {/* Outgoing lines with directional arrows */}
                    <line x1="160" y1="110" x2="50" y2="45" stroke="#F2643C" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#out-arrow-orange)" />
                    <line x1="160" y1="110" x2="50" y2="175" stroke="#F2643C" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#out-arrow-orange)" />
                    <line x1="160" y1="110" x2="270" y2="45" stroke="#F2643C" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#out-arrow-orange)" />
                    <line x1="160" y1="110" x2="270" y2="175" stroke="#F2643C" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#out-arrow-orange)" />

                    {/* Animated outward particle dots */}
                    <circle r="3.5" fill="#F2643C">
                      <animateMotion dur="2s" repeatCount="indefinite" path="M160,110 L50,45" />
                    </circle>
                    <circle r="3.5" fill="#F2643C">
                      <animateMotion dur="2s" begin="0.5s" repeatCount="indefinite" path="M160,110 L50,175" />
                    </circle>
                    <circle r="3.5" fill="#F2643C">
                      <animateMotion dur="2s" begin="1.0s" repeatCount="indefinite" path="M160,110 L270,45" />
                    </circle>
                    <circle r="3.5" fill="#F2643C">
                      <animateMotion dur="2s" begin="1.5s" repeatCount="indefinite" path="M160,110 L270,175" />
                    </circle>

                    {/* Center Outgoing Source Node */}
                    <g transform="translate(160, 110)">
                      <circle r="24" fill="#2E3036" stroke="#F2643C" strokeWidth="3" filter="url(#glow-source)">
                        <animate attributeName="r" values="23;26;23" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="10" fontWeight="700" fill="#F2643C">Power</text>
                    </g>

                    {/* Downstream Consumer Nodes */}
                    <g transform="translate(50, 45)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Water</text>
                    </g>
                    <g transform="translate(50, 175)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Subway</text>
                    </g>
                    <g transform="translate(270, 45)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Telecom</text>
                    </g>
                    <g transform="translate(270, 175)">
                      <circle r="15" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fontWeight="700" fill="#A6A7AB">Hospital</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 3. BETWEENNESS CENTRALITY --- */}
        {(networkConceptFilter === "all" || networkConceptFilter === "path") && (
          <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 sm:p-8 shadow-sm hover:border-[#565A66] transition-all space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#42454E] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#25262B] text-[#F5C24C] rounded-xl border border-[#42454E]">
                  <Compass size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#A6A7AB]">
                    <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-2 py-0.5 rounded-md text-[10px]">03</span>
                    <span>Centrality Metric</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#F1F3F5] mt-0.5">
                    Betweenness Centrality — Critical Bridge Bottlenecks
                  </h3>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-3 py-1.5 bg-[#25262B] text-[#F5C24C] rounded-xl border border-[#42454E] self-start sm:self-auto">
                <MathText>{"C_B(v) = ∑ (σ_st(v) / σ_st)"}</MathText>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4 text-left">
                <p className="text-sm text-[#D0D3D7] leading-relaxed">
                  <strong>Betweenness centrality</strong> measures how often a node sits along the shortest geodesic path between all other pairs of nodes in the network. A node with high betweenness exerts immense control over flows, information, and resource routing.
                </p>

                {/* Formula Box */}
                <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-4 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#A6A7AB]">
                    <span className="font-bold tracking-wider uppercase text-[#F5C24C]">Mathematical Formula</span>
                    <span className="text-[10px]">Shortest Path Geodesics</span>
                  </div>
                  <div className="text-sm text-[#F5C24C] font-bold bg-[#1E1F23] p-3 rounded-lg border border-[#42454E] tracking-wide">
                    <MathText>{"C_B(v) = ∑_{s ≠ v ≠ t} [ σ_st(v) / σ_st ]"}</MathText>
                  </div>
                  <p className="text-[11px] text-[#A6A7AB] font-sans leading-relaxed m-0">
                    Where σ_st is the total number of shortest paths from node s to node t, and σ_st(v) is the count of those paths passing through node v.
                  </p>
                </div>

                {/* Callout Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#4ED9A0] flex items-center gap-1.5">
                      <span>▼</span>
                      <span>Low Betweenness</span>
                    </div>
                    <p className="text-xs text-[#D0D3D7] leading-relaxed m-0">
                      Peripheral node — abundant alternative bypass paths exist if this node fails.
                    </p>
                  </div>
                  <div className="bg-[#25262B] border border-[#42454E] rounded-xl p-3.5 space-y-1">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#F5C24C] flex items-center gap-1.5">
                      <span>▲</span>
                      <span>High Betweenness</span>
                    </div>
                    <p className="text-xs text-[#D0D3D7] leading-relaxed m-0">
                      Critical bridge bottleneck — failure fragments the network into isolated, disconnected components.
                    </p>
                  </div>
                </div>

                {/* Analogy Box */}
                <div className="border-l-2 border-[#F5C24C] bg-[#F5C24C]/10 rounded-r-xl p-3.5 text-xs text-[#D6DAE2] leading-relaxed space-y-1">
                  <b className="text-[#F5C24C] font-semibold flex items-center gap-1.5">
                    <Compass size={13} />
                    <span>Urban Infrastructure Application:</span>
                  </b>
                  <p className="m-0 text-xs text-[#D0D3D7] leading-relaxed">
                    A suspension bridge or central fiber-optic routing exchange might have a moderate degree count, but because it is the sole connector between two urban islands, disabling it cuts off all inter-regional communication and logistics.
                  </p>
                </div>
              </div>

              {/* Visual Diagram Frame */}
              <div className="lg:col-span-5 w-full">
                <div className="w-full h-[280px] sm:h-[320px] bg-[#25262B] border border-[#42454E] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#F5C24C]">
                    <span className="w-2 h-2 rounded-full bg-[#F5C24C] animate-pulse"></span>
                    <MathText>{"C_B = 0.88 (Bridge Bottleneck)"}</MathText>
                  </div>

                  <svg viewBox="0 0 340 200" className="w-full max-w-[280px] h-auto">
                    <defs>
                      <filter id="glow-bridge" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="3.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>

                    {/* Cluster A internal edges */}
                    <line x1="45" y1="55" x2="105" y2="70" stroke="#42454E" strokeWidth="1.5" />
                    <line x1="45" y1="145" x2="105" y2="130" stroke="#42454E" strokeWidth="1.5" />
                    <line x1="45" y1="55" x2="45" y2="145" stroke="#42454E" strokeWidth="1.5" />
                    <line x1="105" y1="70" x2="105" y2="130" stroke="#42454E" strokeWidth="1.5" />

                    {/* Bridge Edges */}
                    <line x1="105" y1="70" x2="170" y2="100" stroke="#F5C24C" strokeWidth="2.5" />
                    <line x1="105" y1="130" x2="170" y2="100" stroke="#F5C24C" strokeWidth="2.5" />
                    <line x1="170" y1="100" x2="235" y2="70" stroke="#F5C24C" strokeWidth="2.5" />
                    <line x1="170" y1="100" x2="235" y2="130" stroke="#F5C24C" strokeWidth="2.5" />

                    {/* Cluster B internal edges */}
                    <line x1="235" y1="70" x2="295" y2="55" stroke="#42454E" strokeWidth="1.5" />
                    <line x1="235" y1="130" x2="295" y2="145" stroke="#42454E" strokeWidth="1.5" />
                    <line x1="295" y1="55" x2="295" y2="145" stroke="#42454E" strokeWidth="1.5" />
                    <line x1="235" y1="70" x2="235" y2="130" stroke="#42454E" strokeWidth="1.5" />

                    {/* Animated particles traversing through bridge */}
                    <circle r="4" fill="#F5C24C">
                      <animateMotion dur="2.8s" repeatCount="indefinite" path="M45,55 L105,70 L170,100 L235,130 L295,145" />
                    </circle>
                    <circle r="4" fill="#F5C24C">
                      <animateMotion dur="2.8s" begin="1.4s" repeatCount="indefinite" path="M295,55 L235,70 L170,100 L105,130 L45,145" />
                    </circle>

                    {/* Cluster A nodes */}
                    <circle cx="45" cy="55" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                    <circle cx="45" cy="145" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                    <circle cx="105" cy="70" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                    <circle cx="105" cy="130" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />

                    {/* Cluster B nodes */}
                    <circle cx="235" cy="70" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                    <circle cx="235" cy="130" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                    <circle cx="295" cy="55" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />
                    <circle cx="295" cy="145" r="11" fill="#2E3036" stroke="#42454E" strokeWidth="2" />

                    {/* Central Bridge Node */}
                    <g transform="translate(170, 100)">
                      <circle r="22" fill="#2E3036" stroke="#F5C24C" strokeWidth="3" filter="url(#glow-bridge)">
                        <animate attributeName="r" values="21;24;21" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <text y="4" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9.5" fontWeight="700" fill="#F5C24C">Bridge</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 4. CLOSENESS & EIGENVECTOR CENTRALITY --- */}
        {(networkConceptFilter === "all" || networkConceptFilter === "path" || networkConceptFilter === "eigen") && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Closeness Centrality */}
            <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 sm:p-7 shadow-sm hover:border-[#565A66] transition-all space-y-4">
              <div className="flex items-center justify-between border-b border-[#42454E] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#25262B] text-[#4ED9A0] rounded-xl border border-[#42454E]">
                    <Radio size={18} />
                  </div>
                  <div>
                    <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-1.5 py-0.2 rounded-sm text-[9px] font-mono uppercase">
                      04
                    </span>
                    <h4 className="text-base font-bold text-[#F1F3F5] mt-0.5">Closeness Centrality</h4>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-1 bg-[#25262B] text-[#4ED9A0] rounded-lg border border-[#42454E]">
                  <MathText>{"C_C = 1 / ∑ d(v,u)"}</MathText>
                </span>
              </div>

              <p className="text-xs text-[#D0D3D7] leading-relaxed">
                Calculates the inverse sum of the shortest distances from a node to all other reachable nodes. High closeness indicates that a node can broadcast resources or reach any node in the system with minimum travel latency.
              </p>

              <div className="bg-[#25262B] border border-[#42454E] p-3 rounded-xl font-mono text-xs space-y-1">
                <span className="text-[10px] text-[#4ED9A0] font-bold uppercase tracking-wider">Formulation:</span>
                <div className="text-xs text-[#F1F3F5]"><MathText>{"C_C(v) = (N - 1) / ∑_{u ≠ v} d(v, u)"}</MathText></div>
              </div>

              <div className="border-l-2 border-[#4ED9A0] bg-[#4ED9A0]/10 rounded-r-xl p-3 text-xs text-[#D6DAE2]">
                <b className="text-[#4ED9A0] font-semibold">Application:</b> Optimal placement of rapid-response emergency depots, ensuring ambulances achieve minimum arrival times across all city districts.
              </div>
            </div>

            {/* Eigenvector Centrality */}
            <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 sm:p-7 shadow-sm hover:border-[#565A66] transition-all space-y-4">
              <div className="flex items-center justify-between border-b border-[#42454E] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#25262B] text-[#6C8CFF] rounded-xl border border-[#42454E]">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-1.5 py-0.2 rounded-sm text-[9px] font-mono uppercase">
                      05
                    </span>
                    <h4 className="text-base font-bold text-[#F1F3F5] mt-0.5">Eigenvector Centrality</h4>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-1 bg-[#25262B] text-[#6C8CFF] rounded-lg border border-[#42454E]">
                  <MathText>{"λ x = A x"}</MathText>
                </span>
              </div>

              <p className="text-xs text-[#D0D3D7] leading-relaxed">
                Measures a node\'s systemic importance based on the principle that connections to high-scoring nodes contribute more to the score of the node in question than equal connections to low-scoring nodes.
              </p>

              <div className="bg-[#25262B] border border-[#42454E] p-3 rounded-xl font-mono text-xs space-y-1">
                <span className="text-[10px] text-[#6C8CFF] font-bold uppercase tracking-wider">Formulation:</span>
                <div className="text-xs text-[#F1F3F5]"><MathText>{"λ x_v = ∑_{u ∈ M(v)} A_uv x_u"}</MathText></div>
              </div>

              <div className="border-l-2 border-[#6C8CFF] bg-[#6C8CFF]/10 rounded-r-xl p-3 text-xs text-[#D6DAE2]">
                <b className="text-[#6C8CFF] font-semibold">Application:</b> Assessing financial institution systemic risk or power grid stability where being connected to a critical hub magnifies vulnerability.
              </div>
            </div>
          </div>
        )}

        {/* --- 5. SPECTRAL & RANKING ALGORITHMS (PageRank, Katz, HITS) --- */}
        {(networkConceptFilter === "all" || networkConceptFilter === "eigen") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* PageRank */}
            <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-5 shadow-sm hover:border-[#565A66] transition-all space-y-3">
              <div className="flex items-center gap-2 text-[#F1F3F5] font-bold text-sm">
                <div className="p-1.5 bg-[#25262B] text-[#6C8CFF] rounded-lg border border-[#42454E]">
                  <GitBranch size={16} />
                </div>
                <span>PageRank Algorithm</span>
              </div>
              <p className="text-xs text-[#D0D3D7] leading-relaxed">
                Incorporates a damping factor d ≈ 0.85 modeling random walk traversals with spontaneous teleportation across directed networks.
              </p>
              <div className="bg-[#25262B] text-[#6C8CFF] font-mono text-[11px] p-2.5 rounded-xl border border-[#42454E]">
                <MathText>{"PR(u) = (1 - d) / N + d ∑ (PR(v) / L(v))"}</MathText>
              </div>
              <span className="text-[11px] text-[#A6A7AB] block">
                <strong className="text-[#F1F3F5]">Use Case:</strong> Web search ranking and drainage flow accumulation across municipal basins.
              </span>
            </div>

            {/* Katz Centrality */}
            <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-5 shadow-sm hover:border-[#565A66] transition-all space-y-3">
              <div className="flex items-center gap-2 text-[#F1F3F5] font-bold text-sm">
                <div className="p-1.5 bg-[#25262B] text-[#4ED9A0] rounded-lg border border-[#42454E]">
                  <BarChart3 size={16} />
                </div>
                <span>Katz Centrality</span>
              </div>
              <p className="text-xs text-[#D0D3D7] leading-relaxed">
                Calculates total walks of all lengths, penalizing distant connections via an attenuation factor α &lt; 1/λ_max.
              </p>
              <div className="bg-[#25262B] text-[#4ED9A0] font-mono text-[11px] p-2.5 rounded-xl border border-[#42454E]">
                <MathText>{"x = (I - α A^T)^(-1) · β"}</MathText>
              </div>
              <span className="text-[11px] text-[#A6A7AB] block">
                <strong className="text-[#F1F3F5]">Use Case:</strong> Long-range disease transmission models and inter-regional freight propagation.
              </span>
            </div>

            {/* HITS Hubs & Authorities */}
            <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-5 shadow-sm hover:border-[#565A66] transition-all space-y-3">
              <div className="flex items-center gap-2 text-[#F1F3F5] font-bold text-sm">
                <div className="p-1.5 bg-[#25262B] text-[#F5C24C] rounded-lg border border-[#42454E]">
                  <Layers size={16} />
                </div>
                <span>HITS Hubs & Authorities</span>
              </div>
              <p className="text-xs text-[#D0D3D7] leading-relaxed">
                Separates nodes into authoritative resource sinks and hub nodes that point to many authoritative providers.
              </p>
              <div className="bg-[#25262B] text-[#F5C24C] font-mono text-[11px] p-2.5 rounded-xl border border-[#42454E]">
                <MathText>{"a(v) = ∑ h(u),  h(u) = ∑ a(v)"}</MathText>
              </div>
              <span className="text-[11px] text-[#A6A7AB] block">
                <strong className="text-[#F1F3F5]">Use Case:</strong> Supply chain logistics separating distributors (hubs) from producers (authorities).
              </span>
            </div>
          </div>
        )}

        {/* --- 6. GLOBAL TOPOLOGY & CLUSTERING --- */}
        {(networkConceptFilter === "all" || networkConceptFilter === "global") && (
          <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 sm:p-8 shadow-sm hover:border-[#565A66] transition-all space-y-5">
            <div className="flex items-center gap-3 border-b border-[#42454E] pb-4">
              <div className="p-2.5 bg-[#25262B] text-[#6C8CFF] rounded-xl border border-[#42454E]">
                <Layers size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#A6A7AB]">
                  <span className="bg-[#4ED9A0] text-[#25262B] font-bold px-2 py-0.5 rounded-md text-[10px]">06</span>
                  <span>Macro Topology</span>
                </div>
                <h4 className="text-xl font-bold text-[#F1F3F5] mt-0.5">
                  Global Macro Topology, Density & Clustering
                </h4>
              </div>
            </div>

            <p className="text-sm text-[#D0D3D7] leading-relaxed">
              Global topological metrics evaluate network-wide density, clustering cohesion, and diameter to quantify baseline structural redundancy and resilience against systemic shock.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs pt-1">
              <div className="bg-[#25262B] p-4 rounded-xl border border-[#42454E] space-y-1">
                <span className="text-[#6C8CFF] font-bold block">Network Density (D):</span>
                <div className="text-[#F1F3F5] text-sm"><MathText>{"D = 2|E| / (|V|(|V| - 1))"}</MathText></div>
                <span className="text-[10px] text-[#A6A7AB] block pt-1 font-sans">Fraction of all possible edges that exist in the system.</span>
              </div>
              <div className="bg-[#25262B] p-4 rounded-xl border border-[#42454E] space-y-1">
                <span className="text-[#4ED9A0] font-bold block">Clustering Coeff (C):</span>
                <div className="text-[#F1F3F5] text-sm"><MathText>{"C = 2 e_v / (k_v(k_v - 1))"}</MathText></div>
                <span className="text-[10px] text-[#A6A7AB] block pt-1 font-sans">Degree to which nodes tend to cluster together in tight triads.</span>
              </div>
              <div className="bg-[#25262B] p-4 rounded-xl border border-[#42454E] space-y-1">
                <span className="text-[#F5C24C] font-bold block">Average Path Length (L):</span>
                <div className="text-[#F1F3F5] text-sm"><MathText>{"L = (1 / N(N - 1)) ∑ d(i, j)"}</MathText></div>
                <span className="text-[10px] text-[#A6A7AB] block pt-1 font-sans">Mean shortest distance across all connected pairs.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  // 3. SIMULATION CONCEPTS: Exact concepts walkthrough directly following simulation-concepts.html
  const renderSimulationConceptsTab = () => {
    return <SimulationConceptsDeck />;
  };

  // 4. VIDEO TUTORIALS: Dedicated video player & list of all posted videos
  const renderVideoTutorialsTab = () => {
    return (
      <div className="space-y-8 animate-in fade-in duration-300" id="video-tutorials-section">
        {/* Main Active Video Player Card */}
        <div className="bg-[#2E3036] rounded-2xl p-6 sm:p-8 border border-[#42454E] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#42454E] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#383A42] text-rose-400 rounded-xl border border-[#42454E]">
                <PlayCircle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-900/50 text-rose-300 border border-rose-700/50">
                    {currentVideo.duration}
                  </span>
                  <span className="text-[11px] text-[#A6A7AB] font-medium">
                    {currentVideo.category}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#F1F3F5] mt-0.5">
                  {currentVideo.title}
                </h2>
              </div>
            </div>

            <div className="font-mono text-xs text-[#5C9EE8] bg-[#383A42] px-3 py-1.5 rounded-lg border border-[#42454E] self-start sm:self-auto">
              <MathText>{currentVideo.formula}</MathText>
            </div>
          </div>

          {/* HTML5 Video Player */}
          <div className="aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden bg-slate-950 border border-[#42454E] shadow-lg relative">
            <video
              key={currentVideo.src}
              className="w-full h-full object-cover"
              controls
              playsInline
              poster="/video-poster-placeholder.png"
            >
              <source src={currentVideo.src} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/70 pointer-events-none -z-10">
              <p className="text-sm font-semibold mb-1">Video Stream Ready</p>
              <p className="text-xs text-slate-400">{currentVideo.src}</p>
            </div>
          </div>

          {/* Video Information & Takeaways */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
            <div className="md:col-span-7 space-y-3">
              <h4 className="text-xs font-bold text-[#A6A7AB] uppercase tracking-wider font-mono">
                Lesson Synopsis
              </h4>
              <p className="text-sm text-[#D0D3D7] leading-relaxed">
                {currentVideo.synopsis}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {currentVideo.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#383A42] text-[#A6A7AB] border border-[#42454E]">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="md:col-span-5 bg-[#1E1F23] p-4.5 rounded-xl border border-[#42454E] space-y-2.5">
              <h4 className="text-xs font-bold text-[#F1F3F5] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#3fb950]" />
                Key Learning Takeaways
              </h4>
              <ul className="space-y-2 text-xs text-[#A6A7AB]">
                {currentVideo.takeaways.map((takeaway, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5C9EE8] shrink-0 mt-1.5"></span>
                    <span className="leading-snug">{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Video Library / Posted Videos Gallery */}
        <div className="space-y-4" id="posted-videos-catalog">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#F1F3F5] font-sans">
                All Posted Video Lessons
              </h3>
              <p className="text-xs text-[#A6A7AB]">Select any video from the catalog to watch and review core formulations</p>
            </div>
            <span className="text-xs font-mono font-bold text-[#A6A7AB] bg-[#383A42] px-2.5 py-1 rounded-full border border-[#42454E]">
              {POSTED_VIDEOS.length} Available Lessons
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {POSTED_VIDEOS.map((video) => {
              const isCurrent = video.id === selectedVideoId;
              return (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideoId(video.id)}
                  className={`group cursor-pointer rounded-xl p-4.5 border transition-all duration-200 flex flex-col justify-between ${
                    isCurrent
                      ? "bg-[#383A42] border-[#5C9EE8] ring-2 ring-[#5C9EE8]/20 shadow-sm"
                      : "bg-[#2E3036] border-[#42454E] hover:border-[#565A66] hover:shadow-xs"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isCurrent ? "bg-[#238636] text-white" : "bg-[#383A42] text-[#A6A7AB] border border-[#42454E]"
                      }`}>
                        {video.duration}
                      </span>
                      <span className="text-[10px] font-medium text-[#A6A7AB]">
                        {video.category}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#F1F3F5] group-hover:text-[#5C9EE8] transition-colors flex items-center gap-1.5">
                        <PlayCircle size={16} className={isCurrent ? "text-[#5C9EE8]" : "text-[#A6A7AB]"} />
                        {video.title}
                      </h4>
                      <p className="text-xs text-[#A6A7AB] mt-1.5 line-clamp-2 leading-relaxed">
                        {video.synopsis}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-2 border-t border-[#42454E] flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-[#A6A7AB]">
                      <MathText>{video.formula}</MathText>
                    </span>
                    <span className={`text-xs font-bold flex items-center gap-1 ${
                      isCurrent ? "text-[#5C9EE8]" : "text-[#A6A7AB] group-hover:text-[#F1F3F5]"
                    }`}>
                      {isCurrent ? "Active Video" : "Watch"}
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 animate-fade-in" id="learn-page-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#2E3036] via-[#383A42] to-[#1E1F23] text-white rounded-2xl p-8 shadow-sm relative overflow-hidden border border-[#42454E]" id="learn-header-banner">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-[#5C9EE8]/20 border border-[#5C9EE8]/40 text-[#5C9EE8] text-[11px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-widest font-semibold">
              URSA Knowledge Suite
            </span>
            <span className="text-[#A6A7AB] text-xs">•</span>
            <span className="text-[#D0D3D7] text-xs font-medium">Interactive Theory & Visual Models</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight font-sans text-[#F1F3F5]">
            Network Centrality & Urban Resilience
          </h1>
          <p className="text-[#A6A7AB] text-sm leading-relaxed">
            Master topological formulations, dependency mechanics, and failure propagation through interactive mathematical definitions, visual diagrams, and video lessons.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10 select-none pointer-events-none" id="learn-bg-icon">
          <Network size={260} />
        </div>
      </div>

      {/* Main Navigation Tabs */}
      {renderMainNavigation()}

      {/* Active Tab Content Area */}
      <div className="min-h-[450px]">
        {/* Empty state when non-admin and all tabs are hidden */}
        {!isAdmin && visibleTabs.length === 0 ? (
          <div className="text-center py-16 px-6 bg-[#2E3036] rounded-2xl border border-[#42454E] space-y-4 animate-in fade-in duration-300">
            <div className="p-4 bg-[#383A42] text-amber-400 rounded-2xl inline-block border border-[#42454E]">
              <EyeOff size={36} />
            </div>
            <h3 className="text-lg font-bold text-[#F1F3F5]">Curriculum Modules Unavailable</h3>
            <p className="text-xs text-[#A6A7AB] max-w-md mx-auto leading-relaxed">
              The instructor or system administrator has temporarily restricted access to the learning modules. Please check back shortly or check the Simulator and Configuration tabs.
            </p>
          </div>
        ) : (
          <>
            {/* Admin notice banner when previewing a hidden section */}
            {isAdmin && !visibility[activeMainTab] && (
              <div className="mb-6 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/20 rounded-lg">
                    <EyeOff size={15} className="text-amber-400" />
                  </div>
                  <span>
                    <strong>Administrator Preview:</strong> This section is currently <strong>Hidden from Users</strong> in Admin Settings. Standard students and researchers cannot view this module.
                  </span>
                </div>
                <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold border border-amber-500/40 shrink-0">
                  Hidden From Standard Users
                </span>
              </div>
            )}

            {/* Render selected tab if user is admin or if tab is visible */}
            {(isAdmin || visibility.general) && activeMainTab === "general" && renderGeneralConceptsTab()}
            {(isAdmin || visibility.network_concepts) && activeMainTab === "network_concepts" && renderNetworkConceptsTab()}
            {(isAdmin || visibility.simulation_concepts) && activeMainTab === "simulation_concepts" && renderSimulationConceptsTab()}
            {(isAdmin || visibility.videos) && activeMainTab === "videos" && renderVideoTutorialsTab()}
            {(isAdmin || visibility.lab) && activeMainTab === "lab" && <PracticeLab />}
          </>
        )}
      </div>
    </div>
  );
}
