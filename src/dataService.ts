import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, getDocs, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Domain, NodeIndicator, Edge, SimulatorParams, SavedNetworkConfig, SimulationLimitsConfig, DEFAULT_SIMULATION_LIMITS, AppUserAccount, DEFAULT_USER_ACCOUNTS, LearnVisibilityConfig, DEFAULT_LEARN_VISIBILITY } from "./types";
import { DEFAULT_DOMAINS, DEFAULT_NODES, parseDefaultEdges, SIMPLE_DOMAINS, SIMPLE_NODES, parseSimpleEdges } from "./defaultNetwork";

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
    // Try to load local storage copies first so we have immediate data
    this.loadFromLocalStorage();
    this.loadAccountsFromLocalStorage();
    this.loadLearnVisibilityFromLocalStorage();
    this.initSystemLimitsListener();
    this.initAccountsListener();
    this.initLearnVisibilityListener();
  }

  private loadAccountsFromLocalStorage() {
    try {
      const saved = localStorage.getItem("ursa_user_accounts");
      if (saved) {
        const parsed: AppUserAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge defaults with saved accounts to ensure Summer 2026 is assigned
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
              // Merge default user accounts with firestore accounts
              const accountMap = new Map<string, AppUserAccount>();
              DEFAULT_USER_ACCOUNTS.forEach((a) => accountMap.set(a.id, a));
              data.accounts.forEach((a: AppUserAccount) => accountMap.set(a.id, a));
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
          } else {
            // Keep default limits
          }
          this.notifyLimitsListeners();
          try {
            localStorage.setItem("ursa_simulation_limits", JSON.stringify(this.limits));
          } catch (e) {
            // LocalStorage quota or blocked
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

  // Set the current authenticated user from App component
  public setCurrentUser(user: any) {
    if (this.currentUser?.uid === user?.uid && this.isLoaded) {
      return; // No change
    }

    // Unsubscribe from previous user's real-time listeners
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];

    this.currentUser = user;
    this.isLoaded = false;

    // Load new user's local storage data or defaults immediately
    this.loadFromLocalStorage();
    this.notifyAll();

    // Set up real-time listeners for the new user
    if (user) {
      this.saveUserMetadata(user);
      this.runFirestoreMigrations(user);
      this.initUserListeners();
    }
  }

  private async runFirestoreMigrations(user: any) {
    if (!user || user.isLocal) return;

    try {
      // 1. Remove legacy literal user document IDs ("user1", "user2", "user3", "admin") from the users collection
      const legacyUserIds = ["user1", "user2", "user3", "admin"];
      for (const id of legacyUserIds) {
        const legacyRef = doc(db, "users", id);
        const snap = await getDoc(legacyRef);
        if (snap.exists()) {
          console.log(`Cleaning up legacy literal user document: users/${id}`);
          await deleteDoc(legacyRef);
        }
      }

      // 2. Remove legacy subcollection 'dimensions' for this user
      const userDimensionsRef = collection(db, "users", user.uid, "dimensions");
      const userDimsSnap = await getDocs(userDimensionsRef);
      if (!userDimsSnap.empty) {
        console.log(`Cleaning up legacy user dimensions subcollection for ${user.uid}...`);
        for (const d of userDimsSnap.docs) {
          await deleteDoc(d.ref);
        }
      }

      // 2. Rename root-level collection 'dimensions' to 'domains', write admin URSA network domains, and delete old 'dimensions'
      // Always write the admin URSA network domains (DEFAULT_DOMAINS) to the root-level 'domains' collection
      console.log("Writing admin URSA network domains to root-level 'domains' collection...");
      for (const domain of DEFAULT_DOMAINS) {
        await setDoc(doc(db, "domains", domain.id), domain);
      }

      const rootDimensionsRef = collection(db, "dimensions");
      const rootDimsSnap = await getDocs(rootDimensionsRef);
      if (!rootDimsSnap.empty) {
        console.log("Migrating and cleaning up root-level collection 'dimensions' to 'domains'...");
        for (const d of rootDimsSnap.docs) {
          const data = d.data();
          // Write to the new root collection 'domains'
          await setDoc(doc(db, "domains", d.id), data, { merge: true });
          // Delete from the old root collection 'dimensions'
          await deleteDoc(d.ref);
        }
        console.log("Root-level 'dimensions' successfully migrated and cleaned up.");
      }
    } catch (e) {
      console.warn("Firestore migration / cleanup failed:", e);
    }
  }

  private async saveUserMetadata(user: any) {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      const emailPrefix = user.email ? user.email.split("@")[0].toLowerCase() : "";
      const userName = emailPrefix || "anonymous";
      const name = userName; // Match user request: name (e.g. mohsenghodrat2)
      
      let displayName = user.displayName || "";
      if (!displayName) {
        if (emailPrefix === "user1") {
          displayName = "User 1";
        } else if (emailPrefix === "user2") {
          displayName = "User 2";
        } else if (emailPrefix === "user3") {
          displayName = "User 3";
        } else if (emailPrefix === "admin") {
          displayName = "Admin";
        } else if (emailPrefix) {
          displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        } else {
          displayName = "Anonymous User";
        }
      }

      const account = this.getAccountByUsername(userName);
      const isAdminAccount = account?.role === "admin" || userName === "admin";
      const term = isAdminAccount ? undefined : (account?.term || "Summer 2026");
      const season = isAdminAccount ? undefined : (account?.season || "Summer");
      const year = isAdminAccount ? undefined : (account?.year || 2026);

      const updatePayload: any = {
        uid: user.uid,
        email: user.email || "",
        displayName: displayName,
        userName: userName,
        name: name,
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

  private initUserListeners() {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;

    try {
      // Listen to domains
      const unsubDims = onSnapshot(
        collection(db, "users", uid, "domains"),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Domain[] = [];
            snapshot.forEach((doc) => list.push(doc.data() as Domain));
            list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            this.domains = list;
          } else {
            this.domains = [];
          }
          this.notifyDomainListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn("Firestore user domains loading failed, using local storage:", err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      // Listen to nodes
      const unsubNodes = onSnapshot(
        collection(db, "users", uid, "nodes"),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: NodeIndicator[] = [];
            const seenAbbrs = new Set<string>();
            snapshot.forEach((doc) => {
              const node = doc.data() as NodeIndicator;
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
          } else {
            this.nodes = [];
          }
          this.notifyNodeListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn("Firestore user nodes loading failed, using local storage:", err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      // Listen to edges
      const unsubEdges = onSnapshot(
        collection(db, "users", uid, "edges"),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Edge[] = [];
            snapshot.forEach((doc) => list.push(doc.data() as Edge));
            this.edges = list;
          } else {
            this.edges = [];
          }
          this.notifyEdgeListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn("Firestore user edges loading failed, using local storage:", err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      // Listen to params
      const unsubParams = onSnapshot(
        doc(db, "users", uid, "params", "default"),
        (snapshot) => {
          if (snapshot.exists()) {
            this.params = snapshot.data() as SimulatorParams;
          } else {
            // we can leave params as default if not exists
          }
          this.notifyParamsListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn("Firestore user params loading failed, using local storage:", err);
          this.isLocalOnly = true;
          this.notifyStatusListeners();
          this.isLoaded = true;
        }
      );

      this.unsubs.push(unsubDims, unsubNodes, unsubEdges, unsubParams);
    } catch (e) {
      console.error("Failed to initialize user Firestore listeners:", e);
      this.isLocalOnly = true;
      this.notifyStatusListeners();
      this.isLoaded = true;
    }
  }



  private loadDefaults() {
    const isAdmin = this.currentUser?.email?.toLowerCase().includes("admin") ?? false;
    
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

  private getLocalStorageKeys() {
    const uid = this.currentUser ? this.currentUser.uid : "global";
    return {
      domains: `network_domains_${uid}`,
      nodes: `ursa_nodes_${uid}`,
      edges: `ursa_edges_${uid}`,
      params: `ursa_params_${uid}`
    };
  }

  private loadFromLocalStorage() {
    try {
      const keys = this.getLocalStorageKeys();
      const savedDomains = localStorage.getItem(keys.domains);
      const savedNodes = localStorage.getItem(keys.nodes);
      const savedEdges = localStorage.getItem(keys.edges);
      const savedParams = localStorage.getItem(keys.params);

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
          const isAdmin = this.currentUser?.email?.toLowerCase().includes("admin") ?? false;
          this.params = isAdmin ? { ...DEFAULT_PARAMS } : { ...SIMPLE_PARAMS };
        }
      } else {
        // Fallback to global defaults for a brand-new user session
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

  // Real-time Subscriptions
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

  // Learn Curriculum Section Visibility
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

  public async saveParams(p: SimulatorParams) {
    this.params = p;
    this.saveToLocalStorageOnly();
    this.notifyParamsListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await setDoc(doc(db, "users", this.currentUser.uid, "params", p.id), p);
      } catch (e) {
        console.warn("Failed to write params to Firestore, saved locally:", e);
      }
    }
  }

  public getIsLocalOnly(): boolean {
    return this.isLocalOnly;
  }

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  // Save custom network configuration
  public async saveCustomNetworkConfig(name: string): Promise<void> {
    const config: SavedNetworkConfig = {
      name: name.trim(),
      savedAt: new Date().toLocaleString(),
      domains: [...this.domains],
      nodes: [...this.nodes],
      edges: [...this.edges],
      params: { ...this.params }
    };

    const uid = this.currentUser ? this.currentUser.uid : "global";
    
    // Save to local storage
    try {
      localStorage.setItem(`network_saved_config_${uid}`, JSON.stringify(config));
    } catch (e) {
      console.error("Failed to save custom config to local storage:", e);
    }

    // Save to Firestore if connected
    if (!this.isLocalOnly && this.currentUser) {
      try {
        await setDoc(doc(db, "users", uid, "saved_config", "latest"), config);
      } catch (e) {
        console.warn("Failed to write saved config to Firestore:", e);
      }
    }
  }

  // Get custom network configuration
  public async getCustomNetworkConfig(): Promise<SavedNetworkConfig | null> {
    const uid = this.currentUser ? this.currentUser.uid : "global";
    
    // Attempt to read from Firestore first if online
    if (!this.isLocalOnly && this.currentUser) {
      try {
        const snap = await getDoc(doc(db, "users", uid, "saved_config", "latest"));
        if (snap.exists()) {
          return snap.data() as SavedNetworkConfig;
        }
      } catch (e) {
        console.warn("Failed to read saved config from Firestore, falling back to local:", e);
      }
    }

    // Fallback to local storage
    try {
      const saved = localStorage.getItem(`network_saved_config_${uid}`);
      if (saved) {
        return JSON.parse(saved) as SavedNetworkConfig;
      }
    } catch (e) {
      console.error("Failed to read saved config from local storage:", e);
    }

    return null;
  }

  // Load / Restore a saved configuration
  public async restoreCustomNetworkConfig(config: SavedNetworkConfig): Promise<void> {
    const normalizedNodes = config.nodes.map(node => ({
      ...node,
      id: node.abbr.toUpperCase(),
      abbr: node.abbr.toUpperCase()
    }));

    // 1. Update local state
    this.domains = [...config.domains];
    this.nodes = normalizedNodes;
    this.edges = [...config.edges];
    this.params = { ...config.params };

    this.saveToLocalStorageOnly();
    this.notifyAll();

    // 2. Sync to Firestore if online
    if (!this.isLocalOnly && this.currentUser) {
      const uid = this.currentUser.uid;
      try {
        // Clear active network in Firestore only, preventing local state reset
        await this.clearFirestoreNetwork(uid);

        // Write domains
        for (const domain of config.domains) {
          await setDoc(doc(db, "users", uid, "domains", domain.id), domain);
        }
        // Write nodes
        for (const node of normalizedNodes) {
          await setDoc(doc(db, "users", uid, "nodes", node.id), node);
        }
        // Write edges
        for (let i = 0; i < config.edges.length; i += 400) {
          const edgeBatch = writeBatch(db);
          const chunk = config.edges.slice(i, i + 400);
          chunk.forEach((edge) => {
            edgeBatch.set(doc(db, "users", uid, "edges", edge.id), edge);
          });
          await edgeBatch.commit();
        }
        // Write params
        await setDoc(doc(db, "users", uid, "params", "default"), config.params);
      } catch (e) {
        console.warn("Syncing restored config to Firestore failed:", e);
      }
    }
  }

  // Seeding/Reset helper
  public async importDefaultNetwork() {
    // 1. Clear current state (local & Firestore) first to ensure clean overwrite
    await this.clearNetwork();

    // 2. Load local defaults
    this.loadDefaults();
    this.saveToLocalStorageOnly();
    this.notifyAll();

    if (!this.isLocalOnly && this.currentUser) {
      const uid = this.currentUser.uid;
      try {
        const isAdmin = this.currentUser?.email?.toLowerCase().includes("admin") ?? false;
        const domainsToLoad = isAdmin ? DEFAULT_DOMAINS : SIMPLE_DOMAINS;
        const nodesToLoad = (isAdmin ? DEFAULT_NODES : SIMPLE_NODES).map(node => ({
          ...node,
          id: node.abbr.toUpperCase(),
          abbr: node.abbr.toUpperCase()
        }));
        const edgesToLoad = isAdmin ? parseDefaultEdges() : parseSimpleEdges();

        for (const domain of domainsToLoad) {
          await setDoc(doc(db, "users", uid, "domains", domain.id), domain);
        }
        for (const node of nodesToLoad) {
          await setDoc(doc(db, "users", uid, "nodes", node.id), node);
        }
        
        for (let i = 0; i < edgesToLoad.length; i += 400) {
          const edgeBatch = writeBatch(db);
          const chunk = edgesToLoad.slice(i, i + 400);
          chunk.forEach((edge) => {
            edgeBatch.set(doc(db, "users", uid, "edges", edge.id), edge);
          });
          await edgeBatch.commit();
        }
        const paramsToLoad = isAdmin ? DEFAULT_PARAMS : SIMPLE_PARAMS;
        await setDoc(doc(db, "users", uid, "params", "default"), paramsToLoad);
        console.log(`Firestore successfully seeded for user: ${uid}`);
      } catch (e) {
        console.warn("Seeding Firestore failed, running in local-only sandbox:", e);
        this.isLocalOnly = true;
        this.notifyStatusListeners();
      }
    }
  }

  // CRUD Operations
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

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await setDoc(doc(db, "users", this.currentUser.uid, "domains", domain.id), domain);
      } catch (e) {
        console.warn("Failed to write to Firestore, saved locally:", e);
      }
    }
  }

  public async deleteDomain(id: string) {
    this.domains = this.domains.filter(d => d.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyDomainListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await deleteDoc(doc(db, "users", this.currentUser.uid, "domains", id));
      } catch (e) {
        console.warn("Failed to write to Firestore, deleted locally:", e);
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

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await setDoc(doc(db, "users", this.currentUser.uid, "nodes", standardizedId), standardizedNode);
        
        const originalId = node.id;
        if (originalId && originalId !== standardizedId) {
          await deleteDoc(doc(db, "users", this.currentUser.uid, "nodes", originalId));
        }
      } catch (e) {
        console.warn("Failed to write to Firestore, saved locally:", e);
      }
    }
  }

  public async deleteNode(id: string) {
    const uppercaseId = id.toUpperCase();
    // Also delete any edges connected to this node
    this.edges = this.edges.filter(edge => edge.source.toUpperCase() !== uppercaseId && edge.target.toUpperCase() !== uppercaseId);
    this.nodes = this.nodes.filter(n => n.id.toUpperCase() !== uppercaseId && n.abbr.toUpperCase() !== uppercaseId);
    this.saveToLocalStorageOnly();
    this.notifyNodeListeners();
    this.notifyEdgeListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await deleteDoc(doc(db, "users", this.currentUser.uid, "nodes", id));
        if (id !== uppercaseId) {
          await deleteDoc(doc(db, "users", this.currentUser.uid, "nodes", uppercaseId));
        }
      } catch (e) {
        console.warn("Failed to write to Firestore, deleted locally:", e);
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

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await setDoc(doc(db, "users", this.currentUser.uid, "edges", edge.id), edge);
      } catch (e) {
        console.warn("Failed to write to Firestore, saved locally:", e);
      }
    }
  }


  private async clearFirestoreNetwork(uid: string) {
    try {
      const dimsRef = collection(db, "users", uid, "domains");
      const dimsSnap = await getDocs(dimsRef);
      for (const d of dimsSnap.docs) {
        await deleteDoc(d.ref);
      }

      const nodesRef = collection(db, "users", uid, "nodes");
      const nodesSnap = await getDocs(nodesRef);
      for (const n of nodesSnap.docs) {
        await deleteDoc(n.ref);
      }

      const edgesRef = collection(db, "users", uid, "edges");
      const edgesSnap = await getDocs(edgesRef);
      for (let i = 0; i < edgesSnap.docs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = edgesSnap.docs.slice(i, i + 400);
        chunk.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Failed to clear Firestore:", e);
    }
  }

  public async clearNetwork() {
    this.domains = [];
    this.nodes = [];
    this.edges = [];
    this.saveToLocalStorageOnly();
    this.notifyAll();

    if (!this.isLocalOnly && this.currentUser) {
      await this.clearFirestoreNetwork(this.currentUser.uid);
    }
  }

  public async deleteEdge(id: string) {
    this.edges = this.edges.filter(e => e.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyEdgeListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await deleteDoc(doc(db, "users", this.currentUser.uid, "edges", id));
      } catch (e) {
        console.warn("Failed to write to Firestore, deleted locally:", e);
      }
    }
  }

  // Account & Academic Term Management
  public subscribeAccounts(listener: (accounts: AppUserAccount[]) => void): () => void {
    this.accountsListeners.add(listener);
    listener([...this.accounts]);
    return () => this.accountsListeners.delete(listener);
  }

  public getAccounts(): AppUserAccount[] {
    return [...this.accounts];
  }

  public getAccountByUsername(username: string): AppUserAccount | undefined {
    const clean = username.trim().toLowerCase();
    return this.accounts.find((a) => a.username.toLowerCase() === clean || a.id.toLowerCase() === clean);
  }

  public async createUserAccount(accountData: Omit<AppUserAccount, "createdAt">): Promise<void> {
    const clean = accountData.username.trim().toLowerCase();
    if (!clean) {
      throw new Error("Username cannot be empty.");
    }
    const exists = this.accounts.some((a) => a.id === clean || a.username.toLowerCase() === clean);
    if (exists) {
      throw new Error(`Username '${accountData.username}' already exists.`);
    }

    const newAccount: AppUserAccount = {
      ...accountData,
      id: clean,
      username: clean,
      createdAt: new Date().toISOString()
    };

    this.accounts = [...this.accounts, newAccount];
    this.notifyAccountsListeners();
    this.saveAccountsToLocalStorage();

    try {
      await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
    } catch (e) {
      console.warn("Failed to persist accounts to Firestore system/user_accounts:", e);
    }
  }

  public async updateUserAccount(username: string, updates: Partial<AppUserAccount>): Promise<void> {
    const clean = username.trim().toLowerCase();
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
    } catch (e) {
      console.warn("Failed to persist accounts to Firestore system/user_accounts:", e);
    }
  }

  public async deleteUserAccount(username: string): Promise<void> {
    const clean = username.trim().toLowerCase();
    if (clean === "admin") {
      throw new Error("Cannot delete primary administrator account.");
    }
    this.accounts = this.accounts.filter((a) => a.id !== clean && a.username.toLowerCase() !== clean);
    this.notifyAccountsListeners();
    this.saveAccountsToLocalStorage();

    try {
      await setDoc(doc(db, "system", "user_accounts"), { accounts: this.accounts }, { merge: true });
    } catch (e) {
      console.warn("Failed to persist accounts to Firestore system/user_accounts:", e);
    }
  }
}

export const dataService = new DataService();
