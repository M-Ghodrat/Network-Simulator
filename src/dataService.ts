import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, getDocs, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { 
  Domain, 
  NodeIndicator, 
  Edge, 
  SimulatorParams, 
  SavedNetworkConfig, 
  SimulationLimitsConfig, 
  DEFAULT_SIMULATION_LIMITS, 
  AppUserAccount, 
  DEFAULT_USER_ACCOUNTS, 
  LearnVisibilityConfig, 
  DEFAULT_LEARN_VISIBILITY 
} from "./types";
import { 
  DEFAULT_DOMAINS, 
  DEFAULT_NODES, 
  parseDefaultEdges, 
  SIMPLE_DOMAINS, 
  SIMPLE_NODES, 
  parseSimpleEdges 
} from "./defaultNetwork";

type Listener<T> = (data: T[]) => void;

const DEFAULT_PARAMS: SimulatorParams = {
  id: "default",
  T: 10,
  theta: 0.2,
  gamma: 1.5,
  epsilon: 0.001,
  rv: 0.05,
  shocks: [
    { node: "PF", intensity: 0.4 },
    { node: "BE", intensity: 0.4 }
  ],
  interventions: []
};

const SIMPLE_PARAMS: SimulatorParams = {
  ...DEFAULT_PARAMS,
  shocks: [
    { node: "N2", intensity: 0.4 },
    { node: "N10", intensity: 0.4 }
  ]
};

class DataService {
  private domains: Domain[] = [];
  private nodes: NodeIndicator[] = [];
  private edges: Edge[] = [];
  private params: SimulatorParams = { ...DEFAULT_PARAMS };
  private limits: SimulationLimitsConfig = { ...DEFAULT_SIMULATION_LIMITS };
  private accounts: AppUserAccount[] = [...DEFAULT_USER_ACCOUNTS];
  private learnVisibility: LearnVisibilityConfig = { ...DEFAULT_LEARN_VISIBILITY };
  private isLocalOnly = false;
  private isQuotaExhausted = false;
  private isLoaded = false;
  private isRestoring = false;
  private isClearing = false;
  private currentUser: any = null;

  private domainListeners: Set<Listener<Domain>> = new Set();
  private nodeListeners: Set<Listener<NodeIndicator>> = new Set();
  private edgeListeners: Set<Listener<Edge>> = new Set();
  private paramsListeners: Set<(p: SimulatorParams) => void> = new Set();
  private statusListeners: Set<(isLocal: boolean) => void> = new Set();
  private limitsListeners: Set<(l: SimulationLimitsConfig) => void> = new Set();
  private accountsListeners: Set<(accs: AppUserAccount[]) => void> = new Set();
  private learnVisibilityListeners: Set<(v: LearnVisibilityConfig) => void> = new Set();

  private unsubs: (() => void)[] = [];
  private systemUnsub: (() => void) | null = null;
  private accountsUnsub: (() => void) | null = null;
  private learnVisibilityUnsub: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private handleFirestoreError(e: any, context?: string) {
    const msg = String(e?.message || "");
    const code = String(e?.code || "");
    const isQuota = code === "resource-exhausted" ||
                    msg.includes("resource-exhausted") ||
                    msg.includes("Quota limit exceeded") ||
                    msg.includes("quota");
    if (isQuota) {
      if (!this.isQuotaExhausted) {
        console.warn(`Firestore free daily write quota reached during ${context || "operation"}. Automatically falling back to local persistent storage.`);
      }
      this.isQuotaExhausted = true;
      this.isLocalOnly = true;
      try {
        localStorage.setItem("ursa_firestore_quota_exhausted", "true");
      } catch {}
      this.notifyStatusListeners();
    } else {
      console.warn(`Firestore warning during ${context || "operation"}:`, e);
    }
  }

  private init() {
    try {
      if (localStorage.getItem("ursa_firestore_quota_exhausted") === "true") {
        this.isQuotaExhausted = true;
        this.isLocalOnly = true;
      }
    } catch {}

    // Immediate local copy loading
    this.loadFromLocalStorage();
    this.loadAccountsFromLocalStorage();
    this.loadLearnVisibilityFromLocalStorage();
    if (!this.isQuotaExhausted) {
      this.initSystemLimitsListener();
      this.initAccountsListener();
      this.initLearnVisibilityListener();
    }
  }

  // --- Unique Username Helpers & Validation ---

  /**
   * Returns the clean unique username for the current active user.
   * Guarantees all data (domains, nodes, edges, params, configs) maps directly to this user name.
   */
  public getCurrentUserName(): string {
    if (!this.currentUser) return "global";
    if (this.currentUser.userName && typeof this.currentUser.userName === "string") {
      return this.currentUser.userName.trim();
    }
    if (this.currentUser.username && typeof this.currentUser.username === "string") {
      return this.currentUser.username.trim();
    }
    if (this.currentUser.email && typeof this.currentUser.email === "string") {
      const email = this.currentUser.email.trim();
      if (email.endsWith("@network.org")) {
        return email.replace(/@network\.org$/, "");
      }
      return email;
    }
    if (typeof this.currentUser.uid === "string") {
      const cleaned = this.currentUser.uid.replace(/^local-/, "").trim();
      if (cleaned) return cleaned;
    }
    return "default_user";
  }

  public isUserAdmin(targetUserName?: string): boolean {
    const raw = (targetUserName || (this.currentUser ? this.getCurrentUserName() : "")).trim();
    if (!raw || raw === "global") return false;
    const lower = raw.toLowerCase();

    // Specific rule: users with @ucanwest.ca at their username are regular users (16-node network)
    if (lower.includes("@ucanwest.ca") || lower.endsWith("@ucanwest.ca")) {
      return false;
    }

    if (lower === "admin") return true;

    const account = this.getAccountByUsername(raw);
    if (account) {
      return account.role === "admin";
    }

    if (!targetUserName || targetUserName === this.getCurrentUserName()) {
      if (this.currentUser?.role === "admin") return true;
      if (this.currentUser?.email && this.currentUser.email.toLowerCase() === "admin@network.org") return true;
    }

    return false;
  }

  public isCurrentUserAdmin(): boolean {
    return this.isUserAdmin(this.getCurrentUserName());
  }

  /**
   * Validates format constraints for usernames.
   * Supports arbitrary usernames including '.', '@', and special characters.
   */
  public validateUsername(rawUsername: string): { valid: boolean; clean: string; error?: string } {
    const clean = (rawUsername || "").trim();
    if (!clean) {
      return { valid: false, clean: "", error: "Username cannot be empty." };
    }
    if (clean.includes("/")) {
      return { valid: false, clean, error: "Username cannot contain forward slashes ('/')." };
    }
    if (clean === "." || clean === "..") {
      return { valid: false, clean, error: "Username cannot be only dots ('.' or '..')." };
    }
    if (/^__.*__$/.test(clean)) {
      return { valid: false, clean, error: "Username cannot use reserved system format (__...__)." };
    }
    return { valid: true, clean };
  }

  /**
   * Checks both local accounts state and Firestore database to verify if a username is already taken.
   */
  public async isUsernameTaken(rawUsername: string): Promise<boolean> {
    const raw = (rawUsername || "").trim();
    if (!raw) return false;
    const clean = raw.toLowerCase();

    // Check in-memory / local storage accounts
    const inLocal = this.accounts.some(
      (a) => a.id.toLowerCase() === clean || a.username.toLowerCase() === clean || a.id === raw || a.username === raw
    );
    if (inLocal) return true;

    // Check Firestore user document
    try {
      const userSnap = await getDoc(doc(db, "users", clean));
      if (userSnap.exists()) return true;

      if (raw !== clean) {
        const rawSnap = await getDoc(doc(db, "users", raw));
        if (rawSnap.exists()) return true;
      }

      // Check system/user_accounts document
      const systemAccountsSnap = await getDoc(doc(db, "system", "user_accounts"));
      if (systemAccountsSnap.exists()) {
        const data = systemAccountsSnap.data();
        if (data?.accounts && Array.isArray(data.accounts)) {
          const inRemote = data.accounts.some(
            (a: AppUserAccount) =>
              a.id?.toLowerCase() === clean ||
              a.username?.toLowerCase() === clean ||
              a.id === raw ||
              a.username === raw
          );
          if (inRemote) return true;
        }
      }
    } catch (e) {
      console.warn("Could not query Firestore for username existence, checking local:", e);
    }

    return false;
  }

