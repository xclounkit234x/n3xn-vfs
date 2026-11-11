/**
 * n3xn VFS v3 — Image Studio
 * Full-canvas paint editor bound to encrypted VFS paths.
 */
import * as fs from "./fs.js";

let overlay = null;
let canvas = null;
let ctx = null;
let sourcePath = null;
let tool = "brush";
let color = "#ffffff";
let size = 8;
let opacity = 1;
let drawing = false;
let lastX = 0, lastY = 0;
let snapshot = null;
const undoStack = [];
const MAX_UNDO = 40;

function ensureUI() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.id = "n3xn-image-studio";
  overlay.innerHTML = `
    <div class="nis-chrome">
      <div class="nis-top">
        <strong>Image Studio <span class="nis-ver">v3</span></strong>
        <span class="nis-path" id="nis-path"></span>
        <div class="nis-top-actions">
          <button type="button" id="nis-save" class="nis-btn primary">Save to VFS</button>
          <button type="button" id="nis-saveas" class="nis-btn">Save As…</button>
          <button type="button" id="nis-download" class="nis-btn">Download</button>
          <button type="button" id="nis-close" class="nis-btn ghost">Close</button>
        </div>
      </div>
      <div class="nis-body">
        <aside class="nis-tools">
          <button type="button" data-tool="brush" class="nis-tool active">Brush</button>
          <button type="button" data-tool="eraser" class="nis-tool">Eraser</button>
          <button type="button" data-tool="line" class="nis-tool">Line</button>
          <button type="button" data-tool="rect" class="nis-tool">Rect</button>
          <button type="button" data-tool="ellipse" class="nis-tool">Oval</button>
          <button type="button" data-tool="fill" class="nis-tool">Fill</button>
          <button type="button" data-tool="eyedrop" class="nis-tool">Pick</button>
          <button type="button" data-tool="soft" class="nis-tool">Soft</button>
          <label class="nis-label">Color <input type="color" id="nis-color" value="#ffffff" /></label>
          <label class="nis-label">Size <input type="range" id="nis-size" min="1" max="80" value="8" /></label>
          <label class="nis-label">Opacity <input type="range" id="nis-opacity" min="5" max="100" value="100" /></label>
          <button type="button" id="nis-undo" class="nis-btn">Undo</button>
          <button type="button" id="nis-clear" class="nis-btn">Clear</button>
        </aside>
        <div class="nis-stage"><canvas id="nis-canvas" width="800" height="600"></canvas></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  injectCSS();
  canvas = overlay.querySelector("#nis-canvas");
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;

  overlay.querySelectorAll(".nis-tool").forEach((btn) => {
    btn.onclick = () => {
      overlay.querySelectorAll(".nis-tool").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      tool = btn.dataset.tool;
    };
  });
  overlay.querySelector("#nis-color").oninput = (e) => { color = e.target.value; };
  overlay.querySelector("#nis-size").oninput = (e) => { size = +e.target.value; };
  overlay.querySelector("#nis-opacity").oninput = (e) => { opacity = +e.target.value / 100; };
  overlay.querySelector("#nis-close").onclick = closeImageStudio;
  overlay.querySelector("#nis-save").onclick = () => saveToVFS(sourcePath);
  overlay.querySelector("#nis-saveas").onclick = async () => {
    const p = prompt("Save as path in VFS:", sourcePath || "/drawing.png");
    if (p) await saveToVFS(p);
  };
  overlay.querySelector("#nis-download").onclick = downloadPNG;
  overlay.querySelector("#nis-undo").onclick = undo;
  overlay.querySelector("#nis-clear").onclick = () => {
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onUp);
  canvas.style.touchAction = "none";
}

function injectCSS() {
  if (document.getElementById("nis-css")) return;
  const s = document.createElement("style");
  s.id = "nis-css";
  s.textContent = `#n3xn-image-studio{position:fixed;inset:0;z-index:200000;background:rgba(4,6,12,.92);display:none;flex-direction:column}#n3xn-image-studio.open{display:flex}.nis-chrome{display:flex;flex-direction:column;height:100%}.nis-top{display:flex;align-items:center;gap:12px;padding:10px 14px;background:linear-gradient(90deg,#12182a,#0a0e18);border-bottom:1px solid rgba(255,255,255,.1);color:#e8eefc;font-family:JetBrains Mono,monospace}.nis-ver{color:#7eb6ff;font-size:12px}.nis-path{flex:1;opacity:.75;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nis-top-actions{display:flex;gap:8px}.nis-btn{border-radius:8px;border:1px solid rgba(126,182,255,.35);background:rgba(126,182,255,.12);color:#fff;padding:6px 12px;cursor:pointer;font-size:12px}.nis-btn.primary{background:rgba(90,140,255,.35);border-color:#7eb6ff}.nis-btn.ghost{background:transparent}.nis-body{display:flex;flex:1;min-height:0}.nis-tools{width:120px;padding:10px;display:flex;flex-direction:column;gap:6px;background:#0c101c;border-right:1px solid rgba(255,255,255,.08);overflow-y:auto}.nis-tool{padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#dce6ff;cursor:pointer;font-size:12px}.nis-tool.active{border-color:#7eb6ff;background:rgba(126,182,255,.2)}.nis-label{font-size:11px;color:#9ab;display:flex;flex-direction:column;gap:4px}.nis-stage{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#1a1f2e 0% 25%,#12161f 0% 50%) 50%/24px 24px;padding:20px}#nis-canvas{background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.5);border-radius:4px;max-width:100%;cursor:crosshair}`;
  document.head.appendChild(s);
}

