/**
 * n3xn VFS v3 — Image Studio (full paint suite)
 * Smooth canvas editor bound to encrypted VFS paths.
 */
import * as fs from "./fs.js";

let overlay = null;
let canvas = null;
let ctx = null;
let sourcePath = null;
let tool = "brush";
let color = "#e8eefc";
let size = 10;
let opacity = 1;
let drawing = false;
let lastX = 0, lastY = 0;
let snapshot = null;
let rainbowHue = 0;
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;

const TOOLS = [
  { id: "brush", label: "Brush", icon: "●" },
  { id: "soft", label: "Soft", icon: "◉" },
  { id: "ink", label: "Ink", icon: "✒" },
  { id: "calligraphy", label: "Calligraphy", icon: "✎" },
  { id: "eraser", label: "Eraser", icon: "⌫" },
  { id: "spray", label: "Spray", icon: "✧" },
  { id: "line", label: "Line", icon: "／" },
  { id: "rect", label: "Rect", icon: "▭" },
  { id: "ellipse", label: "Oval", icon: "◯" },
  { id: "fill", label: "Fill", icon: "▤" },
  { id: "eyedrop", label: "Pick", icon: "⌖" },
  { id: "smudge", label: "Smudge", icon: "〰" },
  { id: "neon", label: "Neon", icon: "✦" },
  { id: "rainbow", label: "Rainbow", icon: "🌈" },
  { id: "mirror", label: "Mirror", icon: "🪞" },
  { id: "pixelate", label: "Pixel", icon: "▦" },
];

