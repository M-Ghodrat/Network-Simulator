import React, { useState, useEffect } from "react";
import { Domain, NodeIndicator, Edge } from "../types";
import { dataService } from "../dataService";
import { Trash2, Edit3, Plus, RefreshCw, Search, ArrowRight, AlertTriangle, CheckCircle, Info, Database } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

export default function ConfigPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [nodes, setNodes] = useState<NodeIndicator[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(false);

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
  const [activeTab, setActiveTab] = useState<"domains" | "nodes" | "edges">("nodes");

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
    recovery_rate: 0.01
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
        recovery_rate: 0.01
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

  return (
    <div className="space-y-6 py-2 animate-fade-in" id="config-page">
      {/* Top action header */}
      <div className="bg-white p-6 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs" id="config-header">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-950 font-sans flex flex-wrap items-center gap-2">
            Network Configuration
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
<div className="flex items-center gap-3">
          <button
            onClick={handleClearNetwork}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            id="clear-network-btn"
          >
            <Trash2 size={14} className={loading ? "opacity-50" : ""} />
            Clear Network
          </button>
          <button
            onClick={handleImportDefaultNetwork}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            id="seed-network-btn"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Import Default Network
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
                        disabled={!!editingNodeId}
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
                        <span className="font-bold text-slate-800">{nodeForm.theta}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.3"
                        step="0.01"
                        value={nodeForm.theta}
                        onChange={(e) => setNodeForm({ ...nodeForm, theta: Number(e.target.value) })}
                        className="w-full accent-slate-900"
                      />
                      <p className="text-[10px] text-slate-400">Incoming degradation above this threshold causes node stability decline.</p>
                    </div>

                    <div className="p-3 bg-slate-50/50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        <span>Passive Recovery Rate (r_v)</span>
                        <span className="font-bold text-slate-800">{nodeForm.recovery_rate}</span>
                      </div>
                      <input
                        type="range"
                        min="0.00"
                        max="0.10"
                        step="0.005"
                        value={nodeForm.recovery_rate}
                        onChange={(e) => setNodeForm({ ...nodeForm, recovery_rate: Number(e.target.value) })}
                        className="w-full accent-slate-900"
                      />
                      <p className="text-[10px] text-slate-400">Recovery added to stability at each wave.</p>
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
                            recovery_rate: 0.01
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
                              <td className="p-3 font-mono font-bold text-slate-900">{node.abbr}</td>
                              <td className="p-3 font-medium font-sans">{node.full_name}</td>
                              <td className="p-3">
                                <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-sans">
                                  {node.domain_id} — {dName}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono">{node.theta ?? 0.2}</td>
                              <td className="p-3 text-center font-mono">{node.recovery_rate ?? 0.01}</td>
                              <td className="p-3 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => {
                                      setEditingNodeId(node.abbr);
                                      setNodeForm({
                                        id: node.abbr,
                                        abbr: node.abbr,
                                        full_name: node.full_name,
                                        domain_id: node.domain_id,
                                        theta: node.theta ?? 0.2,
                                        recovery_rate: node.recovery_rate ?? 0.01
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
    </div>
  );
}
