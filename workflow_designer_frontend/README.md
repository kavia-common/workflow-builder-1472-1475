# Workflow Designer Frontend (Ocean Professional)

Elegant React-based workflow designer with interactive SVG canvas, palette, properties, toolbar, autosave, and JSON import/export.

## Quick Start
- npm start
- Open http://localhost:3000

## Features
- Nodes: Start, Task, Decision, Parallel, End
- Drag from Palette, drop on Canvas; move/resize nodes
- Connect nodes via right circular handle
- Decision edges use green/red for conditional hints
- Parallel node visual split (merge via connecting back)
- Selection and delete nodes/edges
- Undo/Redo, Zoom, Save to localStorage
- Import/Export workflow JSON
- Responsive layout with Ocean Professional theme
- Keyboard shortcuts:
  - Ctrl/Cmd+S: Save
  - Ctrl/Cmd+Z: Undo, Ctrl/Cmd+Y or Shift+Ctrl/Cmd+Z: Redo
  - Delete/Backspace: Delete selection
  - Alt+Drag or Middle mouse: Pan

## Environment Variables
This app reads REACT_APP_* variables if present (no backend required):
- REACT_APP_API_BASE
- REACT_APP_BACKEND_URL
- REACT_APP_FRONTEND_URL
- REACT_APP_WS_URL
- REACT_APP_NODE_ENV
- REACT_APP_FEATURE_FLAGS

## Data Persistence
- Autosaves to localStorage key `workflow_state`.

## JSON Format
```
{
  "nodes": [
    { "id":"...", "type":"task|start|decision|parallel|end", "title":"...", "description":"", "x":0, "y":0, "width":160, "height":60, "io":{"inputs":[],"outputs":[]} }
  ],
  "edges":[
    { "id":"...", "source":"nodeId", "target":"nodeId", "type":"default|conditional|parallel",
      "data": { 
        "branchKey": "unique-key-per-decision",
        "label": "Human label",
        "parameters": { "threshold": 0.8, "mode": "strict" } 
      } }
  ],
  "metadata": { "name":"...", "description":"..." }
}
```

Notes:
- The edge type for decision branches is now generalized to `conditional`.
- Each conditional edge supports `data.parameters` (object) to carry branch-specific inputs for evaluation/execution.
- Legacy types `conditional_true` and `conditional_false` are still accepted on import/load and are migrated to `conditional` with `data.branchKey` set to `"true"`/`"false"`, `data.label` set to `"True"`/`"False"`, and an empty `data.parameters` object if missing.
- Export and persistence always output the new `conditional` type with `data.branchKey`/`data.label`/`data.parameters` when applicable.
