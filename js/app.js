/**
 * n3xn Virtual FileSystem v3 — Main Application
 * Full VFS + Image Studio + Storage Manager + Themes
 */
import * as db from "./db.js";
import * as fs from "./fs.js";
import * as vfsPicker from "./vfs-picker.js";
import * as term from "./terminal.js";
import * as ed from "./editor.js";
import * as runner from "./runner.js";
import * as media from "./media-editor.js";
import * as htmlVisual from "./html-visual.js";
import * as imageStudio from "./image-studio.js";
import * as storageManager from "./storage-manager.js";
import * as themes from "./themes.js";

async function loadMonacoSettings() {
  return import("./monaco-settings.js");
}

function showAuth() {
  document.getElementById("auth-screen")?.classList.remove("hidden");
  document.getElementById("app-screen")?.classList.add("hidden");
  refreshAccountList();
}

function showApp() {
  document.getElementById("auth-screen")?.classList.add("hidden");
  document.getElementById("app-screen")?.classList.remove("hidden");
  const u = document.getElementById("current-user");
  if (u) u.textContent = db.getCurrentUser?.() || "";
}

function refreshAccountList() {
  const select = document.getElementById("account-select");
  if (!select) return;
  select.innerHTML = "";
  let accounts = [];
  try { accounts = db.listAccounts() || []; } catch (e) { accounts = []; }
  if (!accounts.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No accounts — create one";
    select.appendChild(opt);
  } else {
    accounts.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.username;
      opt.textContent = a.username || "(unnamed)";
      select.appendChild(opt);
    });
  }
}

function setStatus(msg) {
  console.info("[n3xn]", msg);
}

function bindAuth() {
  const err = () => document.getElementById("auth-error");
  document.getElementById("btn-show-create")?.addEventListener("click", () => {
    document.getElementById("login-view")?.classList.add("hidden");
    document.getElementById("create-view")?.classList.remove("hidden");
    if (err()) err().textContent = "";
  });
  document.getElementById("btn-show-login")?.addEventListener("click", () => {
    document.getElementById("create-view")?.classList.add("hidden");
    document.getElementById("login-view")?.classList.remove("hidden");
    if (err()) err().textContent = "";
  });
  document.getElementById("btn-create")?.addEventListener("click", async () => {
    const user = document.getElementById("new-username")?.value.trim();
    const pass = document.getElementById("new-password")?.value;
    const pass2 = document.getElementById("new-password2")?.value;
    const e = err();
    if (!user || !pass) { if (e) e.textContent = "Username and password required"; return; }
    if (pass !== pass2) { if (e) e.textContent = "Passwords do not match"; return; }
    try {
      await db.createAccount(user, pass);
      await db.login(user, pass);
      showApp();
      await bootApp();
    } catch (ex) { if (e) e.textContent = ex.message || String(ex); }
  });
  document.getElementById("btn-login")?.addEventListener("click", async () => {
    const user = document.getElementById("account-select")?.value;
    const pass = document.getElementById("login-password")?.value;
    const e = err();
    if (!user || !pass) { if (e) e.textContent = "Select account and enter password"; return; }
    try {
      await db.login(user, pass);
      showApp();
      await bootApp();
    } catch (ex) { if (e) e.textContent = ex.message || String(ex); }
  });
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    try { db.logout?.(); } catch (_) {}
    showAuth();
  });
}

