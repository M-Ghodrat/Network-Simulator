import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, HelpCircle, Info, RefreshCw, Shuffle, ArrowRight } from "lucide-react";

export interface LabNode {
  id: string; // e.g., "A"
  label: string; // e.g., "Node A"
}

export interface LabEdge {
  id: string; // e.g., "A-B"
  source: string; // "A"
  target: string; // "B"
}

type MetricType = "indegree" | "outdegree" | "betweenness";

const TEMPLATES: Record<string, { nodes: LabNode[]; edges: LabEdge[] }> = {
  star: {
    nodes: [
      { id: "A", label: "Node A" },
      { id: "B", label: "Node B" },
      { id: "C", label: "Node C" },
      { id: "D", label: "Node D" },
      { id: "E", label: "Node E" },
    ],
    edges: [
      { id: "B-A", source: "B", target: "A" },
      { id: "C-A", source: "C", target: "A" },
      { id: "D-A", source: "D", target: "A" },
      { id: "E-A", source: "E", target: "A" },
    ],
  },
  chain: {
    nodes: [
      { id: "A", label: "Node A" },
      { id: "B", label: "Node B" },
      { id: "C", label: "Node C" },
      { id: "D", label: "Node D" },
    ],
    edges: [
      { id: "A-B", source: "A", target: "B" },
      { id: "B-C", source: "B", target: "C" },
      { id: "C-D", source: "C", target: "D" },
    ],
  },
  ring: {
    nodes: [
      { id: "A", label: "Node A" },
      { id: "B", label: "Node B" },
      { id: "C", label: "Node C" },
      { id: "D", label: "Node D" },
    ],
    edges: [
      { id: "A-B", source: "A", target: "B" },
      { id: "B-C", source: "B", target: "C" },
      { id: "C-D", source: "C", target: "D" },
      { id: "D-A", source: "D", target: "A" },
    ],
  },
  bridge: {
    nodes: [
      { id: "A", label: "Node A" },
      { id: "B", label: "Node B" },
      { id: "C", label: "Node C" },
      { id: "D", label: "Node D" },
      { id: "E", label: "Node E" },
      { id: "F", label: "Node F" },
    ],
    edges: [
      // Left cluster cycle
      { id: "A-B", source: "A", target: "B" },
      { id: "B-C", source: "B", target: "C" },
      { id: "C-A", source: "C", target: "A" },
      // Right cluster cycle
      { id: "D-E", source: "D", target: "E" },
      { id: "E-F", source: "E", target: "F" },
      { id: "F-D", source: "F", target: "D" },
      // Bridge connecting them
      { id: "C-D", source: "C", target: "D" },
    ],
  }
};

const TEMPLATE_POSITIONS: Record<string, Record<string, { x: number; y: number }>> = {
  star: {
    A: { x: 250, y: 200 },
    B: { x: 120, y: 100 },
    C: { x: 380, y: 100 },
    D: { x: 380, y: 300 },
    E: { x: 120, y: 300 }
  },
  chain: {
    A: { x: 100, y: 200 },
    B: { x: 200, y: 200 },
    C: { x: 300, y: 200 },
    D: { x: 400, y: 200 }
  },
  ring: {
    A: { x: 150, y: 100 },
    B: { x: 350, y: 100 },
    C: { x: 350, y: 300 },
    D: { x: 150, y: 300 }
  },
  bridge: {
    A: { x: 90, y: 120 },
    B: { x: 90, y: 280 },
    C: { x: 200, y: 200 },
    D: { x: 300, y: 200 },
    E: { x: 410, y: 120 },
    F: { x: 410, y: 280 }
  }
};

