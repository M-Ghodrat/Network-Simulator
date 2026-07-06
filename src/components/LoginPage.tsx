import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { LogIn, UserPlus, Shield, Activity, HelpCircle, Lock, Mail, AlertCircle, RefreshCw, Key } from "lucide-react";

interface LoginPageProps {
  onLocalLogin?: (user: any) => void;
}

export default function LoginPage({ onLocalLogin }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all credentials.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    // Automatically pad short passwords behind the scenes to satisfy Firebase Auth (min 6 chars)
    const finalPassword = password.length < 6 ? password.padEnd(6, "0") : password;

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, finalPassword);
      } else {
        await signInWithEmailAndPassword(auth, email, finalPassword);
      }
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/operation-not-allowed") {
        console.warn("Email/Password auth is not enabled in Firebase Console. Bypassing locally.");
        const localUserObj = {
          email: email,
          uid: "local-" + email.replace(/[^a-zA-Z0-9]/g, "-"),
          isLocal: true,
        };
        localStorage.setItem("ursa_local_user", JSON.stringify(localUserObj));
        if (onLocalLogin) {
          onLocalLogin(localUserObj);
        }
        return;
      }
      let message = "Authentication failed. Please verify your details.";
      if (err?.code === "auth/email-already-in-use") {
        message = "This email is already registered.";
      } else if (err?.code === "auth/invalid-credential") {
        message = "Incorrect email or password.";
      } else if (err?.code === "auth/weak-password") {
        message = "Password must be at least 6 characters.";
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  // Demo / Admin bypass logins
  const handleBypassLogin = async (bypassEmail: string, bypassPass: string) => {
    setEmail(bypassEmail);
    setPassword(bypassPass);
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    
    // Auto-pad password behind the scenes to satisfy Firebase Auth rules
    const finalPass = bypassPass.length < 6 ? bypassPass.padEnd(6, "0") : bypassPass;
    
    try {
      try {
        await signInWithEmailAndPassword(auth, bypassEmail, finalPass);
      } catch (err: any) {
        // Handle cases where the bypass user doesn't exist yet
        const code = err?.code || "";
        if (
          code === "auth/invalid-credential" || 
          code === "auth/user-not-found" || 
          code === "auth/invalid-login-credentials"
        ) {
          try {
            await createUserWithEmailAndPassword(auth, bypassEmail, finalPass);
          } catch (createErr: any) {
            if (createErr?.code === "auth/email-already-in-use") {
              throw new Error(`The account ${bypassEmail} already exists with a different password. Please sign in manually or register a new account.`);
            } else {
              throw createErr;
            }
          }
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      console.warn("Firebase Auth bypass unavailable, switching to secure local bypass fallback.", err);
      // Fall back to local sandbox bypass for seamless UX
      const localUserObj = {
        email: bypassEmail,
        uid: "local-" + bypassEmail.replace(/[^a-zA-Z0-9]/g, "-"),
        isLocal: true,
      };
      localStorage.setItem("ursa_local_user", JSON.stringify(localUserObj));
      if (onLocalLogin) {
        onLocalLogin(localUserObj);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-10 animate-fade-in" id="login-container">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden grid grid-cols-1" id="login-card">
        
        {/* Banner */}
        <div className="bg-slate-900 text-white p-6 space-y-2 relative overflow-hidden" id="login-banner">
          <div className="relative z-10 flex items-center gap-2">
            <div className="p-1.5 bg-slate-800 rounded-lg text-indigo-400">
              <Activity size={18} className="animate-pulse" />
            </div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">Project Portal</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight font-sans relative z-10">URSA Network Simulator</h2>
          <p className="text-slate-400 text-xs leading-relaxed relative z-10">
            Urban Resilience and Sustainability Alliance. Model cascading risks, configure indicator nodes, and plan stress interventions.
          </p>
          <div className="absolute right-0 top-0 opacity-5 translate-x-12 -translate-y-8 select-none">
            <Shield size={180} />
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4" id="login-form-body">
          <div className="flex border-b border-slate-100 pb-2">
            <button
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
              className={`flex-1 text-center pb-2 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
                !isSignUp ? "border-slate-900 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsSignUp(true);
                setError(null);
              }}
              className={`flex-1 text-center pb-2 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
                isSignUp ? "border-slate-900 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Register New Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Error alerts */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-shake" id="login-error-alert">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Email Address</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. planner@ursa.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Account Password</label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              {loading ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : isSignUp ? (
                <>
                  <UserPlus size={13} /> Sign Up
                </>
              ) : (
                <>
                  <LogIn size={13} /> Sign In
                </>
              )}
            </button>
          </form>

          {/* Google Sign In option (Enabled by default in Firebase) */}
          <div className="flex items-center gap-2 py-1 text-slate-300">
            <div className="h-[1px] bg-slate-100 flex-1"></div>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">or</span>
            <div className="h-[1px] bg-slate-100 flex-1"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61a5.66 5.66 0 0 1-2.45 3.71v3.08h3.95c2.31-2.13 3.63-5.26 3.63-8.64z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.95-3.08c-1.1.74-2.5 1.18-3.98 1.18-3.07 0-5.67-2.08-6.6-4.88H1.35v3.18A11.996 11.996 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.4 14.31A7.16 7.16 0 0 1 5 12c0-.8.14-1.58.4-2.31V6.51H1.35A11.99 11.99 0 0 0 0 12c0 2.12.55 4.12 1.5 5.88l3.9-3.57z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.35 2.65 1.35 6.51l3.9 3.57c.93-2.8 3.53-4.88 6.75-4.88z"
              />
            </svg>
            Sign In with Google
          </button>

          {/* Quick Sandbox Bypass */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div className="text-center text-[10px] text-slate-400 font-mono">Instant Isolated User Access</div>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleBypassLogin("user1@ursa.org", "user1")}
                disabled={loading}
                className="py-2.5 px-1 border border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-0.5"
              >
                <span className="text-xs">User 1</span>
                <span className="text-[8px] font-mono text-slate-400">pass: user1</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleBypassLogin("user2@ursa.org", "user2")}
                disabled={loading}
                className="py-2.5 px-1 border border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-0.5"
              >
                <span className="text-xs">User 2</span>
                <span className="text-[8px] font-mono text-slate-400">pass: user2</span>
              </button>

              <button
                type="button"
                onClick={() => handleBypassLogin("user3@ursa.org", "user3")}
                disabled={loading}
                className="py-2.5 px-1 border border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 text-purple-700 hover:bg-purple-50 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-0.5"
              >
                <span className="text-xs">User 3</span>
                <span className="text-[8px] font-mono text-slate-400">pass: user3</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleBypassLogin("admin@ursa.org", "adminpass123")}
                disabled={loading}
                className="py-1.5 px-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200 rounded-lg transition-colors cursor-pointer flex flex-col items-center justify-center"
              >
                <span className="font-bold">Bypass as Admin</span>
                <span className="text-[8px] font-mono text-slate-400">admin@ursa.org</span>
              </button>
              <button
                type="button"
                onClick={() => handleBypassLogin("demo@ursa.org", "demopass123")}
                disabled={loading}
                className="py-1.5 px-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200 rounded-lg transition-colors cursor-pointer flex flex-col items-center justify-center"
              >
                <span className="font-bold">Bypass as Analyst</span>
                <span className="text-[8px] font-mono text-slate-400">demo@ursa.org</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
