import React from "react";
import { useWorkflowStore } from "../store/useWorkflowStore";

// PUBLIC_INTERFACE
export default function Toolbar({ onOpenImport, onOpenHelp }) {
  /** Toolbar for core actions: new, save, load, undo/redo, zoom, export/import. */
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const saveToLocalStorage = useWorkflowStore((s) => s.saveToLocalStorage);
  const exportToJSON = useWorkflowStore((s) => s.exportToJSON);
  const setZoom = useWorkflowStore((s) => s.setZoom);
  const ui = useWorkflowStore((s) => s.ui);
  const metadata = useWorkflowStore((s) => s.metadata);

  const onExport = () => {
    const blob = new Blob([exportToJSON()], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${metadata?.name || "workflow"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Workflow actions">
      <div className="group" aria-label="File">
        <button className="btn" onClick={newWorkflow} title="New (Ctrl+N)">New</button>
        <button className="btn" onClick={saveToLocalStorage} title="Save (Ctrl+S)">Save</button>
        <button className="btn" onClick={onOpenImport} title="Import JSON">Import</button>
        <button className="btn" onClick={onExport} title="Export JSON">Export</button>
      </div>
      <div className="group" aria-label="Edit">
        <button className="btn" onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
        <button className="btn" onClick={redo} title="Redo (Ctrl+Y)">Redo</button>
      </div>
      <div className="group" aria-label="View">
        <button className="btn" onClick={() => setZoom(ui.zoom - 0.1)} title="Zoom Out">-</button>
        <span className="btn" aria-live="polite">{Math.round(ui.zoom * 100)}%</span>
        <button className="btn" onClick={() => setZoom(ui.zoom + 0.1)} title="Zoom In">+</button>
      </div>
      <div className="group" aria-label="Help">
        <button className="btn btn-primary" onClick={onOpenHelp}>Help</button>
        <span className="badge">{process.env.REACT_APP_NODE_ENV || "dev"}</span>
      </div>
    </div>
  );
}
