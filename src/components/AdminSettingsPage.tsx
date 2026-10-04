import React, { useState, useEffect, FormEvent } from "react";
import { dataService } from "../dataService";
import { 
  SimulationLimitsConfig, 
  DEFAULT_SIMULATION_LIMITS, 
  ParameterLimit, 
  AppUserAccount, 
  AcademicSeason, 
  DEFAULT_USER_ACCOUNTS,
  LearnVisibilityConfig,
  DEFAULT_LEARN_VISIBILITY
} from "../types";
import {
  SlidersHorizontal,
  Save,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
  Zap,
  Shield,
  Clock,
  UserPlus,
  Users,
  Key,
  Calendar,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Search,
  Check,
  X,
  BookOpen,
  TrendingUp,
  Cpu,
  PlayCircle,
  Network,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import ConfirmModal from "./ConfirmModal";

export default function AdminSettingsPage() {
  const [adminTab, setAdminTab] = useState<"users" | "limits" | "learn">("users");

  // Limits State
  const [limits, setLimits] = useState<SimulationLimitsConfig>({ ...DEFAULT_SIMULATION_LIMITS });
  const [initialLimits, setInitialLimits] = useState<SimulationLimitsConfig>({ ...DEFAULT_SIMULATION_LIMITS });
  const [loadingLimits, setLoadingLimits] = useState(false);
  const [limitsSaveSuccess, setLimitsSaveSuccess] = useState(false);
  const [showResetLimitsModal, setShowResetLimitsModal] = useState(false);

  // Learn Section Visibility State
  const [learnVisibility, setLearnVisibility] = useState<LearnVisibilityConfig>({ ...DEFAULT_LEARN_VISIBILITY });
  const [initialLearnVisibility, setInitialLearnVisibility] = useState<LearnVisibilityConfig>({ ...DEFAULT_LEARN_VISIBILITY });
  const [loadingLearnVisibility, setLoadingLearnVisibility] = useState(false);
  const [learnSaveSuccess, setLearnSaveSuccess] = useState(false);
  const [showResetLearnModal, setShowResetLearnModal] = useState(false);

  // User Accounts State
  const [accounts, setAccounts] = useState<AppUserAccount[]>([...DEFAULT_USER_ACCOUNTS]);
  const [searchUser, setSearchUser] = useState("");
  const [filterTerm, setFilterTerm] = useState("All");

  // New User Form State
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newSeason, setNewSeason] = useState<AcademicSeason>("Summer");
  const [newYear, setNewYear] = useState<number>(2026);
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = useState<string | null>(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editSeason, setEditSeason] = useState<AcademicSeason>("Summer");
  const [editYear, setEditYear] = useState<number>(2026);
  const [editPassword, setEditPassword] = useState<string>("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<AppUserAccount | null>(null);

  // Test slider states for interactive preview
  const [previewValues, setPreviewValues] = useState<Record<string, number>>({
    T: 10,
    gamma: 1.5,
    theta: 0.2,
    rv: 0.05,
    epsilon: 0.001,
    shockIntensity: 0.4,
    interventionStrength: 0.3
  });

  useEffect(() => {
    const unsubLimits = dataService.subscribeLimits((currentLimits) => {
      setLimits(currentLimits);
      setInitialLimits(currentLimits);
      setPreviewValues({
        T: currentLimits.T.defaultVal,
        gamma: currentLimits.gamma.defaultVal,
        theta: currentLimits.theta.defaultVal,
        rv: currentLimits.rv.defaultVal,
        epsilon: currentLimits.epsilon.defaultVal,
        shockIntensity: currentLimits.shockIntensity.defaultVal,
        interventionStrength: currentLimits.interventionStrength.defaultVal
      });
    });

    const unsubAccounts = dataService.subscribeAccounts((currentAccounts) => {
      setAccounts(currentAccounts);
    });

    const unsubLearn = dataService.subscribeLearnVisibility((curVisibility) => {
      setLearnVisibility(curVisibility);
      setInitialLearnVisibility(curVisibility);
    });

    return () => {
      unsubLimits();
      unsubAccounts();
      unsubLearn();
    };
  }, []);

  const seasons: AcademicSeason[] = ["Spring", "Summer", "Fall", "Winter"];
  const availableYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032];

  // Handle Add New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    const validation = dataService.validateUsername(newUsername);
    if (!validation.valid) {
      setUserFormError(validation.error || "Please enter a valid username.");
      return;
    }
    const cleanUsername = validation.clean;

    if (!newPassword.trim()) {
      setUserFormError("Password is required.");
      return;
    }

    if (newPassword.trim().length < 4) {
      setUserFormError("Password must be at least 4 characters.");
      return;
    }

    // Capture target payload before clearing
    const targetUsername = cleanUsername;
    const targetPassword = newPassword.trim();
    const targetRole = newRole;
    const targetSeason = newSeason;
    const targetYear = newYear;

    // Check if account genuinely existed prior to submission
    const alreadyExisted = accounts.some(
      (a) =>
        a.username.toLowerCase() === targetUsername.toLowerCase() ||
        a.id.toLowerCase() === targetUsername.toLowerCase()
    );

    // Clear everything from the form immediately when hitting the add user button
    setNewUsername("");
    setNewPassword("");
    setIsSubmittingUser(true);

    try {
      if (targetRole === "admin") {
        await dataService.createUserAccount({
          id: targetUsername,
          username: targetUsername,
          password: targetPassword,
          role: "admin"
        }, true);
        
        if (alreadyExisted) {
          setUserFormSuccess(`Administrator '${targetUsername}' updated successfully.`);
        } else {
          setUserFormSuccess(`Administrator '${targetUsername}' created successfully.`);
        }
      } else {
        const calculatedTerm = `${targetSeason} ${targetYear}`;
        await dataService.createUserAccount({
          id: targetUsername,
          username: targetUsername,
          password: targetPassword,
          term: calculatedTerm,
          season: targetSeason,
          year: targetYear,
          role: "user"
        }, true);

        if (alreadyExisted) {
          setUserFormSuccess(`Account '${targetUsername}' updated with term '${calculatedTerm}'.`);
        } else {
          setUserFormSuccess(`User '${targetUsername}' registered successfully for term '${calculatedTerm}'.`);
        }
      }

      setTimeout(() => setUserFormSuccess(null), 5000);
    } catch (err: any) {
      // Restore inputs on failure so admin does not lose entered data
      setNewUsername(targetUsername);
      setNewPassword(targetPassword);
      setUserFormError(err.message || "Failed to create user account.");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Start editing a user
  const handleStartEdit = (account: AppUserAccount) => {
    setEditingUserId(account.id);
    setEditSeason(account.season || "Summer");
    setEditYear(account.year || 2026);
    setEditPassword(account.password);
    setShowEditPassword(false);
  };

  // Save edit user
  const handleSaveEdit = async (account: AppUserAccount) => {
    const updatedTerm = `${editSeason} ${editYear}`;
    try {
      await dataService.updateUserAccount(account.id, {
        term: updatedTerm,
        season: editSeason,
        year: editYear,
        password: editPassword.trim() || account.password
      });
      setEditingUserId(null);
    } catch (err) {
      console.error("Failed to update user account:", err);
    }
  };

  // Confirm delete user
  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    try {
      await dataService.deleteUserAccount(deleteTargetUser.id);
      setDeleteTargetUser(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete user account.");
    }
  };

  // Limits Handlers
  const handleFieldChange = (
    key: keyof SimulationLimitsConfig,
    field: keyof ParameterLimit,
    value: any
  ) => {
    setLimits((prev) => {
      const updatedParam = { ...prev[key], [field]: value };
      return { ...prev, [key]: updatedParam };
    });
    setLimitsSaveSuccess(false);
  };

  const handleSaveLimits = async () => {
    for (const key of Object.keys(limits) as (keyof SimulationLimitsConfig)[]) {
      const p = limits[key];
      if (p.min >= p.max) {
        alert(`Invalid range for ${p.label}: Minimum value must be strictly less than Maximum value.`);
        return;
      }
      if (p.step <= 0) {
        alert(`Invalid step for ${p.label}: Step must be greater than zero.`);
        return;
      }
      if (p.defaultVal < p.min || p.defaultVal > p.max) {
        alert(`Invalid default for ${p.label}: Default value (${p.defaultVal}) must be within [${p.min}, ${p.max}].`);
        return;
      }
    }

    setLoadingLimits(true);
    try {
      await dataService.saveSimulationLimits(limits);
      setInitialLimits(limits);
      setLimitsSaveSuccess(true);
      setTimeout(() => setLimitsSaveSuccess(false), 4000);
    } catch (e) {
      console.error("Failed to save simulation limits:", e);
      alert("Failed to save parameter limits to system database.");
    } finally {
      setLoadingLimits(false);
    }
  };

  const handleConfirmResetLimits = async () => {
    setLoadingLimits(true);
    try {
      await dataService.resetSimulationLimits();
      setLimits({ ...DEFAULT_SIMULATION_LIMITS });
      setInitialLimits({ ...DEFAULT_SIMULATION_LIMITS });
      setShowResetLimitsModal(false);
      setLimitsSaveSuccess(true);
      setTimeout(() => setLimitsSaveSuccess(false), 4000);
    } catch (e) {
      console.error("Failed to reset simulation limits:", e);
    } finally {
      setLoadingLimits(false);
    }
  };

  const isLimitsDirty = JSON.stringify(limits) !== JSON.stringify(initialLimits);

  // Learn Visibility Handlers
  const handleToggleLearnSection = (key: keyof LearnVisibilityConfig) => {
    setLearnVisibility((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSetAllLearnSections = (visible: boolean) => {
    setLearnVisibility({
      general: visible,
      network_concepts: visible,
      simulation_concepts: visible,
      videos: visible,
      lab: visible
    });
  };

  const handleSaveLearnVisibility = async () => {
    setLoadingLearnVisibility(true);
    try {
      await dataService.saveLearnVisibility(learnVisibility);
      setInitialLearnVisibility({ ...learnVisibility });
      setLearnSaveSuccess(true);
      setTimeout(() => setLearnSaveSuccess(false), 4000);
    } catch (e) {
      console.error("Failed to save learn visibility:", e);
      alert("Failed to save learn section visibility settings.");
    } finally {
      setLoadingLearnVisibility(false);
    }
  };

  const handleConfirmResetLearnVisibility = async () => {
    setLoadingLearnVisibility(true);
    try {
      await dataService.resetLearnVisibility();
      setLearnVisibility({ ...DEFAULT_LEARN_VISIBILITY });
      setInitialLearnVisibility({ ...DEFAULT_LEARN_VISIBILITY });
      setShowResetLearnModal(false);
      setLearnSaveSuccess(true);
      setTimeout(() => setLearnSaveSuccess(false), 4000);
    } catch (e) {
      console.error("Failed to reset learn visibility:", e);
    } finally {
      setLoadingLearnVisibility(false);
    }
  };

  const isLearnVisibilityDirty = JSON.stringify(learnVisibility) !== JSON.stringify(initialLearnVisibility);
  const visibleLearnCount = Object.values(learnVisibility).filter(Boolean).length;

  const learnSectionsConfig: {
    key: keyof LearnVisibilityConfig;
    title: string;
    subtitle: string;
    icon: any;
    color: string;
    countBadge: string;
    description: string;
    topics: string[];
  }[] = [
    {
      key: "general",
      title: "General Concepts",
      subtitle: "Graph fundamentals & formal mathematical definitions",
      icon: BookOpen,
      color: "text-blue-400",
      countBadge: "Theory & Definitions",
      description: "Foundational graph theory entities: Graph G=(V,E), Vertices, Directed Links, Adjacency Matrix, Degree Distributions, Density, and Topological Foundations.",
      topics: ["Graph G=(V,E)", "Vertices & Capacity", "Directed Coupling Edges", "Adjacency Matrix", "Density & Diameter"]
    },
    {
      key: "network_concepts",
      title: "Network Concepts",
      subtitle: "Topological metrics & network structural formulas",
      icon: TrendingUp,
      color: "text-indigo-400",
      countBadge: "Structural Metrics",
      description: "Structural metric calculators: In-Degree, Out-Degree, Betweenness Centrality, Closeness, Eigenvector Centrality, PageRank, Clustering Coefficient, and Modularity.",
      topics: ["In / Out Degree", "Betweenness Centrality", "Closeness Centrality", "PageRank Vector", "Clustering & Modularity"]
    },
    {
      key: "simulation_concepts",
      title: "Simulation Concepts",
      subtitle: "URSA cascade dynamic mechanics",
      icon: Cpu,
      color: "text-sky-400",
      countBadge: "Core Mechanics",
      description: "Cascade progression engine: Shock Perturbation (δv), Simulation Waves (t), Failure Threshold (θv), Centrality Dampening (γ), Autonomous Recovery (rv), Tolerance (ε), and Targeted Intervention (iv).",
      topics: ["Shock Perturbation δv", "Wave Horizon (t...T)", "Failure Threshold θv", "Dampening Exponent γ", "Targeted Intervention iv"]
    },
    {
      key: "videos",
      title: "Video Tutorials",
      subtitle: "Multimedia video demonstrations & animated visual lectures",
      icon: PlayCircle,
      color: "text-rose-400",
      countBadge: "Video Lectures",
      description: "Video lecture modules with audio demonstrations explaining Betweenness Centrality, In-Degree Centrality, and Out-Degree Centrality propagation.",
      topics: ["Betweenness Centrality", "In-Degree Centrality", "Out-Degree Centrality"]
    },
    {
      key: "lab",
      title: "Practice Lab",
      subtitle: "Interactive sandbox & live cascade experimental environment",
      icon: Network,
      color: "text-emerald-400",
      countBadge: "Interactive Sandbox",
      description: "Hands-on network simulation playground where users can manipulate nodes, trigger custom shocks, adjust real-time parameters, and inspect failure cascades dynamically.",
      topics: ["Interactive Network Graph", "Shock Injection Tools", "Live Wave Stepper", "Failure Metric Inspection"]
    }
  ];

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = 
      !searchUser || 
      acc.username.toLowerCase().includes(searchUser.toLowerCase()) || 
      (acc.term && acc.term.toLowerCase().includes(searchUser.toLowerCase()));
    const matchesTerm = filterTerm === "All" || (filterTerm === "Admin" ? acc.role === "admin" : acc.term === filterTerm);
    return matchesSearch && matchesTerm;
  });

  const uniqueTerms = Array.from(new Set(accounts.map((a) => a.term).filter(Boolean))) as string[];

  const parameterKeys: {
    key: keyof SimulationLimitsConfig;
    icon: any;
    color: string;
    bg: string;
    formula: string;
    stepPrecision: number;
  }[] = [
    {
      key: "T",
      icon: Clock,
      color: "text-[#F1F3F5]",
      bg: "bg-[#383A42]",
      formula: "t ∈ {0, 1, ..., T}",
      stepPrecision: 0
    },
    {
      key: "gamma",
      icon: Activity,
      color: "text-[#5C9EE8]",
      bg: "bg-[#383A42]",
      formula: "W_uv = ((b_uv - b_min)/(b_max - b_min))^γ",
      stepPrecision: 2
    },
    {
      key: "theta",
      icon: Shield,
      color: "text-amber-400",
      bg: "bg-[#383A42]",
      formula: "Degradation if Incoming > θ_v",
      stepPrecision: 3
    },
    {
      key: "rv",
      icon: ShieldCheck,
      color: "text-[#3fb950]",
      bg: "bg-[#383A42]",
      formula: "S_v^(t+1) = S_v^t + r_v",
      stepPrecision: 3
    },
    {
      key: "epsilon",
      icon: Sparkles,
      color: "text-teal-400",
      bg: "bg-[#383A42]",
      formula: "∑ |ΔS_v| < ε => Converged",
      stepPrecision: 4
    },
    {
      key: "shockIntensity",
      icon: Zap,
      color: "text-pink-400",
      bg: "bg-[#383A42]",
      formula: "S_v(0) = 1.0 - δ_v",
      stepPrecision: 2
    },
    {
      key: "interventionStrength",
      icon: Layers,
      color: "text-purple-400",
      bg: "bg-[#383A42]",
      formula: "S_v^(t+1) = S_v + i_v",
      stepPrecision: 2
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 animate-fade-in" id="admin-page-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#2E3036] via-[#383A42] to-[#1E1F23] text-white rounded-2xl p-8 shadow-sm relative overflow-hidden border border-[#42454E]" id="admin-header-banner">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-[#5C9EE8]/20 border border-[#5C9EE8]/40 text-[#5C9EE8] text-[11px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-widest font-semibold">
              URSA Administration Portal
            </span>
            <span className="text-[#A6A7AB] text-xs">•</span>
            <span className="text-[#D0D3D7] text-xs font-medium">User Accounts & Parameter Controls</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight font-sans text-[#F1F3F5]">
            System Administration
          </h1>
          <p className="text-[#A6A7AB] text-sm leading-relaxed">
            Manage student & researcher accounts, assign academic terms (Season & Year), and customize dynamic slider bounds for simulation wave dynamics.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-8 translate-y-8 select-none pointer-events-none">
          <ShieldCheck size={260} />
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex gap-2 bg-[#383A42] p-1.5 rounded-xl border border-[#42454E]" id="admin-nav-tabs">
        <button
          onClick={() => setAdminTab("users")}
          className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            adminTab === "users"
              ? "bg-[#42454E] text-[#F1F3F5] shadow-sm border border-[#565A66]"
              : "text-[#A6A7AB] hover:text-[#F1F3F5] hover:bg-[#42454E]/50"
          }`}
        >
          <Users size={15} className={adminTab === "users" ? "text-[#5C9EE8]" : "text-[#A6A7AB]"} />
          <span>User & Academic Term Management</span>
          <span className="ml-1 px-1.5 py-0.2 bg-[#5C9EE8]/20 text-[#5C9EE8] text-[10px] font-mono rounded-full font-bold border border-[#5C9EE8]/30">
            {accounts.length}
          </span>
        </button>

        <button
          onClick={() => setAdminTab("limits")}
          className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            adminTab === "limits"
              ? "bg-[#42454E] text-[#F1F3F5] shadow-sm border border-[#565A66]"
              : "text-[#A6A7AB] hover:text-[#F1F3F5] hover:bg-[#42454E]/50"
          }`}
        >
          <SlidersHorizontal size={15} className={adminTab === "limits" ? "text-[#5C9EE8]" : "text-[#A6A7AB]"} />
          <span>Simulation Parameter Limits</span>
        </button>

        <button
          onClick={() => setAdminTab("learn")}
          className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            adminTab === "learn"
              ? "bg-[#42454E] text-[#F1F3F5] shadow-sm border border-[#565A66]"
              : "text-[#A6A7AB] hover:text-[#F1F3F5] hover:bg-[#42454E]/50"
          }`}
          id="admin-tab-learn-visibility"
        >
          <BookOpen size={15} className={adminTab === "learn" ? "text-[#5C9EE8]" : "text-[#A6A7AB]"} />
          <span>Learn Section Visibility</span>
          <span className={`ml-1 px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold border ${
            visibleLearnCount === 5 
              ? "bg-[#238636]/20 text-[#3fb950] border-[#238636]/40" 
              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
          }`}>
            {visibleLearnCount}/5 Visible
          </span>
        </button>
      </div>

      {/* ==================== TAB 1: USER & TERM MANAGEMENT ==================== */}
      {adminTab === "users" && (
        <div className="space-y-8 animate-in fade-in duration-300" id="user-management-section">
          
          {/* Top Row: Add User Form */}
          <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-[#42454E] pb-4">
              <div className="p-2.5 bg-[#383A42] text-[#5C9EE8] rounded-xl border border-[#42454E]">
                <UserPlus size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F1F3F5]">
                  Provision New User Account
                </h3>
                <p className="text-xs text-[#A6A7AB]">
                  Create a username, password, and assign an academic term using season and year dropdowns.
                </p>
              </div>
            </div>

            {userFormError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{userFormError}</span>
              </div>
            )}

            {userFormSuccess && (
              <div className="p-3 bg-[#238636]/20 border border-[#238636]/60 rounded-xl text-xs text-[#3fb950] flex items-start gap-2">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[#3fb950]" />
                <span>{userFormSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Username */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. user.name@domain.com, student_4, admin_1"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] placeholder:text-[#A6A7AB] focus:outline-hidden focus:ring-2 focus:ring-[#5C9EE8]"
                />
              </div>

              {/* Password */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    placeholder="Enter password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] placeholder:text-[#A6A7AB] focus:outline-hidden focus:ring-2 focus:ring-[#5C9EE8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A6A7AB] hover:text-[#F1F3F5]"
                  >
                    {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Account Role */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                  Account Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                  className="w-full px-2.5 py-2 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-2 focus:ring-[#5C9EE8] cursor-pointer"
                >
                  <option value="user">Student / User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {/* Term: Season Dropdown */}
              {newRole === "user" ? (
                <>
                  <div className="md:col-span-1 space-y-1.5">
                    <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                      Season
                    </label>
                    <select
                      value={newSeason}
                      onChange={(e) => setNewSeason(e.target.value as AcademicSeason)}
                      className="w-full px-2 py-2 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-2 focus:ring-[#5C9EE8] cursor-pointer"
                    >
                      {seasons.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-1 space-y-1.5">
                    <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                      Year
                    </label>
                    <select
                      value={newYear}
                      onChange={(e) => setNewYear(parseInt(e.target.value, 10))}
                      className="w-full px-2 py-2 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-2 focus:ring-[#5C9EE8] cursor-pointer"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                    Assigned Term
                  </label>
                  <div className="px-3 py-2 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#A6A7AB] italic">
                    N/A (Admin account)
                  </div>
                </div>
              )}

              {/* Submit & Clear Buttons */}
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <div className="text-[10px] text-[#5C9EE8] font-mono font-bold truncate">
                  {newRole === "admin" ? "Role: Administrator" : `Term: ${newSeason} ${newYear}`}
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="flex-1 py-2 px-3 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm border border-[#2ea043]/60"
                  >
                    <UserPlus size={14} />
                    <span>{isSubmittingUser ? "Creating..." : "Add User"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUsername("");
                      setNewPassword("");
                      setUserFormError(null);
                      setUserFormSuccess(null);
                    }}
                    className="py-2 px-2.5 bg-[#1E1F23] hover:bg-[#383A42] text-[#A6A7AB] hover:text-[#F1F3F5] text-xs font-semibold rounded-lg transition-all border border-[#42454E] cursor-pointer"
                    title="Clear all fields"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Active Users Table Card */}
          <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#42454E] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#F1F3F5] flex items-center gap-2">
                  <Users size={18} className="text-[#5C9EE8]" />
                  Active Registered Accounts ({filteredAccounts.length})
                </h3>
                <p className="text-xs text-[#A6A7AB]">
                  Pre-configured users (user1, user2, user3, admin) and newly provisioned accounts with assigned academic terms.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A6A7AB]" />
                  <input
                    type="text"
                    placeholder="Search accounts or terms..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="pl-7 pr-3 py-1.5 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] placeholder:text-[#A6A7AB] focus:outline-hidden focus:ring-1 focus:ring-[#5C9EE8]"
                  />
                </div>

                {/* Term Filter */}
                <select
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-1 focus:ring-[#5C9EE8] cursor-pointer"
                >
                  <option value="All">All Terms</option>
                  {uniqueTerms.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#42454E] text-[#A6A7AB] font-mono text-[11px] uppercase tracking-wider">
                    <th className="pb-3 px-3">Username</th>
                    <th className="pb-3 px-3">Role</th>
                    <th className="pb-3 px-3">Assigned Term</th>
                    <th className="pb-3 px-3">Password</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#42454E]/60 text-[#D0D3D7]">
                  {filteredAccounts.map((account) => {
                    const isEditing = editingUserId === account.id;
                    const isProtected = account.id === "admin";

                    return (
                      <tr key={account.id} className="hover:bg-[#383A42]/40 transition-colors">
                        {/* Username */}
                        <td className="py-3 px-3 font-semibold text-[#F1F3F5] font-mono break-all max-w-[220px]">
                          {account.username}
                        </td>

                        {/* Role */}
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            account.role === "admin"
                              ? "bg-purple-950/60 text-purple-300 border border-purple-700/50"
                              : "bg-[#383A42] text-[#5C9EE8] border border-[#42454E]"
                          }`}>
                            {account.role || "user"}
                          </span>
                        </td>

                        {/* Term */}
                        <td className="py-3 px-3">
                          {account.role === "admin" ? (
                            <span className="text-[#A6A7AB] text-xs font-mono italic">
                              — (System Admin)
                            </span>
                          ) : isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={editSeason}
                                onChange={(e) => setEditSeason(e.target.value as AcademicSeason)}
                                className="px-2 py-1 text-xs bg-[#1E1F23] border border-[#42454E] rounded-md text-[#F1F3F5]"
                              >
                                {seasons.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <select
                                value={editYear}
                                onChange={(e) => setEditYear(parseInt(e.target.value, 10))}
                                className="px-2 py-1 text-xs bg-[#1E1F23] border border-[#42454E] rounded-md text-[#F1F3F5]"
                              >
                                {availableYears.map((y) => (
                                  <option key={y} value={y}>{y}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#383A42] text-[#F1F3F5] font-mono text-[11px] font-semibold border border-[#42454E]">
                              <Calendar size={12} className="text-[#5C9EE8]" />
                              {account.term || "Summer 2026"}
                            </span>
                          )}
                        </td>

                        {/* Password */}
                        <td className="py-3 px-3 font-mono">
                          {isEditing ? (
                            <div className="relative max-w-[140px]">
                              <input
                                type={showEditPassword ? "text" : "password"}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="w-full px-2 pr-6 py-1 text-xs bg-[#1E1F23] border border-[#42454E] rounded-md text-[#F1F3F5]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditPassword(!showEditPassword)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#A6A7AB]"
                              >
                                {showEditPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#A6A7AB]">
                              ••••••••
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSaveEdit(account)}
                                className="p-1.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg transition-colors cursor-pointer"
                                title="Save Changes"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="p-1.5 bg-[#383A42] hover:bg-[#42454E] text-[#A6A7AB] rounded-lg transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleStartEdit(account)}
                                className="p-1.5 bg-[#383A42] hover:bg-[#42454E] text-[#5C9EE8] rounded-lg transition-colors cursor-pointer border border-[#42454E]"
                                title="Edit Term or Password"
                              >
                                <Edit2 size={13} />
                              </button>
                              {!isProtected && (
                                <button
                                  onClick={() => setDeleteTargetUser(account)}
                                  className="p-1.5 bg-[#383A42] hover:bg-rose-950/60 text-rose-400 rounded-lg transition-colors cursor-pointer border border-[#42454E]"
                                  title="Delete User"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
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

      {/* ==================== TAB 2: SIMULATION PARAMETER LIMITS ==================== */}
      {adminTab === "limits" && (
        <div className="space-y-8 animate-in fade-in duration-300" id="parameter-limits-section">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#2E3036] p-4 rounded-xl border border-[#42454E] shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#A6A7AB] uppercase tracking-wider">
                Status:
              </span>
              {isLimitsDirty ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-800/50">
                  <AlertCircle size={13} /> Unsaved Parameter Bounds
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3fb950] bg-[#238636]/20 px-2.5 py-0.5 rounded-full border border-[#238636]/40">
                  <CheckCircle2 size={13} /> Database Synchronized
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResetLimitsModal(true)}
                disabled={loadingLimits}
                className="px-3.5 py-2 text-xs font-semibold text-[#D0D3D7] hover:text-[#F1F3F5] bg-[#383A42] hover:bg-[#42454E] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border border-[#42454E]"
              >
                <RotateCcw size={14} />
                <span>Reset to System Defaults</span>
              </button>

              <button
                onClick={handleSaveLimits}
                disabled={loadingLimits || !isLimitsDirty}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  isLimitsDirty
                    ? "bg-[#238636] hover:bg-[#2ea043] text-white border border-[#2ea043]/60"
                    : "bg-[#383A42] text-[#A6A7AB] cursor-not-allowed border border-[#42454E]"
                }`}
              >
                <Save size={14} />
                <span>{loadingLimits ? "Saving..." : "Save Parameter Limits"}</span>
              </button>
            </div>
          </div>

          {/* Parameter Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {parameterKeys.map(({ key, icon: Icon, color, bg, formula, stepPrecision }) => {
              const param = limits[key];

              return (
                <div
                  key={key}
                  className="bg-[#2E3036] border border-[#42454E] rounded-2xl p-6 shadow-xs space-y-4 hover:border-[#565A66] transition-all"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[#42454E] pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 ${bg} ${color} rounded-xl border border-[#42454E]`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#F1F3F5]">{param.label}</h3>
                        <p className="text-[11px] text-[#A6A7AB] mt-0.5">{param.description}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-[#5C9EE8] bg-[#383A42] px-2 py-0.5 rounded-md border border-[#42454E] shrink-0">
                      {formula}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                        Min Bound
                      </label>
                      <input
                        type="number"
                        step={param.step}
                        value={param.min}
                        onChange={(e) =>
                          handleFieldChange(key, "min", parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-1 focus:ring-[#5C9EE8]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                        Max Bound
                      </label>
                      <input
                        type="number"
                        step={param.step}
                        value={param.max}
                        onChange={(e) =>
                          handleFieldChange(key, "max", parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-1 focus:ring-[#5C9EE8]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                        Step Size
                      </label>
                      <input
                        type="number"
                        step={Math.pow(10, -stepPrecision) || 0.01}
                        value={param.step}
                        onChange={(e) =>
                          handleFieldChange(key, "step", parseFloat(e.target.value) || 0.01)
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-1 focus:ring-[#5C9EE8]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A6A7AB]">
                        Default
                      </label>
                      <input
                        type="number"
                        step={param.step}
                        value={param.defaultVal}
                        onChange={(e) =>
                          handleFieldChange(key, "defaultVal", parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-[#1E1F23] border border-[#42454E] rounded-lg text-[#F1F3F5] focus:outline-hidden focus:ring-1 focus:ring-[#5C9EE8]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: LEARN SECTION VISIBILITY ==================== */}
      {adminTab === "learn" && (
        <div className="space-y-8 animate-in fade-in duration-300" id="learn-visibility-section">
          
          {/* Top Control Bar */}
          <div className="bg-[#2E3036] rounded-2xl border border-[#42454E] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#42454E] pb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#383A42] text-[#5C9EE8] rounded-xl border border-[#42454E]">
                  <BookOpen size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#F1F3F5]">
                      Curriculum & Section Visibility Control
                    </h3>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-[#5C9EE8]/20 text-[#5C9EE8] rounded-md font-bold border border-[#5C9EE8]/30">
                      Live Student Sync
                    </span>
                  </div>
                  <p className="text-xs text-[#A6A7AB] mt-0.5">
                    Decide which educational sections in the <strong>Learn</strong> page are visible to standard users. Hidden sections are strictly suppressed for non-admin accounts.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                <button
                  onClick={() => handleSetAllLearnSections(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#D0D3D7] bg-[#383A42] hover:bg-[#42454E] hover:text-white rounded-lg border border-[#42454E] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Make all 5 learn sections visible to users"
                >
                  <Eye size={13} className="text-[#3fb950]" />
                  <span>Show All</span>
                </button>

                <button
                  onClick={() => handleSetAllLearnSections(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#D0D3D7] bg-[#383A42] hover:bg-[#42454E] hover:text-white rounded-lg border border-[#42454E] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Hide all learn sections from users"
                >
                  <EyeOff size={13} className="text-amber-400" />
                  <span>Hide All</span>
                </button>

                <button
                  onClick={() => setShowResetLearnModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#A6A7AB] hover:text-rose-400 bg-[#383A42] hover:bg-rose-950/30 rounded-lg border border-[#42454E] hover:border-rose-900/50 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Reset curriculum visibility to system default"
                >
                  <RotateCcw size={13} />
                  <span>Reset Defaults</span>
                </button>

                <button
                  onClick={handleSaveLearnVisibility}
                  disabled={loadingLearnVisibility || !isLearnVisibilityDirty}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    isLearnVisibilityDirty
                      ? "bg-[#238636] hover:bg-[#2ea043] text-white border border-[#3fb950]/50 animate-pulse"
                      : "bg-[#383A42] text-[#A6A7AB] border border-[#42454E] opacity-60 cursor-not-allowed"
                  }`}
                >
                  <Save size={13} />
                  <span>{loadingLearnVisibility ? "Saving..." : isLearnVisibilityDirty ? "Save Changes" : "Saved"}</span>
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {learnSaveSuccess && (
              <div className="p-3 bg-[#238636]/20 border border-[#238636]/50 rounded-xl flex items-center gap-2 text-xs text-[#3fb950] animate-in fade-in duration-200">
                <CheckCircle2 size={16} />
                <span>Curriculum visibility configuration saved successfully! Regular users will now only see enabled modules.</span>
              </div>
            )}

            {/* Summary status overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-[#1E1F23] rounded-xl border border-[#42454E] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-[#A6A7AB]">Curriculum Status</span>
                  <p className="text-sm font-bold text-[#F1F3F5] mt-0.5">
                    {visibleLearnCount} of 5 Sections Visible
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${visibleLearnCount > 0 ? "bg-[#238636]/20 text-[#3fb950]" : "bg-rose-900/30 text-rose-400"}`}>
                  <BookOpen size={18} />
                </div>
              </div>

              <div className="p-3.5 bg-[#1E1F23] rounded-xl border border-[#42454E] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-[#A6A7AB]">Hidden From Users</span>
                  <p className="text-sm font-bold text-[#F1F3F5] mt-0.5">
                    {5 - visibleLearnCount} Modules Hidden
                  </p>
                </div>
                <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg">
                  <EyeOff size={18} />
                </div>
              </div>

              <div className="p-3.5 bg-[#1E1F23] rounded-xl border border-[#42454E] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-[#A6A7AB]">Admin View Override</span>
                  <p className="text-xs text-[#5C9EE8] font-medium mt-0.5">
                    Admins can view all sections anytime
                  </p>
                </div>
                <div className="p-2 bg-[#5C9EE8]/20 text-[#5C9EE8] rounded-lg">
                  <ShieldCheck size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* Cards for each Learn Section */}
          <div className="space-y-4">
            {learnSectionsConfig.map((section) => {
              const isVisible = learnVisibility[section.key];
              const IconComponent = section.icon;

              return (
                <div
                  key={section.key}
                  className={`p-5 rounded-2xl border transition-all duration-200 ${
                    isVisible
                      ? "bg-[#2E3036] border-[#42454E] hover:border-[#565A66]"
                      : "bg-[#2E3036]/60 border-[#42454E]/60 opacity-80"
                  }`}
                  id={`learn-control-${section.key}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Icon & Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-xl border shrink-0 ${
                        isVisible 
                          ? "bg-[#383A42] border-[#42454E] " + section.color 
                          : "bg-[#1E1F23] border-[#42454E] text-[#A6A7AB]"
                      }`}>
                        <IconComponent size={22} />
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-[#F1F3F5]">
                            {section.title}
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-[#383A42] text-[#A6A7AB] rounded-md font-semibold border border-[#42454E]">
                            {section.countBadge}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            isVisible
                              ? "bg-[#238636]/20 text-[#3fb950] border-[#238636]/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          }`}>
                            {isVisible ? (
                              <>
                                <Eye size={10} />
                                <span>Visible to Users</span>
                              </>
                            ) : (
                              <>
                                <EyeOff size={10} />
                                <span>Hidden from Users</span>
                              </>
                            )}
                          </span>
                        </div>

                        <p className="text-xs text-[#A6A7AB] leading-relaxed">
                          {section.description}
                        </p>

                        {/* Concept Topics Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-[#A6A7AB] font-medium mr-1">Modules:</span>
                          {section.topics.map((t, idx) => (
                            <span 
                              key={idx}
                              className="text-[10px] font-mono px-2 py-0.5 bg-[#1E1F23] text-[#D0D3D7] rounded border border-[#42454E]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Toggle Switch & Status */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#42454E]">
                      <button
                        type="button"
                        onClick={() => handleToggleLearnSection(section.key)}
                        className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-[#5C9EE8] ${
                          isVisible
                            ? "bg-[#238636] border-[#238636]"
                            : "bg-[#383A42] border-[#42454E]"
                        }`}
                        role="switch"
                        aria-checked={isVisible}
                        title={`Click to ${isVisible ? "hide" : "show"} ${section.title} for users`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                            isVisible ? "translate-x-7" : "translate-x-0"
                          }`}
                        >
                          {isVisible ? (
                            <Check size={12} className="text-[#238636] stroke-[3]" />
                          ) : (
                            <X size={12} className="text-slate-500 stroke-[3]" />
                          )}
                        </span>
                      </button>

                      <span className="text-[11px] font-medium text-[#A6A7AB]">
                        {isVisible ? "Active for all users" : "Hidden for users"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete User Confirm Modal */}
      {deleteTargetUser && (
        <ConfirmModal
          isOpen={!!deleteTargetUser}
          title="Delete User Account"
          message={`Are you sure you want to delete user account '${deleteTargetUser.username}'? This action cannot be undone.`}
          confirmText="Delete Account"
          cancelText="Cancel"
          type="danger"
          onConfirm={handleConfirmDeleteUser}
          onCancel={() => setDeleteTargetUser(null)}
        />
      )}

      {/* Reset Limits Modal */}
      <ConfirmModal
        isOpen={showResetLimitsModal}
        title="Reset All Parameter Limits?"
        message="This will restore all slider ranges, maximums, minimums, and default values to default system specifications."
        confirmText="Reset to Defaults"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleConfirmResetLimits}
        onCancel={() => setShowResetLimitsModal(false)}
      />

      {/* Reset Learn Visibility Modal */}
      <ConfirmModal
        isOpen={showResetLearnModal}
        title="Reset Curriculum Visibility?"
        message="This will restore all 5 Learn curriculum sections to visible by default for all users."
        confirmText="Reset to Visible"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleConfirmResetLearnVisibility}
        onCancel={() => setShowResetLearnModal(false)}
      />
    </div>
  );
}
