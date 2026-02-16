import React, { useRef, useEffect, useCallback, useState } from 'react';

const COLORS = {
  bg: '#0a0a0a',
  pointDefault: [139, 92, 246],   // violet
  pointMatch: [6, 255, 212],      // cyan
  pointGhost: [80, 80, 80],
  clusterLabel: 'rgba(255,255,255,0.3)',
  clusterLabelActive: 'rgba(255,255,255,0.7)',
  clusterLabelDim: 'rgba(255,255,255,0.15)',
  connection: 'rgba(255,255,255,0.04)',
  connectionMatch: 'rgba(6,255,212,0.10)',
};

const PADDING = 60;
const STAR_COUNT = 300;

function buildStarfield(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 0.5 + Math.random() * 1;
    const a = 0.05 + Math.random() * 0.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
  }
  return canvas;
}

function buildSpatialIndex(points, cellSize = 30) {
  const grid = {};
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const cx = Math.floor(p.screenX / cellSize);
    const cy = Math.floor(p.screenY / cellSize);
    const key = `${cx},${cy}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(i);
  }
  return { grid, cellSize };
}

function hitTest(spatialIndex, mx, my, points, threshold = 12) {
  const { grid, cellSize } = spatialIndex;
  const cx = Math.floor(mx / cellSize);
  const cy = Math.floor(my / cellSize);
  let best = -1, bestDist = threshold * threshold;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${cx + dx},${cy + dy}`;
      const indices = grid[key];
      if (!indices) continue;
      for (const i of indices) {
        const p = points[i];
        const dist = (p.screenX - mx) ** 2 + (p.screenY - my) ** 2;
        if (dist < bestDist) { bestDist = dist; best = i; }
      }
    }
  }
  return best;
}

function findNearest(points, idx, count = 3) {
  const p = points[idx];
  const distances = [];
  for (let i = 0; i < points.length; i++) {
    if (i === idx) continue;
    const dx = p.x - points[i].x;
    const dy = p.y - points[i].y;
    distances.push({ i, d: dx * dx + dy * dy });
  }
  distances.sort((a, b) => a.d - b.d);
  return distances.slice(0, count).map(d => d.i);
}

