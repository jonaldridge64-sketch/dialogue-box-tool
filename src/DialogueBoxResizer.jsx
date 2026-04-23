import { useState, useCallback, useRef } from "react";

// Fixed geometry constants from the original SVG
const RADIUS = 7.18;
const DESCENDER_WIDTH = 32.13;
const DESCENDER_DROP = 14.37;
const DESC_CP1_X = -2.23;
const DESC_CP1_Y = 0;
const DESC_CP2_X = -4.43;
const DESC_CP2_Y = 0.52;
const DESC_CP3_X = -6.43;
const DESC_CP3_Y = 1.52;

const ORIGINAL_WIDTH = 181.06;
const ORIGINAL_HEIGHT = 168.37;

// Minimum width: descender + radius + 20px gap between them
const MIN_BOX_WIDTH = DESCENDER_WIDTH + RADIUS + 20;

const PALETTE = [
  "#161b44",
  "#2e3a7c",
  "#4f6db3",
  "#8ca4d9",
  "#c2d1ed",
];

// Scale factors per box count: [box1, box2, box3, box4]
const SCALE_FACTORS = {
  1: [1],
  2: [1, 0.5],
  3: [1, 0.6, 0.3],
  4: [1, 0.65, 0.4, 0.2],
};

function buildPath(width, bodyHeight, offsetX = 0, offsetY = 0, flipped = false, radiusScale = 1, descenderScale = 1) {
  const r = RADIUS * radiusScale;
  const descW = DESCENDER_WIDTH * descenderScale;
  const descDrop = DESCENDER_DROP * descenderScale;
  const cp1x = DESC_CP1_X * descenderScale;
  const cp1y = DESC_CP1_Y * descenderScale;
  const cp2x = DESC_CP2_X * descenderScale;
  const cp2y = DESC_CP2_Y * descenderScale;
  const cp3x = DESC_CP3_X * descenderScale;
  const cp3y = DESC_CP3_Y * descenderScale;
  const bh = bodyHeight;
  const x = offsetX;
  const y = offsetY;

  if (!flipped) {
    return [
      `M ${x + width},${y}`,
      `V ${y + bh - r}`,
      `C ${x + width},${y + bh - r + r * 0.5523} ${x + width - r + r * 0.5523},${y + bh} ${x + width - r},${y + bh}`,
      `H ${x + descW}`,
      `c ${cp1x},${cp1y} ${cp2x},${cp2y} ${cp3x},${cp3y}`,
      `L ${x},${y + bh + descDrop}`,
      `V ${y}`,
      `Z`,
    ].join(" ");
  } else {
    return [
      `M ${x},${y}`,
      `V ${y + bh - r}`,
      `C ${x},${y + bh - r + r * 0.5523} ${x + r - r * 0.5523},${y + bh} ${x + r},${y + bh}`,
      `H ${x + width - descW}`,
      `c ${-cp1x},${cp1y} ${-cp2x},${cp2y} ${-cp3x},${cp3y}`,
      `L ${x + width},${y + bh + descDrop}`,
      `V ${y}`,
      `Z`,
    ].join(" ");
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 6);
}

function rectContains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w &&
    outer.y + outer.h >= inner.y + inner.h;
}

function isFeatureVisible(box, allBoxes, boxIndex) {
  const radiusRect = {
    x: box.x + box.width - RADIUS * 2,
    y: box.y + box.bodyHeight - RADIUS * 2,
    w: RADIUS * 2,
    h: RADIUS * 2,
  };
  const descRect = {
    x: box.x,
    y: box.y + box.bodyHeight - 2,
    w: DESCENDER_WIDTH,
    h: DESCENDER_DROP + 2,
  };

  let radiusHidden = false;
  let descenderHidden = false;

  for (let i = boxIndex + 1; i < allBoxes.length; i++) {
    const other = allBoxes[i];
    const otherRect = {
      x: other.x,
      y: other.y,
      w: other.width,
      h: other.bodyHeight + DESCENDER_DROP,
    };
    if (rectContains(otherRect, radiusRect)) radiusHidden = true;
    if (rectContains(otherRect, descRect)) descenderHidden = true;
  }

  return {
    radiusVisible: !radiusHidden,
    descenderVisible: !descenderHidden,
    valid: !radiusHidden || !descenderHidden,
  };
}

