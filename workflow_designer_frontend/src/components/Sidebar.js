import React, { useMemo } from "react";
import { useWorkflowStore, NodeTypes } from "../store/useWorkflowStore";

// PUBLIC_INTERFACE
export default function Sidebar() {
  /** Sidebar hosting Palette and Properties panels. */
  return (
    <aside className="sidebar">
      <Palette />
      <PropertiesPanel />
    </aside>
  );
}

function Palette() {
  const addNode = useWorkflowStore((s) => s.addNode);
  const items = useMemo(
    () => [
      { label: "Start", type: NodeTypes.START },
      { label: "Task", type: NodeTypes.TASK },
      { label: "Decision", type: NodeTypes.DECISION },
      { label: "Parallel", type: NodeTypes.PARALLEL },
      { label: "End", type: NodeTypes.END },
    ],
    []
  );

  const onDragStart = (e, type) => {
    e.dataTransfer.setData("application/x-node-type", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="panel" aria-label="Palette">
      <div className="panel-header">Palette</div>
      <div className="panel-body">
        <div className="palette-grid">
          {items.map((it) => (
            <div
              key={it.type}
              draggable
              onDragStart={(e) => onDragStart(e, it.type)}
              onDoubleClick={() => addNode({ type: it.type })}
              className="palette-item"
              role="button"
              aria-label={`Drag ${it.label} to canvas`}
              title={`Drag ${it.label} to canvas`}
            >
              {it.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertiesPanel() {
  const selection = useWorkflowStore((s) => s.selection);
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === s.selection.nodeId));
  const edge = useWorkflowStore((s) => s.edges.find((e) => e.id === s.selection.edgeId));
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const updateEdgeType = useWorkflowStore((s) => s.updateEdgeType);
  const metadata = useWorkflowStore((s) => s.metadata);
  const setMeta = useWorkflowStore((s) => (meta) => s.loadFromJSON({ nodes: s.nodes, edges: s.edges, metadata: { ...s.metadata, ...meta } }));

  return (
    <div className="panel" aria-label="Properties">
      <div className="panel-header">Properties</div>
      <div className="panel-body">
        {!selection.nodeId && !selection.edgeId && (
          <div className="properties-form">
            <label>Workflow Name</label>
            <input
              value={metadata?.name || ""}
              onChange={(e) => setMeta({ name: e.target.value })}
              placeholder="Untitled Workflow"
            />
            <label>Description</label>
            <textarea
              rows={4}
              value={metadata?.description || ""}
              onChange={(e) => setMeta({ description: e.target.value })}
              placeholder="Describe the workflow..."
            />
          </div>
        )}
        {node && (
          <div className="properties-form">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{node.type.toUpperCase()}</strong>
              <button className="btn" onClick={() => deleteNode(node.id)} title="Delete Node">Delete</button>
            </div>
            <label>Title</label>
            <input value={node.title} onChange={(e) => updateNode(node.id, { title: e.target.value })} />
            <label>Description</label>
            <textarea rows={4} value={node.description || ""} onChange={(e) => updateNode(node.id, { description: e.target.value })} />
            <label>Inputs (comma separated)</label>
            <input
              value={(node.io?.inputs || []).join(", ")}
              onChange={(e) =>
                updateNode(node.id, { io: { ...node.io, inputs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })
              }
            />
            <label>Outputs (comma separated)</label>
            <input
              value={(node.io?.outputs || []).join(", ")}
              onChange={(e) =>
                updateNode(node.id, { io: { ...node.io, outputs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })
              }
            />
            {node.type === NodeTypes.DECISION && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                Tip: Use conditional edges to represent True/False branches.
              </div>
            )}
            {node.type === NodeTypes.PARALLEL && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                Tip: Connect to multiple tasks to run in parallel; then merge back.
              </div>
            )}
          </div>
        )}
        {edge && (
          <div className="properties-form">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Edge</strong>
              <button className="btn" onClick={() => deleteEdge(edge.id)} title="Delete Edge">Delete</button>
            </div>
            <label>Edge Type</label>
            <select
              value={edge.type}
              onChange={(e) => updateEdgeType(edge.id, e.target.value)}
              aria-label="Edge Type"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", color: "var(--text)" }}
            >
              <option value="default">default</option>
              <option value="conditional">conditional</option>
              {/* Legacy options retained for compatibility; selecting will migrate to "conditional" */}
              <option value="conditional_true">conditional_true</option>
              <option value="conditional_false">conditional_false</option>
              <option value="parallel">parallel</option>
            </select>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Current: <code>{edge.type}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