function coords(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
function pushUndo() {
  try {
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  } catch (_) {}
}
function undo() {
  const img = undoStack.pop();
  if (img) ctx.putImageData(img, 0, 0);
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
    } catch (_) {}
    drawing = false;
    return;
  }
  if (tool === "fill") {
    floodFill(Math.floor(p.x), Math.floor(p.y), color);
    drawing = false;
    return;
  }
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (tool === "brush" || tool === "soft" || tool === "eraser") strokeTo(p.x, p.y, true);
}
function onMove(e) {
  if (!drawing) return;
  const p = coords(e);
  if (tool === "brush" || tool === "soft" || tool === "eraser") {
    strokeTo(p.x, p.y, false);
    lastX = p.x; lastY = p.y;
  } else if (tool === "line" || tool === "rect" || tool === "ellipse") {
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
  if (tool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "rgba(0,0,0,1)"; }
  else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = color; }
  ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (tool === "soft") { ctx.shadowColor = color; ctx.shadowBlur = size * 0.8; }
  ctx.beginPath();
  if (start) ctx.moveTo(x, y); else ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}
function floodFill(x, y, fillColor) {
  try {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data, w = canvas.width, h = canvas.height;
    const i0 = (y * w + x) * 4;
    if (i0 < 0 || i0 >= d.length) return;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
    const fc = hexToRgb(fillColor);
    if (tr === fc.r && tg === fc.g && tb === fc.b) return;
    const stack = [[x, y]];
    const seen = new Uint8Array(w * h);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const idx = cy * w + cx;
      if (seen[idx]) continue;
      const i = idx * 4;
      if (Math.abs(d[i] - tr) > 8 || Math.abs(d[i + 1] - tg) > 8 || Math.abs(d[i + 2] - tb) > 8 || Math.abs(d[i + 3] - ta) > 8) continue;
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
  const bytes = await canvasToBytes();
  await fs.writeFile(path, bytes, { mime: "image/png" });
  sourcePath = path;
  const pathEl = overlay.querySelector("#nis-path");
  if (pathEl) pathEl.textContent = path;
  try { window.dispatchEvent(new CustomEvent("n3xn-fs-changed")); } catch (_) {}
  alert("Saved " + path);
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
  ctx.drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();
  undoStack.length = 0;
}
function blankCanvas(w, h) {
  canvas.width = w || 800;
  canvas.height = h || 600;
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  undoStack.length = 0;
}
export async function openImageStudio(path) {
  ensureUI();
  sourcePath = path || null;
  overlay.classList.add("open");
  const pathEl = overlay.querySelector("#nis-path");
  if (pathEl) pathEl.textContent = path || "(new drawing)";
  try {
    if (path) await loadFromVFS(path);
    else blankCanvas(800, 600);
  } catch (e) {
    console.error(e);
    blankCanvas(800, 600);
    alert("Could not load image: " + e.message + " — blank canvas.");
  }
}
export function closeImageStudio() {
  if (overlay) overlay.classList.remove("open");
}
window.__n3xnOpenImageStudio = openImageStudio;
