import create from "zustand";
import { nanoid } from "nanoid";

// Types
export const NodeTypes = {
  START: "start",
  TASK: "task",
  DECISION: "decision",
  PARALLEL: "parallel",
  END: "end",
};

export const EdgeTypes = {
  DEFAULT: "default",
  // Legacy constants kept for compatibility
  CONDITIONAL_TRUE: "conditional_true",
  CONDITIONAL_FALSE: "conditional_false",
  PARALLEL: "parallel",
  // New generalized conditional
  CONDITIONAL: "conditional",
};

// Helpers
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Safe parse JSON content from a string, returning a fallback on error.
 */
function safeJsonParse(text, fallback) {
  try {
    if (typeof text !== "string") return fallback;
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Migrate edges to new conditional type while supporting legacy.
 * - conditional_true  -> type: "conditional", data.branchKey="true",  data.label="True"
 * - conditional_false -> type: "conditional", data.branchKey="false", data.label="False"
 * Also ensure data.parameters exists as an object for conditional edges.
 */
function migrateEdges(edges = []) {
  return (edges || []).map((e) => {
    let next = e;
    if (e?.type === EdgeTypes.CONDITIONAL_TRUE) {
      next = {
        ...e,
        type: EdgeTypes.CONDITIONAL,
        data: { ...(e.data || {}), branchKey: e?.data?.branchKey || "true", label: e?.data?.label || "True" },
      };
    } else if (e?.type === EdgeTypes.CONDITIONAL_FALSE) {
      next = {
        ...e,
        type: EdgeTypes.CONDITIONAL,
        data: { ...(e.data || {}), branchKey: e?.data?.branchKey || "false", label: e?.data?.label || "False" },
      };
    }

    // Ensure parameters field for conditional edges
    if (next?.type === EdgeTypes.CONDITIONAL) {
      const currentParams = next?.data?.parameters;
      const normalizedParams =
        currentParams && typeof currentParams === "object" ? currentParams : {};
      return {
        ...next,
        data: { ...(next.data || {}), parameters: normalizedParams },
      };
    }
    return next;
  });
}

// Model validation utilities
function validateModel(nodes, edges) {
  const errors = [];
  const startNodes = nodes.filter((n) => n.type === NodeTypes.START);
  if (startNodes.length > 1) {
    errors.push("Only one Start node is allowed.");
  }
  const eList = migrateEdges(edges); // validate with migrated view
  eList.forEach((e) => {
    const src = nodes.find((n) => n.id === e.source);
    const tgt = nodes.find((n) => n.id === e.target);
    if (!src || !tgt) {
      errors.push("Edge references missing node(s).");
    }
    if (src && src.type === NodeTypes.END) {
      errors.push("End nodes cannot have outgoing edges.");
    }
    if (tgt && tgt.type === NodeTypes.START) {
      errors.push("Start node cannot have incoming edges.");
    }
  });
  return { valid: errors.length === 0, errors };
}

/**
 * PUBLIC_INTERFACE
 * Check that for a given Decision node, outgoing conditional edges have unique branchKey values.
 * Returns: { ok: boolean, duplicates: string[] } where duplicates are the repeated branchKeys
 */
export function validateDecisionBranchKeys(nodeId, nodes = [], edges = []) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== NodeTypes.DECISION) return { ok: true, duplicates: [] };
  const migrated = migrateEdges(edges);
  const outgoing = migrated.filter((e) => e.source === nodeId && e.type === EdgeTypes.CONDITIONAL);
  const seen = new Map();
  const dups = new Set();
  outgoing.forEach((e) => {
    const key = e?.data?.branchKey;
    if (!key) return;
    if (seen.has(key)) dups.add(key);
    else seen.set(key, true);
  });
  return { ok: dups.size === 0, duplicates: Array.from(dups) };
}

function initialState() {
  const saved = localStorage.getItem("workflow_state");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // run migration on edges
      const migratedEdges = migrateEdges(parsed.edges || []);
      return {
        ...parsed,
        edges: migratedEdges,
        ui: {
          ...parsed.ui,
          zoom: parsed?.ui?.zoom ?? 1,
          offsetX: parsed?.ui?.offsetX ?? 0,
          offsetY: parsed?.ui?.offsetY ?? 0,
        },
        history: [],
        future: [],
        lastSavedAt: Date.now(),
      };
    } catch {
      // ignore
    }
  }
  return {
    nodes: [],
    edges: [],
    selection: { nodeId: null, edgeId: null },
    ui: { zoom: 1, offsetX: 0, offsetY: 0, grid: true },
    metadata: { name: "Untitled Workflow", description: "" },
    history: [],
    future: [],
    lastSavedAt: null,
  };
}