function positionOnEdge(target, w, h, overlapFrac, usedEdges) {
  // Pick a random edge of the target box: 0=left, 1=right, 2=top, 3=bottom
  // Avoid reusing the same edge if possible
  const edges = [0, 1, 2, 3].filter((e) => !usedEdges.has(e));
  const available = edges.length > 0 ? edges : [0, 1, 2, 3];
  const edge = available[Math.floor(Math.random() * available.length)];

  const tW = target.width;
  const tH = target.bodyHeight;
  const tX = target.x;
  const tY = target.y;

  let x, y;

  if (edge === 0) {
    // Left edge: box sits to the left, overlapping by overlapFrac of its own width
    x = tX - w + w * overlapFrac;
    // Random position along the left edge vertically
    const minY = tY - h * 0.3;
    const maxY = tY + tH - h * 0.7;
    y = minY + Math.random() * (maxY - minY);
  } else if (edge === 1) {
    // Right edge
    x = tX + tW - w * overlapFrac;
    const minY = tY - h * 0.3;
    const maxY = tY + tH - h * 0.7;
    y = minY + Math.random() * (maxY - minY);
  } else if (edge === 2) {
    // Top edge
    y = tY - h + h * overlapFrac;
    const minX = tX - w * 0.3;
    const maxX = tX + tW - w * 0.7;
    x = minX + Math.random() * (maxX - minX);
  } else {
    // Bottom edge
    y = tY + tH - h * overlapFrac;
    const minX = tX - w * 0.3;
    const maxX = tX + tW - w * 0.7;
    x = minX + Math.random() * (maxX - minX);
  }

  return { x, y, edge };
}

function generateRandomBoxes(count, overlapPct) {
  const boxes = [];
  const scales = SCALE_FACTORS[count];
  const baseWidth = 220;
  const baseHeight = baseWidth * 0.75;
  const overlapFrac = overlapPct / 100;

  for (let i = 0; i < count; i++) {
    const scale = scales[i];

    let w, h;
    if (i === 0) {
      // Primary box uses base dimensions
      w = baseWidth;
      h = baseHeight;
    } else {
      // Secondary boxes: preserve approximate area from scale factor
      // but vary the aspect ratio randomly.
      // Target area = baseWidth * baseHeight * scale^2
      const targetArea = baseWidth * baseHeight * scale * scale;
      // Random aspect ratio between 0.5 (tall) and 2.0 (wide)
      const aspectRatio = 0.5 + Math.random() * 1.5;
      // area = w * h, and w = h * aspectRatio
      // so h = sqrt(area / aspectRatio), w = h * aspectRatio
      h = Math.sqrt(targetArea / aspectRatio);
      w = h * aspectRatio;
      // Enforce minimum width: descender takes DESCENDER_WIDTH from the left,
      // radius takes RADIUS from the right, with at least 20px gap between them.
      const minWidth = DESCENDER_WIDTH + RADIUS + 20;
      if (w < minWidth) {
        w = minWidth;
        h = targetArea / w;
      }
    }

    let x, y;
    if (i === 0) {
      x = 40;
      y = 40;
    } else {
      // Pick which existing box to overlap: box 1 always overlaps box 0.
      // Box 2+ can overlap either box 0 or the previous box.
      const targetIndex = i === 1 ? 0 : (Math.random() < 0.5 ? 0 : i - 1);
      const target = boxes[targetIndex];

      // Track which edges have been used on the target to spread things out
      const usedEdges = new Set();
      for (let j = 1; j < i; j++) {
        if (boxes[j]._targetIndex === targetIndex) {
          usedEdges.add(boxes[j]._edge);
        }
      }

      const result = positionOnEdge(target, w, h, overlapFrac, usedEdges);
      x = result.x;
      y = result.y;

      // Store metadata for edge tracking (won't affect export)
      boxes.push({
        id: generateId(),
        width: Math.round(w * 100) / 100,
        bodyHeight: Math.round(h * 100) / 100,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        color: PALETTE[i % PALETTE.length],
        flipped: Math.random() < 0.5,
        geoScale: scale,
        radiusScale: scale,
        descenderScale: scale,
        _targetIndex: targetIndex,
        _edge: result.edge,
      });
      continue;
    }

    boxes.push({
      id: generateId(),
      width: Math.round(w * 100) / 100,
      bodyHeight: Math.round(h * 100) / 100,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      color: PALETTE[i % PALETTE.length],
      flipped: Math.random() < 0.5,
      geoScale: 1,
      radiusScale: 1,
      descenderScale: 1,
    });
  }
  return boxes;
}