function ensureUI() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.id = "n3xn-image-studio";
  const toolBtns = TOOLS.map(
    (t) =>
      `<button type="button" data-tool="${t.id}" class="nis-tool${t.id === "brush" ? " active" : ""}" title="${t.label}">${t.icon}<span>${t.label}</span></button>`
  ).join("");

  overlay.innerHTML = `
    <div class="nis-chrome">
      <div class="nis-top">
        <strong>Image Studio <span class="nis-ver">v3</span></strong>
        <span class="nis-path" id="nis-path"></span>
        <div class="nis-top-actions">
          <button type="button" id="nis-undo" class="nis-btn" title="Undo (Ctrl+Z)">↶ Undo</button>
          <button type="button" id="nis-redo" class="nis-btn" title="Redo (Ctrl+Y)">↷ Redo</button>
          <button type="button" id="nis-save" class="nis-btn primary">Save to VFS</button>
          <button type="button" id="nis-saveas" class="nis-btn">Save As…</button>
          <button type="button" id="nis-download" class="nis-btn">Download</button>
          <button type="button" id="nis-close" class="nis-btn ghost">Close</button>
        </div>
      </div>
      <div class="nis-body">
        <aside class="nis-tools">
          ${toolBtns}
          <label class="nis-label">Color <input type="color" id="nis-color" value="#e8eefc" /></label>
          <label class="nis-label">Size <input type="range" id="nis-size" min="1" max="120" value="10" /><span id="nis-size-val">10</span></label>
          <label class="nis-label">Opacity <input type="range" id="nis-opacity" min="5" max="100" value="100" /><span id="nis-opacity-val">100%</span></label>
          <button type="button" id="nis-clear" class="nis-btn">Clear white</button>
          <button type="button" id="nis-new" class="nis-btn">New 800×600</button>
        </aside>
        <div class="nis-stage"><canvas id="nis-canvas" width="800" height="600"></canvas></div>
      </div>
      <div class="nis-status" id="nis-status">Ready · brush</div>
    </div>`;
  document.body.appendChild(overlay);
  injectCSS();
  canvas = overlay.querySelector("#nis-canvas");
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  overlay.querySelectorAll(".nis-tool").forEach((btn) => {
    btn.onclick = () => {
      overlay.querySelectorAll(".nis-tool").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      tool = btn.dataset.tool;
      setStatus("Tool: " + tool);
    };
  });
  overlay.querySelector("#nis-color").oninput = (e) => { color = e.target.value; };
  overlay.querySelector("#nis-size").oninput = (e) => {
    size = +e.target.value;
    overlay.querySelector("#nis-size-val").textContent = String(size);
  };
  overlay.querySelector("#nis-opacity").oninput = (e) => {
    opacity = +e.target.value / 100;
    overlay.querySelector("#nis-opacity-val").textContent = e.target.value + "%";
  };
  overlay.querySelector("#nis-close").onclick = closeImageStudio;
  overlay.querySelector("#nis-save").onclick = () => saveToVFS(sourcePath);
  overlay.querySelector("#nis-saveas").onclick = async () => {
    const p = prompt("Save as path in VFS:", sourcePath || "/drawing.png");
    if (p) await saveToVFS(p);
  };
  overlay.querySelector("#nis-download").onclick = downloadPNG;
  overlay.querySelector("#nis-undo").onclick = undo;
  overlay.querySelector("#nis-redo").onclick = redo;
  overlay.querySelector("#nis-clear").onclick = () => {
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  overlay.querySelector("#nis-new").onclick = () => {
    if (!confirm("Start blank 800×600 canvas?")) return;
    blankCanvas(800, 600);
    sourcePath = null;
    overlay.querySelector("#nis-path").textContent = "(new drawing)";
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.style.touchAction = "none";
  window.addEventListener("keydown", onKey);
}

function onKey(e) {
  if (!overlay || !overlay.classList.contains("open")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveToVFS(sourcePath); }
}

function injectCSS() {
  if (document.getElementById("nis-css")) return;
  const s = document.createElement("style");
  s.id = "nis-css";
  s.textContent = `#n3xn-image-studio{position:fixed;inset:0;z-index:200000;background:rgba(4,6,12,.94);display:none;flex-direction:column;font-family:JetBrains Mono,ui-monospace,monospace}#n3xn-image-studio.open{display:flex}.nis-chrome{display:flex;flex-direction:column;height:100%}.nis-top{display:flex;align-items:center;gap:12px;padding:10px 14px;background:linear-gradient(90deg,#12182a,#0a0e18);border-bottom:1px solid rgba(126,182,255,.2);color:#e8eefc}.nis-ver{color:#7eb6ff;font-size:12px;margin-left:4px}.nis-path{flex:1;opacity:.75;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nis-top-actions{display:flex;gap:8px;flex-wrap:wrap}.nis-btn{border-radius:8px;border:1px solid rgba(126,182,255,.35);background:rgba(126,182,255,.12);color:#fff;padding:6px 12px;cursor:pointer;font-size:12px}.nis-btn.primary{background:rgba(90,140,255,.4);border-color:#7eb6ff;box-shadow:0 0 12px rgba(126,182,255,.25)}.nis-btn.ghost{background:transparent}.nis-btn:hover{filter:brightness(1.15)}.nis-body{display:flex;flex:1;min-height:0}.nis-tools{width:132px;padding:8px;display:flex;flex-direction:column;gap:4px;background:#0c101c;border-right:1px solid rgba(255,255,255,.08);overflow-y:auto}.nis-tool{display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#dce6ff;cursor:pointer;font-size:11px;text-align:left}.nis-tool span{opacity:.9}.nis-tool.active{border-color:#7eb6ff;background:rgba(126,182,255,.22);box-shadow:0 0 10px rgba(126,182,255,.2)}.nis-label{font-size:10px;color:#9ab;display:flex;flex-direction:column;gap:2px;margin-top:4px}.nis-label input[type=range]{width:100%}.nis-stage{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#1a1f2e 0% 25%,#12161f 0% 50%) 50%/20px 20px;padding:16px}#nis-canvas{background:#fff;box-shadow:0 16px 48px rgba(0,0,0,.55);border-radius:4px;max-width:100%;cursor:crosshair;image-rendering:auto}.nis-status{padding:6px 14px;font-size:11px;color:#9ab;border-top:1px solid rgba(255,255,255,.08);background:#0a0e18}`;
  document.head.appendChild(s);
}

function setStatus(msg) {
  const el = overlay && overlay.querySelector("#nis-status");
  if (el) el.textContent = msg;
}

function coords(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}

function pushUndo() {
  try {
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  } catch (_) {}
}

function undo() {
  if (!undoStack.length) return;
  try {
    redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(undoStack.pop(), 0, 0);
    setStatus("Undo");
  } catch (_) {}
}

function redo() {
  if (!redoStack.length) return;
  try {
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(redoStack.pop(), 0, 0);
    setStatus("Redo");
  } catch (_) {}
}

function onDown(e) {
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  const p = coords(e);
  lastX = p.x; lastY = p.y;
  pushUndo();
  if (tool === "eyedrop") {
    try {
      const d = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      color = "#" + [d[0], d[1], d[2]].map((x) => x.toString(16).padStart(2, "0")).join("");
      overlay.querySelector("#nis-color").value = color;
      setStatus("Picked " + color);
    } catch (_) {}
    drawing = false;
    return;
  }
  if (tool === "fill") { floodFill(Math.floor(p.x), Math.floor(p.y), color); drawing = false; return; }
  if (tool === "pixelate") { pixelateRegion(p.x, p.y, Math.max(8, size * 2)); drawing = false; return; }
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (["brush","soft","ink","calligraphy","eraser","spray","neon","rainbow","mirror","smudge"].includes(tool)) strokeTo(p.x, p.y, true);
}

function onMove(e) {
  if (!drawing) return;
  const p = coords(e);
  if (["brush","soft","ink","calligraphy","eraser","spray","neon","rainbow","mirror","smudge"].includes(tool)) {
    strokeTo(p.x, p.y, false);
    lastX = p.x; lastY = p.y;
  } else if (["line","rect","ellipse"].includes(tool)) {
    ctx.putImageData(snapshot, 0, 0);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    if (tool === "line") { ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    else if (tool === "rect") ctx.strokeRect(lastX, lastY, p.x - lastX, p.y - lastY);
    else {
      const rx = Math.abs(p.x - lastX) / 2, ry = Math.abs(p.y - lastY) / 2;
      const cx = (p.x + lastX) / 2, cy = (p.y + lastY) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function onUp(e) {
  if (!drawing) return;
  drawing = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
}

function strokeTo(x, y, start) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const dx = x - lastX, dy = y - lastY;
  const dist = Math.hypot(dx, dy) || 1;
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    if (start) ctx.moveTo(x, y); else ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y); ctx.stroke();
  } else if (tool === "smudge") {
    smudgeStroke(lastX, lastY, x, y);
  } else if (tool === "spray") {
    sprayAt(x, y);
  } else if (tool === "rainbow") {
    rainbowHue = (rainbowHue + dist * 0.8) % 360;
    ctx.strokeStyle = `hsl(${rainbowHue}, 95%, 55%)`;
    ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = size * 0.4;
    smoothLine(lastX, lastY, x, y, start);
  } else if (tool === "neon") {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = size * 1.8;
    smoothLine(lastX, lastY, x, y, start);
    ctx.shadowBlur = size * 0.5; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1, size * 0.35);
    smoothLine(lastX, lastY, x, y, start);
  } else if (tool === "soft") {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = size * 0.9;
    ctx.globalAlpha = opacity * 0.55;
    smoothLine(lastX, lastY, x, y, start);
  } else if (tool === "ink") {
    ctx.strokeStyle = color;
    const pressure = Math.min(1.4, 0.5 + dist / 12);
    ctx.lineWidth = size * pressure; ctx.lineCap = "round"; ctx.lineJoin = "round";
    smoothLine(lastX, lastY, x, y, start);
  } else if (tool === "calligraphy") {
    ctx.strokeStyle = color; ctx.lineCap = "round";
    const angle = Math.atan2(dy, dx);
    ctx.lineWidth = size * (0.35 + Math.abs(Math.sin(angle)) * 0.9);
    smoothLine(lastX, lastY, x, y, start);
  } else if (tool === "mirror") {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    smoothLine(lastX, lastY, x, y, start);
    smoothLine(canvas.width - lastX, lastY, canvas.width - x, y, start);
  } else {
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    smoothLine(lastX, lastY, x, y, start);
  }
  ctx.restore();
}

function smoothLine(x0, y0, x1, y1, start) {
  ctx.beginPath();
  if (start) { ctx.moveTo(x1, y1); ctx.lineTo(x1, y1); }
  else {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0, y0, mx, my);
    ctx.quadraticCurveTo(mx, my, x1, y1);
  }
  ctx.stroke();
}

