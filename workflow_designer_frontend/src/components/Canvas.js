import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorkflowStore, NodeTypes, EdgeTypes } from "../store/useWorkflowStore";

// Geometry helpers
function getNodeCenter(n) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 };
}

function lineBetween(n1, n2) {
  const a = getNodeCenter(n1);
  const b = getNodeCenter(n2);
  return { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy };
}

function pathStraight({ x1, y1, x2, y2 }) {
  return `M${x1},${y1} L${x2},${y2}`;
}

function edgeMidpoint({ x1, y1, x2, y2 }) {
  return { mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

// Basic hit test for resize handle area
function isOnResizeHandle(n, x, y) {
  const handleSize = 10;
  return (
    x >= n.x + n.width - handleSize &&
    x <= n.x + n.width + handleSize &&
    y >= n.y + n.height - handleSize &&
    y <= n.y + n.height + handleSize
  );
}

// PUBLIC_INTERFACE
export default function Canvas() {
  /** Interactive SVG canvas for building and connecting nodes. */
  const svgRef = useRef(null);
  const { nodes, edges, selection, ui } = useWorkflowStore((s) => ({
    nodes: s.nodes,
    edges: s.edges,
    selection: s.selection,
    ui: s.ui,
  }));

  const addNode = useWorkflowStore((s) => s.addNode);
  const addEdge = useWorkflowStore((s) => s.addEdge);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const moveNode = useWorkflowStore((s) => s.moveNode);
  const resizeNode = useWorkflowStore((s) => s.resizeNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const pan = useWorkflowStore((s) => s.pan);

  const [drag, setDrag] = useState(null); // { id, startX, startY, mode: 'move'|'resize'|'pan'|'edge', edgeSource? }
  const [tempEdge, setTempEdge] = useState(null); // { x1,y1,x2,y2, type }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        useWorkflowStore.getState().saveToLocalStorage();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useWorkflowStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        useWorkflowStore.getState().redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const sel = useWorkflowStore.getState().selection;
        if (sel.nodeId) deleteNode(sel.nodeId);
        if (sel.edgeId) deleteEdge(sel.edgeId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteNode, deleteEdge]);

  const onDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/x-node-type");
    if (!type) return;
    const pt = clientToWorld(e.clientX, e.clientY);
    addNode({ type, x: pt.x - 80, y: pt.y - 30 });
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  function clientToWorld(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - ui.offsetX) / ui.zoom;
    const y = (clientY - rect.top - ui.offsetY) / ui.zoom;
    return { x, y };
  }

  const onCanvasMouseDown = (e) => {
    const isMiddle = e.button === 1 || (e.button === 0 && e.altKey);
    if (isMiddle) {
      setDrag({ mode: "pan", startX: e.clientX, startY: e.clientY });
      return;
    }
    clearSelection();
  };

  const onCanvasMouseMove = (e) => {
    if (!drag) return;
    if (drag.mode === "pan") {
      pan(e.movementX, e.movementY);
    } else if (drag.mode === "edge") {
      const pt = clientToWorld(e.clientX, e.clientY);
      setTempEdge({ ...drag.temp, x2: pt.x, y2: pt.y });
    } else if (drag.mode === "move") {
      const pt = clientToWorld(e.clientX, e.clientY);
      moveNode(drag.id, pt.x - drag.lastX, pt.y - drag.lastY);
      setDrag((d) => ({ ...d, lastX: pt.x, lastY: pt.y }));
    } else if (drag.mode === "resize") {
      const pt = clientToWorld(e.clientX, e.clientY);
      resizeNode(drag.id, pt.x - drag.nodeX, pt.y - drag.nodeY);
    }
  };

  const onCanvasMouseUp = () => {
    if (drag?.mode === "edge" && drag?.edgeSource) {
      // Cancel if not dropped on a node
      setTempEdge(null);
    }
    setDrag(null);
  };

  const nodeMouseDown = (e, n) => {
    e.stopPropagation();
    selectNode(n.id);
    const pt = clientToWorld(e.clientX, e.clientY);
    if (isOnResizeHandle(n, pt.x, pt.y)) {
      setDrag({ mode: "resize", id: n.id, nodeX: n.x, nodeY: n.y });
      return;
    }
    setDrag({ mode: "move", id: n.id, lastX: pt.x, lastY: pt.y });
  };

  const nodeHandleMouseDown = (e, n) => {
    e.stopPropagation();
    const c = getNodeCenter(n);
    const type =
      n.type === NodeTypes.DECISION
        ? EdgeTypes.CONDITIONAL_TRUE
        : n.type === NodeTypes.PARALLEL
        ? EdgeTypes.PARALLEL
        : EdgeTypes.DEFAULT;
    setDrag({
      mode: "edge",
      edgeSource: n.id,
      temp: { x1: c.cx, y1: c.cy, x2: c.cx, y2: c.cy, type },
    });
    setTempEdge({ x1: c.cx, y1: c.cy, x2: c.cx, y2: c.cy, type });
  };

  const nodeMouseUp = (e, targetNode) => {
    if (drag?.mode === "edge" && drag?.edgeSource) {
      if (drag.edgeSource !== targetNode.id) {
        addEdge(drag.edgeSource, targetNode.id, tempEdge?.type);
      }
    }
    setTempEdge(null);
    setDrag(null);
  };

  const onEdgeClick = (e, edge) => {
    e.stopPropagation();
    selectEdge(edge.id);
  };

  const defs = (
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L10,3 L0,6 z" fill="#94A3B8" />
      </marker>
      {/* Shadow filter for badges to enhance readability */}
      <filter id="badgeShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="rgba(0,0,0,0.25)" />
      </filter>
    </defs>
  );

  const worldTransform = `translate(${ui.offsetX}, ${ui.offsetY}) scale(${ui.zoom})`;

  // Render edge path and optional badge
  const renderEdgeWithBadge = (e) => {
    const a = nodes.find((n) => n.id === e.source);
    const b = nodes.find((n) => n.id === e.target);
    if (!a || !b) return null;

    const seg = lineBetween(a, b);
    const d = pathStraight(seg);
    const mid = edgeMidpoint(seg);
    const selected = selection.edgeId === e.id ? "selected" : "";

    const cls =
      e.type === EdgeTypes.CONDITIONAL_TRUE
        ? "edge conditional_true"
        : e.type === EdgeTypes.CONDITIONAL_FALSE
        ? "edge conditional_false"
        : e.type === EdgeTypes.PARALLEL
        ? "edge parallel"
        : "edge";

    // Badge content and color by type
    let badgeText = null;
    let badgeClass = "edge-badge neutral";
    if (e.type === EdgeTypes.CONDITIONAL_TRUE) {
      badgeText = "True";
      badgeClass = "edge-badge true";
    } else if (e.type === EdgeTypes.CONDITIONAL_FALSE) {
      badgeText = "False";
      badgeClass = "edge-badge false";
    } else if (e.type === EdgeTypes.PARALLEL) {
      badgeText = ""; // optional tiny arrow or dot; keeping minimal for parallel
      badgeClass = "edge-badge neutral";
    } else {
      badgeText = ""; // default: no label
      badgeClass = "edge-badge neutral";
    }

    // We offset the badge slightly above the line for readability
    const BADGE_OFFSET_Y = -8;

    return (
      <g key={e.id} className="edge-group">
        <path className={`${cls} ${selected}`} d={d} onClick={(ev) => onEdgeClick(ev, e)} />
        {/* Badge group should not block pointer events */}
        {badgeText ? (
          <g
            className={`${badgeClass}${selected ? " selected" : ""}`}
            transform={`translate(${mid.mx}, ${mid.my + BADGE_OFFSET_Y})`}
            aria-label={`Edge label ${badgeText}`}
          >
            <g filter="url(#badgeShadow)">
              <rect x={-18} y={-10} rx="10" ry="10" width="36" height="20" />
            </g>
            <text textAnchor="middle" dominantBaseline="middle">
              {badgeText}
            </text>
          </g>
        ) : null}
      </g>
    );
  };

  return (
    <div className="canvas-wrap" onDrop={onDrop} onDragOver={onDragOver}>
      <svg
        ref={svgRef}
        className="canvas-svg"
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        role="presentation"
      >
        {defs}
        <g transform={worldTransform}>
          {/* Edges */}
          {edges.map((e) => renderEdgeWithBadge(e))}

          {/* Temp edge */}
          {tempEdge && <path className={`edge ${tempEdge.type || ""}`} d={pathStraight(tempEdge)} />}

          {/* Nodes */}
          {nodes.map((n) => (
            <g
              key={n.id}
              className={`node ${selection.nodeId === n.id ? "selected" : ""}`}
              transform={`translate(${n.x}, ${n.y})`}
              onMouseDown={(e) => nodeMouseDown(e, n)}
              onMouseUp={(e) => nodeMouseUp(e, n)}
            >
              <NodeShape n={n} />
              {/* Connection Handle */}
              <circle
                className="handle"
                cx={n.width}
                cy={n.height / 2}
                r="6"
                onMouseDown={(e) => nodeHandleMouseDown(e, n)}
              />
              {/* Resize Handle */}
              <rect
                x={n.width - 8}
                y={n.height - 8}
                width="16"
                height="16"
                fill="#fff"
                stroke="var(--secondary)"
                strokeWidth="2"
                style={{ cursor: "nwse-resize" }}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function NodeShape({ n }) {
  const fillByType = useMemo(() => {
    switch (n.type) {
      case NodeTypes.START:
        return { fill: "url(#startGrad)", stroke: "var(--primary)" };
      case NodeTypes.END:
        return { fill: "url(#endGrad)", stroke: "var(--error)" };
      case NodeTypes.DECISION:
        return { fill: "url(#decisionGrad)", stroke: "#10B981" };
      case NodeTypes.PARALLEL:
        return { fill: "url(#parallelGrad)", stroke: "#6366F1" };
      default:
        return { fill: "url(#taskGrad)", stroke: "var(--primary)" };
    }
  }, [n.type]);

  return (
    <>
      <defs>
        <linearGradient id="taskGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(244,114,182,0.20)" />
          <stop offset="100%" stopColor="rgba(168,85,247,0.10)" />
        </linearGradient>
        <linearGradient id="startGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,0.25)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.10)" />
        </linearGradient>
        <linearGradient id="endGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(239,68,68,0.25)" />
          <stop offset="100%" stopColor="rgba(239,68,68,0.10)" />
        </linearGradient>
        <linearGradient id="decisionGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.25)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.10)" />
        </linearGradient>
        <linearGradient id="parallelGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(99,102,241,0.25)" />
          <stop offset="100%" stopColor="rgba(99,102,241,0.10)" />
        </linearGradient>
      </defs>

      {n.type === NodeTypes.DECISION ? (
        <g>
          <polygon
            points={`${n.width / 2},0 ${n.width},${n.height / 2} ${n.width / 2},${n.height} 0,${n.height / 2}`}
            fill={fillByType.fill}
            stroke={fillByType.stroke}
            strokeWidth="1.5"
            rx="12"
          />
        </g>
      ) : n.type === NodeTypes.START || n.type === NodeTypes.END ? (
        <g>
          <rect
            x="0"
            y="0"
            width={n.width}
            height={n.height}
            rx={n.height / 2}
            ry={n.height / 2}
            fill={fillByType.fill}
            stroke={fillByType.stroke}
            strokeWidth="1.5"
          />
        </g>
      ) : n.type === NodeTypes.PARALLEL ? (
        <g>
          <rect
            x="0"
            y="0"
            width={n.width}
            height={n.height}
            rx="14"
            fill={fillByType.fill}
            stroke={fillByType.stroke}
            strokeWidth="1.5"
          />
          <path
            d={`M${n.width / 3},8 L${n.width / 3},${n.height - 8} M${(2 * n.width) / 3},8 L${(2 * n.width) / 3},${n.height - 8
              }`}
            stroke={fillByType.stroke}
            strokeWidth="3"
          />
        </g>
      ) : (
        <rect
          x="0"
          y="0"
          width={n.width}
          height={n.height}
          rx="14"
          fill={fillByType.fill}
          stroke={fillByType.stroke}
          strokeWidth="1.5"
        />
      )}

      <text
        x={n.width / 2}
        y={n.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontWeight: 700, fill: "var(--text)" }}
      >
        {n.title}
      </text>
    </>
  );
}