function computeViewBox(boxes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.bodyHeight + DESCENDER_DROP * (b.descenderScale || 1));
  }
  const pad = 24;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function buildExportSvg(boxes) {
  const vb = computeViewBox(boxes);
  const paths = boxes
    .map((b) => `  <path d="${buildPath(b.width, b.bodyHeight, b.x, b.y, b.flipped, b.radiusScale || 1, b.descenderScale || 1)}" fill="${b.color}" />`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}">
${paths}
</svg>`;
}

function downloadSvg(svgString, filename) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DialogueBoxResizer() {
  const [boxCount, setBoxCount] = useState(1);
  const [overlap, setOverlap] = useState(20);
  const [boxes, setBoxes] = useState(() => [
    { id: generateId(), width: ORIGINAL_WIDTH, bodyHeight: ORIGINAL_HEIGHT, x: 40, y: 40, color: PALETTE[0], flipped: false, geoScale: 1, radiusScale: 1, descenderScale: 1 },
  ]);
  const [selectedBox, setSelectedBox] = useState(0);
  const svgRef = useRef(null);
  const draggingRef = useRef(null);

  const selected = boxes[selectedBox] || boxes[0];

  const updateBox = useCallback((index, updates) => {
    setBoxes((prev) => prev.map((b, i) => (i === index ? { ...b, ...updates } : b)));
  }, []);

  const handleBoxCountChange = useCallback((count) => {
    setBoxCount(count);
    if (count === 1) {
      setBoxes([{ id: generateId(), width: ORIGINAL_WIDTH, bodyHeight: ORIGINAL_HEIGHT, x: 40, y: 40, color: PALETTE[0], flipped: false, geoScale: 1, radiusScale: 1, descenderScale: 1 }]);
    } else {
      setBoxes(generateRandomBoxes(count, overlap));
    }
    setSelectedBox(0);
  }, [overlap]);

  const handleRandomise = useCallback(() => {
    setBoxes(generateRandomBoxes(boxCount, overlap));
  }, [boxCount, overlap]);

  const handleExport = useCallback(() => {
    downloadSvg(buildExportSvg(boxes), `dialogue-box-${boxCount}up-${Date.now()}.svg`);
  }, [boxes, boxCount]);

  // Edge/corner detection: check if mouse is near an edge or corner of the box
  const EDGE_THRESHOLD = 6; // px in SVG units for grab zone
  const CORNER_THRESHOLD = 8; // slightly larger hit zone for corners

  function detectEdge(svgPoint, box) {
    const bx = box.x;
    const by = box.y;
    const bw = box.width;
    const bh = box.bodyHeight + DESCENDER_DROP * (box.descenderScale || 1);
    const mx = svgPoint.x;
    const my = svgPoint.y;

    const inX = mx >= bx - CORNER_THRESHOLD && mx <= bx + bw + CORNER_THRESHOLD;
    const inY = my >= by - CORNER_THRESHOLD && my <= by + bh + CORNER_THRESHOLD;
    if (!inX || !inY) return "body";

    const nearLeft = Math.abs(mx - bx) < CORNER_THRESHOLD;
    const nearRight = Math.abs(mx - (bx + bw)) < CORNER_THRESHOLD;
    const nearTop = Math.abs(my - by) < CORNER_THRESHOLD;
    const nearBottom = Math.abs(my - (by + bh)) < CORNER_THRESHOLD;

    // Corners first (they overlap edge zones)
    if (nearTop && nearLeft) return "corner-tl";
    if (nearTop && nearRight) return "corner-tr";
    if (nearBottom && nearLeft) return "corner-bl";
    if (nearBottom && nearRight) return "corner-br";

    // Edges
    if (nearTop && mx > bx + CORNER_THRESHOLD && mx < bx + bw - CORNER_THRESHOLD) return "top";
    if (nearLeft && my > by + CORNER_THRESHOLD && my < by + bh - CORNER_THRESHOLD) return "left";
    if (nearRight && my > by + CORNER_THRESHOLD && my < by + bh - CORNER_THRESHOLD) return "right";

    return "body";
  }

  const handleMouseDown = useCallback((e, boxIndex) => {
    e.preventDefault();
    setSelectedBox(boxIndex);
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

    const box = boxes[boxIndex];
    const edge = detectEdge(svgP, box);

    draggingRef.current = { index: boxIndex, lastX: svgP.x, lastY: svgP.y, edge };

    const onMove = (me) => {
      if (!draggingRef.current) return;
      const mp = svg.createSVGPoint();
      mp.x = me.clientX;
      mp.y = me.clientY;
      const svgM = mp.matrixTransform(svg.getScreenCTM().inverse());
      const dx = svgM.x - draggingRef.current.lastX;
      const dy = svgM.y - draggingRef.current.lastY;
      draggingRef.current.lastX = svgM.x;
      draggingRef.current.lastY = svgM.y;

      const dragEdge = draggingRef.current.edge;

      setBoxes((prev) =>
        prev.map((b, i) => {
          if (i !== draggingRef.current.index) return b;

          if (dragEdge === "top") {
            const newHeight = Math.max(30, b.bodyHeight - dy);
            return { ...b, y: b.y + (b.bodyHeight - newHeight), bodyHeight: newHeight };
          }
          if (dragEdge === "left") {
            const minW = DESCENDER_WIDTH * (b.descenderScale || 1) + RADIUS * (b.radiusScale || 1) + 20;
            const newWidth = Math.max(minW, b.width - dx);
            return { ...b, x: b.x + (b.width - newWidth), width: newWidth };
          }
          if (dragEdge === "right") {
            const minW = DESCENDER_WIDTH * (b.descenderScale || 1) + RADIUS * (b.radiusScale || 1) + 20;
            const newWidth = Math.max(minW, b.width + dx);
            return { ...b, width: newWidth };
          }
          if (dragEdge === "corner-tl") {
            // Proportional scale from bottom-right anchor
            const scaleX = (b.width - dx) / b.width;
            const scaleY = (b.bodyHeight - dy) / b.bodyHeight;
            const s = Math.max(0.1, (scaleX + scaleY) / 2);
            const newWidth = Math.max(MIN_BOX_WIDTH, b.width * s);
            const newHeight = Math.max(30, b.bodyHeight * s);
            const newRS = Math.max(0.1, (b.radiusScale || 1) * s);
            const newDS = Math.max(0.1, (b.descenderScale || 1) * s);
            return {
              ...b,
              x: b.x + b.width - newWidth,
              y: b.y + b.bodyHeight - newHeight,
              width: newWidth,
              bodyHeight: newHeight,
              radiusScale: newRS,
              descenderScale: newDS,
            };
          }
          if (dragEdge === "corner-tr") {
            // Proportional scale from bottom-left anchor
            const scaleX = (b.width + dx) / b.width;
            const scaleY = (b.bodyHeight - dy) / b.bodyHeight;
            const s = Math.max(0.1, (scaleX + scaleY) / 2);
            const newWidth = Math.max(MIN_BOX_WIDTH, b.width * s);
            const newHeight = Math.max(30, b.bodyHeight * s);
            const newRS = Math.max(0.1, (b.radiusScale || 1) * s);
            const newDS = Math.max(0.1, (b.descenderScale || 1) * s);
            return {
              ...b,
              y: b.y + b.bodyHeight - newHeight,
              width: newWidth,
              bodyHeight: newHeight,
              radiusScale: newRS,
              descenderScale: newDS,
            };
          }
          if (dragEdge === "corner-bl") {
            // Proportional scale from top-right anchor
            const scaleX = (b.width - dx) / b.width;
            const scaleY = (b.bodyHeight + dy) / b.bodyHeight;
            const s = Math.max(0.1, (scaleX + scaleY) / 2);
            const newWidth = Math.max(MIN_BOX_WIDTH, b.width * s);
            const newHeight = Math.max(30, b.bodyHeight * s);
            const newRS = Math.max(0.1, (b.radiusScale || 1) * s);
            const newDS = Math.max(0.1, (b.descenderScale || 1) * s);
            return {
              ...b,
              x: b.x + b.width - newWidth,
              width: newWidth,
              bodyHeight: newHeight,
              radiusScale: newRS,
              descenderScale: newDS,
            };
          }
          if (dragEdge === "corner-br") {
            // Proportional scale from top-left anchor
            const scaleX = (b.width + dx) / b.width;
            const scaleY = (b.bodyHeight + dy) / b.bodyHeight;
            const s = Math.max(0.1, (scaleX + scaleY) / 2);
            const newWidth = Math.max(MIN_BOX_WIDTH, b.width * s);
            const newHeight = Math.max(30, b.bodyHeight * s);
            const newRS = Math.max(0.1, (b.radiusScale || 1) * s);
            const newDS = Math.max(0.1, (b.descenderScale || 1) * s);
            return { ...b, width: newWidth, bodyHeight: newHeight, radiusScale: newRS, descenderScale: newDS };
          }
          // Body drag: move position
          return { ...b, x: b.x + dx, y: b.y + dy };
        })
      );
    };
    const onUp = () => {
      draggingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [boxes]);

  const vb = computeViewBox(boxes);
  const validations = boxes.map((b, i) => isFeatureVisible(b, boxes, i));
  const hasWarning = validations.some((v) => !v.valid);

  const sliderLabel = {
    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "#8a8880",
  };

  return (
    <div style={{
      display: "flex", width: "100vw", height: "100vh",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      background: "#f5f4f0", color: "#161b44", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* LEFT PANEL */}
      <div style={{
        width: "30%", minWidth: 280, maxWidth: 380,
        borderRight: "1px solid #d8d6d0",
        display: "flex", flexDirection: "column",
        background: "#ffffff", flexShrink: 0, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #eeece8" }}>
          <h1 style={{
            fontSize: 15, fontWeight: 600, letterSpacing: "0.02em",
            margin: 0, textTransform: "uppercase",
          }}>Dialogue Box</h1>
          <p style={{ fontSize: 11, color: "#8a8880", margin: "5px 0 0" }}>
            Resize and compose. Drag to reposition.
          </p>
        </div>

        {/* Box count + overlap */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #eeece8" }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "#8a8880", marginBottom: 8,
          }}>Layers</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => handleBoxCountChange(n)} style={{
                flex: 1, padding: "7px 0",
                border: boxCount === n ? "2px solid #161b44" : "1px solid #d8d6d0",
                borderRadius: 5,
                background: boxCount === n ? "#161b44" : "#fff",
                color: boxCount === n ? "#fff" : "#161b44",
                fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono', monospace",
                cursor: "pointer",
              }}>{n}</button>
            ))}
          </div>

          {boxCount > 1 && (
            <>
              {/* Overlap slider */}
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7,
                }}>
                  <label style={sliderLabel}>Overlap</label>
                  <span style={{
                    fontSize: 12, fontFamily: "'DM Mono', monospace", color: "#161b44",
                  }}>{overlap}%</span>
                </div>
                <input type="range" min={10} max={50} step={1} value={overlap}
                  onChange={(e) => setOverlap(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#161b44", cursor: "pointer" }}
                />
              </div>

              <button onClick={handleRandomise} style={{
                width: "100%", marginTop: 10, padding: "7px 0",
                border: "1px solid #d8d6d0", borderRadius: 5,
                background: "#fafaf8", color: "#161b44",
                fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
              }}>Randomise</button>
            </>
          )}
        </div>

        {/* Scrollable controls */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Box tabs */}
          {boxCount > 1 && (
            <div style={{ display: "flex", borderBottom: "1px solid #eeece8" }}>
              {boxes.map((b, i) => (
                <button key={b.id} onClick={() => setSelectedBox(i)} style={{
                  flex: 1, padding: "10px 0",
                  border: "none",
                  borderBottom: selectedBox === i ? "2px solid #161b44" : "2px solid transparent",
                  background: "transparent",
                  color: selectedBox === i ? "#161b44" : "#8a8880",
                  fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: 2, background: b.color, display: "inline-block",
                  }} />
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: "18px 24px" }}>
            {/* Colour */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ ...sliderLabel, marginBottom: 7 }}>Colour</div>
              <div style={{ display: "flex", gap: 5 }}>
                {PALETTE.map((c) => (
                  <button key={c} onClick={() => updateBox(selectedBox, { color: c })} style={{
                    width: 26, height: 26, borderRadius: 4, background: c,
                    border: selected.color === c ? "2px solid #161b44" : "2px solid transparent",
                    outline: selected.color === c ? "2px solid #fff" : "none",
                    cursor: "pointer",
                  }} />
                ))}
              </div>
            </div>

            {/* Width */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <label style={sliderLabel}>Width</label>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#161b44" }}>
                  {selected.width.toFixed(0)}
                </span>
              </div>
              <input type="range" min={MIN_BOX_WIDTH} max={800} step={0.5} value={selected.width}
                onChange={(e) => updateBox(selectedBox, { width: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#161b44", cursor: "pointer" }}
              />
            </div>

            {/* Height */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <label style={sliderLabel}>Height</label>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#161b44" }}>
                  {selected.bodyHeight.toFixed(0)}
                </span>
              </div>
              <input type="range" min={30} max={800} step={0.5} value={selected.bodyHeight}
                onChange={(e) => updateBox(selectedBox, { bodyHeight: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#161b44", cursor: "pointer" }}
              />
            </div>

            {/* Flip */}
            <div style={{ marginBottom: 18 }}>
              <button
                onClick={() => updateBox(selectedBox, { flipped: !selected.flipped })}
                style={{
                  width: "100%", padding: "8px 0",
                  border: "1px solid #d8d6d0", borderRadius: 5,
                  background: "#fff",
                  color: "#161b44",
                  fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#161b44"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#161b44"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1 3h12M13 3l-3-2.5M13 3l-3 2.5M13 11H1M1 11l3-2.5M1 11l3 2.5"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Flip
              </button>
            </div>

            {/* Detail scale (radius + descender) */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <label style={sliderLabel}>Detail Scale</label>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#161b44" }}>
                  {((selected.radiusScale || 1) * 100).toFixed(0)}%
                </span>
              </div>
              <input type="range" min={0.1} max={5} step={0.05} value={selected.radiusScale || 1}
                onChange={(e) => { const s = parseFloat(e.target.value); updateBox(selectedBox, { radiusScale: s, descenderScale: s }); }}
                style={{ width: "100%", accentColor: "#161b44", cursor: "pointer" }}
              />
            </div>

            {/* Validation */}
            {validations[selectedBox] && !validations[selectedBox].valid && (
              <div style={{
                background: "#fff3f0", border: "1px solid #e8c4bc", borderRadius: 5,
                padding: "9px 11px", fontSize: 11, color: "#a04030", lineHeight: 1.5,
              }}>
                Both radius and descender on this layer are hidden. At least one must remain visible.
              </div>
            )}
          </div>
        </div>

        {/* Export */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #eeece8",
          display: "flex", gap: 8, flexShrink: 0,
        }}>
          <button onClick={handleExport} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 5,
            background: hasWarning ? "#8a8880" : "#161b44", color: "#ffffff",
            fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
          }}>Export SVG</button>
        </div>
      </div>

      {/* CANVAS */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }} />

        <div style={{
          position: "relative", width: "calc(100% - 80px)", height: "calc(100% - 80px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              filter: "drop-shadow(0 4px 20px rgba(22, 27, 68, 0.08))",
            }}
            preserveAspectRatio="xMidYMid meet"
          >
            {boxes.map((b, i) => (
              <path key={b.id}
                d={buildPath(b.width, b.bodyHeight, b.x, b.y, b.flipped, b.radiusScale || 1, b.descenderScale || 1)}
                fill={b.color}
                stroke={i === selectedBox ? "rgba(255,255,255,0.7)" : "none"}
                strokeWidth={i === selectedBox ? 1.2 : 0}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => handleMouseDown(e, i)}
              />
            ))}
            {/* Edge and corner handles for selected box */}
            {(() => {
              const b = boxes[selectedBox];
              if (!b) return null;
              const t = EDGE_THRESHOLD;
              const ct = CORNER_THRESHOLD;
              const bh = b.bodyHeight + DESCENDER_DROP * (b.descenderScale || 1);
              return (
                <g>
                  {/* Corner handles */}
                  <rect x={b.x - ct} y={b.y - ct} width={ct * 2} height={ct * 2}
                    fill="transparent" style={{ cursor: "nwse-resize" }}
                    onMouseDown={(e) => handleMouseDown(e, selectedBox)} />
                  <rect x={b.x + b.width - ct} y={b.y - ct} width={ct * 2} height={ct * 2}
                    fill="transparent" style={{ cursor: "nesw-resize" }}
                    onMouseDown={(e) => handleMouseDown(e, selectedBox)} />
                  <rect x={b.x - ct} y={b.y + bh - ct} width={ct * 2} height={ct * 2}
                    fill="transparent" style={{ cursor: "nesw-resize" }}
                    onMouseDown={(e) => handleMouseDown(e, selectedBox)} />
                  <rect x={b.x + b.width - ct} y={b.y + bh - ct} width={ct * 2} height={ct * 2}
                    fill="transparent" style={{ cursor: "nwse-resize" }}
                    onMouseDown={(e) => handleMouseDown(e, selectedBox)} />
                  {/* Edge handles */}
                  <rect x={b.x + ct} y={b.y - t} width={b.width - ct * 2} height={t * 2}
                    fill="transparent" style={{ cursor: "ns-resize" }}
                    onMouseDown={(e) => handleMouseDown(e, selectedBox)} />
                  <rect x={b.x - t} y={b.y + ct} width={t * 2} height={bh - ct * 2}
                    fill="transparent" style={{ cursor: "ew-resize" }}
                    onMouseDown={(e) => handleMouseDown(e, selectedBox)} />
                  <rect x={b.x + b.width - t} y={b.y + ct} width={t * 2} height={bh - ct * 2}
                    fill="transparent" style={{ cursor: "ew-resize" }}
                    onMouseDown={(e) => handleMouseDown(e, selectedBox)} />
                </g>
              );
            })()}
          </svg>
        </div>

        <div style={{
          position: "absolute", bottom: 14, right: 18,
          fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#b0ada6",
        }}>
          {boxCount} {boxCount === 1 ? "expression" : "expressions"}
          {boxCount > 1 && ` · ${overlap}% overlap`}
        </div>
      </div>
    </div>
  );
}