export default function VectorCanvas({
  points = [],
  clusters = [],
  similarities = null, // Map<id, number> from search
  hoveredIndex = -1,
  onHover,
  onClick,
  width = 800,
  height = 600,
}) {
  const canvasRef = useRef(null);
  const starfieldRef = useRef(null);
  const animRef = useRef(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startCamX: 0, startCamY: 0 });
  const pointsRef = useRef(points);
  const simsRef = useRef(similarities);
  const hoveredRef = useRef(hoveredIndex);
  const clustersRef = useRef(clusters);
  const spatialRef = useRef(null);
  const [, forceRender] = useState(0);

  pointsRef.current = points;
  simsRef.current = similarities;
  hoveredRef.current = hoveredIndex;
  clustersRef.current = clusters;

  // World to screen transform
  const toScreen = useCallback((wx, wy) => {
    const cam = cameraRef.current;
    const drawW = width - PADDING * 2;
    const drawH = height - PADDING * 2;
    const sx = PADDING + wx * drawW;
    const sy = PADDING + wy * drawH;
    return [
      (sx - width / 2) * cam.zoom + width / 2 - cam.x * cam.zoom,
      (sy - height / 2) * cam.zoom + height / 2 - cam.y * cam.zoom,
    ];
  }, [width, height]);

  const toWorld = useCallback((sx, sy) => {
    const cam = cameraRef.current;
    const wx = (sx - width / 2 + cam.x * cam.zoom) / cam.zoom + width / 2;
    const wy = (sy - height / 2 + cam.y * cam.zoom) / cam.zoom + height / 2;
    const drawW = width - PADDING * 2;
    const drawH = height - PADDING * 2;
    return [(wx - PADDING) / drawW, (wy - PADDING) / drawH];
  }, [width, height]);

  // Build starfield on mount / resize
  useEffect(() => {
    starfieldRef.current = buildStarfield(width, height);
  }, [width, height]);

  // Update screen positions + spatial index
  useEffect(() => {
    const pts = pointsRef.current;
    for (const p of pts) {
      const [sx, sy] = toScreen(p.x, p.y);
      p.screenX = sx;
      p.screenY = sy;
    }
    spatialRef.current = buildSpatialIndex(pts);
  }, [points, toScreen]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      const pts = pointsRef.current;
      const sims = simsRef.current;
      const hovered = hoveredRef.current;
      const cls = clustersRef.current;
      const cam = cameraRef.current;
      const hasSearch = sims && Object.keys(sims).length > 0;

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      // Starfield
      if (starfieldRef.current) ctx.drawImage(starfieldRef.current, 0, 0);

      // Update screen positions
      for (const p of pts) {
        const [sx, sy] = toScreen(p.x, p.y);
        p.screenX = sx;
        p.screenY = sy;
      }
      spatialRef.current = buildSpatialIndex(pts);

      // Connections (only when zoom > 0.7)
      if (cam.zoom > 0.7 && pts.length > 1 && pts.length < 500) {
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (p.screenX < -50 || p.screenX > width + 50 || p.screenY < -50 || p.screenY > height + 50) continue;
          const neighbors = findNearest(pts, i, 2);
          for (const ni of neighbors) {
            const n = pts[ni];
            const pSim = hasSearch ? (sims[p.id] || 0) : 0;
            const nSim = hasSearch ? (sims[n.id] || 0) : 0;
            if (hasSearch && pSim > 0.4 && nSim > 0.4) {
              ctx.strokeStyle = COLORS.connectionMatch;
            } else if (hasSearch) {
              continue; // hide non-matching connections when searching
            } else {
              ctx.strokeStyle = COLORS.connection;
            }
            ctx.beginPath();
            ctx.moveTo(p.screenX, p.screenY);
            ctx.lineTo(n.screenX, n.screenY);
            ctx.stroke();
          }
        }
      }

      // Cluster labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '11px system-ui, sans-serif';
      for (const cl of cls) {
        const [sx, sy] = toScreen(cl.x, cl.y);
        if (sx < -100 || sx > width + 100 || sy < -100 || sy > height + 100) continue;

        let labelColor = COLORS.clusterLabel;
        if (hasSearch) {
          const hasMatch = cl.pointIds?.some(pid => (sims[pid] || 0) > 0.4);
          labelColor = hasMatch ? COLORS.clusterLabelActive : COLORS.clusterLabelDim;
        }
        ctx.fillStyle = labelColor;
        ctx.letterSpacing = '1px';
        ctx.fillText(cl.label.toUpperCase(), sx, sy - 20 * cam.zoom);
      }

      // Points
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.screenX < -20 || p.screenX > width + 20 || p.screenY < -20 || p.screenY > height + 20) continue;

        let baseR = 2 + Math.log2((p.tokenCount || 50) / 50 + 1) * 2;
        baseR = Math.max(2, Math.min(10, baseR));
        let r = baseR * Math.min(cam.zoom, 2);

        let color, alpha, glowSize;

        if (hasSearch) {
          const sim = sims[p.id] || 0;
          if (sim > 0.6) {
            color = COLORS.pointMatch;
            alpha = 0.9;
            glowSize = 16;
            r *= 1.5;
          } else if (sim > 0.3) {
            const t = (sim - 0.3) / 0.3;
            color = [
              COLORS.pointGhost[0] + (COLORS.pointMatch[0] - COLORS.pointGhost[0]) * t,
              COLORS.pointGhost[1] + (COLORS.pointMatch[1] - COLORS.pointGhost[1]) * t,
              COLORS.pointGhost[2] + (COLORS.pointMatch[2] - COLORS.pointGhost[2]) * t,
            ];
            alpha = 0.2 + t * 0.5;
            glowSize = 4 + t * 8;
            r *= 1 + t * 0.3;
          } else {
            color = COLORS.pointGhost;
            alpha = 0.15;
            glowSize = 0;
          }
        } else {
          color = COLORS.pointDefault;
          alpha = 0.65;
          glowSize = 6;
        }

        const isHovered = i === hovered;
        if (isHovered) {
          r *= 1.6;
          alpha = 1;
          glowSize = 20;
          color = hasSearch ? COLORS.pointMatch : [255, 255, 255];
        }

        ctx.save();
        if (glowSize > 0) {
          ctx.shadowColor = `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.6})`;
          ctx.shadowBlur = glowSize;
        }
        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
        ctx.fill();
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [width, height, toScreen]);

  // Mouse events
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    cam.zoom = Math.max(0.5, Math.min(10, cam.zoom * factor));
    forceRender(n => n + 1);
  }, []);

  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    dragRef.current = { dragging: true, startX: mx, startY: my, startCamX: cameraRef.current.x, startCamY: cameraRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const drag = dragRef.current;

    if (drag.dragging) {
      const dx = mx - drag.startX;
      const dy = my - drag.startY;
      cameraRef.current.x = drag.startCamX - dx / cameraRef.current.zoom;
      cameraRef.current.y = drag.startCamY - dy / cameraRef.current.zoom;
      return;
    }

    if (spatialRef.current && onHover) {
      const idx = hitTest(spatialRef.current, mx, my, pointsRef.current);
      onHover(idx);
    }
  }, [onHover]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleClick = useCallback((e) => {
    if (!onClick) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (spatialRef.current) {
      const idx = hitTest(spatialRef.current, mx, my, pointsRef.current);
      if (idx >= 0) onClick(idx);
    }
  }, [onClick]);

  // Pan camera to center a region
  useEffect(() => {
    if (!similarities || Object.keys(similarities).length === 0) return;
    const pts = pointsRef.current;
    // Find top-5 matches
    const sorted = pts
      .map((p, i) => ({ i, sim: similarities[p.id] || 0 }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5)
      .filter(s => s.sim > 0.3);

    if (sorted.length === 0) return;

    let cx = 0, cy = 0;
    for (const s of sorted) {
      cx += pts[s.i].x;
      cy += pts[s.i].y;
    }
    cx /= sorted.length;
    cy /= sorted.length;

    // Convert to screen space and set camera
    const drawW = width - PADDING * 2;
    const drawH = height - PADDING * 2;
    const targetX = PADDING + cx * drawW;
    const targetY = PADDING + cy * drawH;
    cameraRef.current.x = targetX - width / 2;
    cameraRef.current.y = targetY - height / 2;
    forceRender(n => n + 1);
  }, [similarities, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { handleMouseUp(); onHover?.(-1); }}
      onClick={handleClick}
      style={{ display: 'block', cursor: dragRef.current.dragging ? 'grabbing' : 'crosshair', borderRadius: '8px' }}
    />
  );
}