function sprayAt(x, y) {
  ctx.fillStyle = color;
  const n = Math.max(8, size * 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * size;
    ctx.globalAlpha = opacity * (0.3 + Math.random() * 0.5);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(0.5, size * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
}

function smudgeStroke(x0, y0, x1, y1) {
  const steps = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const r = Math.max(2, Math.floor(size / 2));
    try {
      const sx = Math.max(0, Math.floor(x - r)), sy = Math.max(0, Math.floor(y - r));
      const w = Math.min(r * 2, canvas.width - sx), h = Math.min(r * 2, canvas.height - sy);
      if (w <= 0 || h <= 0) continue;
      const img = ctx.getImageData(sx, sy, w, h);
      ctx.putImageData(img, sx + 1, sy);
      ctx.globalAlpha = 0.15 * opacity;
      ctx.drawImage(canvas, sx, sy, w, h, sx - 1, sy, w, h);
      ctx.globalAlpha = opacity;
    } catch (_) {}
  }
}

function pixelateRegion(cx, cy, radius) {
  const block = Math.max(4, Math.floor(size / 3));
  const x0 = Math.max(0, Math.floor(cx - radius)), y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(canvas.width, Math.ceil(cx + radius)), y1 = Math.min(canvas.height, Math.ceil(cy + radius));
  for (let y = y0; y < y1; y += block) {
    for (let x = x0; x < x1; x += block) {
      if (Math.hypot(x + block / 2 - cx, y + block / 2 - cy) > radius) continue;
      try {
        const w = Math.min(block, canvas.width - x), h = Math.min(block, canvas.height - y);
        const d = ctx.getImageData(x, y, 1, 1).data;
        ctx.fillStyle = `rgba(${d[0]},${d[1]},${d[2]},${d[3] / 255})`;
        ctx.fillRect(x, y, w, h);
      } catch (_) {}
    }
  }
}

function floodFill(x, y, fillColor) {
  try {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data, w = canvas.width, h = canvas.height;
    const i0 = (y * w + x) * 4;
    if (i0 < 0 || i0 >= d.length) return;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    const fc = hexToRgb(fillColor);
    if (tr === fc.r && tg === fc.g && tb === fc.b && ta === 255) return;
    const stack = [[x, y]];
    const seen = new Uint8Array(w * h);
    let guard = w * h * 2;
    while (stack.length && guard-- > 0) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const idx = cy * w + cx;
      if (seen[idx]) continue;
      const i = idx * 4;
      if (Math.abs(d[i] - tr) > 12 || Math.abs(d[i + 1] - tg) > 12 || Math.abs(d[i + 2] - tb) > 12 || Math.abs(d[i + 3] - ta) > 12) continue;
      seen[idx] = 1;
      d[i] = fc.r; d[i + 1] = fc.g; d[i + 2] = fc.b; d[i + 3] = 255;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(img, 0, 0);
  } catch (e) { console.warn("fill failed", e); }
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}

async function canvasToBytes() {
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function saveToVFS(path) {
  if (!path) {
    path = prompt("Path in VFS:", "/drawing.png");
    if (!path) return;
  }
  if (!/\.(png|jpg|jpeg|webp)$/i.test(path)) path = path.replace(/\.[^.]+$/, "") + ".png";
  setStatus("Saving…");
  try {
    const bytes = await canvasToBytes();
    await fs.writeFile(path, bytes, { mime: "image/png" });
    sourcePath = path;
    const pathEl = overlay.querySelector("#nis-path");
    if (pathEl) pathEl.textContent = path;
    try { window.dispatchEvent(new CustomEvent("n3xn-fs-changed")); } catch (_) {}
    setStatus("Saved " + path);
  } catch (e) {
    setStatus("Save failed: " + (e.message || e));
    alert("Save failed: " + (e.message || e));
  }
}

function downloadPNG() {
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (sourcePath || "drawing.png").split("/").pop();
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

async function loadFromVFS(path) {
  const file = await fs.readFile(path);
  let blob;
  if (file.content instanceof Uint8Array) blob = new Blob([file.content], { type: file.mime || "image/png" });
  else if (typeof file.content === "string") {
    if (file.content.startsWith("data:")) blob = await (await fetch(file.content)).blob();
    else blob = new Blob([file.content], { type: file.mime || "image/svg+xml" });
  } else if (file.content instanceof ArrayBuffer) blob = new Blob([file.content], { type: file.mime || "image/png" });
  else throw new Error("Unsupported file content");
  const bmp = await createImageBitmap(blob);
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();
  undoStack.length = 0;
  redoStack.length = 0;
}

function blankCanvas(w, h) {
  canvas.width = w || 800;
  canvas.height = h || 600;
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  undoStack.length = 0;
  redoStack.length = 0;
}

export async function openImageStudio(path) {
  ensureUI();
  sourcePath = path || null;
  overlay.classList.add("open");
  const pathEl = overlay.querySelector("#nis-path");
  if (pathEl) pathEl.textContent = path || "(new drawing)";
  setStatus(path ? "Loading " + path : "New canvas");
  try {
    if (path) await loadFromVFS(path);
    else blankCanvas(800, 600);
    setStatus("Ready · " + (path || "untitled") + " · " + canvas.width + "×" + canvas.height);
  } catch (e) {
    console.error(e);
    blankCanvas(800, 600);
    setStatus("Load failed — blank canvas");
    alert("Could not load image: " + e.message + " — blank canvas.");
  }
}

export function closeImageStudio() {
  if (overlay) overlay.classList.remove("open");
}

window.__n3xnOpenImageStudio = openImageStudio;
