import { useState } from "react";
import { BookOpen, Network, Shield, AlertTriangle, Layers, PlayCircle, Info } from "lucide-react";

type Tab = "general" | "indegree" | "outdegree" | "betweenness";

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");

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
    <div className="flex flex-wrap gap-2 mb-8 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
      <button
        onClick={() => setActiveTab("general")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
          activeTab === "general" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        General Concepts
      </button>
      <button
        onClick={() => setActiveTab("indegree")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
          activeTab === "indegree" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        <PlayCircle size={16} className={activeTab === "indegree" ? "text-indigo-600" : "text-slate-400"} />
        In-Degree
      </button>
      <button
        onClick={() => setActiveTab("outdegree")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
          activeTab === "outdegree" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        <PlayCircle size={16} className={activeTab === "outdegree" ? "text-indigo-600" : "text-slate-400"} />
        Out-Degree
      </button>
      <button
        onClick={() => setActiveTab("betweenness")}
        className={`flex-1 min-w-[120px] px-4 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
          activeTab === "betweenness" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        }`}
      >
        <PlayCircle size={16} className={activeTab === "betweenness" ? "text-indigo-600" : "text-slate-400"} />
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
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Understanding In-Degree Centrality</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              In a directed network graph, the <strong>in-degree</strong> of a node is the number of edges pointing towards it. In urban resilience modeling, high in-degree indicates that a system depends on many other systems to function. 
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              For example, an Emergency Healthcare facility (node) might rely on Electricity, Water, Road Access, and Telecommunications. Its high in-degree means it has numerous <em>vulnerability pathways</em>—if any of its incoming dependencies fail, the facility's operations are threatened.
            </p>
          </div>
        )}

        {topicKey === "outdegree" && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Understanding Out-Degree Centrality</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Conversely, the <strong>out-degree</strong> of a node is the number of edges pointing away from it. This metric represents the node's influence or potency to cause cascading damage.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              A primary Power Substation might provide energy to hospitals, water pumps, traffic lights, and residential areas. Its high out-degree means that a shock to this single facility can rapidly propagate across the city, making it a critical point for cascading failures.
            </p>
          </div>
        )}

        {topicKey === "betweenness" && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Understanding Betweenness Centrality</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong>Betweenness centrality</strong> measures how often a node acts as a bridge along the shortest path between two other nodes. Nodes with high betweenness exert significant control over the network's flow.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              In an urban context, a major highway intersection or a central telecommunications hub might not have the highest number of direct connections (degree), but it connects disparate parts of the city. If a high-betweenness node fails, it can fracture the network into isolated sub-networks, severely hampering recovery efforts.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderGeneralContent = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="basics-grid">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4" id="graph-theory-intro">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Network size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">
              What is a Network Graph?
            </h2>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            In network science, any system can be represented as a <strong>Graph</strong> consisting of <strong>Nodes</strong> (vertices) connected by <strong>Edges</strong> (links). 
          </p>
          <ul className="space-y-2 text-sm text-slate-600 pl-1">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5">•</span>
              <span><strong>Nodes:</strong> Individual entities or actors within the system. In URSA, nodes represent 40 core resilience indicators (e.g., Water Supply, Energy, Public Finance).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5">•</span>
              <span><strong>Directed Edges:</strong> Connections representing causal influence or dependencies from one node to another. An edge from <em>Energy (EN)</em> to <em>Water (WR)</em> indicates that a power failure directly degrades water pumping capacity.</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4" id="resilience-intro">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Shield size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">
              Urban Resilience & Cascades
            </h2>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            <strong>Urban Resilience</strong> is the capacity of cities to survive, adapt, and grow no matter what kinds of chronic stresses and acute shocks they experience.
          </p>
          <ul className="space-y-2 text-sm text-slate-600 pl-1">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold mt-0.5">•</span>
              <span><strong>Acute Shocks:</strong> Sudden, sharp events that threaten a city (e.g., floods, cyberattacks, financial collapses).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold mt-0.5">•</span>
              <span><strong>Cascading Failures:</strong> A process where a shock to a single node triggers a chain reaction, progressively disabling downstream connected systems. The URSA Simulator models how these cascades propagate through adaptive edge weights.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6" id="dimensions-section">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers size={20} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 font-sans">
            The 7 Core Dimensions of URSA
          </h2>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          The URSA framework groups 40 core resilience indicators into 7 main dimensions of urban sustainability. Edges can connect indicators within the same dimension (intra-domain) or across different dimensions (inter-domain).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="dimensions-grid">
          {[
            { id: 1, name: "Critical Infrastructure", desc: "Energy, Water, Transport, Built & Digital infrastructure services." },
            { id: 2, name: "Economics", desc: "Financial robustness, Diverse livelihoods, Business environments, Assets." },
            { id: 3, name: "Environment", desc: "Air quality, Decarbonization, Flood control, Ecology, Heat stress mitigation." },
            { id: 4, name: "Health & Well-being", desc: "Quality healthcare access, Public health systems, Emergency care services." },
            { id: 5, name: "Institutional", desc: "Education, Inclusivity, Rule of Law, Cross-sector collaboration & Knowledge." },
            { id: 6, name: "Leadership & Strategy", desc: "Governance, Integrated planning, and Disaster Management systems." },
            { id: 7, name: "Social & Demographic", desc: "Social cohesion, Comprehensive security, Community prepared engagement." }
          ].map((dim) => (
            <div key={dim.id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1" id={`dim-card-${dim.id}`}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-indigo-100 text-indigo-700 text-[10px] font-mono font-bold rounded-full">
                  {dim.id}
                </span>
                <h4 className="text-sm font-semibold text-slate-900 truncate">{dim.name}</h4>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">{dim.desc}</p>
            </div>
          ))}
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
            Urban Resilience Network Science
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Welcome to the URSA educational suite. Explore general network theory concepts, or dive into specific topics like Centrality metrics using our video lessons below.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12 select-none" id="learn-bg-icon">
          <Network size={280} />
        </div>
      </div>

      {renderTabs()}

      <div className="min-h-[400px]">
        {activeTab === "general" ? renderGeneralContent() : renderVideoSection(activeTab)}
      </div>
    </div>
  );
}
