import React, { useMemo, useState, useEffect } from "react";
import { useWorkflowStore, NodeTypes, EdgeTypes } from "../store/useWorkflowStore";

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
  const updateEdgeData = useWorkflowStore((s) => s.updateEdgeData);
  const metadata = useWorkflowStore((s) => s.metadata);
  const setMeta = useWorkflowStore((s) => (meta) => s.loadFromJSON({ nodes: s.nodes, edges: s.edges, metadata: { ...s.metadata, ...meta } }));

  // Local UI state for parameters editor (JSON text) with basic validation
  const [paramsText, setParamsText] = useState("");
  const [paramsError, setParamsError] = useState(null);

  // Sync editor when edge selection changes
  useEffect(() => {
    if (edge?.type === EdgeTypes.CONDITIONAL) {
      const p = edge?.data?.parameters || {};
      setParamsText(JSON.stringify(p, null, 2));
      setParamsError(null);
    } else {
      setParamsText("");
      setParamsError(null);
    }
  }, [edge]);

  const onApplyParams = () => {
    if (!edge) return;
    try {
      const parsed = paramsText ? JSON.parse(paramsText) : {};
      if (parsed && typeof parsed === "object") {
        updateEdgeData(edge.id, { parameters: parsed });
        setParamsError(null);
      } else {
        setParamsError("Parameters must be a JSON object.");
      }
    } catch (e) {
      setParamsError("Invalid JSON.");
    }
  };

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

            {edge.type === EdgeTypes.CONDITIONAL && (
              <>
                <label>Branch Key</label>
                <input
                  value={edge?.data?.branchKey || ""}
                  placeholder="e.g. true, false, or custom key"
                  onChange={(e) => updateEdgeData(edge.id, { branchKey: e.target.value })}
                />
                <label>Branch Label</label>
                <input
                  value={edge?.data?.label || ""}
                  placeholder="Human-friendly label"
                  onChange={(e) => updateEdgeData(edge.id, { label: e.target.value })}
                />
                <label>Parameters (JSON)</label>
                <textarea
                  rows={6}
                  value={paramsText}
                  onChange={(e) => setParamsText(e.target.value)}
                  placeholder='{"threshold": 0.8, "mode": "strict"}'
                />
                {paramsError ? (
                  <div style={{ color: "var(--error)", fontSize: 12, marginTop: 4 }}>{paramsError}</div>
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    Provide a JSON object with branch-specific parameters for evaluation or execution.
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button className="btn" onClick={() => {
                    // reset to serialized current store value
                    setParamsText(JSON.stringify(edge?.data?.parameters || {}, null, 2));
                    setParamsError(null);
                  }}>Reset</button>
                  <button className="btn btn-primary" onClick={onApplyParams}>Apply</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
