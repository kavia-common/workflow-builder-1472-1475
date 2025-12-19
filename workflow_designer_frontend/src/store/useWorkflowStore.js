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
  CONDITIONAL_TRUE: "conditional_true",
  CONDITIONAL_FALSE: "conditional_false",
  PARALLEL: "parallel",
};

// Helpers
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Model validation utilities
function validateModel(nodes, edges) {
  const errors = [];
  const startNodes = nodes.filter((n) => n.type === NodeTypes.START);
  if (startNodes.length > 1) {
    errors.push("Only one Start node is allowed.");
  }
  edges.forEach((e) => {
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

function initialState() {
  const saved = localStorage.getItem("workflow_state");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
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
      const valid = validateModel(data.nodes || [], data.edges || []);
      return {
        history: pushHistory(state),
        future: [],
        nodes: data.nodes || [],
        edges: data.edges || [],
        metadata: data.metadata || { name: "Imported", description: "" },
        selection: { nodeId: null, edgeId: null },
        validation: valid,
      };
    }),

  // PUBLIC_INTERFACE
  exportToJSON: () => {
    const { nodes, edges, metadata } = get();
    return JSON.stringify({ nodes, edges, metadata }, null, 2);
  },

  // PUBLIC_INTERFACE
  saveToLocalStorage: () => {
    const { nodes, edges, metadata, ui } = get();
    localStorage.setItem(
      "workflow_state",
      JSON.stringify({ nodes, edges, metadata, ui })
    );
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
  addEdge: (source, target, type = EdgeTypes.DEFAULT, data = {}) =>
    set((state) => {
      if (source === target) return {};
      const src = state.nodes.find((n) => n.id === source);
      const tgt = state.nodes.find((n) => n.id === target);
      if (!src || !tgt) return {};
      if (src.type === NodeTypes.END) return {};
      if (tgt.type === NodeTypes.START) return {};
      const id = nanoid(8);
      const edge = { id, source, target, type, data };
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
    set((state) => ({
      history: pushHistory(state),
      future: [],
      edges: state.edges.map((e) => (e.id === id ? { ...e, type } : e)),
      // keep the same selection so the panel stays open
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
