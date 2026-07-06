import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { Dimension, NodeIndicator, Edge, SimulatorParams } from "./types";
import { DEFAULT_DIMENSIONS, DEFAULT_NODES, parseDefaultEdges, SIMPLE_DIMENSIONS, SIMPLE_NODES, parseSimpleEdges } from "./defaultNetwork";

type Listener<T> = (data: T[]) => void;

const DEFAULT_PARAMS: SimulatorParams = {
  id: "default",
  T: 10,
  theta: 0.2,
  gamma: 1.5,
  epsilon: 0.001,
  rv: 0.01,
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
  private dimensions: Dimension[] = [];
  private nodes: NodeIndicator[] = [];
  private edges: Edge[] = [];
  private params: SimulatorParams = { ...DEFAULT_PARAMS };
  private isLocalOnly = false;
  private isLoaded = false;
  private currentUser: any = null;

  private dimListeners: Set<Listener<Dimension>> = new Set();
  private nodeListeners: Set<Listener<NodeIndicator>> = new Set();
  private edgeListeners: Set<Listener<Edge>> = new Set();
  private paramsListeners: Set<(p: SimulatorParams) => void> = new Set();
  private statusListeners: Set<(isLocal: boolean) => void> = new Set();

  private unsubs: (() => void)[] = [];

  constructor() {
    this.init();
  }

  private init() {
    // Try to load local storage copies first so we have immediate data
    this.loadFromLocalStorage();
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
      this.initUserListeners();
    }
  }

  private initUserListeners() {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;

    try {
      // Listen to dimensions
      const unsubDims = onSnapshot(
        collection(db, "users", uid, "dimensions"),
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Dimension[] = [];
            snapshot.forEach((doc) => list.push(doc.data() as Dimension));
            list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            this.dimensions = list;
          } else {
            this.dimensions = [];
          }
          this.notifyDimListeners();
          this.saveToLocalStorageOnly();
          this.isLoaded = true;
        },
        (err) => {
          console.warn("Firestore user dimensions loading failed, using local storage:", err);
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
            snapshot.forEach((doc) => list.push(doc.data() as NodeIndicator));
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
      this.dimensions = [...DEFAULT_DIMENSIONS];
      this.nodes = [...DEFAULT_NODES];
      this.edges = parseDefaultEdges();
      this.params = { ...DEFAULT_PARAMS };
    } else {
      this.dimensions = [...SIMPLE_DIMENSIONS];
      this.nodes = [...SIMPLE_NODES];
      this.edges = parseSimpleEdges();
      this.params = { ...SIMPLE_PARAMS };
    }
    
    this.saveToLocalStorageOnly();
    this.notifyAll();
  }

  private getLocalStorageKeys() {
    const uid = this.currentUser ? this.currentUser.uid : "global";
    return {
      dims: `ursa_dims_${uid}`,
      nodes: `ursa_nodes_${uid}`,
      edges: `ursa_edges_${uid}`,
      params: `ursa_params_${uid}`
    };
  }

  private loadFromLocalStorage() {
    try {
      const keys = this.getLocalStorageKeys();
      const savedDims = localStorage.getItem(keys.dims);
      const savedNodes = localStorage.getItem(keys.nodes);
      const savedEdges = localStorage.getItem(keys.edges);
      const savedParams = localStorage.getItem(keys.params);

      if (savedDims && savedNodes && savedEdges) {
        this.dimensions = JSON.parse(savedDims);
        this.nodes = JSON.parse(savedNodes);
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
      localStorage.setItem(keys.dims, JSON.stringify(this.dimensions));
      localStorage.setItem(keys.nodes, JSON.stringify(this.nodes));
      localStorage.setItem(keys.edges, JSON.stringify(this.edges));
      localStorage.setItem(keys.params, JSON.stringify(this.params));
    } catch (e) {
      console.error("Local storage save failed:", e);
    }
  }

  private notifyDimListeners() {
    this.dimListeners.forEach((listener) => listener([...this.dimensions]));
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

  private notifyAll() {
    this.notifyDimListeners();
    this.notifyNodeListeners();
    this.notifyEdgeListeners();
    this.notifyParamsListeners();
    this.notifyStatusListeners();
  }

  // Real-time Subscriptions
  public subscribeDimensions(listener: Listener<Dimension>): () => void {
    this.dimListeners.add(listener);
    listener([...this.dimensions]);
    return () => this.dimListeners.delete(listener);
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

  // Seeding/Reset helper
  public async importDefaultNetwork() {
    // Load local defaults first for instant UI response
    this.loadDefaults();

    if (!this.isLocalOnly && this.currentUser) {
      const uid = this.currentUser.uid;
      try {
        // Clear previous state by writing defaults
        const isAdmin = this.currentUser?.email?.toLowerCase().includes("admin") ?? false;
        const dimsToLoad = isAdmin ? DEFAULT_DIMENSIONS : SIMPLE_DIMENSIONS;
        const nodesToLoad = isAdmin ? DEFAULT_NODES : SIMPLE_NODES;
        const edgesToLoad = isAdmin ? parseDefaultEdges() : parseSimpleEdges();

        for (const dim of dimsToLoad) {
          await setDoc(doc(db, "users", uid, "dimensions", dim.id), dim);
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
  public async saveDimension(dim: Dimension) {
    const exists = this.dimensions.some(d => d.id === dim.id);
    if (exists) {
      this.dimensions = this.dimensions.map(d => d.id === dim.id ? dim : d);
    } else {
      this.dimensions = [...this.dimensions, dim];
      this.dimensions.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    }
    this.saveToLocalStorageOnly();
    this.notifyDimListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await setDoc(doc(db, "users", this.currentUser.uid, "dimensions", dim.id), dim);
      } catch (e) {
        console.warn("Failed to write to Firestore, saved locally:", e);
      }
    }
  }

  public async deleteDimension(id: string) {
    this.dimensions = this.dimensions.filter(d => d.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyDimListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await deleteDoc(doc(db, "users", this.currentUser.uid, "dimensions", id));
      } catch (e) {
        console.warn("Failed to write to Firestore, deleted locally:", e);
      }
    }
  }

  public async saveNode(node: NodeIndicator) {
    const exists = this.nodes.some(n => n.id === node.id);
    if (exists) {
      this.nodes = this.nodes.map(n => n.id === node.id ? node : n);
    } else {
      this.nodes = [...this.nodes, node];
      this.nodes.sort((a, b) => a.abbr.localeCompare(b.abbr));
    }
    this.saveToLocalStorageOnly();
    this.notifyNodeListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await setDoc(doc(db, "users", this.currentUser.uid, "nodes", node.id), node);
      } catch (e) {
        console.warn("Failed to write to Firestore, saved locally:", e);
      }
    }
  }

  public async deleteNode(id: string) {
    // Also delete any edges connected to this node
    this.edges = this.edges.filter(edge => edge.source !== id && edge.target !== id);
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.saveToLocalStorageOnly();
    this.notifyNodeListeners();
    this.notifyEdgeListeners();

    if (!this.isLocalOnly && this.currentUser) {
      try {
        await deleteDoc(doc(db, "users", this.currentUser.uid, "nodes", id));
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


  public async clearNetwork() {
    this.dimensions = [];
    this.nodes = [];
    this.edges = [];
    this.saveToLocalStorageOnly();
    this.notifyAll();

    if (!this.isLocalOnly && this.currentUser) {
      const uid = this.currentUser.uid;
      try {
        const dimsRef = collection(db, "users", uid, "dimensions");
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
        console.warn("Failed to clear Firestore, cleared locally:", e);
      }
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
}

export const dataService = new DataService();
