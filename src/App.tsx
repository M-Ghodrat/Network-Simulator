import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "./firebase";
import { dataService } from "./dataService";
import LoginPage from "./components/LoginPage";
import LearnPage from "./components/LearnPage";
import ConfigPage from "./components/ConfigPage";
import SimulatorPage from "./components/SimulatorPage";
import { Network, LogOut, BookOpen, Sliders, Activity, User as UserIcon, RefreshCw } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"learn" | "config" | "simulator">("learn");

  // Track Auth state
  useEffect(() => {
    // Check local storage first for a bypassed local user
    const savedUser = localStorage.getItem("ursa_local_user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        setAuthLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem("ursa_local_user");
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!localStorage.getItem("ursa_local_user")) {
        setUser(currentUser);
        setAuthLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Synchronize user with dataService context
  useEffect(() => {
    if (user) {
      dataService.setCurrentUser(user);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("ursa_local_user");
      await signOut(auth);
      setUser(null);
      setActiveTab("learn");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3" id="app-loading-screen">
        <RefreshCw size={36} className="animate-spin text-slate-400" />
        <span className="text-xs text-slate-500 font-mono font-semibold uppercase tracking-wider">
          Initializing URSA Workspace...
        </span>
      </div>
    );
  }

  // Auth Guard
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" id="app-auth-guard">
        <LoginPage onLocalLogin={setUser} />
      </div>
    );
  }

  const emailPrefix = user?.email ? user.email.split("@")[0].toLowerCase() : "";
  let userDisplayName = "User";
  let modeDisplayName = "Mode A";

  if (emailPrefix === "user1") {
    userDisplayName = "User 1";
    modeDisplayName = "Mode A";
  } else if (emailPrefix === "user2") {
    userDisplayName = "User 2";
    modeDisplayName = "Mode B";
  } else if (emailPrefix === "user3") {
    userDisplayName = "User 3";
    modeDisplayName = "Mode C";
  } else if (emailPrefix === "admin") {
    userDisplayName = "Admin";
    modeDisplayName = "Mode Admin";
  } else if (emailPrefix) {
    userDisplayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    modeDisplayName = "Mode Default";
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col" id="app-main-layout">
      
      {/* Header / Nav Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80 backdrop-blur-md" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            
            {/* Logo */}
            <div className="flex items-center gap-2 select-none" id="app-logo">
              <div className="p-1 bg-slate-900 text-white rounded-lg">
                <Network size={18} />
              </div>
              <div>
                <span className="font-bold text-slate-950 text-sm tracking-tight font-sans">URSA</span>
                <span className="text-[10px] text-slate-400 font-mono block -mt-1 font-bold">Urban Intelligence Studio</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 sm:gap-2" id="app-nav">
              <button
                onClick={() => setActiveTab("learn")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "learn"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="nav-learn"
              >
                <BookOpen size={13} />
                <span className="hidden sm:inline">Learn</span>
              </button>

              <button
                onClick={() => setActiveTab("config")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "config"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="nav-config"
              >
                <Sliders size={13} />
                <span className="hidden sm:inline">Network Configuration</span>
              </button>

              <button
                onClick={() => setActiveTab("simulator")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "simulator"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                id="nav-simulator"
              >
                <Activity size={13} />
                <span className="hidden sm:inline">Simulator</span>
              </button>
            </nav>

            {/* User Account Menu */}
            <div className="flex items-center gap-2 sm:gap-3" id="app-user-menu">
              <div className="hidden md:flex flex-col items-end text-right">
                <span className="text-[11px] font-semibold text-slate-800 tracking-tight font-sans">
                  {userDisplayName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">
                  {modeDisplayName}
                </span>
              </div>
              
              <div className="p-1 bg-slate-100 rounded-full text-slate-500 md:hidden">
                <UserIcon size={14} title={user.email || "User"} />
              </div>

              <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                title="Log out of URSA"
                id="logout-btn"
              >
                <LogOut size={15} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6" id="app-main-content">
        {activeTab === "learn" && <LearnPage />}
        {activeTab === "config" && <ConfigPage />}
        {activeTab === "simulator" && <SimulatorPage />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 text-[10px] font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>URSA - Urban Intelligence Studio v1.2.0</span>
          <span>Security Context: Firestore Encrypted Core DB &bull; Active Node Session</span>
        </div>
      </footer>

    </div>
  );
}
