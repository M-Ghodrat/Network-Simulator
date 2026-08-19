import { useState } from "react";
import { BookOpen, Network, Shield, AlertTriangle, Layers, PlayCircle, Info, Compass, Award, GitCommit, Heart, TrendingUp } from "lucide-react";
import PracticeLab from "./PracticeLab";

type Tab = "general" | "metrics" | "advanced" | "lab";

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [activeMetricTab, setActiveMetricTab] = useState<"indegree" | "outdegree" | "betweenness">("indegree");

  const videoData = {
    indegree: {
      title: "In-Degree Centrality",
      src: "/indegree.mp4",
      description: "This video explains the concept of <strong>In-Degree Centrality</strong>. It measures true prestige or influence by counting the number of incoming connections directed towards a specific node in the network."
    },
    outdegree: {
      title: "Out-Degree Centrality",
      src: "/outdegree.mp4",
      description: "This video introduces <strong>Out-Degree Centrality</strong>. It measures the outgoing influence of a node by counting the number of connections it initiates towards others in the network."
    },
    betweenness: {
      title: "Betweenness Centrality",
      src: "/betweenness.mp4",
      description: "This video explains the concept of <strong>Betweenness Centrality</strong>. It quantifies the number of times a node acts as a bridge along the shortest path between two other nodes, highlighting critical bottlenecks in the network."
    }
  };

  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 mb-8 bg-slate-100 p-1.5 rounded-xl border border-slate-200" id="learn-navigation-tabs">
      <button
        onClick={() => setActiveTab("general")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
          activeTab === "general" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        General Concepts
      </button>
      <button
        onClick={() => setActiveTab("metrics")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
          activeTab === "metrics" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        <TrendingUp size={14} className={activeTab === "metrics" ? "text-indigo-600" : "text-slate-400"} />
        Network Metrics
      </button>
      <button
        onClick={() => setActiveTab("advanced")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
          activeTab === "advanced" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        <Layers size={14} className={activeTab === "advanced" ? "text-indigo-600" : "text-slate-400"} />
        Advanced Metrics
      </button>
      <button
        onClick={() => setActiveTab("lab")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
          activeTab === "lab" ? "bg-indigo-50 text-indigo-900 shadow-xs border border-indigo-200" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        <Network size={14} className={activeTab === "lab" ? "text-indigo-600 animate-pulse" : "text-slate-400"} />
        Practice Lab
      </button>
    </div>
  );

  const renderMetricsSubTabs = () => (
    <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200 rounded-lg mb-6 max-w-md" id="metrics-sub-tabs">
      <button
        onClick={() => setActiveMetricTab("indegree")}
        className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
          activeMetricTab === "indegree" ? "bg-white text-indigo-700 shadow-2xs border border-slate-100" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        In-Degree
      </button>
      <button
        onClick={() => setActiveMetricTab("outdegree")}
        className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
          activeMetricTab === "outdegree" ? "bg-white text-indigo-700 shadow-2xs border border-slate-100" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        Out-Degree
      </button>
      <button
        onClick={() => setActiveMetricTab("betweenness")}
        className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
          activeMetricTab === "betweenness" ? "bg-white text-indigo-700 shadow-2xs border border-slate-100" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        Betweenness
      </button>
    </div>
  );

  const renderVideoSection = (topicKey: "indegree" | "outdegree" | "betweenness") => {
    const data = videoData[topicKey];
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <PlayCircle size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">
              Video Lesson: {data.title}
            </h2>
          </div>
          <div className="aspect-video w-full max-w-3xl mx-auto rounded-lg overflow-hidden bg-slate-900 border border-slate-200 shadow-sm relative">
            <video 
              key={data.src}
              className="w-full h-full object-cover" 
              controls 
              playsInline
              poster="/video-poster-placeholder.png"
            >
              <source src={data.src} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/80 pointer-events-none -z-10">
               <p className="text-sm font-semibold mb-2">Video not found</p>
               <p className="text-xs">Please upload your video to the public folder as "{data.src.replace('/', '')}"</p>
            </div>
          </div>
          <div className="max-w-3xl mx-auto mt-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <p className="text-slate-700 text-sm leading-relaxed flex gap-3">
              <Info className="shrink-0 text-slate-400 mt-0.5" size={18} />
              <span dangerouslySetInnerHTML={{ __html: data.description }}></span>
            </p>
          </div>
        </div>

        {topicKey === "indegree" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Understanding In-Degree Centrality</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                In a directed network graph, the <strong>in-degree</strong> of a node is the number of edges pointing towards it. In urban resilience modeling, high in-degree indicates that a system depends on many other systems to function. 
              </p>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                <span className="font-bold text-slate-800">Mathematical Definition:</span>
                <div>C_D,in(v) = deg_in(v) = ∑ A_uv</div>
                <div className="text-[10px] text-slate-400 mt-1">Where A_uv is the adjacency matrix representing connection from node u to node v.</div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                For example, an Emergency Healthcare facility (node) might rely on Electricity, Water, Road Access, and Telecommunications. Its high in-degree means it has numerous <em>vulnerability pathways</em>—if any of its incoming dependencies fail, the facility's operations are threatened.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Visual Illustration</h3>
                <p className="text-xs text-slate-500 mb-4">A high in-degree node acts as a convergence point for multiple incoming dependencies, making it vulnerable to incoming cascade shocks.</p>
                <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-100 flex items-center justify-center">
                  <svg viewBox="0 0 400 200" className="w-full max-w-[280px] h-auto">
                    <defs>
                      <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
                      </marker>
                    </defs>
                    <line x1="80" y1="50" x2="200" y2="100" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
                    <line x1="80" y1="150" x2="200" y2="100" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
                    <line x1="320" y1="50" x2="200" y2="100" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />
                    <line x1="320" y1="150" x2="200" y2="100" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow)" />

                    <circle cx="80" cy="50" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="80" y="54" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N1</text>

                    <circle cx="80" cy="150" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="80" y="154" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N2</text>

                    <circle cx="320" cy="50" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="320" y="54" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N3</text>

                    <circle cx="320" cy="150" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="320" y="154" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N4</text>

                    <circle cx="200" cy="100" r="22" fill="#e0e7ff" stroke="#6366f1" strokeWidth="3" />
                    <text x="200" y="104" textAnchor="middle" className="text-xs font-black font-mono text-indigo-700">Target</text>
                    <text x="200" y="145" textAnchor="middle" className="text-[10px] font-bold text-indigo-600">In-Degree = 4</text>
                  </svg>
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-xs text-indigo-900 mt-2">
                <strong>Educational Interpretation:</strong> In classroom networks, high In-Degree reflects academic popularity or contribution worthiness. Other students frequently seek this person's advice.
              </div>
            </div>
          </div>
        )}

        {topicKey === "outdegree" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Understanding Out-Degree Centrality</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Conversely, the <strong>out-degree</strong> of a node is the number of edges pointing away from it. This metric represents the node's influence or potency to cause cascading damage.
              </p>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                <span className="font-bold text-slate-800">Mathematical Definition:</span>
                <div>C_D,out(v) = deg_out(v) = ∑ A_vu</div>
                <div className="text-[10px] text-slate-400 mt-1">Where A_vu is the adjacency matrix representing connection from node v to node u.</div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                A primary Power Substation might provide energy to hospitals, water pumps, traffic lights, and residential areas. Its high out-degree means that a shock to this single facility can rapidly propagate across the city, making it a critical point for cascading failures.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Visual Illustration</h3>
                <p className="text-xs text-slate-500 mb-4">A high out-degree node acts as a primary initiator or distributor of resources, meaning its failure can trigger massive cascading effects.</p>
                <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-100 flex items-center justify-center">
                  <svg viewBox="0 0 400 200" className="w-full max-w-[280px] h-auto">
                    <defs>
                      <marker id="arrow-out" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" />
                      </marker>
                    </defs>
                    <line x1="200" y1="100" x2="80" y2="50" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow-out)" />
                    <line x1="200" y1="100" x2="80" y2="150" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow-out)" />
                    <line x1="200" y1="100" x2="320" y2="50" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow-out)" />
                    <line x1="200" y1="100" x2="320" y2="150" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#arrow-out)" />

                    <circle cx="80" cy="50" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="80" y="54" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N1</text>

                    <circle cx="80" cy="150" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="80" y="154" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N2</text>

                    <circle cx="320" cy="50" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="320" y="54" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N3</text>

                    <circle cx="320" cy="150" r="16" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
                    <text x="320" y="154" textAnchor="middle" className="text-[10px] font-bold font-mono text-slate-600">N4</text>

                    <circle cx="200" cy="100" r="22" fill="#fce7f3" stroke="#ec4899" strokeWidth="3" />
                    <text x="200" y="104" textAnchor="middle" className="text-xs font-black font-mono text-pink-700">Source</text>
                    <text x="200" y="145" textAnchor="middle" className="text-[10px] font-bold text-pink-600">Out-Degree = 4</text>
                  </svg>
                </div>
              </div>
              <div className="bg-pink-50 border border-pink-100 p-3 rounded-lg text-xs text-pink-900 mt-2">
                <strong>Educational Interpretation:</strong> In collaborative discussion groups, high Out-Degree highlights highly active, supportive students who initiate interactions and reply frequently.
              </div>
            </div>
          </div>
        )}

        {topicKey === "betweenness" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Understanding Betweenness Centrality</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong>Betweenness centrality</strong> measures how often a node acts as a bridge along the shortest path between two other nodes. Nodes with high betweenness exert significant control over the network's flow.
              </p>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 font-mono text-xs text-slate-700 space-y-1">
                <span className="font-bold text-slate-800">Mathematical Definition:</span>
                <div>C_B(v) = ∑ [ σ_st(v) / σ_st ] (for s ≠ v ≠ t)</div>
                <div className="text-[10px] text-slate-400 mt-1">Where σ_st is total shortest paths from s to t, and σ_st(v) is those passing through v.</div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                In an urban context, a major highway intersection or a central telecommunications hub might not have the highest number of direct connections (degree), but it connects disparate parts of the city. If a high-betweenness node fails, it can fracture the network into isolated sub-networks, severely hampering recovery efforts.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-2">Visual Illustration</h3>
                <p className="text-xs text-slate-500 mb-4">The highlighted central node acts as a vital transition bridge connecting two otherwise disconnected communities.</p>
                <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-100 flex items-center justify-center">
                  <svg viewBox="0 0 400 200" className="w-full max-w-[280px] h-auto">
                    {/* Community 1 */}
                    <line x1="60" y1="60" x2="130" y2="70" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line x1="60" y1="140" x2="130" y2="130" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line x1="60" y1="60" x2="60" y2="140" stroke="#cbd5e1" strokeWidth="1.5" />
                    
                    {/* Connect to Bridge */}
                    <line x1="130" y1="70" x2="200" y2="100" stroke="#6366f1" strokeWidth="2.5" />
                    <line x1="130" y1="130" x2="200" y2="100" stroke="#6366f1" strokeWidth="2.5" />
                    
                    {/* Connect to Community 2 */}
                    <line x1="200" y1="100" x2="270" y2="70" stroke="#6366f1" strokeWidth="2.5" />
                    <line x1="200" y1="100" x2="270" y2="130" stroke="#6366f1" strokeWidth="2.5" />
                    
                    {/* Community 2 */}
                    <line x1="270" y1="70" x2="340" y2="60" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line x1="270" y1="130" x2="340" y2="140" stroke="#cbd5e1" strokeWidth="1.5" />
                    <line x1="340" y1="60" x2="340" y2="140" stroke="#cbd5e1" strokeWidth="1.5" />

                    <circle cx="60" cy="60" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle cx="60" cy="140" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle cx="130" cy="70" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle cx="130" cy="130" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />

                    <circle cx="270" cy="70" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle cx="270" cy="130" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle cx="340" cy="60" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
                    <circle cx="340" cy="140" r="12" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />

                    <circle cx="200" cy="100" r="18" fill="#dbeafe" stroke="#3b82f6" strokeWidth="3" className="animate-pulse" />
                    <text x="200" y="104" textAnchor="middle" className="text-[9px] font-black font-mono text-blue-700">Bridge</text>
                    <text x="200" y="145" textAnchor="middle" className="text-[10px] font-bold text-blue-600">High Betweenness</text>
                  </svg>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-900 mt-2">
                <strong>Educational Interpretation:</strong> In learning groups, high betweenness nodes are information brokers. They connect disparate peer clusters and coordinate inter-group knowledge sharing.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAdvancedContent = () => {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-xs text-center space-y-6 animate-in fade-in zoom-in-95 duration-300" id="advanced-coming-soon">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-2xs animate-pulse">
          <Layers size={28} />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg font-bold text-slate-900">Advanced Centrality Metrics</h3>
          <p className="text-xs text-indigo-600 font-mono font-bold uppercase tracking-wider">Coming Soon</p>
          <p className="text-slate-500 text-xs leading-relaxed">
            We are actively developing the theoretical proofs, mathematical formulations, and interactive web simulators for advanced network dynamics, including <strong>Eigenvector Centrality</strong>, <strong>Katz Centrality</strong>, <strong>PageRank</strong>, and <strong>HITS Hubs & Authorities</strong>.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-100 max-w-sm mx-auto flex items-center justify-center gap-3 text-[10px] text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Theoretical Proofs
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Matrix Solvers
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Interactive Graph Demos
          </span>
        </div>
      </div>
    );
  };

  const renderGeneralContent = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6" id="general-concepts-card">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Network size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">
              Foundations of Network Science
            </h2>
            <p className="text-xs text-slate-400 font-medium">Core terminology, mathematical definitions, and structural elements of graphs.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Graph Section */}
          <div className="space-y-2 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide font-mono block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              The Graph (G)
            </span>
            <p className="text-xs text-slate-500 leading-relaxed">
              A mathematical representation of a network, formally defined as <strong>G = (V, E)</strong>. It maps the overall structure of interconnected elements, showcasing how individual components relate to one another as a cohesive system.
            </p>
          </div>

          {/* Vertices/Nodes Section */}
          <div className="space-y-2 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide font-mono block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Vertices & Nodes (V)
            </span>
            <p className="text-xs text-slate-500 leading-relaxed">
              The individual structural entities, variables, or actors within a network. In our urban resilience model, vertices represent core physical or economic infrastructure layers such as energy, water, road access, and telecommunications.
            </p>
          </div>

          {/* Edges/Links Section */}
          <div className="space-y-2 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide font-mono block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
              Edges & Links (E)
            </span>
            <p className="text-xs text-slate-500 leading-relaxed">
              The pairwise connections indicating relationships or flows of influence between nodes. In directed networks, an edge <strong>(u, v)</strong> goes from node u to node v, signifying that a state change or failure in u directly propagates to and influences v.
            </p>
          </div>
        </div>

        {/* Minimalist graph SVG visualization */}
        <div className="bg-slate-50/30 border border-slate-100 rounded-xl p-6 flex flex-col items-center justify-center space-y-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Standard Directed Graph Visual Model</span>
          <svg viewBox="0 0 500 180" className="w-full max-w-[360px] h-auto">
            <defs>
              <marker id="arrow-gen" viewBox="0 0 10 10" refX="21" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
              </marker>
            </defs>
            <line x1="120" y1="90" x2="250" y2="40" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow-gen)" />
            <line x1="120" y1="90" x2="250" y2="140" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow-gen)" />
            <line x1="250" y1="40" x2="380" y2="90" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow-gen)" />
            <line x1="250" y1="140" x2="380" y2="90" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow-gen)" />

            <circle cx="120" cy="90" r="18" fill="#fff" stroke="#6366f1" strokeWidth="2" />
            <text x="120" y="93" textAnchor="middle" className="text-[10px] font-mono font-bold text-indigo-600">Node A</text>

            <circle cx="250" cy="40" r="18" fill="#fff" stroke="#10b981" strokeWidth="2" />
            <text x="250" y="43" textAnchor="middle" className="text-[10px] font-mono font-bold text-emerald-600">Node B</text>

            <circle cx="250" cy="140" r="18" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
            <text x="250" y="143" textAnchor="middle" className="text-[10px] font-mono font-bold text-slate-600">Node C</text>

            <circle cx="380" cy="90" r="18" fill="#fff" stroke="#ec4899" strokeWidth="2" />
            <text x="380" y="93" textAnchor="middle" className="text-[10px] font-mono font-bold text-pink-600">Node D</text>
          </svg>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 animate-fade-in" id="learn-page-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-sm relative overflow-hidden" id="learn-header-banner">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="bg-slate-700/60 text-slate-200 text-xs px-2.5 py-1 rounded-full font-mono uppercase tracking-widest">
            Module 1: Foundations
          </span>
          <h1 className="text-3xl font-bold tracking-tight font-sans">
            Network Centrality Suite
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Learn mathematical modeling, network theories, and educational social network metrics using custom-designed interactive formulas, illustrations, and benchmark graph examples.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12 select-none" id="learn-bg-icon">
          <Network size={280} />
        </div>
      </div>

      {renderTabs()}

      <div className="min-h-[400px]">
        {activeTab === "general" ? (
          renderGeneralContent()
        ) : activeTab === "lab" ? (
          <PracticeLab />
        ) : activeTab === "advanced" ? (
          renderAdvancedContent()
        ) : (
          <div className="space-y-6">
            {renderMetricsSubTabs()}
            {renderVideoSection(activeMetricTab)}
          </div>
        )}
      </div>
    </div>
  );
}
