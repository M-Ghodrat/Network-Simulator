import { useState, useEffect, useRef } from "react";
import { NodeIndicator, Domain, Edge, Intervention, Shock, SimulationResult } from "../types";
import { dataService } from "../dataService";
import { runSimulationClient, SimulationPayload } from "../lib/simulationClient";
import { Play, Pause, RefreshCw, Download, Plus, Trash2, Sliders, BarChart4, Network, HelpCircle, AlertTriangle } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from "recharts";

export default function SimulatorPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [nodes, setNodes] = useState<NodeIndicator[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [isLocal, setIsLocal] = useState(false);

  // Custom confirmation/alert modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "danger" | "info" | "success";
    showCancel?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const closeModal = () => {
    setModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Simulation parameters states
  const [T, setT] = useState(10);
  const [theta, setTheta] = useState(0.2);
  const [gamma, setGamma] = useState(1.5);
  const [epsilon, setEpsilon] = useState(0.001);
  const [rv, setRv] = useState(0.01);

  // Shocks list
  const [shocks, setShocks] = useState<Shock[]>([]);
  const [newShockNode, setNewShockNode] = useState("");
  const [newShockIntensity, setNewShockIntensity] = useState(0.4);

  // Interventions list
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [newIntervNode, setNewIntervNode] = useState("");
  const [newIntervWave, setNewIntervWave] = useState(2);
  const [newIntervStrength, setNewIntervStrength] = useState(0.018);

  // Simulation result
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Visualization playing state
  const [selectedWave, setSelectedWave] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dashboard charting selections
  const [selectedChartNodes, setSelectedChartNodes] = useState<string[]>([]);
  const [newChartNode, setNewChartNode] = useState("");
  
  // Results table filter
  const [tableSearch, setTableSearch] = useState("");
  const [imageScale, setImageScale] = useState(80);

  // Load configuration from dataService
  useEffect(() => {
    setLoadingNodes(true);
    const unsubDomains = dataService.subscribeDomains((list) => {
      setDomains(list);
    });

    const unsubNodes = dataService.subscribeNodes((list) => {
      setNodes(list);
      // Select defaults for new items
      if (list.length > 0) {
        const defaultNode = list.find(n => n.abbr === "PF")?.abbr || list.find(n => n.abbr === "N2")?.abbr || list[0].abbr;
        setNewShockNode((prev) => prev || defaultNode);
        setNewIntervNode((prev) => prev || defaultNode);
        setNewChartNode((prev) => prev || list[0].abbr);
      }
    });

    const unsubEdges = dataService.subscribeEdges((list) => {
      setEdges(list);
      setLoadingNodes(false);
    });

    const unsubParams = dataService.subscribeParams((p) => {
      if (p) {
        setT(p.T ?? 10);
        setTheta(p.theta ?? 0.2);
        setGamma(p.gamma ?? 1.5);
        setEpsilon(p.epsilon ?? 0.001);
        setRv(p.rv ?? 0.01);
        if (p.shocks) setShocks(p.shocks);
        if (p.interventions) setInterventions(p.interventions);
      }
    });

    const unsubStatus = dataService.subscribeStatus((localFlag) => {
      setIsLocal(localFlag);
    });

    return () => {
      unsubDomains();
      unsubNodes();
      unsubEdges();
      unsubParams();
      unsubStatus();
    };
  }, []);

  // Handle playing animation
  useEffect(() => {
    if (isPlaying && simResult) {
      playIntervalRef.current = setInterval(() => {
        setSelectedWave((prev) => {
          const maxWave = simResult.plots.length - 1;
          if (prev >= maxWave) {
            return 0; // loop back
          }
          return prev + 1;
        });
      }, 900);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, simResult]);

  // Add default demo shock scenario on load
  useEffect(() => {
    if (nodes.length > 0 && shocks.length === 0) {
      const defaultShocks: Shock[] = [];
      const defaultCharts: string[] = [];
      
      if (nodes.some(n => n.abbr === "PF")) {
        defaultShocks.push({ node: "PF", intensity: 0.4 });
        defaultCharts.push("PF");
      } else if (nodes.some(n => n.abbr === "N2")) {
        defaultShocks.push({ node: "N2", intensity: 0.4 });
        defaultCharts.push("N2");
      }
      
      if (nodes.some(n => n.abbr === "BE")) {
        defaultShocks.push({ node: "BE", intensity: 0.4 });
        defaultCharts.push("BE");
      } else if (nodes.some(n => n.abbr === "N10")) {
        defaultShocks.push({ node: "N10", intensity: 0.4 });
        defaultCharts.push("N10");
      }

      if (defaultShocks.length > 0) {
        setShocks(defaultShocks);
      }
      if (defaultCharts.length > 0 && selectedChartNodes.length === 0) {
        setSelectedChartNodes(defaultCharts);
      }
    }
  }, [nodes]);

  // CRUD for shocks
  const addShock = () => {
    if (!newShockNode) return;
    const existingIndex = shocks.findIndex((s) => s.node === newShockNode);
    if (existingIndex >= 0) {
      const updatedShocks = [...shocks];
      updatedShocks[existingIndex] = { node: newShockNode, intensity: newShockIntensity };
      setShocks(updatedShocks);
    } else {
      setShocks([...shocks, { node: newShockNode, intensity: newShockIntensity }]);
    }
  };

  const removeShock = (node: string) => {
    setShocks(shocks.filter((s) => s.node !== node));
  };

  // CRUD for interventions
  const addIntervention = () => {
    if (!newIntervNode) return;
    setInterventions([
      ...interventions,
      { node: newIntervNode, wave: newIntervWave, strength: newIntervStrength }
    ]);
  };

  const removeIntervention = (index: number) => {
    setInterventions(interventions.filter((_, i) => i !== index));
  };

  const saveCurrentParams = async () => {
    try {
      await dataService.saveParams({
        id: "default",
        T,
        theta,
        gamma,
        epsilon,
        rv,
        shocks,
        interventions
      });
    } catch (e) {
      console.error("Failed to save params:", e);
    }
  };

  // Run Simulation API call
  const runSimulation = async () => {
    if (nodes.length === 0) {
      alert("No nodes loaded. Please seed the network in Network Configuration first!");
      return;
    }

    setSimulating(true);
    setErrorMsg(null);
    setIsPlaying(false);
    setSelectedWave(0);

    // Save current parameters to Firestore
    await saveCurrentParams();

    // Prepare python payload
    const payloadShocks: Record<string, number> = {};
    shocks.forEach((s) => {
      payloadShocks[s.node] = s.intensity;
    });


    const payload: SimulationPayload = {
      nodes,
      edges,
      domains,
      params: {
        shocks: payloadShocks,
        T,
        gamma,
        epsilon,
        default_theta: theta,
        default_recovery_rate: rv,
        interventions
      }
    };

    try {
      // Run the simulation entirely in the browser
      const result = runSimulationClient(payload);
      setSimResult(result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "An unexpected error occurred during client-side simulation.");
    } finally {
      setSimulating(false);
    }
  };

  // Charts data preparation
  const getGSILineData = () => {
    if (!simResult) return [];
    return simResult.gsi.map((val, idx) => ({
      wave: idx,
      GSI: Number(val.toFixed(3)),
      VNC: simResult.vnc[idx]
    }));
  };

  const getNodeLineData = () => {
    if (!simResult) return [];
    const waveCount = simResult.gsi.length;
    const chartData = [];
    
    for (let t = 0; t < waveCount; t++) {
      const row: Record<string, any> = { wave: t };
      selectedChartNodes.forEach((abbr) => {
        const hist = simResult.history[abbr];
        if (hist) {
          row[abbr] = Number(hist[t].toFixed(3));
        }
      });
      chartData.push(row);
    }
    return chartData;
  };

  const getSpilloverBarData = () => {
    if (!simResult || !simResult.domain_spillover[selectedWave]) return [];
    const spillover = simResult.domain_spillover[selectedWave];
    return Object.entries(spillover).map(([domainId, fraction]) => {
      const dName = domains.find((d) => d.id === domainId)?.name || `Domain ${domainId}`;
      return {
        domain: dName.split(" ").slice(0, 2).join(" "), // shorten for label
        fullName: dName,
        fraction: Number(((fraction as number) * 100).toFixed(1)),
        id: domainId
      };
    });
  };

  // Exporters
  const downloadCSV = () => {
    if (!simResult) return;
    
    const waveCount = simResult.gsi.length;
    let csvContent = "wave,node_abbr,node_name,domain,stability\n";
    
    for (let t = 0; t < waveCount; t++) {
      nodes.forEach((node) => {
        const sVal = simResult.history[node.abbr]?.[t];
        const sValStr = sVal !== undefined ? sVal.toFixed(4) : "1.0000";
        const dName = domains.find(d => d.id === node.domain_id)?.name || node.domain_id;
        // Escape quotes
        const nameEscaped = node.full_name.replace(/"/g, '""');
        const domainEscaped = dName.replace(/"/g, '""');
        csvContent += `${t},${node.abbr},"${nameEscaped}","${domainEscaped}",${sValStr}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `network_simulation_results_T${T}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPNG = () => {
    if (!simResult || !simResult.plots[selectedWave]) return;
    const base64Data = simResult.plots[selectedWave];
    const link = document.createElement("a");
    link.setAttribute("href", base64Data);
    link.setAttribute("download", `cascade_network_wave_${selectedWave}.png`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Domain color mapping helper for text/badges
  const getDomainColor = (id: string) => {
    const map: Record<string, string> = {
      "1": "bg-blue-50 text-blue-700 border-blue-100",
      "2": "bg-emerald-50 text-emerald-700 border-emerald-100",
      "3": "bg-green-50 text-green-700 border-green-100",
      "4": "bg-pink-50 text-pink-700 border-pink-100",
      "5": "bg-violet-50 text-violet-700 border-violet-100",
      "6": "bg-amber-50 text-amber-700 border-amber-100",
      "7": "bg-orange-50 text-orange-700 border-orange-100"
    };
    return map[id] || "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-2" id="simulator-page">
      
      {/* 1. LEFT PANEL - SIMULATION CONTROLS */}
      <div className="lg:col-span-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs space-y-5 flex flex-col justify-between" id="left-controls">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sliders size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 font-sans">Simulation Controls</h2>
          </div>

          {/* Seed Shocks (Acutes) */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
              1. Seed Acute Shocks (t = 0)
            </label>
            <div className="flex gap-2">
              <select
                value={newShockNode}
                onChange={(e) => setNewShockNode(e.target.value)}
                className="flex-1 min-w-0 py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              >
                {nodes.map((n) => (
                  <option key={n.abbr} value={n.abbr}>
                    {n.abbr} — {n.full_name}
                  </option>
                ))}
              </select>
              <button
                onClick={addShock}
                className="shrink-0 px-2.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Shock
              </button>
            </div>

            {/* Shocks intensity selector */}
            <div className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded-lg gap-2 border border-slate-100">
              <span className="text-slate-400 font-mono">Intensity (δ_v):</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={newShockIntensity}
                onChange={(e) => setNewShockIntensity(Number(e.target.value))}
                className="w-24 accent-slate-900"
              />
              <span className="font-mono font-bold text-slate-800">{(newShockIntensity * 100).toFixed(0)}%</span>
            </div>

            {/* Shocks list */}
            {shocks.length > 0 && (
              <div className="space-y-1.5 pt-1.5 max-h-24 overflow-y-auto pr-1" id="shocks-list">
                {shocks.map((s) => {
                  const nodeObj = nodes.find(n => n.abbr === s.node);
                  return (
                    <div key={s.node} className="flex items-center justify-between text-xs p-1.5 bg-rose-50/50 border border-rose-100 rounded-md font-mono">
                      <span className="font-bold text-rose-900">{s.node} (-{(s.intensity*100).toFixed(0)}%)</span>
                      <button onClick={() => removeShock(s.node)} className="text-rose-400 hover:text-rose-700">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Core Hyperparameters */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
              2. System Parameters
            </span>

            {/* Waves T */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Simulation Waves (T):</span>
                <span className="font-mono font-bold">{T}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={T}
                onChange={(e) => setT(Number(e.target.value))}
                className="w-full accent-slate-900"
              />
            </div>

            {/* Threshold (theta) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Failure Threshold (θ):</span>
                <span className="font-mono font-bold">{theta}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.3"
                step="0.01"
                value={theta}
                onChange={(e) => setTheta(Number(e.target.value))}
                className="w-full accent-slate-900"
              />
            </div>

            {/* Exponent (gamma) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Centrality Dampening (γ):</span>
                <span className="font-mono font-bold">{gamma}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={gamma}
                onChange={(e) => setGamma(Number(e.target.value))}
                className="w-full accent-slate-900"
              />
            </div>

            {/* Passive Recovery (rv) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Passive Recovery (r_v):</span>
                <span className="font-mono font-bold">{rv}</span>
              </div>
              <input
                type="range"
                min="0.00"
                max="0.10"
                step="0.005"
                value={rv}
                onChange={(e) => setRv(Number(e.target.value))}
                className="w-full accent-slate-900"
              />
            </div>

            {/* Advanced: Convergence tolerance epsilon */}
            <div className="flex justify-between items-center text-[11px] text-slate-600">
              <span>Tolerance (ε):</span>
              <input
                type="number"
                step="0.0001"
                value={epsilon}
                onChange={(e) => setEpsilon(Number(e.target.value))}
                className="w-20 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded-md font-mono font-bold text-right"
              />
            </div>
          </div>

          {/* Active Interventions Schedule */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
              3. Interventions Scheduled
            </span>
            
            <div className="grid grid-cols-12 gap-1.5">
              <select
                value={newIntervNode}
                onChange={(e) => setNewIntervNode(e.target.value)}
                className="col-span-5 py-1 px-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none font-mono"
              >
                {nodes.map((n) => (
                  <option key={n.abbr} value={n.abbr}>{n.abbr}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max={T - 1}
                value={newIntervWave}
                onChange={(e) => setNewIntervWave(Number(e.target.value))}
                className="col-span-3 py-1 px-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none text-center font-mono"
                title="Apply at wave"
                placeholder="w"
              />
              <button
                type="button"
                onClick={addIntervention}
                className="col-span-4 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Intervention Strength Slider */}
            <div className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded-lg gap-2 border border-slate-100">
              <span className="text-slate-400 font-mono">Boost (+i_v):</span>
              <input
                type="range"
                min="0.005"
                max="0.05"
                step="0.002"
                value={newIntervStrength}
                onChange={(e) => setNewIntervStrength(Number(e.target.value))}
                className="w-24 accent-slate-900"
              />
              <span className="font-mono font-bold text-indigo-700">+{newIntervStrength.toFixed(3)}</span>
            </div>

            {/* Interventions list */}
            {interventions.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto pr-1" id="interventions-list">
                {interventions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-[11px] p-1.5 bg-indigo-50/50 border border-indigo-100 rounded-md font-mono">
                    <span className="text-indigo-900 font-semibold">{item.node} @ Wave {item.wave} (+{item.strength})</span>
                    <button onClick={() => removeIntervention(index)} className="text-indigo-400 hover:text-indigo-700">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          {errorMsg && (
            <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg text-[10px] text-rose-700 leading-relaxed" id="sim-error-alert">
              <AlertTriangle size={12} className="inline mr-1" />
              {errorMsg}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={runSimulation}
              disabled={simulating || loadingNodes}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              id="run-sim-btn"
            >
              {simulating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Computing Cascade...
                </>
              ) : (
                <>
                  <Play size={12} fill="white" />
                  Run Cascade Simulation
                </>
              )}
            </button>
            <button
              onClick={async () => {
                await saveCurrentParams();
                setModal({
                  isOpen: true,
                  title: "Parameters Saved",
                  message: "Your simulator parameter configuration has been successfully synchronized and saved to Cloud Firestore!",
                  confirmText: "Awesome",
                  type: "success",
                  showCancel: false,
                  onConfirm: closeModal
                });
              }}
              className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
              title="Save current parameter configuration to Cloud Database"
              id="save-params-btn"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - VISUALIZATION & DASHBOARD */}
      <div className="lg:col-span-9 flex flex-col gap-6">
        {/* 2. MIDDLE PANEL - NETWORK VISUALIZATION */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs space-y-4 flex flex-col justify-between" id="middle-visualization">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 font-sans">Network Propagation Cascade Map</h2>
          </div>
          {simResult && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span className="font-semibold tracking-wider uppercase">Zoom</span>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="10"
                  value={imageScale}
                  onChange={(e) => setImageScale(Number(e.target.value))}
                  className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="w-8 text-right">{imageScale}%</span>
              </div>
              <button
                onClick={downloadPNG}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900"
                title="Download network visualization image"
              >
                <Download size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Visualizer Frame */}
        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl relative flex items-center justify-center min-h-[580px] overflow-auto" id="visualizer-stage">
          {simulating && (
            <div className="absolute inset-0 bg-slate-100/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3 rounded-xl z-20">
              <RefreshCw size={36} className="animate-spin text-indigo-600" />
              <span className="text-xs text-slate-600 font-semibold">Running realistic stress propagation...</span>
            </div>
          )}

          {!simResult ? (
            <div className="p-8 text-center space-y-3 max-w-sm" id="empty-viz">
              <Network size={40} className="text-slate-300 mx-auto stroke-1" />
              <h3 className="text-xs font-bold text-slate-700">No active simulation run</h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Choose seed shocks in the left panel and click <strong>Run Cascade Simulation</strong> to pre-render the cascading failure states in Python.
              </p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2" id="graph-image-container">
              {simResult.plots[selectedWave] ? (
                <img
                  src={simResult.plots[selectedWave]}
                  alt={`Wave ${selectedWave}`}
                  style={{ width: `${imageScale}%` }}
                  className="h-auto object-contain drop-shadow-sm select-none transition-all duration-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-slate-400 text-xs">Error rendering wave frame</span>
              )}
            </div>
          )}
        </div>

        {/* Wave timeline control bar */}
        {simResult && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2" id="timeline-controls">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-1.5 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                    isPlaying ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-white text-slate-700 border-slate-200"
                  }`}
                  id="play-pause-btn"
                >
                  {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                </button>
                <span className="text-xs font-bold text-slate-800">
                  Wave Stage: <span className="font-mono text-indigo-600">{selectedWave}</span> / {simResult.plots.length - 1}
                </span>
              </div>
              <span className="text-[10px] font-mono font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                {selectedWave === 0 ? "Initial Shock State" : `Propagation wave ${selectedWave}`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max={simResult.plots.length - 1}
                value={selectedWave}
                onChange={(e) => {
                  setSelectedWave(Number(e.target.value));
                  setIsPlaying(false);
                }}
                className="flex-1 accent-indigo-600 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. RIGHT PANEL - DASHBOARD / METRICS OUTPUT */}
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs space-y-5" id="right-dashboard">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart4 size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 font-sans">Simulation Dashboard</h2>
          </div>
          {simResult && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
            >
              <Download size={11} /> Export CSV
            </button>
          )}
        </div>

        {!simResult ? (
          <div className="p-8 text-center text-slate-400 text-xs py-16">
            Dashboard metrics will be compiled after running the simulation.
          </div>
        ) : (
          <div className="space-y-6" id="dashboard-metrics">
            
            {/* KPI Stats Grid */}
            <div className="grid grid-cols-2 gap-3" id="kpi-grid">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Cascade Depth (CD)</span>
                <span className="text-lg font-bold text-slate-900 font-mono">{simResult.cascade_depth} waves</span>
                <span className="text-[9px] text-slate-400 block">Wave of convergence</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Avg Stability (GSI)</span>
                <span className="text-lg font-bold text-slate-900 font-mono">{(simResult.gsi[selectedWave] * 100).toFixed(1)}%</span>
                <span className="text-[9px] text-slate-400 block">At wave {selectedWave}</span>
              </div>
            </div>

            {/* Vulnerable Node count list */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <span>Vulnerable Indicators (S_v &lt; 0.3)</span>
                <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md font-bold">{simResult.vnc[selectedWave]} nodes</span>
              </div>
              
              {simResult.vulnerable_nodes[selectedWave]?.length === 0 ? (
                <div className="text-[10px] text-emerald-600 font-sans font-semibold">No systems vulnerable. System stable.</div>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto" id="vuln-badges">
                  {simResult.vulnerable_nodes[selectedWave]?.map((abbr) => {
                    const nodeObj = nodes.find(n => n.abbr === abbr);
                    const sVal = simResult.history[abbr]?.[selectedWave] ?? 1.0;
                    return (
                      <span
                        key={abbr}
                        title={`${nodeObj?.full_name || ""} — Stability: ${sVal.toFixed(2)}`}
                        className="text-[9px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded"
                      >
                        {abbr}:{(sVal * 100).toFixed(0)}%
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CHART 1: Global Stability Index (GSI) & VNC over Waves */}
            <div className="space-y-1">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Global Stability Index (GSI)
              </h3>
              <div className="h-32 w-full" id="chart-gsi">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getGSILineData()} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="wave" fontSize={9} fontStyle="italic" />
                    <YAxis domain={[0, 1]} fontSize={9} />
                    <Tooltip contentStyle={{ fontSize: 10, background: "white", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="GSI" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 2: Custom Multi-Indicator stability over Waves */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Indicator Stability (S_v) Comparison
                </h3>
                {/* Node selection for comparing chart */}
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !selectedChartNodes.includes(val)) {
                      setSelectedChartNodes([...selectedChartNodes, val]);
                    }
                  }}
                  className="py-0.5 px-1 bg-slate-50 border border-slate-200 rounded text-[9px] font-mono focus:outline-none"
                >
                  <option value="">+ Add Chart Node</option>
                  {nodes.map(n => (
                    <option key={n.abbr} value={n.abbr}>{n.abbr}</option>
                  ))}
                </select>
              </div>

              {/* Selected compare list */}
              {selectedChartNodes.length > 0 && (
                <div className="flex flex-wrap gap-1 pb-1" id="comparison-node-filters">
                  {selectedChartNodes.map((abbr) => (
                    <span key={abbr} className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold bg-indigo-50 text-indigo-700 px-1 rounded">
                      {abbr}
                      <button
                        onClick={() => setSelectedChartNodes(selectedChartNodes.filter(c => c !== abbr))}
                        className="text-indigo-400 hover:text-indigo-700 font-bold ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="h-32 w-full" id="chart-node-compare">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getNodeLineData()} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="wave" fontSize={9} />
                    <YAxis domain={[0, 1]} fontSize={9} />
                    <Tooltip contentStyle={{ fontSize: 10, background: "white", borderRadius: 8 }} />
                    {selectedChartNodes.map((abbr, idx) => {
                      // pick unique stroke color
                      const colors = ["#e11d48", "#16a34a", "#2563eb", "#ea580c", "#9333ea", "#0d9488"];
                      const color = colors[idx % colors.length];
                      return <Line key={abbr} type="monotone" dataKey={abbr} stroke={color} strokeWidth={1.5} dot={{ r: 1 }} />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Domain Spillover Bar Chart */}
            <div className="space-y-1">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Domain Vulnerability Spillover (Wave {selectedWave})
              </h3>
              
              <div className="h-32 w-full" id="chart-spillover">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getSpilloverBarData()} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="domain" fontSize={8} tickLine={false} />
                    <YAxis domain={[0, 100]} fontSize={9} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ fontSize: 10, background: "white", borderRadius: 8 }} formatter={(v) => [`${v}%`, "Vulnerable"]} />
                    <Bar dataKey="fraction" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                      {getSpilloverBarData().map((entry, index) => {
                        // use unique colors matching domain scheme if possible
                        const colors = ["#4169E1", "#2E8B57", "#228B22", "#FF69B4", "#8A2BE2", "#FF8C00", "#D2691E"];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] text-slate-400 text-center">Percentage of domain nodes with stability &lt; 0.3.</p>
            </div>

            {/* SV Table summary */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Node Stability Table
                </h3>
                <input
                  type="text"
                  placeholder="Filter table..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="py-0.5 px-2 bg-slate-50 border border-slate-200 rounded text-[9px] font-sans focus:outline-none w-32"
                />
              </div>

              <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg text-[10px]" id="dashboard-table-container">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-mono text-[9px] border-b border-slate-100 sticky top-0">
                      <th className="p-2">Abbr</th>
                      <th className="p-2">Indicator Name</th>
                      <th className="p-2 text-right">Stability S_v({selectedWave})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {nodes
                      .filter(n => n.abbr.toLowerCase().includes(tableSearch.toLowerCase()) || n.full_name.toLowerCase().includes(tableSearch.toLowerCase()))
                      .map((node) => {
                        const sVal = simResult.history[node.abbr]?.[selectedWave] ?? 1.0;
                        return (
                          <tr key={node.abbr} className="hover:bg-slate-50/50">
                            <td className="p-2 font-mono font-bold">{node.abbr}</td>
                            <td className="p-2 font-medium truncate max-w-[120px]">{node.full_name}</td>
                            <td className={`p-2 text-right font-mono font-bold ${
                              sVal < 0.3 ? "text-rose-600" : sVal < 0.7 ? "text-amber-600" : "text-emerald-700"
                            }`}>
                              {(sVal * 100).toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      </div>

      <ConfirmModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        type={modal.type}
        showCancel={modal.showCancel}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
      />
    </div>
  );
}