export default function PracticeLab() {
  const [nodes, setNodes] = useState<LabNode[]>(TEMPLATES.bridge.nodes);
  const [edges, setEdges] = useState<LabEdge[]>(TEMPLATES.bridge.edges);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(
    TEMPLATE_POSITIONS.bridge
  );

  const [activeMetric, setActiveMetric] = useState<MetricType>("betweenness");
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Form states
  const [newNodeId, setNewNodeId] = useState("");
  const [edgeSource, setEdgeSource] = useState("");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize nodes dropdown
  useEffect(() => {
    if (nodes.length > 0) {
      setEdgeSource(nodes[0].id);
      setEdgeTarget(nodes[1]?.id || nodes[0].id);
    } else {
      setEdgeSource("");
      setEdgeTarget("");
    }
  }, [nodes]);

  // Load template
  const loadTemplate = (key: string) => {
    const t = TEMPLATES[key];
    if (t) {
      setNodes(t.nodes);
      setEdges(t.edges);
      setNodePositions(TEMPLATE_POSITIONS[key] || calculateCirclePositions(t.nodes));
      setErrorMsg(null);
    } else {
      // Clear canvas
      setNodes([]);
      setEdges([]);
      setNodePositions({});
      setErrorMsg(null);
    }
  };

  const calculateCirclePositions = (nodesList: LabNode[]) => {
    const positions: Record<string, { x: number; y: number }> = {};
    const cx = 250;
    const cy = 200;
    const r = 120;
    const N = nodesList.length;
    nodesList.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      positions[node.id] = {
        x: Math.round(cx + r * Math.cos(angle)),
        y: Math.round(cy + r * Math.sin(angle)),
      };
    });
    return positions;
  };

  // Add Node
  const addNode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newNodeId.trim().toUpperCase();
    if (!cleanId) {
      setErrorMsg("Please enter a Node ID.");
      return;
    }
    if (cleanId.length > 3) {
      setErrorMsg("Node ID must be 1 to 3 characters.");
      return;
    }
    if (nodes.some((n) => n.id === cleanId)) {
      setErrorMsg(`Node "${cleanId}" already exists.`);
      return;
    }

    const newNode: LabNode = {
      id: cleanId,
      label: `Node ${cleanId}`,
    };

    setNodes((prev) => [...prev, newNode]);
    setNodePositions((prev) => ({
      ...prev,
      [cleanId]: { x: 250 + (Math.random() - 0.5) * 30, y: 200 + (Math.random() - 0.5) * 30 },
    }));
    setNewNodeId("");
    setErrorMsg(null);
  };

  // Remove Node
  const removeNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setNodePositions((prev) => {
      const copy = { ...prev };
      delete copy[nodeId];
      return copy;
    });
    setErrorMsg(null);
  };

  // Add Edge
  const addEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!edgeSource || !edgeTarget) {
      setErrorMsg("Select a valid source and target node.");
      return;
    }
    if (edgeSource === edgeTarget) {
      setErrorMsg("Self-loops are not allowed (source and target must differ).");
      return;
    }

    const edgeId = `${edgeSource}-${edgeTarget}`;
    if (edges.some((e) => e.id === edgeId)) {
      setErrorMsg(`Edge ${edgeSource} → ${edgeTarget} already exists.`);
      return;
    }

    const newEdge: LabEdge = {
      id: edgeId,
      source: edgeSource,
      target: edgeTarget,
    };

    setEdges((prev) => [...prev, newEdge]);
    setErrorMsg(null);
  };

  // Remove Edge
  const removeEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    setErrorMsg(null);
  };

  // Drag and Drop implementation
  const handleMouseDown = (nodeId: string) => {
    setDraggedNode(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!draggedNode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Constrain coordinates nicely within layout
    const constrainedX = Math.max(30, Math.min(470, x));
    const constrainedY = Math.max(30, Math.min(370, y));

    setNodePositions((prev) => ({
      ...prev,
      [draggedNode]: { x: constrainedX, y: constrainedY },
    }));
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  // CENTRALITY CALCULATIONS (Brandes' Algorithm & Simple Degrees)
  const calculateMetrics = () => {
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    const betweenness: Record<string, number> = {};
    const edgeBetweenness: Record<string, number> = {};

    nodes.forEach((n) => {
      inDegree[n.id] = 0;
      outDegree[n.id] = 0;
      betweenness[n.id] = 0;
    });

    edges.forEach((e) => {
      edgeBetweenness[e.id] = 0;
      if (outDegree[e.source] !== undefined) outDegree[e.source]++;
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    // Brandes' Algorithm for unweighted directed graph
    nodes.forEach((s) => {
      const S: string[] = []; // Stack
      const P: Record<string, string[]> = {}; // Predecessors list
      const sigma: Record<string, number> = {}; // shortest path counts
      const d: Record<string, number> = {}; // distances

      nodes.forEach((w) => {
        P[w.id] = [];
        sigma[w.id] = 0;
        d[w.id] = -1;
      });

      sigma[s.id] = 1;
      d[s.id] = 0;

      const Q: string[] = [s.id]; // Queue

      while (Q.length > 0) {
        const v = Q.shift()!;
        S.push(v);

        // Out neighbors
        const neighbors = edges.filter((e) => e.source === v).map((e) => e.target);

        neighbors.forEach((w) => {
          if (d[w] < 0) {
            d[w] = d[v] + 1;
            Q.push(w);
          }
          if (d[w] === d[v] + 1) {
            sigma[w] += sigma[v];
            P[w].push(v);
          }
        });
      }

      const delta: Record<string, number> = {};
      nodes.forEach((w) => (delta[w.id] = 0));

      while (S.length > 0) {
        const w = S.pop()!;
        P[w].forEach((v) => {
          const c = (sigma[v] / sigma[w]) * (1 + delta[w]);
          delta[v] += c;

          const edge = edges.find((e) => e.source === v && e.target === w);
          if (edge) {
            edgeBetweenness[edge.id] += c;
          }
        });
        if (w !== s.id) {
          betweenness[w] += delta[w];
        }
      }
    });

    return { inDegree, outDegree, betweenness, edgeBetweenness };
  };

  const metrics = calculateMetrics();

  // Helper to extract min/max for high/low highlights
  const getHighlightBounds = (metricValues: Record<string, number>) => {
    const vals = Object.values(metricValues);
    if (vals.length === 0) return { min: 0, max: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, max };
  };

  const nodeBounds = {
    indegree: getHighlightBounds(metrics.inDegree),
    outdegree: getHighlightBounds(metrics.outDegree),
    betweenness: getHighlightBounds(metrics.betweenness),
  };

  const edgeBounds = getHighlightBounds(metrics.edgeBetweenness);

  // Highlight determination helper
  const getNodeHighlightStatus = (nodeId: string, metric: MetricType) => {
    if (nodes.length < 2) return "none";
    const val =
      metric === "indegree"
        ? metrics.inDegree[nodeId]
        : metric === "outdegree"
        ? metrics.outDegree[nodeId]
        : metrics.betweenness[nodeId];

    const bounds = nodeBounds[metric];
    if (bounds.max === bounds.min) return "none"; // If all have the same value, no unique contrast

    if (val === bounds.max) return "highest";
    if (val === bounds.min) return "lowest";
    return "none";
  };

  const getEdgeHighlightStatus = (edgeId: string) => {
    if (edges.length < 2) return "none";
    const val = metrics.edgeBetweenness[edgeId];
    if (edgeBounds.max === edgeBounds.min) return "none";

    if (val === edgeBounds.max) return "highest";
    if (val === edgeBounds.min) return "lowest";
    return "none";
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
      {/* Introduction Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <RefreshCw size={18} className="animate-spin-slow" />
          </div>
          <h2 className="text-base font-bold text-slate-900 font-sans">
            Practice Lab: Interactive Centrality Playground
          </h2>
        </div>
        <p className="text-slate-600 text-xs leading-relaxed">
          Create custom graphs or select a preset template below to understand how the mathematical formulas work. 
          Select different metrics to live-recalculate network nodes, and observe how the **highest** and **lowest** indicators highlight on the graph layout in real-time. <strong>You can drag nodes to rearrange the visual layout!</strong>
        </p>

        {/* Preset Templates bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-2">
            Load Preset:
          </span>
          <button
            onClick={() => loadTemplate("star")}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors"
          >
            ⭐ Star Network
          </button>
          <button
            onClick={() => loadTemplate("chain")}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors"
          >
            ⛓️ Chain / Line
          </button>
          <button
            onClick={() => loadTemplate("ring")}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors"
          >
            🔄 Ring / Cycle
          </button>
          <button
            onClick={() => loadTemplate("bridge")}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-indigo-700 border border-slate-200 rounded-md transition-colors"
          >
            🌉 Bridge (Bowtie)
          </button>
          <button
            onClick={() => loadTemplate("clear")}
            className="px-2.5 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 hover:border-rose-200 text-rose-700 border border-rose-100 rounded-md transition-colors"
          >
            🗑️ Clear Canvas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Graph Viewer (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <h3 className="text-xs font-bold text-slate-800">Visual Network Canvas</h3>
            </div>

            {/* Metric visualization selection */}
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-mono text-slate-400 uppercase">View Metric:</label>
              <select
                value={activeMetric}
                onChange={(e) => setActiveMetric(e.target.value as MetricType)}
                className="text-xs py-1 px-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-900"
              >
                <option value="indegree">In-Degree Centrality</option>
                <option value="outdegree">Out-Degree Centrality</option>
                <option value="betweenness">Betweenness Centrality</option>
              </select>
            </div>
          </div>

          {/* SVG Visualizer */}
          <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-900 shadow-inner flex items-center justify-center">
            {nodes.length === 0 ? (
              <div className="py-24 text-center text-slate-500 space-y-2">
                <p className="text-xs font-medium">Your canvas is empty.</p>
                <p className="text-[10px] text-slate-600 max-w-xs mx-auto">
                  Use the preset load buttons above or add a new node using the form on the right to start building your network.
                </p>
              </div>
            ) : (
              <svg
                ref={svgRef}
                width="100%"
                height="400"
                viewBox="0 0 500 400"
                className="select-none cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* SVG Definitions for Arrowheads */}
                <defs>
                  <marker
                    id="lab-arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                  </marker>
                  <marker
                    id="lab-arrow-highest"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                  </marker>
                  <marker
                    id="lab-arrow-lowest"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="4"
                    markerHeight="4"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                  </marker>
                </defs>

                {/* Render Edges (Lines) */}
                {edges.map((edge) => {
                  const sourcePos = nodePositions[edge.source];
                  const targetPos = nodePositions[edge.target];
                  if (!sourcePos || !targetPos) return null;

                  // Calculate shortened line boundaries to nicely fit standard node circle borders (R=22)
                  const dx = targetPos.x - sourcePos.x;
                  const dy = targetPos.y - sourcePos.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  if (len === 0) return null;

                  const rSource = 20;
                  const rTarget = 20;
                  const x1 = sourcePos.x + (dx / len) * rSource;
                  const y1 = sourcePos.y + (dy / len) * rSource;
                  const x2 = targetPos.x - (dx / len) * (rTarget + 5);
                  const y2 = targetPos.y - (dy / len) * (rTarget + 5);

                  // Highlight properties
                  const isBetweennessSelected = activeMetric === "betweenness";
                  const status = isBetweennessSelected ? getEdgeHighlightStatus(edge.id) : "none";
                  
                  let strokeColor = "#475569"; // slate-600
                  let strokeWidth = "1.5";
                  let dashArray = "none";
                  let markerId = "lab-arrow";

                  if (isBetweennessSelected) {
                    if (status === "highest") {
                      strokeColor = "#10b981"; // emerald-500
                      strokeWidth = "3.5";
                      markerId = "lab-arrow-highest";
                    } else if (status === "lowest") {
                      strokeColor = "#ef4444"; // red-500
                      strokeWidth = "1";
                      dashArray = "3,3";
                      markerId = "lab-arrow-lowest";
                    }
                  }

                  return (
                    <g key={edge.id} className="transition-all duration-300">
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dashArray}
                        markerEnd={`url(#${markerId})`}
                        className="transition-all duration-300"
                      />
                      {/* Optional hover tooltip or betweenness label */}
                      {isBetweennessSelected && metrics.edgeBetweenness[edge.id] > 0 && (
                        <rect
                          x={(x1 + x2) / 2 - 14}
                          y={(y1 + y2) / 2 - 8}
                          width="28"
                          height="14"
                          rx="3"
                          fill="#1e293b"
                          stroke="#334155"
                          strokeWidth="0.5"
                        />
                      )}
                      {isBetweennessSelected && metrics.edgeBetweenness[edge.id] > 0 && (
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 + 2}
                          fill="#f8fafc"
                          fontSize="8"
                          fontFamily="monospace"
                          textAnchor="middle"
                          className="font-bold pointer-events-none"
                        >
                          {metrics.edgeBetweenness[edge.id].toFixed(1)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Render Nodes (Circles) */}
                {nodes.map((node) => {
                  const pos = nodePositions[node.id];
                  if (!pos) return null;

                  const val =
                    activeMetric === "indegree"
                      ? metrics.inDegree[node.id]
                      : activeMetric === "outdegree"
                      ? metrics.outDegree[node.id]
                      : metrics.betweenness[node.id];

                  const status = getNodeHighlightStatus(node.id, activeMetric);

                  // Set colors/border based on highlight status
                  let fill = "#1e293b"; // slate-900 (default)
                  let stroke = "#475569"; // slate-600
                  let strokeWidth = "2";
                  let pulseClass = "";
                  let r = 20;

                  if (status === "highest") {
                    fill = "#064e3b"; // dark emerald
                    stroke = "#34d399"; // bright emerald
                    strokeWidth = "3.5";
                    pulseClass = "animate-pulse";
                    r = 22;
                  } else if (status === "lowest") {
                    fill = "#450a0a"; // dark rose
                    stroke = "#f87171"; // rose-400
                    strokeWidth = "1.5";
                    r = 18;
                  }

                  return (
                    <g
                      key={node.id}
                      onMouseDown={() => handleMouseDown(node.id)}
                      className="cursor-grab active:cursor-grabbing group transition-all duration-300"
                    >
                      {/* Node circle outline glowing effect for "highest" */}
                      {status === "highest" && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={r + 4}
                          fill="none"
                          stroke="#059669"
                          strokeWidth="1.5"
                          strokeOpacity="0.4"
                          className={pulseClass}
                        />
                      )}

                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        className="transition-all duration-300"
                      />

                      {/* Node label inside circle */}
                      <text
                        x={pos.x}
                        y={pos.y - 1}
                        fill="#f1f5f9"
                        fontSize="10"
                        fontFamily="sans-serif"
                        textAnchor="middle"
                        className="font-bold pointer-events-none select-none"
                      >
                        {node.id}
                      </text>

                      {/* Display metric value under node ID */}
                      <text
                        x={pos.x}
                        y={pos.y + 9}
                        fill={status === "highest" ? "#34d399" : status === "lowest" ? "#f87171" : "#94a3b8"}
                        fontSize="7"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="pointer-events-none select-none font-semibold"
                      >
                        v:{val % 1 === 0 ? val : val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Color Coding Legend Banner */}
          <div className="p-3 rounded-lg border border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50 text-[11px]" id="legend-banner">
            <div className="flex items-center gap-1.5 text-slate-500 font-mono">
              <Info size={14} className="text-slate-400" />
              <span>Highlight Legend:</span>
            </div>
            <div className="flex flex-wrap gap-4 font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-emerald-400"></span>
                <span className="text-emerald-800 font-sans">🏆 Highest Centrality Value</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-900 border border-rose-400"></span>
                <span className="text-rose-800 font-sans">🔽 Lowest Centrality Value</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-500"></span>
                <span className="text-slate-700 font-sans">Standard Nodes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Form Controls & Tables (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col space-y-5">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Plus size={16} className="text-slate-500" /> Modeler Controls
            </h3>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg font-medium leading-relaxed">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Form to Add Node & Add Edge stacked */}
          <div className="grid grid-cols-1 gap-4">
            {/* Add Node form */}
            <form onSubmit={addNode} className="space-y-2 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                1. Add New Indicator Node
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ID (e.g. G, H)"
                  maxLength={3}
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  className="flex-1 py-1 px-2.5 bg-white border border-slate-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 font-bold rounded-md transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  Add Node
                </button>
              </div>
            </form>

            {/* Add Edge form */}
            <form onSubmit={addEdge} className="space-y-2 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                2. Connect Nodes with Directed Edge
              </span>
              <div className="grid grid-cols-11 gap-1.5 items-center">
                <select
                  value={edgeSource}
                  onChange={(e) => setEdgeSource(e.target.value)}
                  className="col-span-4 text-xs py-1 px-1.5 border border-slate-200 bg-white rounded-md focus:outline-none"
                >
                  <option value="" disabled>Source</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.id}</option>
                  ))}
                </select>

                <div className="col-span-1 text-center font-bold text-slate-400 text-xs">
                  →
                </div>

                <select
                  value={edgeTarget}
                  onChange={(e) => setEdgeTarget(e.target.value)}
                  className="col-span-4 text-xs py-1 px-1.5 border border-slate-200 bg-white rounded-md focus:outline-none"
                >
                  <option value="" disabled>Target</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.id}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] py-1.5 font-bold rounded-md transition-colors shadow-xs cursor-pointer text-center"
                >
                  Link
                </button>
              </div>
            </form>
          </div>

          {/* Node Centrality Table */}
          <div className="space-y-2 flex-1 flex flex-col min-h-[180px]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block font-semibold">
              Live Centrality Values
            </span>

            {nodes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-4 text-[10px] text-slate-400 text-center">
                Create nodes to view centrality scores
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-lg flex-1 max-h-[220px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-100 font-mono text-[9px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2 pl-3">Node</th>
                      <th className="p-2">In-Degree</th>
                      <th className="p-2">Out-Degree</th>
                      <th className="p-2">Betweenness</th>
                      <th className="p-2 pr-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {nodes.map((node) => {
                      const inD = metrics.inDegree[node.id];
                      const outD = metrics.outDegree[node.id];
                      const btw = metrics.betweenness[node.id];

                      const inStatus = getNodeHighlightStatus(node.id, "indegree");
                      const outStatus = getNodeHighlightStatus(node.id, "outdegree");
                      const btwStatus = getNodeHighlightStatus(node.id, "betweenness");

                      return (
                        <tr key={node.id} className="hover:bg-slate-50/50 transition-colors font-mono">
                          <td className="p-2 pl-3 font-sans font-bold text-slate-800">{node.id}</td>
                          <td className="p-2">
                            <span className="font-semibold">{inD}</span>
                            {inStatus === "highest" && <span className="ml-1 text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-sans font-bold">🏆 Max</span>}
                            {inStatus === "lowest" && <span className="ml-1 text-[8px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-sans font-bold">🔽 Min</span>}
                          </td>
                          <td className="p-2">
                            <span className="font-semibold">{outD}</span>
                            {outStatus === "highest" && <span className="ml-1 text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-sans font-bold">🏆 Max</span>}
                            {outStatus === "lowest" && <span className="ml-1 text-[8px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-sans font-bold">🔽 Min</span>}
                          </td>
                          <td className="p-2">
                            <span className="font-semibold">{btw % 1 === 0 ? btw : btw.toFixed(1)}</span>
                            {btwStatus === "highest" && <span className="ml-1 text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-sans font-bold">🏆 Max</span>}
                            {btwStatus === "lowest" && <span className="ml-1 text-[8px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-sans font-bold">🔽 Min</span>}
                          </td>
                          <td className="p-2 pr-3 text-right">
                            <button
                              onClick={() => removeNode(node.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title={`Delete ${node.id}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Edges List Table if betweenness selected */}
          {edges.length > 0 && activeMetric === "betweenness" && (
            <div className="space-y-2 max-h-[160px] overflow-y-auto border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                Directed Edge Betweenness Scores
              </span>
              <div className="flex flex-wrap gap-1.5">
                {edges.map((edge) => {
                  const val = metrics.edgeBetweenness[edge.id];
                  const edgeStatus = getEdgeHighlightStatus(edge.id);
                  let badgeStyle = "bg-white text-slate-700 border-slate-100";

                  if (edgeStatus === "highest") {
                    badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200 ring-2 ring-emerald-500/20";
                  } else if (edgeStatus === "lowest") {
                    badgeStyle = "bg-rose-50 text-rose-800 border-rose-100";
                  }

                  return (
                    <div
                      key={edge.id}
                      className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono border rounded-lg shadow-2xs ${badgeStyle}`}
                    >
                      <span className="font-bold">{edge.source}→{edge.target}</span>
                      <span className="text-slate-400">:</span>
                      <span className="font-semibold text-slate-900">{val % 1 === 0 ? val : val.toFixed(1)}</span>
                      <button
                        onClick={() => removeEdge(edge.id)}
                        className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                        title={`Delete edge ${edge.source} to ${edge.target}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
