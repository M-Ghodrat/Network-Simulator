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
  private isLoaded = false;
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

  private init() {
    // Immediate local copy loading
    this.loadFromLocalStorage();
    this.loadAccountsFromLocalStorage();
    this.loadLearnVisibilityFromLocalStorage();
    this.initSystemLimitsListener();
    this.initAccountsListener();
    this.initLearnVisibilityListener();
  }

  // --- Unique Username Helpers & Validation ---

  /**
   * Returns the clean, lowercase unique username for the current active user.
   * Guarantees all data (domains, nodes, edges, params, configs) maps directly to this user name.
   */
  public getCurrentUserName(): string {
    if (!this.currentUser) return "global";
    if (this.currentUser.userName && typeof this.currentUser.userName === "string") {
      return this.currentUser.userName.trim().toLowerCase();
    }
    if (this.currentUser.username && typeof this.currentUser.username === "string") {
      return this.currentUser.username.trim().toLowerCase();
    }
    if (this.currentUser.email && typeof this.currentUser.email === "string") {
      const prefix = this.currentUser.email.split("@")[0].trim().toLowerCase();
      if (prefix) return prefix;
    }
    if (typeof this.currentUser.uid === "string") {
      const cleaned = this.currentUser.uid.replace(/^local-/, "").trim().toLowerCase();
      if (cleaned) return cleaned;
    }
    return "default_user";
  }

  public isCurrentUserAdmin(): boolean {
    const userName = this.getCurrentUserName();
    if (userName === "admin") return true;
    if (this.currentUser?.role === "admin") return true;
    const account = this.getAccountByUsername(userName);
    if (account?.role === "admin") return true;
    if (this.currentUser?.email && this.currentUser.email.toLowerCase().includes("admin")) return true;
    return false;
  }

  /**
   * Validates format constraints for usernames: 3-30 chars, alphanumeric with hyphens/underscores.
   */
  public validateUsername(rawUsername: string): { valid: boolean; clean: string; error?: string } {
    const clean = (rawUsername || "").trim().toLowerCase();
    if (!clean) {
      return { valid: false, clean: "", error: "Username cannot be empty." };
    }
    if (clean.length < 3) {
      return { valid: false, clean, error: "Username must be at least 3 characters long." };
    }
    if (clean.length > 30) {
      return { valid: false, clean, error: "Username cannot exceed 30 characters." };
    }
    if (!/^[a-z0-9_-]+$/.test(clean)) {
      return { valid: false, clean, error: "Username may only contain letters, numbers, underscores, and hyphens." };
    }
    return { valid: true, clean };
  }

  /**
   * Checks both local accounts state and Firestore database to verify if a username is already taken.
   */
  public async isUsernameTaken(rawUsername: string): Promise<boolean> {
    const clean = (rawUsername || "").trim().toLowerCase();
    if (!clean) return false;

    // Check in-memory / local storage accounts
    const inLocal = this.accounts.some(
      (a) => a.id.toLowerCase() === clean || a.username.toLowerCase() === clean
    );
    if (inLocal) return true;

    // Check Firestore user document
    try {
      const userSnap = await getDoc(doc(db, "users", clean));
      if (userSnap.exists()) return true;

      // Check system/user_accounts document
      const systemAccountsSnap = await getDoc(doc(db, "system", "user_accounts"));
      if (systemAccountsSnap.exists()) {
        const data = systemAccountsSnap.data();
        if (data?.accounts && Array.isArray(data.accounts)) {
          const inRemote = data.accounts.some(
            (a: AppUserAccount) => a.id?.toLowerCase() === clean || a.username?.toLowerCase() === clean
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
      const saved = localStorage.getItem("ursa_user_accounts");
      if (saved) {
        const parsed: AppUserAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const accountMap = new Map<string, AppUserAccount>();
          DEFAULT_USER_ACCOUNTS.forEach((a) => accountMap.set(a.id, a));
          parsed.forEach((a) => accountMap.set(a.id, a));
          this.accounts = Array.from(accountMap.values());
        }
      } else {
        localStorage.setItem("ursa_user_accounts", JSON.stringify(DEFAULT_USER_ACCOUNTS));
      }
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
              DEFAULT_USER_ACCOUNTS.forEach((a) => accountMap.set(a.id, a));
              data.accounts.forEach((a: AppUserAccount) => {
                if (a.id && a.username) {
                  accountMap.set(a.id.toLowerCase(), a);
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
    const raw = (username || "").trim().toLowerCase();
    const clean = raw.includes("@") ? raw.split("@")[0].trim().toLowerCase() : raw;
    return this.accounts.find(
      (a) => a.username.toLowerCase() === clean || a.id.toLowerCase() === clean || a.username.toLowerCase() === raw || a.id.toLowerCase() === raw
    );
  }

  /**
   * Async account finder that searches memory, default accounts, and Firestore.
   */
  public async findAccountAsync(usernameOrEmail: string): Promise<AppUserAccount | undefined> {
    const raw = (usernameOrEmail || "").trim().toLowerCase();
    const clean = raw.includes("@") ? raw.split("@")[0].trim().toLowerCase() : raw;

    // 1. Check local/in-memory accounts
    const foundLocal = this.getAccountByUsername(clean);
    if (foundLocal) return foundLocal;

    // 2. Check defaults
    const foundDefault = DEFAULT_USER_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === clean || a.id.toLowerCase() === clean
    );
    if (foundDefault) return foundDefault;

    // 3. Query Firestore users/{clean}
    try {
      const userSnap = await getDoc(doc(db, "users", clean));
      if (userSnap.exists()) {
        const data = userSnap.data();
        const acc: AppUserAccount = {
          id: clean,
          username: data.username || data.userName || clean,
          password: data.password || clean,
          role: data.role || (clean === "admin" ? "admin" : "user"),
          term: data.term || (data.role === "admin" ? undefined : "Summer 2026"),
          season: data.season || (data.role === "admin" ? undefined : "Summer"),
          year: data.year || (data.role === "admin" ? undefined : 2026),
          createdAt: data.createdAt || new Date().toISOString()
        };
        // Cache in memory
        if (!this.accounts.some((a) => a.id === clean)) {
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
              a.id?.toLowerCase() === raw ||
              a.username?.toLowerCase() === raw
          );
          if (matched) {
            if (!this.accounts.some((a) => a.id === matched.id)) {
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

    // Check if taken
    const existing = this.accounts.find(
      (a) => a.id.toLowerCase() === clean || a.username.toLowerCase() === clean
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
      this.accounts = this.accounts.map((a) => (a.id.toLowerCase() === clean ? newAccount : a));
    } else {
      this.accounts = [...this.accounts, newAccount];
    }

    this.notifyAccountsListeners();
    this.saveAccountsToLocalStorage();

    // Persist to system/user_accounts document
    try {
      await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
    } catch (e) {
      console.warn("Failed to persist accounts to Firestore system/user_accounts:", e);
    }

    // Persist user document to users/{clean}
    try {
      const userDocRef = doc(db, "users", clean);
      await setDoc(userDocRef, {
        id: clean,
        userName: clean,
        name: clean,
        email: `${clean}@network.org`,
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
      console.warn(`Failed to initialize Firestore user profile for ${clean}:`, e);
    }

    return { overwritten };
  }

  public async updateUserAccount(username: string, updates: Partial<AppUserAccount>): Promise<void> {
    const clean = (username || "").trim().toLowerCase();
    this.accounts = this.accounts.map((a) => {
      if (a.id === clean || a.username.toLowerCase() === clean) {
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

    try {
      await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
      await setDoc(doc(db, "users", clean), {
        ...updates,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Failed to persist accounts to Firestore system/user_accounts:", e);
    }
  }

  public async deleteUserAccount(username: string): Promise<void> {
    const clean = (username || "").trim().toLowerCase();
    if (clean === "admin") {
      throw new Error("Cannot delete primary administrator account.");
    }
    this.accounts = this.accounts.filter((a) => a.id !== clean && a.username.toLowerCase() !== clean);
    this.notifyAccountsListeners();
    this.saveAccountsToLocalStorage();

    try {
      await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
      await deleteDoc(doc(db, "users", clean));
    } catch (e) {
      console.warn("Failed to delete user from Firestore:", e);
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
    if (!user) return;
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
      console.warn("Failed to write user metadata to Firestore:", e);
    }
  }

  private async checkAndMigrateLegacyData(userName: string) {
    if (!this.currentUser?.uid || this.currentUser.uid === userName || this.currentUser.uid.startsWith("local-")) {
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
      console.warn("Legacy data migration check completed:", e);
    }
  }

  private async seedInitialUserDataIfEmpty(userName: string) {
    if (this.isLocalOnly || !userName || userName === "global") return;
    try {
      const snap = await getDocs(collection(db, "users", userName, "domains"));
      if (!snap.empty) return; // User already has data in Firestore

      console.log(`Seeding initial network data for user '${userName}' in Firestore...`);
      const isAdmin = this.isCurrentUserAdmin();
      const domainsToLoad = isAdmin ? DEFAULT_DOMAINS : SIMPLE_DOMAINS;
      const nodesToLoad = (isAdmin ? DEFAULT_NODES : SIMPLE_NODES).map(node => ({
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
        chunk.forEach(edge => batch.set(doc(db, "users", userName, "edges", edge.id), edge));
        await batch.commit();
      }
      await setDoc(doc(db, "users", userName, "params", "default"), paramsToLoad);
      console.log(`Initial network data successfully seeded for user '${userName}'`);
    } catch (e) {
      console.warn(`Could not seed initial network for user '${userName}':`, e);
    }
  }

  private initUserListeners() {
    if (!this.currentUser) return;
    const userName = this.getCurrentUserName();
    if (!userName || userName === "global") return;

    try {
      this.checkAndMigrateLegacyData(userName);

      // 1. Domains Listener mapped to users/{userName}/domains
      const unsubDims = onSnapshot(
        collection(db, "users", userName, "domains"),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Domain[] = [];
            snapshot.forEach((docSnap) => list.push(docSnap.data() as Domain));
            list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            this.domains = list;
          } else {
            // If empty in Firestore and not loaded, seed initial user network
            if (!this.isLoaded) {
              this.seedInitialUserDataIfEmpty(userName);
            }
          }
          this.notifyDomainListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn(`Firestore domains loading failed for ${userName}, using local:`, err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      // 2. Nodes Listener mapped to users/{userName}/nodes
      const unsubNodes = onSnapshot(
        collection(db, "users", userName, "nodes"),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: NodeIndicator[] = [];
            const seenAbbrs = new Set<string>();
            snapshot.forEach((docSnap) => {
              const node = docSnap.data() as NodeIndicator;
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
          }
          this.notifyNodeListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn(`Firestore nodes loading failed for ${userName}, using local:`, err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      // 3. Edges Listener mapped to users/{userName}/edges
      const unsubEdges = onSnapshot(
        collection(db, "users", userName, "edges"),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Edge[] = [];
            snapshot.forEach((docSnap) => list.push(docSnap.data() as Edge));
            this.edges = list;
          }
          this.notifyEdgeListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn(`Firestore edges loading failed for ${userName}, using local:`, err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      // 4. Params Listener mapped to users/{userName}/params/default
      const unsubParams = onSnapshot(
        doc(db, "users", userName, "params", "default"),
        (snapshot) => {
          if (snapshot.exists()) {
            this.params = snapshot.data() as SimulatorParams;
          }
          this.notifyParamsListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn(`Firestore params loading failed for ${userName}, using local:`, err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      this.unsubs.push(unsubDims, unsubNodes, unsubEdges, unsubParams);
    } catch (e) {
      console.error(`Failed to initialize user Firestore listeners for ${userName}:`, e);
      this.isLocalOnly = true;
      this.notifyStatusListeners();
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
    const isAdmin = this.isCurrentUserAdmin();
    
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
        this.domains = JSON.parse(savedDomains);
        
        const rawNodes = JSON.parse(savedNodes) as NodeIndicator[];
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

        this.edges = JSON.parse(savedEdges);
        if (savedParams) {
          this.params = JSON.parse(savedParams);
        } else {
          const isAdmin = this.isCurrentUserAdmin();
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

    try {
      await setDoc(doc(db, "system", "slider_limits"), newLimits);
    } catch (e) {
      console.warn("Failed to write simulation limits to Firestore, saved locally:", e);
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
          console.warn("System learn visibility Firestore listener failed, using local/default:", err);
        }
      );
    } catch (e) {
      console.warn("Failed to attach system learn visibility listener:", e);
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

    try {
      await setDoc(doc(db, "system", "learn_visibility"), newVisibility);
    } catch (e) {
      console.warn("Failed to write learn visibility to Firestore, saved locally:", e);
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
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "params", p.id || "default"), p);
      } catch (e) {
        console.warn(`Failed to write params for ${userName} to Firestore, saved locally:`, e);
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
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "domains", domain.id), domain);
      } catch (e) {
        console.warn(`Failed to write domain for ${userName} to Firestore, saved locally:`, e);
      }
    }
  }

  public async deleteDomain(id: string) {
    this.domains = this.domains.filter(d => d.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyDomainListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await deleteDoc(doc(db, "users", userName, "domains", id));
      } catch (e) {
        console.warn(`Failed to delete domain for ${userName} in Firestore:`, e);
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
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "nodes", standardizedId), standardizedNode);
        const originalId = node.id;
        if (originalId && originalId !== standardizedId) {
          await deleteDoc(doc(db, "users", userName, "nodes", originalId));
        }
      } catch (e) {
        console.warn(`Failed to write node for ${userName} to Firestore, saved locally:`, e);
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
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await deleteDoc(doc(db, "users", userName, "nodes", id));
        if (id !== uppercaseId) {
          await deleteDoc(doc(db, "users", userName, "nodes", uppercaseId));
        }
        for (const edge of edgesToDelete) {
          await deleteDoc(doc(db, "users", userName, "edges", edge.id));
        }
      } catch (e) {
        console.warn(`Failed to delete node for ${userName} in Firestore:`, e);
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
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "edges", edge.id), edge);
      } catch (e) {
        console.warn(`Failed to write edge for ${userName} to Firestore, saved locally:`, e);
      }
    }
  }

  public async deleteEdge(id: string) {
    this.edges = this.edges.filter(e => e.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyEdgeListeners();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await deleteDoc(doc(db, "users", userName, "edges", id));
      } catch (e) {
        console.warn(`Failed to delete edge for ${userName} in Firestore:`, e);
      }
    }
  }

  private async clearFirestoreNetwork(userName: string) {
    try {
      const dimsRef = collection(db, "users", userName, "domains");
      const dimsSnap = await getDocs(dimsRef);
      for (const d of dimsSnap.docs) {
        await deleteDoc(d.ref);
      }

      const nodesRef = collection(db, "users", userName, "nodes");
      const nodesSnap = await getDocs(nodesRef);
      for (const n of nodesSnap.docs) {
        await deleteDoc(n.ref);
      }

      const edgesRef = collection(db, "users", userName, "edges");
      const edgesSnap = await getDocs(edgesRef);
      for (let i = 0; i < edgesSnap.docs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = edgesSnap.docs.slice(i, i + 400);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn(`Failed to clear Firestore network for ${userName}:`, e);
    }
  }

  public async clearNetwork() {
    this.domains = [];
    this.nodes = [];
    this.edges = [];
    this.saveToLocalStorageOnly();
    this.notifyAll();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && userName && userName !== "global") {
      await this.clearFirestoreNetwork(userName);
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

    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await setDoc(doc(db, "users", userName, "saved_config", "latest"), config);
      } catch (e) {
        console.warn(`Failed to write saved config for ${userName} to Firestore:`, e);
      }
    }
  }

  public async getCustomNetworkConfig(): Promise<SavedNetworkConfig | null> {
    const userName = this.getCurrentUserName();

    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        const snap = await getDoc(doc(db, "users", userName, "saved_config", "latest"));
        if (snap.exists()) {
          return snap.data() as SavedNetworkConfig;
        }
      } catch (e) {
        console.warn(`Failed to read saved config for ${userName} from Firestore, falling back to local:`, e);
      }
    }

    try {
      const keys = this.getLocalStorageKeys();
      const saved = localStorage.getItem(keys.savedConfig);
      if (saved) {
        return JSON.parse(saved) as SavedNetworkConfig;
      }
    } catch (e) {
      console.error("Failed to read saved config from local storage:", e);
    }

    return null;
  }

  public async restoreCustomNetworkConfig(config: SavedNetworkConfig): Promise<void> {
    const normalizedNodes = config.nodes.map(node => ({
      ...node,
      id: node.abbr.toUpperCase(),
      abbr: node.abbr.toUpperCase()
    }));

    this.domains = [...config.domains];
    this.nodes = normalizedNodes;
    this.edges = [...config.edges];
    this.params = { ...config.params };

    this.saveToLocalStorageOnly();
    this.notifyAll();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        await this.clearFirestoreNetwork(userName);

        for (const domain of config.domains) {
          await setDoc(doc(db, "users", userName, "domains", domain.id), domain);
        }
        for (const node of normalizedNodes) {
          await setDoc(doc(db, "users", userName, "nodes", node.id), node);
        }
        for (let i = 0; i < config.edges.length; i += 400) {
          const edgeBatch = writeBatch(db);
          const chunk = config.edges.slice(i, i + 400);
          chunk.forEach((edge) => {
            edgeBatch.set(doc(db, "users", userName, "edges", edge.id), edge);
          });
          await edgeBatch.commit();
        }
        await setDoc(doc(db, "users", userName, "params", "default"), config.params);
      } catch (e) {
        console.warn(`Syncing restored config to Firestore failed for ${userName}:`, e);
      }
    }
  }

  public async importDefaultNetwork() {
    await this.clearNetwork();
    this.loadDefaults();
    this.saveToLocalStorageOnly();
    this.notifyAll();

    const userName = this.getCurrentUserName();
    if (!this.isLocalOnly && userName && userName !== "global") {
      try {
        const isAdmin = this.isCurrentUserAdmin();
        const domainsToLoad = isAdmin ? DEFAULT_DOMAINS : SIMPLE_DOMAINS;
        const nodesToLoad = (isAdmin ? DEFAULT_NODES : SIMPLE_NODES).map(node => ({
          ...node,
          id: node.abbr.toUpperCase(),
          abbr: node.abbr.toUpperCase()
        }));
        const edgesToLoad = isAdmin ? parseDefaultEdges() : parseSimpleEdges();

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
        const paramsToLoad = isAdmin ? DEFAULT_PARAMS : SIMPLE_PARAMS;
        await setDoc(doc(db, "users", userName, "params", "default"), paramsToLoad);
        console.log(`Default network successfully imported for user: ${userName}`);
      } catch (e) {
        console.warn(`Importing default network to Firestore failed for ${userName}:`, e);
      }
    }
  }
}

export const dataService = new DataService();
