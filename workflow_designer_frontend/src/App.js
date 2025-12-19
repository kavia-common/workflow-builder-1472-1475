import React, { useEffect, useState } from "react";
import "./App.css";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import { HelpModal, ImportModal } from "./components/Modals";
import { useWorkflowStore } from "./store/useWorkflowStore";

// PUBLIC_INTERFACE
function App() {
  /** Root of the Workflow Designer app; sets theme and renders layout. */
  const [theme, setTheme] = useState("light");
  const saveToLocalStorage = useWorkflowStore((s) => s.saveToLocalStorage);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Auto-save on changes
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const metadata = useWorkflowStore((s) => s.metadata);
  const ui = useWorkflowStore((s) => s.ui);
  useEffect(() => {
    const t = setTimeout(() => saveToLocalStorage(), 400);
    return () => clearTimeout(t);
  }, [nodes, edges, metadata, ui, saveToLocalStorage]);

  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="app-shell" data-theme={theme}>
      <Toolbar onOpenHelp={() => setHelpOpen(true)} onOpenImport={() => setImportOpen(true)} />
      <Sidebar />
      <Canvas />
      <ThemeToggle theme={theme} setTheme={setTheme} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  // PUBLIC_INTERFACE
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  return (
    <button
      className="btn btn-primary"
      onClick={toggleTheme}
      style={{ position: "fixed", right: 16, bottom: 16, zIndex: 20 }}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title="Toggle theme"
    >
      {theme === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}

export default App;