  // --- Accounts & User Directory Management ---

  private loadAccountsFromLocalStorage() {
    try {
      const accountMap = new Map<string, AppUserAccount>();
      DEFAULT_USER_ACCOUNTS.forEach((a) => accountMap.set(a.id.toLowerCase(), { ...a }));

      const saved = localStorage.getItem("ursa_user_accounts");
      if (saved) {
        const parsed: AppUserAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((a) => {
            if (a && (a.id || a.username)) {
              const key = (a.id || a.username).toLowerCase();
              const def = DEFAULT_USER_ACCOUNTS.find((d) => d.id.toLowerCase() === key);
              accountMap.set(key, {
                id: key,
                username: a.username || def?.username || key,
                password: a.password || def?.password || key,
                role: a.role || def?.role || (key === "admin" ? "admin" : "user"),
                term: a.term || def?.term || (a.role === "admin" || def?.role === "admin" ? undefined : "Summer 2026"),
                season: a.season || def?.season || (a.role === "admin" || def?.role === "admin" ? undefined : "Summer"),
                year: a.year || def?.year || (a.role === "admin" || def?.role === "admin" ? undefined : 2026),
                createdAt: a.createdAt || def?.createdAt || new Date().toISOString(),
                updatedAt: a.updatedAt
              });
            }
          });
        }
      }
      this.accounts = Array.from(accountMap.values());
    } catch (e) {
      this.accounts = [...DEFAULT_USER_ACCOUNTS];
    }
  }

  private saveAccountsToLocalStorage() {
    try {
      localStorage.setItem("ursa_user_accounts", JSON.stringify(this.accounts));
    } catch (e) {
      console.warn("Failed to write user accounts to local storage:", e);
    }
  }

  private initAccountsListener() {
    try {
      if (this.accountsUnsub) {
        this.accountsUnsub();
      }
      this.accountsUnsub = onSnapshot(
        doc(db, "system", "user_accounts"),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data?.accounts && Array.isArray(data.accounts)) {
              const accountMap = new Map<string, AppUserAccount>();
              DEFAULT_USER_ACCOUNTS.forEach((a) => accountMap.set(a.id.toLowerCase(), { ...a }));

              data.accounts.forEach((a: AppUserAccount) => {
                if (a && (a.id || a.username)) {
                  const key = (a.id || a.username).toLowerCase();
                  const def = DEFAULT_USER_ACCOUNTS.find((d) => d.id.toLowerCase() === key);

                  const fullAccount: AppUserAccount = {
                    id: key,
                    username: a.username || def?.username || key,
                    password: a.password || def?.password || key,
                    role: a.role || def?.role || (key === "admin" ? "admin" : "user"),
                    term: a.term || def?.term || (a.role === "admin" || def?.role === "admin" ? undefined : "Summer 2026"),
                    season: a.season || def?.season || (a.role === "admin" || def?.role === "admin" ? undefined : "Summer"),
                    year: a.year || def?.year || (a.role === "admin" || def?.role === "admin" ? undefined : 2026),
                    createdAt: a.createdAt || def?.createdAt || new Date().toISOString(),
                    updatedAt: a.updatedAt
                  };
                  accountMap.set(key, fullAccount);
                }
              });

              this.accounts = Array.from(accountMap.values());
              this.saveAccountsToLocalStorage();
              this.notifyAccountsListeners();
            }
          }
        },
        (err) => {
          console.warn("System accounts Firestore listener warning, using local:", err);
        }
      );
    } catch (e) {
      console.warn("Failed to attach system accounts listener:", e);
    }
  }

  private notifyAccountsListeners() {
    this.accountsListeners.forEach((l) => l([...this.accounts]));
  }

  public subscribeAccounts(listener: (accounts: AppUserAccount[]) => void): () => void {
    this.accountsListeners.add(listener);
    listener([...this.accounts]);
    return () => this.accountsListeners.delete(listener);
  }

  public getAccounts(): AppUserAccount[] {
    return [...this.accounts];
  }

  public getAccountByUsername(username: string): AppUserAccount | undefined {
    const raw = (username || "").trim();
    if (!raw) return undefined;
    const clean = raw.toLowerCase();
    return this.accounts.find(
      (a) =>
        a.id.toLowerCase() === clean ||
        a.username.toLowerCase() === clean ||
        a.id === raw ||
        a.username === raw
    );
  }

  /**
   * Async account finder that searches memory, default accounts, and Firestore.
   */
  public async findAccountAsync(usernameOrEmail: string): Promise<AppUserAccount | undefined> {
    const raw = (usernameOrEmail || "").trim();
    if (!raw) return undefined;
    const clean = raw.toLowerCase();

    // 1. Check local/in-memory accounts (exact raw or lowercase match)
    const foundLocal = this.accounts.find(
      (a) =>
        a.id.toLowerCase() === clean ||
        a.username.toLowerCase() === clean ||
        a.id === raw ||
        a.username === raw
    );
    if (foundLocal) return foundLocal;

    // 2. Also check if raw is an email and someone registered just the prefix or vice-versa
    if (clean.includes("@")) {
      const prefix = clean.split("@")[0];
      const foundPrefix = this.accounts.find(
        (a) => a.username.toLowerCase() === prefix || a.id.toLowerCase() === prefix
      );
      if (foundPrefix) return foundPrefix;
    }

    // 3. Check defaults
    const foundDefault = DEFAULT_USER_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === clean || a.id.toLowerCase() === clean
    );
    if (foundDefault) return foundDefault;

    // 4. Query Firestore users/{clean} or users/{raw}
    try {
      let userSnap = await getDoc(doc(db, "users", clean));
      let docIdToUse = clean;
      if (!userSnap.exists() && raw !== clean) {
        userSnap = await getDoc(doc(db, "users", raw));
        docIdToUse = raw;
      }
      if (userSnap.exists()) {
        const data = userSnap.data();
        const acc: AppUserAccount = {
          id: docIdToUse,
          username: data.username || data.userName || raw,
          password: data.password || raw,
          role: data.role || (clean === "admin" ? "admin" : "user"),
          term: data.term || (data.role === "admin" ? undefined : "Summer 2026"),
          season: data.season || (data.role === "admin" ? undefined : "Summer"),
          year: data.year || (data.role === "admin" ? undefined : 2026),
          createdAt: data.createdAt || new Date().toISOString()
        };
        // Cache in memory
        if (!this.accounts.some((a) => a.id.toLowerCase() === docIdToUse.toLowerCase())) {
          this.accounts.push(acc);
          this.saveAccountsToLocalStorage();
          this.notifyAccountsListeners();
        }
        return acc;
      }

      // Check system/user_accounts document
      const systemSnap = await getDoc(doc(db, "system", "user_accounts"));
      if (systemSnap.exists()) {
        const data = systemSnap.data();
        if (data?.accounts && Array.isArray(data.accounts)) {
          const matched = data.accounts.find(
            (a: AppUserAccount) =>
              a.id?.toLowerCase() === clean ||
              a.username?.toLowerCase() === clean ||
              a.id === raw ||
              a.username === raw ||
              (clean.includes("@") &&
                (a.id?.toLowerCase() === clean.split("@")[0] ||
                  a.username?.toLowerCase() === clean.split("@")[0]))
          );
          if (matched) {
            if (!this.accounts.some((a) => a.id.toLowerCase() === matched.id.toLowerCase())) {
              this.accounts.push(matched);
              this.saveAccountsToLocalStorage();
              this.notifyAccountsListeners();
            }
            return matched;
          }
        }
      }
    } catch (e) {
      console.warn("Firestore lookup error in findAccountAsync:", e);
    }

    return undefined;
  }

  /**
   * Creates or updates a user account with unique username mapping.
   * Automatically initializes the user's Firestore document at /users/{userName}
   * and pre-seeds their network data.
   */
  public async createUserAccount(
    accountData: Omit<AppUserAccount, "createdAt">,
    allowOverwrite: boolean = false
  ): Promise<{ overwritten: boolean }> {
    const validation = this.validateUsername(accountData.username);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid username format.");
    }
    const clean = validation.clean;
    const lookupKey = clean.toLowerCase();

    // Check if taken
    const existing = this.accounts.find(
      (a) => a.id.toLowerCase() === lookupKey || a.username.toLowerCase() === lookupKey
    );

    let overwritten = false;
    if (existing) {
      if (!allowOverwrite) {
        throw new Error(`Username '${accountData.username}' is already taken.`);
      }
      overwritten = true;
    }

    const newAccount: AppUserAccount = {
      ...accountData,
      id: clean,
      username: clean,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      this.accounts = this.accounts.map((a) => (a.id.toLowerCase() === lookupKey ? newAccount : a));
    } else {
      this.accounts = [...this.accounts, newAccount];
    }

    // Ensure default accounts are present in this.accounts before persisting
    const finalAccountMap = new Map<string, AppUserAccount>();
    DEFAULT_USER_ACCOUNTS.forEach((a) => finalAccountMap.set(a.id.toLowerCase(), { ...a }));
    this.accounts.forEach((a) => {
      if (a && (a.id || a.username)) {
        const key = (a.id || a.username).toLowerCase();
        const def = DEFAULT_USER_ACCOUNTS.find((d) => d.id.toLowerCase() === key);
        finalAccountMap.set(key, {
          id: key,
          username: a.username || def?.username || key,
          password: a.password || def?.password || key,
          role: a.role || def?.role || (key === "admin" ? "admin" : "user"),
          term: a.term || def?.term || (a.role === "admin" || def?.role === "admin" ? undefined : "Summer 2026"),
          season: a.season || def?.season || (a.role === "admin" || def?.role === "admin" ? undefined : "Summer"),
          year: a.year || def?.year || (a.role === "admin" || def?.role === "admin" ? undefined : 2026),
          createdAt: a.createdAt || def?.createdAt || new Date().toISOString(),
          updatedAt: a.updatedAt
        });
      }
    });
    this.accounts = Array.from(finalAccountMap.values());

    this.notifyAccountsListeners();
    this.saveAccountsToLocalStorage();

    // Persist to system/user_accounts document
    if (!this.isLocalOnly && !this.isQuotaExhausted) {
      try {
        await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
      } catch (e) {
        this.handleFirestoreError(e, "persist accounts to system/user_accounts");
      }

      // Persist user document to users/{clean}
      try {
        const userDocRef = doc(db, "users", clean);
        await setDoc(userDocRef, {
          id: clean,
          userName: clean,
          name: clean,
          email: clean.includes("@") ? clean : `${clean}@network.org`,
          displayName: clean.charAt(0).toUpperCase() + clean.slice(1),
          role: newAccount.role,
          term: newAccount.term || (newAccount.role === "admin" ? undefined : "Summer 2026"),
          season: newAccount.season || (newAccount.role === "admin" ? undefined : "Summer"),
          year: newAccount.year || (newAccount.role === "admin" ? undefined : 2026),
          createdAt: newAccount.createdAt,
          updatedAt: newAccount.updatedAt
        }, { merge: true });

        // Pre-seed user's network workspace under /users/{clean}/...
        await this.seedInitialUserDataIfEmpty(clean);
      } catch (e) {
        this.handleFirestoreError(e, `initialize user profile for ${clean}`);
      }
    }

    return { overwritten };
  }

  public async updateUserAccount(username: string, updates: Partial<AppUserAccount>): Promise<void> {
    const raw = (username || "").trim();
    const clean = raw.toLowerCase();
    this.accounts = this.accounts.map((a) => {
      if (a.id.toLowerCase() === clean || a.username.toLowerCase() === clean || a.id === raw || a.username === raw) {
        return {
          ...a,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return a;
    });
    this.notifyAccountsListeners();
    this.saveAccountsToLocalStorage();

    if (!this.isLocalOnly && !this.isQuotaExhausted) {
      try {
        await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
        await setDoc(doc(db, "users", raw), {
          ...updates,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        if (raw !== clean) {
          await setDoc(doc(db, "users", clean), {
            ...updates,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (e) {
        this.handleFirestoreError(e, "update user account in Firestore");
      }
    }
  }

  public async deleteUserAccount(username: string): Promise<void> {
    const raw = (username || "").trim();
    const clean = raw.toLowerCase();
    if (clean === "admin") {
      throw new Error("Cannot delete primary administrator account.");
    }
    this.accounts = this.accounts.filter(
      (a) => a.id.toLowerCase() !== clean && a.username.toLowerCase() !== clean && a.id !== raw && a.username !== raw
    );
    this.notifyAccountsListeners();
    this.saveAccountsToLocalStorage();

    if (!this.isLocalOnly && !this.isQuotaExhausted) {
      try {
        await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
        await deleteDoc(doc(db, "users", raw));
        if (raw !== clean) {
          await deleteDoc(doc(db, "users", clean));
        }
      } catch (e) {
        this.handleFirestoreError(e, "delete user from Firestore");
      }
    }
  }

  // --- Active User Context & Synchronization ---

  /**
   * Synchronizes the active user session with DataService.
   * Ensures all subsequent data fetches and persistence operations map directly
   * to this user's unique username.
   */
  public setCurrentUser(user: any) {
    const prevUserName = this.currentUser ? this.getCurrentUserName() : null;
    this.currentUser = user;
    const newUserName = user ? this.getCurrentUserName() : null;

    if (prevUserName === newUserName && this.isLoaded) {
      return; // Same user, already loaded
    }

    // Unsubscribe from previous user's real-time listeners
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];

    this.isLoaded = false;

    // Load new user's local storage data or defaults immediately
    this.loadFromLocalStorage();
    this.notifyAll();

    // Set up real-time listeners and metadata for the new user mapped to their unique user name
    if (user) {
      this.saveUserMetadata(user);
      this.initUserListeners();
    }
  }

  private async saveUserMetadata(user: any) {
    if (!user || this.isLocalOnly || this.isQuotaExhausted) return;
    const userName = this.getCurrentUserName();
    if (!userName || userName === "global") return;

    try {
      // Document is mapped directly to unique userName: users/{userName}
      const userRef = doc(db, "users", userName);
      
      let displayName = user.displayName || "";
      if (!displayName) {
        if (userName === "user1") {
          displayName = "User 1";
        } else if (userName === "user2") {
          displayName = "User 2";
        } else if (userName === "user3") {
          displayName = "User 3";
        } else if (userName === "admin") {
          displayName = "Admin";
        } else if (userName) {
          displayName = userName.charAt(0).toUpperCase() + userName.slice(1);
        } else {
          displayName = "User";
        }
      }

      const account = this.getAccountByUsername(userName);
      const isAdminAccount = account?.role === "admin" || userName === "admin";
      const term = isAdminAccount ? undefined : (account?.term || "Summer 2026");
      const season = isAdminAccount ? undefined : (account?.season || "Summer");
      const year = isAdminAccount ? undefined : (account?.year || 2026);

      const updatePayload: any = {
        id: userName,
        uid: user.uid || userName,
        userName: userName,
        name: userName,
        email: user.email || `${userName}@network.org`,
        displayName: displayName,
        role: isAdminAccount ? "admin" : (account?.role || "user"),
        updatedAt: new Date().toISOString()
      };

      if (term) updatePayload.term = term;
      if (season) updatePayload.season = season;
      if (year) updatePayload.year = year;

      await setDoc(userRef, updatePayload, { merge: true });
    } catch (e) {
      this.handleFirestoreError(e, "saveUserMetadata");
    }
  }

  private async checkAndMigrateLegacyData(userName: string) {
    if (this.isLocalOnly || this.isQuotaExhausted || !this.currentUser?.uid || this.currentUser.uid === userName || this.currentUser.uid.startsWith("local-")) {
      return;
    }
    const legacyUid = this.currentUser.uid;
    try {
      const legacyDims = await getDocs(collection(db, "users", legacyUid, "domains"));
      if (!legacyDims.empty) {
        console.log(`Migrating legacy user data from ${legacyUid} to ${userName}...`);
        for (const d of legacyDims.docs) {
          await setDoc(doc(db, "users", userName, "domains", d.id), d.data());
          await deleteDoc(d.ref);
        }
        const legacyNodes = await getDocs(collection(db, "users", legacyUid, "nodes"));
        for (const n of legacyNodes.docs) {
          await setDoc(doc(db, "users", userName, "nodes", n.id), n.data());
          await deleteDoc(n.ref);
        }
        const legacyEdges = await getDocs(collection(db, "users", legacyUid, "edges"));
        for (const e of legacyEdges.docs) {
          await setDoc(doc(db, "users", userName, "edges", e.id), e.data());
          await deleteDoc(e.ref);
        }
        const legacyParams = await getDoc(doc(db, "users", legacyUid, "params", "default"));
        if (legacyParams.exists()) {
          await setDoc(doc(db, "users", userName, "params", "default"), legacyParams.data());
          await deleteDoc(legacyParams.ref);
        }
        const legacyConfig = await getDoc(doc(db, "users", legacyUid, "saved_config", "latest"));
        if (legacyConfig.exists()) {
          await setDoc(doc(db, "users", userName, "saved_config", "latest"), legacyConfig.data());
          await deleteDoc(legacyConfig.ref);
        }
        await deleteDoc(doc(db, "users", legacyUid));
        console.log(`Legacy data migration for ${userName} complete!`);
      }
    } catch (e) {
      this.handleFirestoreError(e, "checkAndMigrateLegacyData");
    }
  }

  public async resetUserFirestoreToSimple16Nodes(userName: string) {
    if (this.isLocalOnly || this.isQuotaExhausted || !userName || userName === "global") return;
    try {
      // 1. Clear existing network documents while preserving collection containers
      await this.clearFirestoreNetwork(userName);

      // 2. Seed standard 16-node network (4 domains, 16 indicators, 16 directed edges)
      const domainsToLoad = SIMPLE_DOMAINS;
      const nodesToLoad = SIMPLE_NODES.map((node) => ({
        ...node,
        id: node.abbr.toUpperCase(),
        abbr: node.abbr.toUpperCase()
      }));
      const edgesToLoad = parseSimpleEdges();
      const paramsToLoad = SIMPLE_PARAMS;

      for (const d of domainsToLoad) {
        await setDoc(doc(db, "users", userName, "domains", d.id), d);
      }
      for (const n of nodesToLoad) {
        await setDoc(doc(db, "users", userName, "nodes", n.id), n);
      }
      for (let i = 0; i < edgesToLoad.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = edgesToLoad.slice(i, i + 400);
        chunk.forEach((edge) => batch.set(doc(db, "users", userName, "edges", edge.id), edge));
        await batch.commit();
      }
      await setDoc(doc(db, "users", userName, "params", "default"), paramsToLoad);

      if (this.getCurrentUserName() === userName) {
        this.domains = [...domainsToLoad];
        this.nodes = [...nodesToLoad];
        this.edges = [...edgesToLoad];
        this.params = { ...paramsToLoad };
        this.saveToLocalStorageOnly();
        this.notifyAll();
      }
      console.log(`Successfully reset user '${userName}' in Firestore to 16-node default network.`);
    } catch (e) {
      this.handleFirestoreError(e, `resetUserFirestoreToSimple16Nodes for ${userName}`);
    }
  }

  private async seedInitialUserDataIfEmpty(userName: string) {
    if (this.isLocalOnly || this.isQuotaExhausted || !userName || userName === "global" || this.isRestoring) return;
    try {
      const snap = await getDocs(collection(db, "users", userName, "domains"));
      if (!snap.empty) {
        return; // User already has domain data in Firestore
      }

      // Check if user has saved config in Firestore or local storage before seeding defaults
      const savedConfig = await this.getCustomNetworkConfig();
      if (savedConfig && savedConfig.domains && savedConfig.domains.length > 0) {
        console.log(`Seeding user '${userName}' workspace from saved configuration '${savedConfig.name || "Latest Saved Config"}'...`);
        await this.restoreCustomNetworkConfig(savedConfig);
        return;
      }

      const isAdmin = this.isUserAdmin(userName);
      console.log(`Seeding initial network data for user '${userName}' (admin: ${isAdmin}) in Firestore...`);
      const domainsToLoad = isAdmin ? DEFAULT_DOMAINS : SIMPLE_DOMAINS;
      const nodesToLoad = (isAdmin ? DEFAULT_NODES : SIMPLE_NODES).map((node) => ({
        ...node,
        id: node.abbr.toUpperCase(),
        abbr: node.abbr.toUpperCase()
      }));
      const edgesToLoad = isAdmin ? parseDefaultEdges() : parseSimpleEdges();
      const paramsToLoad = isAdmin ? DEFAULT_PARAMS : SIMPLE_PARAMS;

      for (const d of domainsToLoad) {
        await setDoc(doc(db, "users", userName, "domains", d.id), d);
      }
      for (const n of nodesToLoad) {
        await setDoc(doc(db, "users", userName, "nodes", n.id), n);
      }
      for (let i = 0; i < edgesToLoad.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = edgesToLoad.slice(i, i + 400);
        chunk.forEach((edge) => batch.set(doc(db, "users", userName, "edges", edge.id), edge));
        await batch.commit();
      }
      await setDoc(doc(db, "users", userName, "params", "default"), paramsToLoad);
      console.log(`Initial network data successfully seeded for user '${userName}' (${isAdmin ? 40 : 16} nodes)`);
    } catch (e) {
      this.handleFirestoreError(e, `seedInitialUserData for ${userName}`);
    }
  }

  private initUserListeners() {
    if (!this.currentUser) return;
    const userName = this.getCurrentUserName();
    if (!userName || userName === "global") return;

    if (this.isLocalOnly || this.isQuotaExhausted) {
      this.isLoaded = true;
      return;
    }

    try {
      this.checkAndMigrateLegacyData(userName);

      // 1. Domains Listener mapped to users/{userName}/domains
      const unsubDims = onSnapshot(
        collection(db, "users", userName, "domains"),
        async (snapshot) => {
          if (this.isRestoring || this.isClearing) return;
          const list: Domain[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.id.startsWith("_")) return;
            const data = docSnap.data() as Domain;
            if ((data as any).placeholder) return;
            list.push(data);
          });
          list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
          this.domains = list;

          // If completely empty in Firestore (no documents or placeholders) and not loaded, seed initial user network
          if (list.length === 0 && snapshot.empty && !this.isLoaded && !this.isRestoring && !this.isClearing && !this.isLocalOnly && !this.isQuotaExhausted) {
            await this.seedInitialUserDataIfEmpty(userName);
          }

          if (!this.isRestoring && !this.isClearing) {
            this.notifyDomainListeners();
            this.saveToLocalStorageOnly();
          }
          this.isLoaded = true;
        },
        (err) => {
          this.handleFirestoreError(err, `domains loading for ${userName}`);
          this.isLoaded = true;
        }
      );

      // 2. Nodes Listener mapped to users/{userName}/nodes
      const unsubNodes = onSnapshot(
        collection(db, "users", userName, "nodes"),
        async (snapshot) => {
          if (this.isRestoring || this.isClearing) return;
          const list: NodeIndicator[] = [];
          const seenAbbrs = new Set<string>();
          snapshot.forEach((docSnap) => {
            if (docSnap.id.startsWith("_")) return;
            const node = docSnap.data() as NodeIndicator;
            if ((node as any).placeholder) return;
            const standardizedId = node.abbr.trim().toUpperCase();
            const standardizedNode: NodeIndicator = {
              ...node,
              id: standardizedId,
              abbr: standardizedId
            };
            if (!seenAbbrs.has(standardizedNode.abbr)) {
              seenAbbrs.add(standardizedNode.abbr);
              list.push(standardizedNode);
            }
          });
          list.sort((a, b) => a.abbr.localeCompare(b.abbr));
          this.nodes = list;

          if (!this.isRestoring && !this.isClearing) {
            this.notifyNodeListeners();
            this.saveToLocalStorageOnly();
          }
          this.isLoaded = true;
        },
        (err) => {
          this.handleFirestoreError(err, `nodes loading for ${userName}`);
          this.isLoaded = true;
        }
      );

      // 3. Edges Listener mapped to users/{userName}/edges
      const unsubEdges = onSnapshot(
        collection(db, "users", userName, "edges"),
        (snapshot) => {
          if (this.isRestoring || this.isClearing) return;
          const list: Edge[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.id.startsWith("_")) return;
            const edge = docSnap.data() as Edge;
            if ((edge as any).placeholder) return;
            list.push(edge);
          });
          this.edges = list;

          if (!this.isRestoring && !this.isClearing) {
            this.notifyEdgeListeners();
            this.saveToLocalStorageOnly();
          }
          this.isLoaded = true;
        },
        (err) => {
          this.handleFirestoreError(err, `edges loading for ${userName}`);
          this.isLoaded = true;
        }
      );

      // 4. Params Listener mapped to users/{userName}/params/default
      const unsubParams = onSnapshot(
        doc(db, "users", userName, "params", "default"),
        (snapshot) => {
          if (this.isRestoring) return;
          if (snapshot.exists()) {
            this.params = snapshot.data() as SimulatorParams;
          }
          if (!this.isRestoring) {
            this.notifyParamsListeners();
            this.saveToLocalStorageOnly();
          }
          this.isLoaded = true;
        },
        (err) => {
          this.handleFirestoreError(err, `params loading for ${userName}`);
          this.isLoaded = true;
        }
      );

      this.unsubs.push(unsubDims, unsubNodes, unsubEdges, unsubParams);
    } catch (e) {
      this.handleFirestoreError(e, `init user listeners for ${userName}`);
      this.isLoaded = true;
    }
  }

  // --- Local Storage Management (Mapped by UserName) ---

  private getLocalStorageKeys() {
    const userName = this.getCurrentUserName();
    return {
      domains: `network_domains_${userName}`,
      nodes: `ursa_nodes_${userName}`,
      edges: `ursa_edges_${userName}`,
      params: `ursa_params_${userName}`,
      savedConfig: `network_saved_config_${userName}`
    };
  }

  private loadDefaults() {
    const userName = this.getCurrentUserName();
    const isAdmin = this.isUserAdmin(userName);
    
    if (isAdmin) {
      this.domains = [...DEFAULT_DOMAINS];
      this.nodes = DEFAULT_NODES.map(node => ({
        ...node,
        id: node.abbr.toUpperCase(),
        abbr: node.abbr.toUpperCase()
      }));
      this.edges = parseDefaultEdges();
      this.params = { ...DEFAULT_PARAMS };
    } else {
      this.domains = [...SIMPLE_DOMAINS];
      this.nodes = SIMPLE_NODES.map(node => ({
        ...node,
        id: node.abbr.toUpperCase(),
        abbr: node.abbr.toUpperCase()
      }));
      this.edges = parseSimpleEdges();
      this.params = { ...SIMPLE_PARAMS };
    }
    
    this.saveToLocalStorageOnly();
    this.notifyAll();
  }

  private loadFromLocalStorage() {
    try {
      const keys = this.getLocalStorageKeys();
      let savedDomains = localStorage.getItem(keys.domains);
      let savedNodes = localStorage.getItem(keys.nodes);
      let savedEdges = localStorage.getItem(keys.edges);
      let savedParams = localStorage.getItem(keys.params);

      // If keys by username not found, check if legacy keys by uid exist to migrate them
      if (!savedDomains && this.currentUser?.uid) {
        const legacyUid = this.currentUser.uid;
        savedDomains = localStorage.getItem(`network_domains_${legacyUid}`);
        savedNodes = localStorage.getItem(`ursa_nodes_${legacyUid}`);
        savedEdges = localStorage.getItem(`ursa_edges_${legacyUid}`);
        savedParams = localStorage.getItem(`ursa_params_${legacyUid}`);
      }

      if (savedDomains && savedNodes && savedEdges) {
        const loadedDomains = JSON.parse(savedDomains) as Domain[];
        const rawNodes = JSON.parse(savedNodes) as NodeIndicator[];
        const loadedEdges = JSON.parse(savedEdges);
        
        this.domains = loadedDomains;
        
        const normalizedList: NodeIndicator[] = [];
        const seenAbbrs = new Set<string>();
        for (const n of rawNodes) {
          const standardizedId = n.abbr.trim().toUpperCase();
          const standardizedNode = {
            ...n,
            id: standardizedId,
            abbr: standardizedId
          };
          if (!seenAbbrs.has(standardizedNode.abbr)) {
            seenAbbrs.add(standardizedNode.abbr);
            normalizedList.push(standardizedNode);
          }
        }
        this.nodes = normalizedList;
        this.edges = loadedEdges;

        if (savedParams) {
          this.params = JSON.parse(savedParams);
        } else {
          const userName = this.getCurrentUserName();
          const isAdmin = this.isUserAdmin(userName);
          this.params = isAdmin ? { ...DEFAULT_PARAMS } : { ...SIMPLE_PARAMS };
        }
      } else {
        this.loadDefaults();
      }
    } catch (e) {
      console.error("Local storage load failed, resetting to defaults:", e);
      this.loadDefaults();
    }
  }

  private saveToLocalStorageOnly() {
    try {
      const keys = this.getLocalStorageKeys();
      localStorage.setItem(keys.domains, JSON.stringify(this.domains));
      localStorage.setItem(keys.nodes, JSON.stringify(this.nodes));
      localStorage.setItem(keys.edges, JSON.stringify(this.edges));
      localStorage.setItem(keys.params, JSON.stringify(this.params));
    } catch (e) {
      console.error("Local storage save failed:", e);
    }
  }

  // --- Real-time Listeners and State Notifications ---

  private notifyDomainListeners() {
    this.domainListeners.forEach((listener) => listener([...this.domains]));
  }

  private notifyNodeListeners() {
    this.nodeListeners.forEach((listener) => listener([...this.nodes]));
  }

  private notifyEdgeListeners() {
    this.edgeListeners.forEach((listener) => listener([...this.edges]));
  }

  private notifyParamsListeners() {
    this.paramsListeners.forEach((listener) => listener({ ...this.params }));
  }

  private notifyStatusListeners() {
    this.statusListeners.forEach((listener) => listener(this.isLocalOnly));
  }

  private notifyLimitsListeners() {
    this.limitsListeners.forEach((listener) => listener({ ...this.limits }));
  }

  private notifyAll() {
    this.notifyDomainListeners();
    this.notifyNodeListeners();
    this.notifyEdgeListeners();
    this.notifyParamsListeners();
    this.notifyStatusListeners();
    this.notifyLimitsListeners();
  }

  // --- Limits & System Listeners ---

  private initSystemLimitsListener() {
    try {
      if (this.systemUnsub) {
        this.systemUnsub();
      }
      this.systemUnsub = onSnapshot(
        doc(db, "system", "slider_limits"),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as Partial<SimulationLimitsConfig>;
            this.limits = {
              ...DEFAULT_SIMULATION_LIMITS,
              ...data
            };
          }
          this.notifyLimitsListeners();
          try {
            localStorage.setItem("ursa_simulation_limits", JSON.stringify(this.limits));
          } catch (e) {
            // LocalStorage quota
          }
        },
        (err) => {
          console.warn("System slider limits Firestore listener failed, using local/default:", err);
        }
      );
    } catch (e) {
      console.warn("Failed to attach system slider limits listener:", e);
    }
  }

  public subscribeLimits(listener: (l: SimulationLimitsConfig) => void): () => void {
    this.limitsListeners.add(listener);
    listener({ ...this.limits });
    return () => this.limitsListeners.delete(listener);
  }

  public getSimulationLimits(): SimulationLimitsConfig {
    return { ...this.limits };
  }

  public async saveSimulationLimits(newLimits: SimulationLimitsConfig): Promise<void> {
    this.limits = { ...newLimits };
    this.notifyLimitsListeners();
    try {
      localStorage.setItem("ursa_simulation_limits", JSON.stringify(this.limits));
    } catch (e) {
      console.warn("Failed to write simulation limits to localStorage:", e);
    }

    if (!this.isLocalOnly && !this.isQuotaExhausted) {
      try {
        await setDoc(doc(db, "system", "slider_limits"), newLimits);
      } catch (e) {
        this.handleFirestoreError(e, "saveSimulationLimits");
      }
    }
  }

  public async resetSimulationLimits(): Promise<void> {
    await this.saveSimulationLimits(DEFAULT_SIMULATION_LIMITS);
  }

  // --- Learn Visibility Configuration ---

  private loadLearnVisibilityFromLocalStorage() {
    try {
      const saved = localStorage.getItem("ursa_learn_visibility");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.learnVisibility = {
          ...DEFAULT_LEARN_VISIBILITY,
          ...parsed
        };
      }
    } catch (e) {
      this.learnVisibility = { ...DEFAULT_LEARN_VISIBILITY };
    }
  }

  private initLearnVisibilityListener() {
    try {
      if (this.learnVisibilityUnsub) {
        this.learnVisibilityUnsub();
      }
      this.learnVisibilityUnsub = onSnapshot(
        doc(db, "system", "learn_visibility"),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as Partial<LearnVisibilityConfig>;
            this.learnVisibility = {
              ...DEFAULT_LEARN_VISIBILITY,
              ...data
            };
          }
          this.notifyLearnVisibilityListeners();
          try {
            localStorage.setItem("ursa_learn_visibility", JSON.stringify(this.learnVisibility));
          } catch (e) {
            // LocalStorage blocked
          }
        },
        (err) => {
          this.handleFirestoreError(err, "system learn visibility listener");
        }
      );
    } catch (e) {
      this.handleFirestoreError(e, "attach learn visibility listener");
    }
  }

  private notifyLearnVisibilityListeners() {
    this.learnVisibilityListeners.forEach((listener) => listener({ ...this.learnVisibility }));
  }

  public subscribeLearnVisibility(listener: (v: LearnVisibilityConfig) => void): () => void {
    this.learnVisibilityListeners.add(listener);
    listener({ ...this.learnVisibility });
    return () => this.learnVisibilityListeners.delete(listener);
  }

  public getLearnVisibility(): LearnVisibilityConfig {
    return { ...this.learnVisibility };
  }

  public async saveLearnVisibility(newVisibility: LearnVisibilityConfig): Promise<void> {
    this.learnVisibility = { ...newVisibility };
    this.notifyLearnVisibilityListeners();
    try {
      localStorage.setItem("ursa_learn_visibility", JSON.stringify(this.learnVisibility));
    } catch (e) {
      console.warn("Failed to write learn visibility to localStorage:", e);
    }

    if (!this.isLocalOnly && !this.isQuotaExhausted) {
      try {
        await setDoc(doc(db, "system", "learn_visibility"), newVisibility);
      } catch (e) {
        this.handleFirestoreError(e, "saveLearnVisibility");
      }
    }
  }

  public async resetLearnVisibility(): Promise<void> {
    await this.saveLearnVisibility(DEFAULT_LEARN_VISIBILITY);
  }

  // --- Subscriptions for Core App Data ---

  public subscribeDomains(listener: Listener<Domain>): () => void {
    this.domainListeners.add(listener);
    listener([...this.domains]);
    return () => this.domainListeners.delete(listener);
  }

  public subscribeNodes(listener: Listener<NodeIndicator>): () => void {
    this.nodeListeners.add(listener);
    listener([...this.nodes]);
    return () => this.nodeListeners.delete(listener);
  }

  public subscribeEdges(listener: Listener<Edge>): () => void {
    this.edgeListeners.add(listener);
    listener([...this.edges]);
    return () => this.edgeListeners.delete(listener);
  }

  public subscribeParams(listener: (p: SimulatorParams) => void): () => void {
    this.paramsListeners.add(listener);
    listener({ ...this.params });
    return () => this.paramsListeners.delete(listener);
  }

  public subscribeStatus(listener: (isLocal: boolean) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.isLocalOnly);
    return () => this.statusListeners.delete(listener);
  }

  public getIsLocalOnly(): boolean {
    return this.isLocalOnly;
  }

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  // --- CRUD Operations Mapped to Unique Username ---

  public async saveParams(p: SimulatorParams) {
    this.params = p;
    this.saveToLocalStorageOnly();
    this.notifyParamsListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "params", p.id || "default"), p);
      } catch (e) {
        this.handleFirestoreError(e, `saveParams for ${userName}`);
      }
    }
  }

  public async saveDomain(domain: Domain) {
    const exists = this.domains.some(d => d.id === domain.id);
    if (exists) {
      this.domains = this.domains.map(d => d.id === domain.id ? domain : d);
    } else {
      this.domains = [...this.domains, domain];
      this.domains.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    }
    this.saveToLocalStorageOnly();
    this.notifyDomainListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "domains", domain.id), domain);
      } catch (e) {
        this.handleFirestoreError(e, `saveDomain for ${userName}`);
      }
    }
  }

  public async deleteDomain(id: string) {
    this.domains = this.domains.filter(d => d.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyDomainListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await deleteDoc(doc(db, "users", userName, "domains", id));
        if (this.domains.length === 0) {
          await setDoc(doc(db, "users", userName, "domains", "_placeholder"), {
            placeholder: true,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        this.handleFirestoreError(e, `deleteDomain for ${userName}`);
      }
    }
  }

  public async saveNode(node: NodeIndicator) {
    const standardizedId = node.abbr.trim().toUpperCase();
    const standardizedNode: NodeIndicator = {
      ...node,
      id: standardizedId,
      abbr: standardizedId
    };

    const exists = this.nodes.some(n => n.id.toUpperCase() === standardizedId || n.abbr.toUpperCase() === standardizedId);
    if (exists) {
      this.nodes = this.nodes.map(n => (n.id.toUpperCase() === standardizedId || n.abbr.toUpperCase() === standardizedId) ? standardizedNode : n);
    } else {
      this.nodes = [...this.nodes, standardizedNode];
      this.nodes.sort((a, b) => a.abbr.localeCompare(b.abbr));
    }
    this.saveToLocalStorageOnly();
    this.notifyNodeListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "nodes", standardizedId), standardizedNode);
        const originalId = node.id;
        if (originalId && originalId !== standardizedId) {
          await deleteDoc(doc(db, "users", userName, "nodes", originalId));
        }
      } catch (e) {
        this.handleFirestoreError(e, `saveNode for ${userName}`);
      }
    }
  }

  public async deleteNode(id: string) {
    const uppercaseId = id.toUpperCase();
    const edgesToDelete = this.edges.filter(edge => edge.source.toUpperCase() === uppercaseId || edge.target.toUpperCase() === uppercaseId);
    
    this.edges = this.edges.filter(edge => edge.source.toUpperCase() !== uppercaseId && edge.target.toUpperCase() !== uppercaseId);
    this.nodes = this.nodes.filter(n => n.id.toUpperCase() !== uppercaseId && n.abbr.toUpperCase() !== uppercaseId);
    this.saveToLocalStorageOnly();
    this.notifyNodeListeners();
    this.notifyEdgeListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await deleteDoc(doc(db, "users", userName, "nodes", id));
        if (id !== uppercaseId) {
          await deleteDoc(doc(db, "users", userName, "nodes", uppercaseId));
        }
        for (const edge of edgesToDelete) {
          await deleteDoc(doc(db, "users", userName, "edges", edge.id));
        }
        if (this.nodes.length === 0) {
          await setDoc(doc(db, "users", userName, "nodes", "_placeholder"), {
            placeholder: true,
            updatedAt: new Date().toISOString()
          });
        }
        if (this.edges.length === 0) {
          await setDoc(doc(db, "users", userName, "edges", "_placeholder"), {
            placeholder: true,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        this.handleFirestoreError(e, `deleteNode for ${userName}`);
      }
    }
  }

  public async saveEdge(edge: Edge) {
    const exists = this.edges.some(e => e.id === edge.id);
    if (!exists) {
      this.edges = [...this.edges, edge];
    }
    this.saveToLocalStorageOnly();
    this.notifyEdgeListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "edges", edge.id), edge);
      } catch (e) {
        this.handleFirestoreError(e, `saveEdge for ${userName}`);
      }
    }
  }

  public async deleteEdge(id: string) {
    this.edges = this.edges.filter(e => e.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyEdgeListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await deleteDoc(doc(db, "users", userName, "edges", id));
        if (this.edges.length === 0) {
          await setDoc(doc(db, "users", userName, "edges", "_placeholder"), {
            placeholder: true,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        this.handleFirestoreError(e, `deleteEdge for ${userName}`);
      }
    }
  }

  private async clearFirestoreNetwork(userName: string) {
    if (this.isLocalOnly || this.isQuotaExhausted || !userName || userName === "global") return;
    try {
      const dimsRef = collection(db, "users", userName, "domains");
      const dimsSnap = await getDocs(dimsRef);

      const nodesRef = collection(db, "users", userName, "nodes");
      const nodesSnap = await getDocs(nodesRef);

      const edgesRef = collection(db, "users", userName, "edges");
      const edgesSnap = await getDocs(edgesRef);

      // Collect all sub-data documents to delete (keep placeholder so Firestore preserves collection containers)
      const allDocsToDelete = [
        ...dimsSnap.docs.filter((d) => d.id !== "_placeholder"),
        ...nodesSnap.docs.filter((n) => n.id !== "_placeholder"),
        ...edgesSnap.docs.filter((e) => e.id !== "_placeholder")
      ];

      // Delete sub-data in batches
      for (let i = 0; i < allDocsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = allDocsToDelete.slice(i, i + 400);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }

      // Ensure placeholder documents exist so the collections 'domains', 'nodes', and 'edges'
      // are permanently retained in Firestore without removing them from the user's hierarchy
      const keepBatch = writeBatch(db);
      keepBatch.set(doc(db, "users", userName, "domains", "_placeholder"), {
        placeholder: true,
        updatedAt: new Date().toISOString()
      });
      keepBatch.set(doc(db, "users", userName, "nodes", "_placeholder"), {
        placeholder: true,
        updatedAt: new Date().toISOString()
      });
      keepBatch.set(doc(db, "users", userName, "edges", "_placeholder"), {
        placeholder: true,
        updatedAt: new Date().toISOString()
      });
      await keepBatch.commit();
    } catch (e) {
      this.handleFirestoreError(e, `clearFirestoreNetwork for ${userName}`);
    }
  }

  public async clearNetwork() {
    this.isClearing = true;
    try {
      this.domains = [];
      this.nodes = [];
      this.edges = [];
      this.saveToLocalStorageOnly();
      this.notifyAll();

      const userName = this.getCurrentUserName();
      if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
        await this.clearFirestoreNetwork(userName);
      }
    } finally {
      this.isClearing = false;
      this.domains = [];
      this.nodes = [];
      this.edges = [];
      this.saveToLocalStorageOnly();
      this.notifyAll();
    }
  }

  // --- Network Config Backup / Restore (Mapped to Unique Username) ---

  public async saveCustomNetworkConfig(name: string): Promise<void> {
    const config: SavedNetworkConfig = {
      name: name.trim(),
      savedAt: new Date().toLocaleString(),
      domains: [...this.domains],
      nodes: [...this.nodes],
      edges: [...this.edges],
      params: { ...this.params }
    };

    const userName = this.getCurrentUserName();
    const keys = this.getLocalStorageKeys();

    try {
      localStorage.setItem(keys.savedConfig, JSON.stringify(config));
    } catch (e) {
      console.error("Failed to save custom config to local storage:", e);
    }

    if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "saved_config", "latest"), config);
      } catch (e) {
        this.handleFirestoreError(e, `saveCustomNetworkConfig for ${userName}`);
      }
    }
  }

  public async getCustomNetworkConfig(targetUserName?: string): Promise<SavedNetworkConfig | null> {
    const rawTarget = targetUserName || this.getCurrentUserName();
    const cleanUserName = (rawTarget || "").trim();

    if (cleanUserName && cleanUserName !== "global") {
      try {
        const candidates = [cleanUserName, cleanUserName.toLowerCase()];
        if (cleanUserName.toLowerCase() === "user3") {
          candidates.push("jorTdhQZINafzcumb5tCjhzmgr12");
        }
        if (cleanUserName.toLowerCase() === "user4") {
          candidates.push("fDpHiKWT8pWeNH78zTAv53ESNqD2");
        }
        if (this.currentUser?.uid && !candidates.includes(this.currentUser.uid)) {
          candidates.push(this.currentUser.uid);
        }

        // 1. Direct candidate ID lookup for saved_config/latest
        for (const c of candidates) {
          try {
            const snap = await getDoc(doc(db, "users", c, "saved_config", "latest"));
            if (snap.exists()) {
              const data = snap.data() as SavedNetworkConfig;
              if (data && data.domains && data.domains.length > 0) {
                return data;
              }
            }
          } catch (err: any) {
            console.warn(`Could not read saved_config/latest for candidate ${c}:`, err?.message);
          }
        }

        // 2. Query users collection to resolve mapped UIDs (e.g. jorTdhQZINafzcumb5tCjhzmgr12 -> user3)
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          for (const uDoc of usersSnap.docs) {
            const uData = uDoc.data();
            const matches =
              uDoc.id.toLowerCase() === cleanUserName.toLowerCase() ||
              uData?.userName?.toLowerCase() === cleanUserName.toLowerCase() ||
              uData?.name?.toLowerCase() === cleanUserName.toLowerCase() ||
              uData?.email?.toLowerCase() === `${cleanUserName.toLowerCase()}@network.org` ||
              uData?.email?.toLowerCase().startsWith(`${cleanUserName.toLowerCase()}@`);
            if (matches) {
              const snap = await getDoc(doc(db, "users", uDoc.id, "saved_config", "latest"));
              if (snap.exists()) {
                const data = snap.data() as SavedNetworkConfig;
                if (data && data.domains && data.domains.length > 0) {
                  return data;
                }
              }
            }
          }
        } catch (err: any) {
          console.warn(`Could not scan users collection for ${cleanUserName}:`, err?.message);
        }

        // 3. Check any doc in saved_config subcollection
        for (const c of candidates) {
          try {
            const collSnap = await getDocs(collection(db, "users", c, "saved_config"));
            if (!collSnap.empty) {
              for (const docSnap of collSnap.docs) {
                const data = docSnap.data() as SavedNetworkConfig;
                if (data && data.domains && data.domains.length > 0) {
                  return data;
                }
              }
            }
          } catch (err: any) {
            console.warn(`Could not read saved_config collection for ${c}:`, err?.message);
          }
        }

        // 4. Check if live Firestore network (domains, nodes, edges) exists for candidate
        for (const c of candidates) {
          try {
            const dimsSnap = await getDocs(collection(db, "users", c, "domains"));
            const dList: Domain[] = [];
            dimsSnap.forEach((d) => {
              if (d.id.startsWith("_")) return;
              const data = d.data() as Domain;
              if ((data as any).placeholder) return;
              dList.push(data);
            });
            dList.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

            const nodesSnap = await getDocs(collection(db, "users", c, "nodes"));
            const nList: NodeIndicator[] = [];
            nodesSnap.forEach((n) => {
              if (n.id.startsWith("_")) return;
              const data = n.data() as NodeIndicator;
              if ((data as any).placeholder) return;
              nList.push(data);
            });

            const edgesSnap = await getDocs(collection(db, "users", c, "edges"));
            const eList: Edge[] = [];
            edgesSnap.forEach((e) => {
              if (e.id.startsWith("_")) return;
              const data = e.data() as Edge;
              if ((data as any).placeholder) return;
              eList.push(data);
            });

            let p = { ...this.params };
            try {
              const pSnap = await getDoc(doc(db, "users", c, "params", "default"));
              if (pSnap.exists()) {
                p = pSnap.data() as any;
              }
            } catch {}

            if (dList.length > 0 && nList.length > 0) {
                // Determine savedAt from user metadata or fallback rather than generating current timestamp
                let recordedTime = "";
                try {
                  const uSnap = await getDoc(doc(db, "users", c));
                  if (uSnap.exists()) {
                    const uData = uSnap.data();
                    if (uData?.updatedAt) {
                      recordedTime = new Date(uData.updatedAt).toLocaleString();
                    } else if (uData?.createdAt) {
                      recordedTime = new Date(uData.createdAt).toLocaleString();
                    }
                  }
                } catch {}

                return {
                  name: `${cleanUserName} Active Network`,
                  savedAt: recordedTime || "Original Setup",
                  domains: dList,
                  nodes: nList,
                  edges: eList,
                  params: p
                };
              }
          } catch (err: any) {
            console.warn(`Could not read live network subcollections for ${c}:`, err?.message);
          }
        }
      } catch (e) {
        console.warn(`Firestore read attempt failed for ${cleanUserName}:`, e);
      }
    }

    // 5. Local storage fallback
    try {
      const keys = this.getLocalStorageKeys();
      const localKeysToTry = [
        `network_saved_config_${cleanUserName.toLowerCase()}`,
        `network_saved_config_${cleanUserName}`,
        keys.savedConfig,
        `ursa_saved_config_${cleanUserName.toLowerCase()}`,
        "ursa_saved_config"
      ];
      for (const k of localKeysToTry) {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved) as SavedNetworkConfig;
          if (parsed && parsed.domains && parsed.domains.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error("Failed to read saved config from local storage:", e);
    }

    return null;
  }

  public async restoreSavedConfigFromFirestore(targetUserName?: string): Promise<SavedNetworkConfig> {
    const userName = (targetUserName || this.getCurrentUserName()).trim();
    const config = await this.getCustomNetworkConfig(userName);
    if (!config || !config.domains || config.domains.length === 0) {
      throw new Error(`No saved configuration found for user "${userName}" under 'saved_config --> latest'. Please save a configuration first or upload a JSON backup.`);
    }
    await this.restoreCustomNetworkConfig(config);
    return config;
  }

  public async restoreCustomNetworkConfig(config: SavedNetworkConfig): Promise<void> {
    if (!config || !config.domains || !config.nodes) {
      throw new Error("Invalid network configuration format.");
    }

    this.isRestoring = true;

    try {
      const normalizedNodes = (config.nodes || []).map(node => ({
        ...node,
        id: node.abbr.toUpperCase(),
        abbr: node.abbr.toUpperCase()
      }));

      this.domains = [...(config.domains || [])];
      this.nodes = normalizedNodes;
      this.edges = [...(config.edges || [])];
      this.params = config.params ? { ...config.params } : { ...this.params };

      const userName = this.getCurrentUserName();
      this.saveToLocalStorageOnly();

      // Persist config backup to local storage
      const keys = this.getLocalStorageKeys();

      // Crucial: preserve the time at which the backup was made; NEVER overwrite with current load/restore time
      const rawSavedAt =
        config.savedAt ||
        (config as any).createdAt ||
        (config as any).timestamp ||
        (config as any).saved_at ||
        (config as any).created_at ||
        (config as any).date;

      const preservedSavedAt =
        typeof rawSavedAt === "string" && rawSavedAt.trim()
          ? rawSavedAt.trim()
          : typeof rawSavedAt === "number"
          ? new Date(rawSavedAt).toLocaleString()
          : new Date().toLocaleString();

      const configToSave: SavedNetworkConfig = {
        name: config.name || "Restored Network",
        savedAt: preservedSavedAt,
        domains: [...this.domains],
        nodes: [...this.nodes],
        edges: [...this.edges],
        params: { ...this.params }
      };

      try {
        localStorage.setItem(keys.savedConfig, JSON.stringify(configToSave));
        localStorage.setItem("ursa_saved_config", JSON.stringify(configToSave));
      } catch (e) {
        console.warn("Failed to update saved config in local storage during restore:", e);
      }

      if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
        try {
          await this.clearFirestoreNetwork(userName);

          for (const domain of this.domains) {
            await setDoc(doc(db, "users", userName, "domains", domain.id), domain);
          }
          for (const node of normalizedNodes) {
            await setDoc(doc(db, "users", userName, "nodes", node.id), node);
          }
          for (let i = 0; i < this.edges.length; i += 400) {
            const edgeBatch = writeBatch(db);
            const chunk = this.edges.slice(i, i + 400);
            chunk.forEach((edge) => {
              edgeBatch.set(doc(db, "users", userName, "edges", edge.id), edge);
            });
            await edgeBatch.commit();
          }
          if (this.params) {
            await setDoc(doc(db, "users", userName, "params", "default"), this.params);
          }
          await setDoc(doc(db, "users", userName, "saved_config", "latest"), configToSave);
        } catch (e) {
          this.handleFirestoreError(e, `sync restored config for ${userName}`);
        }
      }
    } finally {
      this.isRestoring = false;
      this.notifyAll();
      this.saveToLocalStorageOnly();
    }
  }

  public async importDefaultNetwork() {
    this.isRestoring = true;
    try {
      this.loadDefaults();
      this.saveToLocalStorageOnly();
      this.notifyAll();

      const userName = this.getCurrentUserName();
      if (!this.isLocalOnly && !this.isQuotaExhausted && userName && userName !== "global") {
        try {
          const isAdmin = this.isUserAdmin(userName);
          const domainsToLoad = isAdmin ? DEFAULT_DOMAINS : SIMPLE_DOMAINS;
          const nodesToLoad = (isAdmin ? DEFAULT_NODES : SIMPLE_NODES).map(node => ({
            ...node,
            id: node.abbr.toUpperCase(),
            abbr: node.abbr.toUpperCase()
          }));
          const edgesToLoad = isAdmin ? parseDefaultEdges() : parseSimpleEdges();
          const paramsToLoad = isAdmin ? DEFAULT_PARAMS : SIMPLE_PARAMS;

          // Clear out any obsolete Firestore documents first while preserving collection containers
          await this.clearFirestoreNetwork(userName);

          for (const domain of domainsToLoad) {
            await setDoc(doc(db, "users", userName, "domains", domain.id), domain);
          }
          for (const node of nodesToLoad) {
            await setDoc(doc(db, "users", userName, "nodes", node.id), node);
          }
          for (let i = 0; i < edgesToLoad.length; i += 400) {
            const edgeBatch = writeBatch(db);
            const chunk = edgesToLoad.slice(i, i + 400);
            chunk.forEach((edge) => {
              edgeBatch.set(doc(db, "users", userName, "edges", edge.id), edge);
            });
            await edgeBatch.commit();
          }
          await setDoc(doc(db, "users", userName, "params", "default"), paramsToLoad);
          console.log(`Default network successfully imported for user: ${userName} (${isAdmin ? 40 : 16} nodes)`);
        } catch (e) {
          this.handleFirestoreError(e, `importDefaultNetwork for ${userName}`);
        }
      }
    } finally {
      this.isRestoring = false;
      this.saveToLocalStorageOnly();
      this.notifyAll();
    }
  }
}

export const dataService = new DataService();
