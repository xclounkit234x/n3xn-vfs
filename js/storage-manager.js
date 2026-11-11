/**
 * n3xn VFS v3 — Storage Manager (Manage Storage style)
 */
import * as fs from "./fs.js";
import * as db from "./db.js";

let panel = null;

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

export async function openStorageManager() {
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "n3xn-storage-manager";
    panel.innerHTML = `
      <div class="nsm-box">
        <div class="nsm-head"><strong>Storage Manager</strong><button type="button" id="nsm-close">×</button></div>
        <div class="nsm-quota" id="nsm-quota">Measuring…</div>
        <div class="nsm-actions">
          <button type="button" id="nsm-refresh">Refresh</button>
          <button type="button" id="nsm-rebuild">Rebuild tree</button>
        </div>
        <div class="nsm-list" id="nsm-list"></div>
      </div>`;
    document.body.appendChild(panel);
    if (!document.getElementById("nsm-css")) {
      const s = document.createElement("style");
      s.id = "nsm-css";
      s.textContent = `#n3xn-storage-manager{position:fixed;inset:0;z-index:210000;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center}#n3xn-storage-manager.open{display:flex}.nsm-box{width:min(520px,94vw);max-height:80vh;overflow:auto;background:#101624;border:1px solid rgba(126,182,255,.3);border-radius:16px;padding:16px;color:#e8eefc;font-family:JetBrains Mono,monospace;box-shadow:0 20px 60px rgba(0,0,0,.5)}.nsm-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.nsm-head button{background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer}.nsm-quota{font-size:12px;opacity:.85;margin-bottom:10px;line-height:1.5}.nsm-actions{display:flex;gap:8px;margin-bottom:12px}.nsm-actions button{border-radius:8px;border:1px solid rgba(126,182,255,.35);background:rgba(126,182,255,.12);color:#fff;padding:6px 12px;cursor:pointer}.nsm-row{display:flex;justify-content:space-between;gap:8px;padding:8px;border-bottom:1px solid rgba(255,255,255,.06);font-size:12px}.nsm-row button{font-size:11px;cursor:pointer;border-radius:6px;border:1px solid rgba(255,80,100,.4);background:rgba(255,80,100,.15);color:#fff;padding:2px 8px}`;
      document.head.appendChild(s);
    }
    panel.querySelector("#nsm-close").onclick = () => panel.classList.remove("open");
    panel.querySelector("#nsm-refresh").onclick = refresh;
    panel.querySelector("#nsm-rebuild").onclick = async () => {
      await fs.rebuildTreeFromFiles();
      await fs.saveTree();
      await refresh();
      try { window.dispatchEvent(new CustomEvent("n3xn-fs-changed")); } catch (_) {}
    };
  }
  panel.classList.add("open");
  await refresh();
}

async function refresh() {
  const quotaEl = panel.querySelector("#nsm-quota");
  const listEl = panel.querySelector("#nsm-list");
  listEl.innerHTML = "Loading…";
  let estimate = null;
  try {
    if (navigator.storage && navigator.storage.estimate) estimate = await navigator.storage.estimate();
  } catch (_) {}
  let files = [];
  try { files = await db.listAllFiles(); }
  catch (e) { listEl.textContent = "Could not list files: " + e.message; return; }
  let total = 0;
  files.forEach((f) => { total += f.size || 0; });
  quotaEl.innerHTML =
    `<div>User: <b>${db.getCurrentUser() || "?"}</b></div>` +
    `<div>VFS files: <b>${files.length}</b> · ~ <b>${fmtBytes(total)}</b></div>` +
    (estimate
      ? `<div>Browser: <b>${fmtBytes(estimate.usage || 0)}</b> / <b>${fmtBytes(estimate.quota || 0)}</b></div>`
      : `<div>Quota API unavailable</div>`);
  if (!files.length) { listEl.innerHTML = "<div class='nsm-row'>No files stored.</div>"; return; }
  files.sort((a, b) => (b.size || 0) - (a.size || 0));
  listEl.innerHTML = "";
  files.slice(0, 200).forEach((f) => {
    const row = document.createElement("div");
    row.className = "nsm-row";
    const left = document.createElement("span");
    left.textContent = `${f.path || "?"} (${fmtBytes(f.size || 0)})`;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Remove";
    del.onclick = async () => {
      if (!confirm("Delete " + f.path + "?")) return;
      await fs.removeRecursive(f.path);
      await refresh();
      try { window.dispatchEvent(new CustomEvent("n3xn-fs-changed")); } catch (_) {}
    };
    row.appendChild(left);
    row.appendChild(del);
    listEl.appendChild(row);
  });
}