function pushHistory(state) {
  const snapshot = {
    nodes: state.nodes,
    edges: state.edges,
    selection: state.selection,
    metadata: state.metadata,
    ui: state.ui,
  };
  const hist = [...state.history, snapshot].slice(-50);
  return hist;
}

export const useWorkflowStore = create((set, get) => ({
  ...initialState(),

  // PUBLIC_INTERFACE
  newWorkflow: () =>
    set((state) => ({
      history: pushHistory(state),
      future: [],
      nodes: [],
      edges: [],
      selection: { nodeId: null, edgeId: null },
      metadata: { name: "Untitled Workflow", description: "" },
    })),

  // PUBLIC_INTERFACE
  loadFromJSON: (json) =>
    set((state) => {
      let data = typeof json === "string" ? JSON.parse(json) : json;
      // migrate legacy conditional types on import and ensure parameters
      const migratedEdges = migrateEdges(data.edges || []);
      const valid = validateModel(data.nodes || [], migratedEdges || []);
      return {
        history: pushHistory(state),
        future: [],
        nodes: data.nodes || [],
        edges: migratedEdges || [],
        metadata: data.metadata || { name: "Imported", description: "" },
        selection: { nodeId: null, edgeId: null },
        validation: valid,
      };
    }),

  // PUBLIC_INTERFACE
  exportToJSON: () => {
    const { nodes, edges, metadata } = get();
    // ensure export serialized with migrated conditional edge type and parameters
    const e = migrateEdges(edges);
    return JSON.stringify({ nodes, edges: e, metadata }, null, 2);
  },

  // PUBLIC_INTERFACE
  saveToLocalStorage: () => {
    const { nodes, edges, metadata, ui } = get();
    // save migrated view to include new fields
    const e = migrateEdges(edges);
    localStorage.setItem("workflow_state", JSON.stringify({ nodes, edges: e, metadata, ui }));
    set({ lastSavedAt: Date.now() });
  },

  // PUBLIC_INTERFACE
  addNode: (partial) =>
    set((state) => {
      const id = nanoid(8);
      const node = {
        id,
        type: partial.type || NodeTypes.TASK,
        title: partial.title || (partial.type || "Task"),
        description: "",
        x: partial.x || 100,
        y: partial.y || 100,
        width: partial.width || 160,
        height: partial.height || 60,
        io: { inputs: [], outputs: [] },
        data: partial.data || {},
      };
      return {
        history: pushHistory(state),
        future: [],
        nodes: [...state.nodes, node],
        selection: { nodeId: id, edgeId: null },
      };
    }),

  // PUBLIC_INTERFACE
  updateNode: (id, updates) =>
    set((state) => ({
      history: pushHistory(state),
      future: [],
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  // PUBLIC_INTERFACE
  moveNode: (id, dx, dy) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n
      ),
    })),

  // PUBLIC_INTERFACE
  resizeNode: (id, width, height) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, width: clamp(width, 80, 480), height: clamp(height, 40, 320) } : n
      ),
    })),

  // PUBLIC_INTERFACE
  deleteNode: (id) =>
    set((state) => ({
      history: pushHistory(state),
      future: [],
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selection: { nodeId: null, edgeId: null },
    })),

  // PUBLIC_INTERFACE
  /**
   * Add an edge. For Decision nodes, callers can pass data.branchKey and data.label, and optional data.parameters (object).
   */
  addEdge: (source, target, type = EdgeTypes.DEFAULT, data = {}) =>
    set((state) => {
      if (source === target) return {};
      const src = state.nodes.find((n) => n.id === source);
      const tgt = state.nodes.find((n) => n.id === target);
      if (!src || !tgt) return {};
      if (src.type === NodeTypes.END) return {};
      if (tgt.type === NodeTypes.START) return {};

      // Normalize legacy conditional types to generalized conditional
      let finalType = type;
      let finalData = { ...(data || {}) };
      if (type === EdgeTypes.CONDITIONAL_TRUE) {
        finalType = EdgeTypes.CONDITIONAL;
        finalData.branchKey = finalData.branchKey || "true";
        finalData.label = finalData.label || "True";
      } else if (type === EdgeTypes.CONDITIONAL_FALSE) {
        finalType = EdgeTypes.CONDITIONAL;
        finalData.branchKey = finalData.branchKey || "false";
        finalData.label = finalData.label || "False";
      }

      // Ensure parameters object for conditional edges
      if (finalType === EdgeTypes.CONDITIONAL) {
        finalData.parameters =
          finalData.parameters && typeof finalData.parameters === "object"
            ? finalData.parameters
            : {};
      }

      const id = nanoid(8);
      const edge = { id, source, target, type: finalType, data: finalData };
      return {
        history: pushHistory(state),
        future: [],
        edges: [...state.edges, edge],
        selection: { nodeId: null, edgeId: id },
      };
    }),

  // PUBLIC_INTERFACE
  deleteEdge: (id) =>
    set((state) => ({
      history: pushHistory(state),
      future: [],
      edges: state.edges.filter((e) => e.id !== id),
      selection: { nodeId: null, edgeId: null },
    })),

  // PUBLIC_INTERFACE
  updateEdgeType: (id, type) =>
    set((state) => {
      // normalize legacy -> conditional
      let finalType = type;
      let updateDataPatch = {};
      if (type === EdgeTypes.CONDITIONAL_TRUE) {
        finalType = EdgeTypes.CONDITIONAL;
        updateDataPatch = { branchKey: "true", label: "True" };
      } else if (type === EdgeTypes.CONDITIONAL_FALSE) {
        finalType = EdgeTypes.CONDITIONAL;
        updateDataPatch = { branchKey: "false", label: "False" };
      }
      return {
        history: pushHistory(state),
        future: [],
        edges: state.edges.map((e) => {
          if (e.id !== id) return e;
          const nextType = finalType;
          // when switching to conditional, ensure parameters object exists
          const nextData =
            nextType === EdgeTypes.CONDITIONAL
              ? { ...(e.data || {}), ...updateDataPatch, parameters: { ...((e.data && e.data.parameters) || {}) } }
              : { ...(e.data || {}), ...updateDataPatch };
          return { ...e, type: nextType, data: nextData };
        }),
        // keep the same selection so the panel stays open
        selection: state.selection?.edgeId === id ? state.selection : { nodeId: null, edgeId: id },
      };
    }),

  // PUBLIC_INTERFACE
  /**
   * Update edge data fields (e.g., branchKey, label, parameters).
   * Partial updates to edge.data are supported.
   */
  updateEdgeData: (id, dataPatch) =>
    set((state) => ({
      history: pushHistory(state),
      future: [],
      edges: state.edges.map((e) => {
        if (e.id !== id) return e;
        const patch = { ...(dataPatch || {}) };
        // If parameters provided as string, try to parse; if object, take as-is.
        if ("parameters" in patch) {
          const incoming = patch.parameters;
          const normalized =
            typeof incoming === "string"
              ? safeJsonParse(incoming, e.data?.parameters || {})
              : (incoming && typeof incoming === "object" ? incoming : e.data?.parameters || {});
          patch.parameters = normalized;
        }
        return { ...e, data: { ...(e.data || {}), ...patch } };
      }),
      selection: state.selection?.edgeId === id ? state.selection : { nodeId: null, edgeId: id },
    })),

  // PUBLIC_INTERFACE
  selectNode: (id) => set({ selection: { nodeId: id, edgeId: null } }),

  // PUBLIC_INTERFACE
  selectEdge: (id) => set({ selection: { nodeId: null, edgeId: id } }),

  // PUBLIC_INTERFACE
  clearSelection: () => set({ selection: { nodeId: null, edgeId: null } }),

  // PUBLIC_INTERFACE
  setZoom: (zoom) =>
    set((state) => ({ ui: { ...state.ui, zoom: clamp(zoom, 0.25, 2) } })),

  // PUBLIC_INTERFACE
  pan: (dx, dy) =>
    set((state) => ({
      ui: { ...state.ui, offsetX: state.ui.offsetX + dx, offsetY: state.ui.offsetY + dy },
    })),

  // PUBLIC_INTERFACE
  undo: () =>
    set((state) => {
      if (!state.history.length) return {};
      const prev = state.history[state.history.length - 1];
      const rest = state.history.slice(0, -1);
      const snapshot = {
        nodes: state.nodes,
        edges: state.edges,
        selection: state.selection,
        metadata: state.metadata,
        ui: state.ui,
      };
      return {
        nodes: prev.nodes,
        edges: prev.edges,
        selection: prev.selection,
        metadata: prev.metadata,
        ui: prev.ui,
        history: rest,
        future: [snapshot, ...state.future].slice(0, 50),
      };
    }),

  // PUBLIC_INTERFACE
  redo: () =>
    set((state) => {
      if (!state.future.length) return {};
      const next = state.future[0];
      const rest = state.future.slice(1);
      const snapshot = {
        nodes: state.nodes,
        edges: state.edges,
        selection: state.selection,
        metadata: state.metadata,
        ui: state.ui,
      };
      return {
        nodes: next.nodes,
        edges: next.edges,
        selection: next.selection,
        metadata: next.metadata,
        ui: next.ui,
        history: [...state.history, snapshot].slice(-50),
        future: rest,
      };
    }),
}));