async function refreshTree() {
  const tree = document.getElementById("file-tree");
  if (!tree) return;
  tree.innerHTML = "";
  try {
    let items = [];
    if (fs.listDir) {
      const root = await fs.listDir("/");
      items = Array.isArray(root) ? root : (root?.children || []);
    } else if (fs.readdir) {
      items = await fs.readdir("/");
    }
    for (const child of items) {
      const name = typeof child === "string" ? child : (child.name || child);
      const isDir = typeof child === "object" && (child.type === "dir" || child.isDirectory);
      const full = "/" + String(name).replace(/^\//, "");
      const item = document.createElement("div");
      item.className = "tree-item";
      item.innerHTML = `<span class="icon">${isDir ? "📁" : "📄"}</span><span class="name">${name}</span>`;
      item.onclick = async () => {
        document.querySelectorAll(".tree-item").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        const pathEl = document.getElementById("current-path");
        if (pathEl) pathEl.textContent = full;
        window.__n3xnActivePath = full;
        if (!isDir) {
          const ext = (String(name).split(".").pop() || "").toLowerCase();
          if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) {
            await imageStudio.openImageStudio(full);
          } else {
            try { await ed.openFile?.(full); } catch (e) { setStatus("Open: " + e.message); }
          }
        }
      };
      tree.appendChild(item);
    }
  } catch (e) {
    tree.innerHTML = `<div class="tree-item">Error: ${e.message}</div>`;
  }
}

async function bootApp() {
  try { themes.loadSavedTheme(); } catch (_) {}
  try { await term.initTerminal?.(); } catch (_) {}
  try { await ed.initEditor?.(); } catch (_) {}
  await refreshTree();
  bindToolbar();
  setStatus("Ready — n3xn VFS v3");
}

function bindToolbar() {
  document.getElementById("btn-storage-manager")?.addEventListener("click", () => storageManager.openStorageManager());
  document.getElementById("btn-theme")?.addEventListener("click", () => themes.openThemePicker());
  document.getElementById("btn-media")?.addEventListener("click", () => {
    const p = window.__n3xnActivePath || null;
    const ext = (p || "").split(".").pop()?.toLowerCase() || "";
    if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext) || !p) imageStudio.openImageStudio(p);
    else media.openMediaEditor?.(p);
  });
  document.getElementById("btn-html-visual")?.addEventListener("click", () => {
    let p = window.__n3xnActivePath;
    if (!p || !/\.html?$/i.test(p)) p = prompt("HTML path:", p || "/index.html");
    if (p) htmlVisual.openHtmlVisual?.(p);
  });
  document.getElementById("btn-monaco-settings")?.addEventListener("click", async () => {
    try {
      const monacoSettings = await loadMonacoSettings();
      monacoSettings.defineExtraThemes?.();
      monacoSettings.openSettingsDrawer?.();
    } catch (e) { alert("Monaco settings: " + e.message); }
  });
  document.getElementById("btn-save")?.addEventListener("click", () => ed.saveFile?.());
  document.getElementById("btn-new-file")?.addEventListener("click", async () => {
    const name = prompt("New file path:", "/untitled.txt");
    if (!name) return;
    await fs.writeFile?.(name, "", { mime: "text/plain" });
    await refreshTree();
  });
  document.getElementById("btn-new-folder")?.addEventListener("click", async () => {
    const name = prompt("New folder:", "/folder");
    if (!name) return;
    await fs.mkdir?.(name);
    await refreshTree();
  });
  document.getElementById("btn-rebuild-tree")?.addEventListener("click", () => refreshTree());
}

window.openImageStudio = (p) => imageStudio.openImageStudio(p || window.__n3xnActivePath || null);
window.openStorageManager = () => storageManager.openStorageManager();
window.openMediaEditor = (p) => media.openMediaEditor?.(p || window.__n3xnActivePath || null);
window.openHtmlVisual = (p) => htmlVisual.openHtmlVisual?.(p || window.__n3xnActivePath || "/index.html");
window.__n3xnThemes = themes;

async function main() {
  bindAuth();
  try { themes.loadSavedTheme(); } catch (_) {}
  try { await db.init?.(); } catch (_) {}
  if (db.isLoggedIn?.() || db.getCurrentUser?.()) {
    showApp();
    await bootApp();
  } else {
    showAuth();
  }
}

main().catch((e) => { console.error(e); setStatus("Boot error: " + e.message); });
import "./v3-hooks.js";
