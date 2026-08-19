import React, { useState, useEffect, useMemo } from "react";
import { Domain, NodeIndicator, Edge, SavedNetworkConfig } from "../types";
import { dataService } from "../dataService";
import { Trash2, Edit3, Plus, RefreshCw, Search, ArrowRight, AlertTriangle, CheckCircle, Info, Database, Network, Save, FolderOpen, TrendingUp, Award } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import { auth } from "../firebase";
import { generateStaticNetworkSvg } from "../lib/simulationClient";

export default function ConfigPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [nodes, setNodes] = useState<NodeIndicator[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userObj = auth.currentUser;
    if (userObj) {
      setCurrentUser(userObj);
    } else {
      const localUser = localStorage.getItem("ursa_local_user");
      if (localUser) {
        try {
          setCurrentUser(JSON.parse(localUser));
        } catch (e) {
          console.error(e);
        }
      }
    }

    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (u) {
        setCurrentUser(u);
      } else {
        const localUser = localStorage.getItem("ursa_local_user");
        if (localUser) {
          try {
            setCurrentUser(JSON.parse(localUser));
          } catch (e) {}
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // Success / error feedback
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Custom confirmation modal state
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

  // Tabs for sub-sections
  const [activeTab, setActiveTab] = useState<"domains" | "nodes" | "edges" | "network" | "metrics">("nodes");
  const [metricDomainFilter, setMetricDomainFilter] = useState("all");
  const [metricNodeSearch, setMetricNodeSearch] = useState("");
  const [sortBy, setSortBy] = useState<"id" | "inDegree" | "outDegree" | "betweenness">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [networkScale, setNetworkScale] = useState(80);

  // Saved custom configuration states
  const [savedConfig, setSavedConfig] = useState<SavedNetworkConfig | null>(null);
  const [saveName, setSaveName] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await dataService.getCustomNetworkConfig();
        setSavedConfig(config);
      } catch (err) {
        console.warn("Failed to fetch saved config:", err);
      }
    };
    fetchConfig();
  }, [currentUser, isLocal]);

  // CRUD Form States - Domains
  const [domainForm, setDomainForm] = useState({ id: "", name: "" });
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);

  // CRUD Form States - Nodes
  const [nodeForm, setNodeForm] = useState({
    id: "",
    abbr: "",
    full_name: "",
    domain_id: "1",
    theta: 0.2,
    recovery_rate: 0.05
  });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // CRUD Form States - Edges
  const [edgeForm, setEdgeForm] = useState({ source: "", target: "" });

  // Filters / Search
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeDomainFilter, setNodeDomainFilter] = useState("all");
  const [edgeSearch, setEdgeSearch] = useState("");

  // Subscribing to dataService
  useEffect(() => {
    setLoading(true);
    const unsubDomains = dataService.subscribeDomains((list) => {
      setDomains(list);
    });

    const unsubNodes = dataService.subscribeNodes((list) => {
      setNodes(list);
    });

    const unsubEdges = dataService.subscribeEdges((list) => {
      setEdges(list);
      setLoading(false);
    });

    const unsubStatus = dataService.subscribeStatus((localFlag) => {
      setIsLocal(localFlag);
    });

    return () => {
      unsubDomains();
      unsubNodes();
      unsubEdges();
      unsubStatus();
    };
  }, []);

  // Centrality metrics calculations
  const allMetrics = useMemo(() => {
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    const betweenness: Record<string, number> = {};

    nodes.forEach((n) => {
      inDegree[n.id] = 0;
      outDegree[n.id] = 0;
      betweenness[n.id] = 0;
    });

    edges.forEach((e) => {
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

      if (sigma[s.id] !== undefined) {
        sigma[s.id] = 1;
        d[s.id] = 0;
      }

      const Q: string[] = [s.id]; // Queue

      while (Q.length > 0) {
        const v = Q.shift()!;
        S.push(v);

        // Out neighbors of v
        const neighbors = edges.filter((e) => e.source === v).map((e) => e.target);

        neighbors.forEach((w) => {
          if (d[w] !== undefined) {
            if (d[w] < 0) {
              d[w] = d[v] + 1;
              Q.push(w);
            }
            if (d[w] === d[v] + 1) {
              sigma[w] += sigma[v];
              P[w].push(v);
            }
          }
        });
      }

      const delta: Record<string, number> = {};
      nodes.forEach((w) => (delta[w.id] = 0));

      while (S.length > 0) {
        const w = S.pop()!;
        P[w].forEach((v) => {
          if (sigma[w] > 0) {
            const c = (sigma[v] / sigma[w]) * (1 + delta[w]);
            delta[v] += c;
          }
        });
        if (w !== s.id) {
          betweenness[w] += delta[w];
        }
      }
    });

    return { inDegree, outDegree, betweenness };
  }, [nodes, edges]);

  const overallExtremums = useMemo(() => {
    if (nodes.length === 0) return null;

    const getExtremums = (metric: Record<string, number>) => {
      const entries = Object.entries(metric);
      if (entries.length === 0) return { maxNodes: [] as string[], minNodes: [] as string[], maxVal: 0, minVal: 0 };
      
      let maxVal = -Infinity;
      let minVal = Infinity;
      
      entries.forEach(([_, val]) => {
        if (val > maxVal) maxVal = val;
        if (val < minVal) minVal = val;
      });

      const maxNodes: string[] = [];
      const minNodes: string[] = [];

      // Only mark unique extremums if they do not all have identical values
      if (maxVal !== minVal) {
        entries.forEach(([id, val]) => {
          if (val === maxVal) maxNodes.push(id);
          if (val === minVal) minNodes.push(id);
        });
      }

      return { maxNodes, minNodes, maxVal, minVal };
    };

    return {
      inDegree: getExtremums(allMetrics.inDegree),
      outDegree: getExtremums(allMetrics.outDegree),
      betweenness: getExtremums(allMetrics.betweenness),
    };
  }, [nodes, allMetrics]);

  const filteredMetricsList = useMemo(() => {
    const list = nodes
      .filter((node) => {
        const matchesDomain = metricDomainFilter === "all" || node.domain_id === metricDomainFilter;
        const matchesSearch =
          metricNodeSearch === "" ||
          node.id.toLowerCase().includes(metricNodeSearch.toLowerCase()) ||
          node.full_name.toLowerCase().includes(metricNodeSearch.toLowerCase());
        return matchesDomain && matchesSearch;
      })
      .map((node) => {
        const dName = domains.find((d) => d.id === node.domain_id)?.name || `Domain ${node.domain_id}`;
        return {
          node,
          domainName: dName,
          inDegree: allMetrics.inDegree[node.id] || 0,
          outDegree: allMetrics.outDegree[node.id] || 0,
          betweenness: allMetrics.betweenness[node.id] || 0,
        };
      });

    list.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === "id") {
        valA = a.node.id;
        valB = b.node.id;
      } else {
        valA = a[sortBy];
        valB = b[sortBy];
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [nodes, allMetrics, metricDomainFilter, metricNodeSearch, domains, sortBy, sortOrder]);

  const showFeedback = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Seeding Function (One-time default network seed)

  const handleClearNetwork = () => {
    setModal({
      isOpen: true,
      title: "Clear Entire Network?",
      message: "Are you sure you want to remove ALL domains, nodes, and edges? This action cannot be undone, though you can always re-import the default network later.",
      confirmText: "Clear All",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        closeModal();
        setLoading(true);
        try {
          await dataService.clearNetwork();
          showFeedback("All network domains, nodes, and edges have been removed.", "success");
        } catch (err: any) {
          console.error(err);
          showFeedback(`Failed to clear network: ${err?.message || err}`, "error");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleImportDefaultNetwork = () => {
    setModal({
      isOpen: true,
      title: "Import Default Network?",
      message: "Are you sure you want to seed the default network? This will replace your current domains, nodes, and edges with default default structures!",
      confirmText: "Import",
      cancelText: "Cancel",
      type: "info",
      onConfirm: async () => {
        closeModal();
        setLoading(true);
        try {
          await dataService.importDefaultNetwork();
          showFeedback("Default network structure loaded successfully!", "success");
        } catch (err: any) {
          console.error(err);
          showFeedback(`Seeding failed: ${err?.message || err}`, "error");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // ==========================================
  // DOMAIN CRUD
  // ==========================================
  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainForm.id.trim() || !domainForm.name.trim()) return;

    try {
      const newDomain: Domain = { id: domainForm.id.trim(), name: domainForm.name.trim() };
      await dataService.saveDomain(newDomain);
      setDomainForm({ id: "", name: "" });
      setEditingDomainId(null);
      showFeedback(`Domain ${newDomain.id} saved successfully!`, "success");
    } catch (err: any) {
      showFeedback(`Failed to save domain: ${err.message}`, "error");
    }
  };

  const handleDeleteDomain = async (id: string) => {
    const assignedNodes = nodes.filter((n) => n.domain_id === id);
    if (assignedNodes.length > 0) {
      setModal({
        isOpen: true,
        title: "Cannot Delete Domain",
        message: `Cannot delete domain. There are ${assignedNodes.length} indicators still assigned to it (e.g., ${assignedNodes[0].abbr}). Reassign them first!`,
        confirmText: "OK",
        type: "danger",
        showCancel: false,
        onConfirm: closeModal
      });
      return;
    }

    setModal({
      isOpen: true,
      title: "Delete Domain?",
      message: "Are you sure you want to delete this domain?",
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        closeModal();
        try {
          await dataService.deleteDomain(id);
          showFeedback("Domain deleted successfully!", "success");
        } catch (err: any) {
          showFeedback(`Failed to delete domain: ${err.message}`, "error");
        }
      }
    });
  };

  // ==========================================
  // NODE CRUD
  // ==========================================
  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    const abbr = nodeForm.abbr.trim().toUpperCase();
    if (!abbr || !nodeForm.full_name.trim() || !nodeForm.domain_id) {
      showFeedback("Please fill in all indicator fields!", "error");
      return;
    }

    if (!/^[A-Z0-9_\-]+$/i.test(abbr)) {
      setModal({
        isOpen: true,
        title: "Invalid Abbreviation",
        message: "The indicator abbreviation contains characters that are not allowed. It can only contain letters, numbers, hyphens (-), and underscores (_). Special characters (such as '/') are strictly forbidden to prevent database storage issues. Please modify the abbreviation.",
        confirmText: "OK",
        showCancel: false,
        type: "danger",
        onConfirm: closeModal
      });
      return;
    }

    // Check if we are editing and changing the abbreviation/ID
    if (editingNodeId && editingNodeId !== abbr) {
      // Check if new abbreviation already exists
      const exists = nodes.some((n) => n.id.toUpperCase() === abbr || n.abbr.toUpperCase() === abbr);
      if (exists) {
        showFeedback(`An indicator with abbreviation "${abbr}" already exists!`, "error");
        return;
      }

      try {
        // Find connected edges
        const connectedEdges = edges.filter((edge) => edge.source === editingNodeId || edge.target === editingNodeId);
        
        // Save new node first
        const newNode: NodeIndicator = {
          id: abbr,
          abbr: abbr,
          full_name: nodeForm.full_name.trim(),
          domain_id: nodeForm.domain_id,
          theta: Number(nodeForm.theta),
          recovery_rate: Number(nodeForm.recovery_rate)
        };
        await dataService.saveNode(newNode);

        // Update each connected edge to use the new abbreviation
        for (const oldEdge of connectedEdges) {
          const newSource = oldEdge.source === editingNodeId ? abbr : oldEdge.source;
          const newTarget = oldEdge.target === editingNodeId ? abbr : oldEdge.target;
          const newEdge: Edge = {
            id: `${newSource}-${newTarget}`,
            source: newSource,
            target: newTarget,
            weight: oldEdge.weight
          };
          
          await dataService.saveEdge(newEdge);
          // Delete old edge
          await dataService.deleteEdge(oldEdge.id);
        }

        // Delete old node
        await dataService.deleteNode(editingNodeId);

        setNodeForm({
          id: "",
          abbr: "",
          full_name: "",
          domain_id: domains[0]?.id || "1",
          theta: 0.2,
          recovery_rate: 0.05
        });
        setEditingNodeId(null);
        showFeedback(`Indicator renamed to ${newNode.abbr} and saved successfully!`, "success");
      } catch (err: any) {
        showFeedback(`Failed to rename indicator: ${err.message}`, "error");
      }
      return;
    }

    try {
      const newNode: NodeIndicator = {
        id: abbr,
        abbr: abbr,
        full_name: nodeForm.full_name.trim(),
        domain_id: nodeForm.domain_id,
        theta: Number(nodeForm.theta),
        recovery_rate: Number(nodeForm.recovery_rate)
      };

      await dataService.saveNode(newNode);
      setNodeForm({
        id: "",
        abbr: "",
        full_name: "",
        domain_id: domains[0]?.id || "1",
        theta: 0.2,
        recovery_rate: 0.05
      });
      setEditingNodeId(null);
      showFeedback(`Indicator ${newNode.abbr} saved successfully!`, "success");
    } catch (err: any) {
      showFeedback(`Failed to save indicator: ${err.message}`, "error");
    }
  };

  const handleDeleteNode = async (abbr: string) => {
    // Check if node is part of any edge
    const connectedEdges = edges.filter((e) => e.source === abbr || e.target === abbr);
    const hasEdges = connectedEdges.length > 0;

    setModal({
      isOpen: true,
      title: "Delete Indicator?",
      message: hasEdges
        ? `Indicator ${abbr} is connected to ${connectedEdges.length} edges. Deleting this indicator will also delete all of its connected edges. Proceed?`
        : `Are you sure you want to delete ${abbr}?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        closeModal();
        try {
          await dataService.deleteNode(abbr);
          showFeedback("Indicator deleted successfully!", "success");
        } catch (err: any) {
          showFeedback(`Failed to delete indicator: ${err.message}`, "error");
        }
      }
    });
  };

  // ==========================================
  // EDGE CRUD
  // ==========================================
  const handleAddEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    const { source, target } = edgeForm;
    if (!source || !target) return;
    if (source === target) {
      showFeedback("Source and target indicators cannot be the same!", "error");
      return;
    }

    const edgeId = `${source}_to_${target}`;
    // Check if already exists
    if (edges.some((edge) => edge.id === edgeId)) {
      showFeedback("This directed edge already exists!", "error");
      return;
    }

    try {
      const newEdge: Edge = { id: edgeId, source, target };
      await dataService.saveEdge(newEdge);
      setEdgeForm({ source: "", target: "" });
      showFeedback(`Edge ${source} → ${target} created successfully!`, "success");
    } catch (err: any) {
      showFeedback(`Failed to create edge: ${err.message}`, "error");
    }
  };

  const handleDeleteEdge = async (id: string) => {
    setModal({
      isOpen: true,
      title: "Delete Edge?",
      message: "Are you sure you want to delete this directed connection?",
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        closeModal();
        try {
          await dataService.deleteEdge(id);
          showFeedback("Edge deleted successfully!", "success");
        } catch (err: any) {
          showFeedback(`Failed to delete edge: ${err.message}`, "error");
        }
      }
    });
  };


  // Filtered lists
  const filteredNodes = nodes.filter((node) => {
    const matchesSearch = node.abbr.toLowerCase().includes(nodeSearch.toLowerCase()) || 
                          node.full_name.toLowerCase().includes(nodeSearch.toLowerCase());
    const matchesDomain = nodeDomainFilter === "all" || node.domain_id === nodeDomainFilter;
    return matchesSearch && matchesDomain;
  });

  const filteredEdges = edges.filter((edge) => {
    const sName = nodes.find(n => n.abbr === edge.source)?.full_name || "";
    const tName = nodes.find(n => n.abbr === edge.target)?.full_name || "";
    const query = edgeSearch.toLowerCase();
    return edge.source.toLowerCase().includes(query) ||
           edge.target.toLowerCase().includes(query) ||
           sName.toLowerCase().includes(query) ||
           tName.toLowerCase().includes(query);
  });

  const emailPrefix = currentUser?.email ? currentUser.email.split("@")[0].toLowerCase() : "";
  let modeSuffix = "";
  if (emailPrefix === "user1") {
    modeSuffix = " (Mode A)";
  } else if (emailPrefix === "user2") {
    modeSuffix = " (Mode B)";
  } else if (emailPrefix === "user3") {
    modeSuffix = " (Mode C)";
  } else if (emailPrefix === "admin") {
    modeSuffix = " (URSA)";
  }

  return (
    <div className="space-y-6 py-2 animate-fade-in" id="config-page">
      {/* Top action header */}
      <div className="bg-white p-6 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs" id="config-header">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-950 font-sans flex flex-wrap items-center gap-2">
            Network Configuration{modeSuffix}
            {isLocal ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold font-mono rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Sandbox Mode (Offline Persistent)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold font-mono rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Cloud Connected (Firestore)
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-xs">
            Manage your city resilience model's indicators, domains, and structural dependencies.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleClearNetwork}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            id="clear-network-btn"
          >
            <Trash2 size={13} className={loading ? "opacity-50" : ""} />
            Clear Network
          </button>
          <button
            onClick={() => setIsSaveModalOpen(true)}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            id="save-backup-btn"
          >
            <Save size={13} />
            Save Backup
          </button>
          <button
            onClick={() => setIsLoadModalOpen(true)}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            id="restore-network-btn"
          >
            <FolderOpen size={13} className={loading ? "animate-spin" : ""} />
            Import / Restore
          </button>
        </div>
      </div>

      {/* Global Message Banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs leading-relaxed ${
          message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
        }`} id="feedback-banner">
          {message.type === "success" ? <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />}
          <div>{message.text}</div>
        </div>
      )}

      {/* Main layout with sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="config-layout">
        
        {/* Left section Selector Sidebar */}
        <div className="lg:col-span-3 bg-white p-4 border border-slate-200 rounded-xl space-y-2 h-fit shadow-xs" id="config-sidebar">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Sections</h3>
          <button
            onClick={() => setActiveTab("nodes")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
              activeTab === "nodes" ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>Nodes (Indicators)</span>
            <span className="bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded-md font-mono text-[10px]">
              {nodes.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("edges")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
              activeTab === "edges" ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>Directed Edges</span>
            <span className="bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded-md font-mono text-[10px]">
              {edges.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("domains")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
              activeTab === "domains" ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>Domains</span>
            <span className="bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded-md font-mono text-[10px]">
              {domains.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("network")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
              activeTab === "network" ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Network size={12} className="text-slate-400" />
              <span>Network Map</span>
            </span>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-md font-mono text-[10px]">
              Static
            </span>
          </button>
          <button
            onClick={() => setActiveTab("metrics")}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
              activeTab === "metrics" ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-slate-400" />
              <span>Network Metrics</span>
            </span>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-md font-mono text-[10px]">
              Live
            </span>
          </button>

          <div className="pt-4 border-t border-slate-100 px-2 text-[11px] text-slate-400 leading-relaxed flex items-start gap-1.5">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>The network model requires at least 1 indicator in a domain to visualize it correctly. Use <strong>Import Default Network</strong> to reset or restore configuration.</span>
          </div>
        </div>

        {/* Right Section Content */}
        <div className="lg:col-span-9 space-y-6" id="config-content">
          
          {/* loading overlay if fetching */}
          {loading && (
            <div className="bg-white p-12 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 shadow-xs">
              <RefreshCw size={32} className="animate-spin text-slate-400" />
              <span className="text-slate-500 text-xs font-mono">Synchronizing state with Cloud Firestore...</span>
            </div>
          )}

          {!loading && activeTab === "domains" && (
            <div className="space-y-6" id="domains-tab">
              {/* Form to create/edit domain */}
              <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  {editingDomainId ? "Edit Domain" : "Create New Domain"}
                </h3>
                <form onSubmit={handleSaveDomain} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Domain ID/Number</label>
                    <input
                      type="text"
                      disabled={!!editingDomainId}
                      value={domainForm.id}
                      onChange={(e) => setDomainForm({ ...domainForm, id: e.target.value })}
                      placeholder="e.g. 1"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Domain Name</label>
                    <input
                      type="text"
                      value={domainForm.name}
                      onChange={(e) => setDomainForm({ ...domainForm, name: e.target.value })}
                      placeholder="e.g. Critical Infrastructure"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      {editingDomainId ? "Save" : "Add Domain"}
                    </button>
                    {editingDomainId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDomainId(null);
                          setDomainForm({ id: "", name: "" });
                        }}
                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Domains list */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Domain Registry</h3>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {domains.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">No domains registered. Click "Import Default Network" above to load standard schema.</div>
                  ) : (
                    domains.map((dim) => (
                      <div key={dim.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-700 font-mono font-bold rounded-lg border border-slate-200 text-[10px]">
                            {dim.id}
                          </span>
                          <span className="font-semibold text-slate-900 font-sans">{dim.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingDomainId(dim.id);
                              setDomainForm({ id: dim.id, name: dim.name });
                            }}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-md transition-colors"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteDomain(dim.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === "nodes" && (
            <div className="space-y-6" id="nodes-tab">
              {/* Form to create/edit nodes */}
              <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  {editingNodeId ? "Edit Resilience Indicator Node" : "Create New Resilience Indicator Node"}
                </h3>
                <form onSubmit={handleSaveNode} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Abbreviation (Abbr)</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={nodeForm.abbr}
                        onChange={(e) => setNodeForm({ ...nodeForm, abbr: e.target.value })}
                        placeholder="e.g. BI"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs uppercase font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Full Name</label>
                      <input
                        type="text"
                        value={nodeForm.full_name}
                        onChange={(e) => setNodeForm({ ...nodeForm, full_name: e.target.value })}
                        placeholder="e.g. Built Infrastructure"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Domain Assignment</label>
                      <select
                        value={nodeForm.domain_id}
                        onChange={(e) => setNodeForm({ ...nodeForm, domain_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      >
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>
                            Domain {d.id} — {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        <span>Failure Threshold (θ_v)</span>
                        <span className="font-bold text-slate-800">{Number(nodeForm.theta).toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.00"
                        max="0.40"
                        step="0.01"
                        value={Math.min(0.40, Math.max(0.00, Number(nodeForm.theta)))}
                        onChange={(e) => setNodeForm({ ...nodeForm, theta: Number(e.target.value) })}
                        className="w-full accent-slate-900"
                      />
                      <p className="text-[10px] text-slate-400">Incoming degradation above this threshold (0.00 – 0.40) causes node stability decline.</p>
                    </div>

                    <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        <span>Passive Recovery Rate (r_v)</span>
                        <span className="font-bold text-slate-800">{Number(nodeForm.recovery_rate).toFixed(3)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.00"
                        max="0.10"
                        step="0.005"
                        value={Math.min(0.10, Math.max(0.00, Number(nodeForm.recovery_rate)))}
                        onChange={(e) => setNodeForm({ ...nodeForm, recovery_rate: Number(e.target.value) })}
                        className="w-full accent-slate-900"
                      />
                      <p className="text-[10px] text-slate-400">Recovery added to stability at each wave (0.000 – 0.100).</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {editingNodeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNodeId(null);
                          setNodeForm({
                            id: "",
                            abbr: "",
                            full_name: "",
                            domain_id: domains[0]?.id || "1",
                            theta: 0.2,
                            recovery_rate: 0.05
                          });
                        }}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      {editingNodeId ? "Save Indicator" : "Add Indicator Node"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Indicator registry table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-4 p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider self-start sm:self-center">Indicator Registry</h3>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                    <div className="relative w-full sm:w-48">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={nodeSearch}
                        onChange={(e) => setNodeSearch(e.target.value)}
                        placeholder="Search indicator..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <select
                      value={nodeDomainFilter}
                      onChange={(e) => setNodeDomainFilter(e.target.value)}
                      className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    >
                      <option value="all">All Domains</option>
                      {domains.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-mono text-[10px] uppercase">
                        <th className="p-3 font-semibold">Abbr</th>
                        <th className="p-3 font-semibold">Full Name</th>
                        <th className="p-3 font-semibold">Domain</th>
                        <th className="p-3 font-semibold text-center">Threshold (θ)</th>
                        <th className="p-3 font-semibold text-center">Recovery (r)</th>
                        <th className="p-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredNodes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">No matching indicator nodes found.</td>
                        </tr>
                      ) : (
                        filteredNodes.map((node) => {
                          const dName = domains.find((d) => d.id === node.domain_id)?.name || `Domain ${node.domain_id}`;
                          return (
                            <tr key={node.abbr} className="hover:bg-slate-50/30 transition-colors">
                              <td className="p-3">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-white font-mono font-bold text-xs">
                                  {node.abbr}
                                </span>
                              </td>
                              <td className="p-3 font-medium font-sans">{node.full_name}</td>
                              <td className="p-3">
                                <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-sans">
                                  {node.domain_id} — {dName}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono">{node.theta ?? 0.2}</td>
                              <td className="p-3 text-center font-mono">{node.recovery_rate ?? 0.05}</td>
                              <td className="p-3 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => {
                                      setEditingNodeId(node.id);
                                      setNodeForm({
                                        id: node.id,
                                        abbr: node.abbr,
                                        full_name: node.full_name,
                                        domain_id: node.domain_id,
                                        theta: node.theta ?? 0.2,
                                        recovery_rate: node.recovery_rate ?? 0.05
                                      });
                                    }}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-md transition-colors"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNode(node.abbr)}
                                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === "edges" && (
            <div className="space-y-6" id="edges-tab">
              {/* Form to create edges */}
              <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  Create Directed Causal Influence (Edge)
                </h3>
                <form onSubmit={handleAddEdge} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Source Node (Causes impact)</label>
                    <select
                      value={edgeForm.source}
                      onChange={(e) => setEdgeForm({ ...edgeForm, source: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono"
                    >
                      <option value="">-- Choose Source --</option>
                      {nodes.map((n) => (
                        <option key={n.abbr} value={n.abbr}>
                          {n.abbr} — {n.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="sm:col-span-1 flex justify-center pb-2.5 text-slate-400 hidden sm:flex">
                    <ArrowRight size={16} />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Target Node (Receives impact)</label>
                    <select
                      value={edgeForm.target}
                      onChange={(e) => setEdgeForm({ ...edgeForm, target: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none font-mono"
                    >
                      <option value="">-- Choose Target --</option>
                      {nodes.map((n) => (
                        <option key={n.abbr} value={n.abbr}>
                          {n.abbr} — {n.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} /> Create Edge
                    </button>
                  </div>
                </form>
              </div>

              {/* Edges list table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-4 p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider self-start sm:self-center">Adjacency Edges List</h3>
                  <div className="relative w-full sm:w-64">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={edgeSearch}
                      onChange={(e) => setEdgeSearch(e.target.value)}
                      placeholder="Filter edges by node abbreviation/name..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-mono text-[10px] uppercase">
                        <th className="p-3 font-semibold">Source (u)</th>
                        <th className="p-3 font-semibold text-center">Direction</th>
                        <th className="p-3 font-semibold">Target (v)</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredEdges.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">No matching directed edges found.</td>
                        </tr>
                      ) : (
                        filteredEdges.map((edge) => {
                          const sNode = nodes.find(n => n.abbr === edge.source);
                          const tNode = nodes.find(n => n.abbr === edge.target);
                          const isIntraDomain = sNode && tNode && sNode.domain_id === tNode.domain_id;
                          return (
                            <tr key={edge.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="p-3">
                                <span className="font-mono font-bold text-slate-900">{edge.source}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({sNode?.full_name || "Unknown"})</span>
                              </td>
                              <td className="p-3 text-center text-slate-400">
                                <ArrowRight size={13} className="inline" />
                              </td>
                              <td className="p-3">
                                <span className="font-mono font-bold text-slate-900">{edge.target}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({tNode?.full_name || "Unknown"})</span>
                              </td>
                              <td className="p-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  isIntraDomain ? "bg-red-50 text-red-700 border border-red-100" : "bg-slate-100 text-slate-600"
                                }`}>
                                  {isIntraDomain ? "Intra-Domain" : "Inter-Domain"}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteEdge(edge.id)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === "network" && (
            <div className="space-y-6 animate-fade-in" id="network-tab">
              <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900 font-sans">
                      Resilience Network Architecture Map
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Static visualization of domains, indicator nodes, and inter-indicator influence paths.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span className="font-semibold tracking-wider uppercase">Zoom</span>
                      <input
                        type="range"
                        min="50"
                        max="100"
                        step="10"
                        value={networkScale}
                        onChange={(e) => setNetworkScale(Number(e.target.value))}
                        className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="w-8 text-right">{networkScale}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center min-h-[520px] overflow-auto p-4" id="network-map-stage">
                  {nodes.length === 0 ? (
                    <div className="p-8 text-center space-y-3 max-w-sm">
                      <Network size={40} className="text-slate-300 mx-auto stroke-1" />
                      <h3 className="text-xs font-bold text-slate-700">No nodes configured</h3>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Please import the default network or add indicator nodes to visualize the structure.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <img
                        src={generateStaticNetworkSvg(nodes, edges, domains)}
                        alt="Resilience Network Architecture Map"
                        style={{ width: `${networkScale}%` }}
                        className="h-auto object-contain drop-shadow-xs select-none transition-all duration-200"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === "metrics" && (
            <div className="space-y-6 animate-fade-in" id="metrics-tab">
              {/* Introduction & Formula Explanation */}
              <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <TrendingUp size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-sans">
                      Network Centrality & Vulnerability Metrics
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Live structural analysis of direct dependencies, immediate influence pathways, and cascade transit bottlenecks.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                  <div className="space-y-1 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      In-Degree Centrality
                    </span>
                    <p className="text-slate-500">
                      Counts incoming connections. High In-Degree means the indicator is directly vulnerable to cascade shocks from multiple other nodes.
                    </p>
                    <div className="font-mono text-[10px] text-slate-400 mt-1">
                      Formula: C_D,in(v) = deg_in(v)
                    </div>
                  </div>

                  <div className="space-y-1 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                      Out-Degree Centrality
                    </span>
                    <p className="text-slate-500">
                      Counts outgoing connections. High Out-Degree means shocks hitting this indicator propagate rapidly, directly impacting many child nodes.
                    </p>
                    <div className="font-mono text-[10px] text-slate-400 mt-1">
                      Formula: C_D,out(v) = deg_out(v)
                    </div>
                  </div>

                  <div className="space-y-1 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Betweenness Centrality
                    </span>
                    <p className="text-slate-500">
                      Measures the fraction of shortest paths passing through a node. High Betweenness nodes act as key transition hubs or bottleneck pathways.
                    </p>
                    <div className="font-mono text-[10px] text-slate-400 mt-1">
                      Formula: C_B(v) = ∑ (σ_st(v) / σ_st)
                    </div>
                  </div>
                </div>
              </div>

              {/* Extremums Bento Layout */}
              {nodes.length > 0 && overallExtremums && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="metrics-extremums">
                  {/* In-Degree card */}
                  <div className="bg-white p-4 border border-slate-200 rounded-xl flex flex-col justify-between space-y-4 shadow-2xs">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold animate-pulse">In-Degree Overview</div>
                      <h4 className="text-xs font-bold text-slate-700">Immediate Dependencies</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg space-y-1">
                        <span className="text-[9px] font-bold text-emerald-800 block uppercase tracking-wider font-mono">🏆 Max In-Degree</span>
                        <div className="text-sm font-black text-slate-900 font-mono">
                          {overallExtremums.inDegree.maxVal}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate" title={overallExtremums.inDegree.maxNodes.join(", ")}>
                          {overallExtremums.inDegree.maxNodes.length > 0 ? overallExtremums.inDegree.maxNodes.join(", ") : "None"}
                        </div>
                      </div>
                      <div className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-lg space-y-1">
                        <span className="text-[9px] font-bold text-rose-800 block uppercase tracking-wider font-mono">🔽 Min In-Degree</span>
                        <div className="text-sm font-black text-slate-900 font-mono">
                          {overallExtremums.inDegree.minVal}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate" title={overallExtremums.inDegree.minNodes.join(", ")}>
                          {overallExtremums.inDegree.minNodes.length > 0 ? overallExtremums.inDegree.minNodes.join(", ") : "None"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Out-Degree card */}
                  <div className="bg-white p-4 border border-slate-200 rounded-xl flex flex-col justify-between space-y-4 shadow-2xs">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold animate-pulse">Out-Degree Overview</div>
                      <h4 className="text-xs font-bold text-slate-700">Immediate Influence</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg space-y-1">
                        <span className="text-[9px] font-bold text-emerald-800 block uppercase tracking-wider font-mono">🏆 Max Out-Degree</span>
                        <div className="text-sm font-black text-slate-900 font-mono">
                          {overallExtremums.outDegree.maxVal}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate" title={overallExtremums.outDegree.maxNodes.join(", ")}>
                          {overallExtremums.outDegree.maxNodes.length > 0 ? overallExtremums.outDegree.maxNodes.join(", ") : "None"}
                        </div>
                      </div>
                      <div className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-lg space-y-1">
                        <span className="text-[9px] font-bold text-rose-800 block uppercase tracking-wider font-mono">🔽 Min Out-Degree</span>
                        <div className="text-sm font-black text-slate-900 font-mono">
                          {overallExtremums.outDegree.minVal}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate" title={overallExtremums.outDegree.minNodes.join(", ")}>
                          {overallExtremums.outDegree.minNodes.length > 0 ? overallExtremums.outDegree.minNodes.join(", ") : "None"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Betweenness card */}
                  <div className="bg-white p-4 border border-slate-200 rounded-xl flex flex-col justify-between space-y-4 shadow-2xs">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold animate-pulse">Betweenness Overview</div>
                      <h4 className="text-xs font-bold text-slate-700">Shortest Path Hubs</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg space-y-1">
                        <span className="text-[9px] font-bold text-emerald-800 block uppercase tracking-wider font-mono">🏆 Max Betweenness</span>
                        <div className="text-sm font-black text-slate-900 font-mono">
                          {overallExtremums.betweenness.maxVal.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate" title={overallExtremums.betweenness.maxNodes.join(", ")}>
                          {overallExtremums.betweenness.maxNodes.length > 0 ? overallExtremums.betweenness.maxNodes.join(", ") : "None"}
                        </div>
                      </div>
                      <div className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-lg space-y-1">
                        <span className="text-[9px] font-bold text-rose-800 block uppercase tracking-wider font-mono">🔽 Min Betweenness</span>
                        <div className="text-sm font-black text-slate-900 font-mono">
                          {overallExtremums.betweenness.minVal.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate" title={overallExtremums.betweenness.minNodes.join(", ")}>
                          {overallExtremums.betweenness.minNodes.length > 0 ? overallExtremums.betweenness.minNodes.join(", ") : "None"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters Panel */}
              <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Award size={18} className="text-slate-400" />
                    <h3 className="text-xs font-bold text-slate-800">Filter & Analyze Indicators</h3>
                  </div>

                  {/* Reset Filters when active */}
                  {(metricDomainFilter !== "all" || metricNodeSearch !== "") && (
                    <button
                      onClick={() => {
                        setMetricDomainFilter("all");
                        setMetricNodeSearch("");
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw size={12} className="animate-spin-slow" />
                      Reset Active Filters
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Domain Filter */}
                  <div className="space-y-1">
                    <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Filter by Domain</label>
                    <select
                      value={metricDomainFilter}
                      onChange={(e) => setMetricDomainFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none font-medium text-slate-700"
                    >
                      <option value="all">All Domains (Entire Network)</option>
                      {domains.map((d) => (
                        <option key={d.id} value={d.id}>
                          Domain {d.id} — {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search input */}
                  <div className="space-y-1">
                    <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Search Node ID or Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. BI, Public Finance..."
                        value={metricNodeSearch}
                        onChange={(e) => setMetricNodeSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none font-medium"
                      />
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Table / Grid */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                    Indicator Centrality Metrics ({filteredMetricsList.length} shown)
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    Click column headers to sort. Double click to toggle direction.
                  </span>
                </div>

                {filteredMetricsList.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <TrendingUp size={28} className="text-slate-300 mx-auto stroke-1 animate-pulse" />
                    <h4 className="text-xs font-bold text-slate-600">No matching indicators found</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Try resetting your filters or adjusting your search term.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-100 font-mono text-[9px] uppercase tracking-wider select-none">
                        <tr>
                          {/* Node sorting header */}
                          <th
                            onClick={() => {
                              if (sortBy === "id") {
                                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                              } else {
                                setSortBy("id");
                                setSortOrder("asc");
                              }
                            }}
                            className="p-3 pl-4 cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              Indicator {sortBy === "id" && (sortOrder === "asc" ? "▲" : "▼")}
                            </span>
                          </th>

                          {/* Domain header */}
                          <th className="p-3">Domain</th>

                          {/* In-Degree header */}
                          <th
                            onClick={() => {
                              if (sortBy === "inDegree") {
                                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                              } else {
                                setSortBy("inDegree");
                                setSortOrder("desc");
                              }
                            }}
                            className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              In-Degree Centrality {sortBy === "inDegree" && (sortOrder === "asc" ? "▲" : "▼")}
                            </span>
                          </th>

                          {/* Out-Degree header */}
                          <th
                            onClick={() => {
                              if (sortBy === "outDegree") {
                                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                              } else {
                                setSortBy("outDegree");
                                setSortOrder("desc");
                              }
                            }}
                            className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              Out-Degree Centrality {sortBy === "outDegree" && (sortOrder === "asc" ? "▲" : "▼")}
                            </span>
                          </th>

                          {/* Betweenness header */}
                          <th
                            onClick={() => {
                              if (sortBy === "betweenness") {
                                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                              } else {
                                setSortBy("betweenness");
                                setSortOrder("desc");
                              }
                            }}
                            className="p-3 pr-4 cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              Betweenness Centrality {sortBy === "betweenness" && (sortOrder === "asc" ? "▲" : "▼")}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredMetricsList.map(({ node, domainName, inDegree, outDegree, betweenness }) => {
                          const isGlobalMaxIn = overallExtremums?.inDegree.maxNodes.includes(node.id);
                          const isGlobalMinIn = overallExtremums?.inDegree.minNodes.includes(node.id);

                          const isGlobalMaxOut = overallExtremums?.outDegree.maxNodes.includes(node.id);
                          const isGlobalMinOut = overallExtremums?.outDegree.minNodes.includes(node.id);

                          const isGlobalMaxBtw = overallExtremums?.betweenness.maxNodes.includes(node.id);
                          const isGlobalMinBtw = overallExtremums?.betweenness.minNodes.includes(node.id);

                          const maxIn = overallExtremums?.inDegree.maxVal || 1;
                          const maxOut = overallExtremums?.outDegree.maxVal || 1;
                          const maxBtw = overallExtremums?.betweenness.maxVal || 1;

                          return (
                            <tr key={node.id} className="hover:bg-slate-50/40 transition-colors">
                              {/* ID & Name */}
                              <td className="p-3 pl-4">
                                <div className="font-mono font-bold text-slate-800 text-[13px]">{node.id}</div>
                                <div className="text-[10px] text-slate-400 font-sans line-clamp-1">{node.full_name}</div>
                              </td>

                              {/* Domain Badge */}
                              <td className="p-3">
                                <div className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 max-w-[140px] truncate" title={domainName}>
                                  D{node.domain_id} — {domainName}
                                </div>
                              </td>

                              {/* In-Degree Centrality */}
                              <td className="p-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900 text-xs">{inDegree}</span>
                                    {isGlobalMaxIn && (
                                      <span className="inline-block text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-sans font-bold whitespace-nowrap">🏆 Max</span>
                                    )}
                                    {isGlobalMinIn && (
                                      <span className="inline-block text-[8px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-sans font-bold whitespace-nowrap">🔽 Min</span>
                                    )}
                                  </div>
                                  <div className="w-24 bg-slate-100 rounded-full h-1 relative overflow-hidden hidden sm:block">
                                    <div
                                      className={`h-full rounded-full ${isGlobalMaxIn ? "bg-emerald-500" : isGlobalMinIn ? "bg-rose-400" : "bg-indigo-600"}`}
                                      style={{ width: `${maxIn > 0 ? (inDegree / maxIn) * 100 : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>

                              {/* Out-Degree Centrality */}
                              <td className="p-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900 text-xs">{outDegree}</span>
                                    {isGlobalMaxOut && (
                                      <span className="inline-block text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-sans font-bold whitespace-nowrap">🏆 Max</span>
                                    )}
                                    {isGlobalMinOut && (
                                      <span className="inline-block text-[8px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-sans font-bold whitespace-nowrap font-semibold">🔽 Min</span>
                                    )}
                                  </div>
                                  <div className="w-24 bg-slate-100 rounded-full h-1 relative overflow-hidden hidden sm:block">
                                    <div
                                      className={`h-full rounded-full ${isGlobalMaxOut ? "bg-emerald-500" : isGlobalMinOut ? "bg-rose-400" : "bg-indigo-600"}`}
                                      style={{ width: `${maxOut > 0 ? (outDegree / maxOut) * 100 : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>

                              {/* Betweenness Centrality */}
                              <td className="p-3 pr-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900 text-xs">{betweenness.toFixed(2)}</span>
                                    {isGlobalMaxBtw && (
                                      <span className="inline-block text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-sans font-bold whitespace-nowrap">🏆 Max</span>
                                    )}
                                    {isGlobalMinBtw && (
                                      <span className="inline-block text-[8px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-sans font-bold whitespace-nowrap font-semibold">🔽 Min</span>
                                    )}
                                  </div>
                                  <div className="w-24 bg-slate-100 rounded-full h-1 relative overflow-hidden hidden sm:block">
                                    <div
                                      className={`h-full rounded-full ${isGlobalMaxBtw ? "bg-emerald-500" : isGlobalMinBtw ? "bg-rose-400" : "bg-indigo-600"}`}
                                      style={{ width: `${maxBtw > 0 ? (betweenness / maxBtw) * 100 : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Non-blocking confirmation modal */}
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

      {/* Save Custom Network Configuration Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden p-6 relative space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <Save size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-sans">Save Current Network Configuration</h3>
                <p className="text-[11px] text-slate-400">This will overwrite your previously saved configuration.</p>
              </div>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!saveName.trim()) return;
              setIsSaveModalOpen(false);
              setLoading(true);
              try {
                await dataService.saveCustomNetworkConfig(saveName);
                const config = await dataService.getCustomNetworkConfig();
                setSavedConfig(config);
                showFeedback(`Configuration "${saveName}" saved successfully!`, "success");
                setSaveName("");
              } catch (err: any) {
                showFeedback(`Save failed: ${err.message}`, "error");
              } finally {
                setLoading(false);
              }
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Configuration Name</label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Optimized Transit Model v2"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSaveModalOpen(false);
                    setSaveName("");
                  }}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!saveName.trim()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import / Restore Network Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden p-6 relative space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <FolderOpen size={18} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-sans">Import & Restore Network</h3>
                <p className="text-[11px] text-slate-400">Choose a default network structure or restore your last saved configuration.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Option 1: System Default */}
              <div className="border border-slate-200 hover:border-indigo-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/50 hover:bg-indigo-50/10 transition-all">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    System Default Network
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Resets the entire canvas to the standard city resilience configuration designed for your account profile role.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsLoadModalOpen(false);
                    handleImportDefaultNetwork();
                  }}
                  className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  Load Default
                </button>
              </div>

              {/* Option 2: Saved Config */}
              <div className="border border-slate-200 hover:border-emerald-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/50 hover:bg-emerald-50/10 transition-all">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Last Saved Config
                  </h4>
                  {savedConfig ? (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-emerald-800 line-clamp-1">
                        "{savedConfig.name}"
                      </p>
                      <p className="text-[9px] text-slate-400">
                        Saved: {savedConfig.savedAt}
                      </p>
                      <p className="text-[9px] text-slate-500 leading-relaxed">
                        Restores your custom indicators, domains, weights, and parameters.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic py-2">
                      No saved configuration found. Save your network first.
                    </p>
                  )}
                </div>
                <button
                  disabled={!savedConfig}
                  onClick={() => {
                    setIsLoadModalOpen(false);
                    if (!savedConfig) return;
                    setModal({
                      isOpen: true,
                      title: "Restore Saved Configuration?",
                      message: `Are you sure you want to restore the saved configuration "${savedConfig.name}"? This will replace all active domains, nodes, and edges.`,
                      confirmText: "Restore",
                      cancelText: "Cancel",
                      type: "success",
                      onConfirm: async () => {
                        closeModal();
                        setLoading(true);
                        try {
                          await dataService.restoreCustomNetworkConfig(savedConfig);
                          showFeedback(`Configuration "${savedConfig.name}" restored successfully!`, "success");
                        } catch (err: any) {
                          showFeedback(`Restore failed: ${err.message}`, "error");
                        } finally {
                          setLoading(false);
                        }
                      }
                    });
                  }}
                  className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Save size={12} />
                  Restore Saved
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsLoadModalOpen(false)}
                className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
