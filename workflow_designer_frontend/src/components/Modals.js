import React, { useState } from "react";
import { useWorkflowStore } from "../store/useWorkflowStore";

// PUBLIC_INTERFACE
export function HelpModal({ open, onClose }) {
  /** Minimal help/about modal. */
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Help">
      <div className="modal">
        <header>About Workflow Designer</header>
        <div className="content">
          <p>
            Build workflows visually with Start, Task, Decision, Parallel, and End nodes. Drag from the palette to the
            canvas, connect nodes using the circular handle. Decision nodes support conditional branches (use edge color
            hints). Parallel nodes split and merge flows.
          </p>
          <ul>
            <li>Ctrl/Cmd+S: Save to localStorage</li>
            <li>Ctrl/Cmd+Z: Undo, Ctrl/Cmd+Y or Shift+Ctrl/Cmd+Z: Redo</li>
            <li>Delete/Backspace: Delete selection</li>
            <li>Drag with Alt or middle mouse to pan</li>
          </ul>
          <p style={{ color: "var(--muted)" }}>
            API base (unused): {process.env.REACT_APP_API_BASE || "(not set)"}.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export function ImportModal({ open, onClose }) {
  /** Import JSON modal with textarea. */
  const [text, setText] = useState("");
  const loadFromJSON = useWorkflowStore((s) => s.loadFromJSON);

  if (!open) return null;

  const onImport = () => {
    try {
      loadFromJSON(text);
      onClose();
    } catch (e) {
      alert("Invalid JSON");
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Import JSON">
      <div className="modal">
        <header>Import Workflow JSON</header>
        <div className="content">
          <textarea
            rows={12}
            style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", padding: 12 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{"nodes":[...],"edges":[...],"metadata":{...}}'
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={onImport}>Import</button>
          </div>
        </div>
      </div>
    </div>
  );
}
