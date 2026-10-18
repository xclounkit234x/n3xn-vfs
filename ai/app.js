
/**
 * NRXN AIR · v0.3+ Glass Chat App
 * Multi-account · multi-chat · shared chats · AI memories · themes · ChatGPT-class UI
 */
import { AIRRuntime } from "./air.js";
import { loadManifest, loadModelBytes } from "./model-loader.js";

const STORAGE_KEY = "nrxn-air-v03-state";
const THEMES = {
  seraph: { name: "Seraph Glass", accent: "#a78bfa", accent2: "#c4b5fd", glow: "rgba(167,139,250,0.35)" },
  blood: { name: "GX Blood", accent: "#ff2222", accent2: "#ff6666", glow: "rgba(200,0,0,0.28)" },
  midnight: { name: "Midnight", accent: "#6366f1", accent2: "#818cf8", glow: "rgba(99,102,241,0.3)" },
  emerald: { name: "Emerald", accent: "#34d399", accent2: "#6ee7b7", glow: "rgba(52,211,153,0.28)" },
  amber: { name: "Amber", accent: "#f59e0b", accent2: "#fbbf24", glow: "rgba(245,158,11,0.28)" },
  matrix: { name: "Matrix", accent: "#00ff66", accent2: "#66ff99", glow: "rgba(0,255,102,0.22)" },
  rose: { name: "Rose", accent: "#f472b6", accent2: "#f9a8d4", glow: "rgba(244,114,182,0.3)" },
  cyan: { name: "Cyan", accent: "#22d3ee", accent2: "#67e8f9", glow: "rgba(34,211,238,0.28)" },
};

const DEFAULT_SYSTEM = `You are AIR, a local WebAssembly AI running entirely on-device. Be concise, helpful, and honest. You have no cloud access.`;

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Storage full or blocked", e);
  }
}

function defaultState() {
  const accountId = uid("acc");
  const chatId = uid("chat");
  return {
    version: 1,
    activeAccountId: accountId,
    activeChatId: chatId,
    accounts: [
      {
        id: accountId,
        name: "Local User",
        color: "#a78bfa",
        createdAt: Date.now(),
        chatIds: [chatId],
        sharedChatIds: [],
        memories: [
          { id: uid("mem"), title: "About me", content: "I prefer short, clear answers.", createdAt: Date.now() },
        ],
      },
    ],
    chats: {
      [chatId]: {
        id: chatId,
        title: "Welcome chat",
        ownerId: accountId,
        shared: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          {
            id: uid("msg"),
            role: "assistant",
            content: "Hello! AIR is running fully local in WebAssembly. Create accounts, switch chats, add memories, and customize the glass theme. This tiny demo model is a runtime proof — larger models use the same loader.",
            ts: Date.now(),
          },
        ],
        systemPrompt: DEFAULT_SYSTEM,
      },
    },
    settings: {
      theme: "seraph",
      customAccent: "",
      density: "comfortable",
      showParticles: true,
      maxChars: 420,
      injectMemories: true,
      sidebarCollapsed: false,
      fontScale: 1,
    },
  };
}

let state = loadState() || defaultState();
let air = null;
let generating = false;
let abortGen = false;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

function account() {
  return state.accounts.find((a) => a.id === state.activeAccountId) || state.accounts[0];
}

function chat() {
  return state.chats[state.activeChatId];
}

function applyTheme() {
  const t = THEMES[state.settings.theme] || THEMES.seraph;
  const accent = state.settings.customAccent || t.accent;
  const root = document.documentElement;
  root.dataset.theme = state.settings.theme;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-2", t.accent2);
  root.style.setProperty("--accent-glow", t.glow);
  root.style.setProperty("--font-scale", state.settings.fontScale || 1);
  document.body.classList.toggle("no-particles", !state.settings.showParticles);
  document.body.classList.toggle("density-compact", state.settings.density === "compact");
  document.body.classList.toggle("sidebar-collapsed", state.settings.sidebarCollapsed);
  if (window.NRXNParticles) window.NRXNParticles.setAccent(accent);
}

function persist() {
  saveState(state);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function titleFromMessages(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  return first.content.slice(0, 42).trim() + (first.content.length > 42 ? "…" : "");
}

/* ─── Render ─── */

function renderAccounts() {
  const acc = account();
  const list = $("#accountList");
  if (!list) return;
  list.innerHTML = state.accounts
    .map(
      (a) => `
    <button type="button" class="account-pill ${a.id === acc.id ? "active" : ""}" data-acc="${a.id}" title="${escapeHtml(a.name)}">
      <span class="avatar" style="background:${a.color}">${escapeHtml(a.name.slice(0, 1).toUpperCase())}</span>
      <span class="name">${escapeHtml(a.name)}</span>
    </button>`
    )
    .join("");
  $("#currentAccountName").textContent = acc.name;
  $("#currentAccountAvatar").style.background = acc.color;
  $("#currentAccountAvatar").textContent = acc.name.slice(0, 1).toUpperCase();
}

function renderChatList() {
  const acc = account();
  const list = $("#chatList");
  if (!list) return;
  const owned = (acc.chatIds || []).map((id) => state.chats[id]).filter(Boolean);
  const shared = (acc.sharedChatIds || []).map((id) => state.chats[id]).filter(Boolean);
  const allShared = Object.values(state.chats).filter((c) => c.shared && !acc.chatIds.includes(c.id) && !acc.sharedChatIds.includes(c.id));

  const item = (c, badge = "") => `
    <button type="button" class="chat-item ${c.id === state.activeChatId ? "active" : ""}" data-chat="${c.id}">
      <span class="chat-title">${escapeHtml(c.title || "Untitled")}</span>
      ${badge ? `<span class="badge">${badge}</span>` : ""}
      <span class="chat-meta">${formatTime(c.updatedAt || c.createdAt)}</span>
    </button>`;

  list.innerHTML = `
    <div class="list-section-label">Your chats</div>
    ${owned.length ? owned.map((c) => item(c)).join("") : `<div class="empty-hint">No chats yet</div>`}
    <div class="list-section-label">Shared on this device</div>
    ${[...shared, ...allShared].length ? [...shared, ...allShared].map((c) => item(c, "shared")).join("") : `<div class="empty-hint">No shared chats</div>`}
  `;
}

function renderMessages() {
  const c = chat();
  const box = $("#messages");
  if (!box || !c) return;
  box.innerHTML = c.messages
    .map((m) => {
      const roleClass = m.role === "user" ? "user" : m.role === "system" ? "system" : "assistant";
      return `
      <article class="msg ${roleClass}" data-id="${m.id}">
        <div class="msg-avatar">${m.role === "user" ? "U" : m.role === "system" ? "S" : "AI"}</div>
        <div class="msg-body">
          <div class="msg-role">${m.role === "assistant" ? "AIR" : m.role}</div>
          <div class="msg-content">${escapeHtml(m.content)}</div>
          <div class="msg-actions">
            <button type="button" class="icon-btn copy-btn" data-copy="${m.id}" title="Copy">⧉</button>
            ${m.role === "assistant" ? `<button type="button" class="icon-btn regen-btn" data-regen="${m.id}" title="Regenerate">↻</button>` : ""}
          </div>
        </div>
      </article>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
  $("#chatTitle").textContent = c.title || "Chat";
  $("#chatSubtitle").textContent = c.shared ? "Shared chat · visible to all accounts on this device" : "Private to current account";
}

function renderMemories() {
  const acc = account();
  const list = $("#memoryList");
  if (!list) return;
  const mems = acc.memories || [];
  list.innerHTML = mems.length
    ? mems
        .map(
          (m) => `
      <div class="memory-card" data-mem="${m.id}">
        <div class="memory-title">${escapeHtml(m.title)}</div>
        <div class="memory-body">${escapeHtml(m.content)}</div>
        <div class="memory-actions">
          <button type="button" class="ghost-btn edit-mem" data-mem="${m.id}">Edit</button>
          <button type="button" class="ghost-btn danger del-mem" data-mem="${m.id}">Delete</button>
        </div>
      </div>`
        )
        .join("")
    : `<div class="empty-hint">No memories yet. AIR can use these as persistent context.</div>`;
}

function renderSettings() {
  const s = state.settings;
  $("#themeSelect").value = s.theme;
  $("#customAccent").value = s.customAccent || "";
  $("#densitySelect").value = s.density;
  $("#particlesToggle").checked = s.showParticles;
  $("#memoriesToggle").checked = s.injectMemories;
  $("#maxChars").value = s.maxChars;
  $("#fontScale").value = s.fontScale;
  $("#systemPrompt").value = chat()?.systemPrompt || DEFAULT_SYSTEM;
  const themeRow = $("#themeSwatches");
  if (themeRow) {
    themeRow.innerHTML = Object.entries(THEMES)
      .map(
        ([id, t]) =>
          `<button type="button" class="theme-swatch ${s.theme === id ? "selected" : ""}" data-theme="${id}" style="background:${t.accent}" title="${t.name}"></button>`
      )
      .join("");
  }
}

function renderRuntime(info) {
  const el = $("#runtimeStatus");
  if (!el) return;
  if (!info) {
    el.innerHTML = `<span class="pulse-dot"></span> Booting runtime…`;
    return;
  }
  el.innerHTML = `<span class="pulse-dot ok"></span> WASM v${info.version ?? "?"} · ${(info.memoryBytes || 0).toLocaleString()} B · local CPU`;
}

function renderModel(text) {
  const el = $("#modelStatus");
  if (el) el.textContent = text;
}

function renderAll() {
  applyTheme();
  renderAccounts();
  renderChatList();
  renderMessages();
  renderMemories();
  renderSettings();
  persist();
}

/* ─── Actions ─── */

function switchAccount(id) {
  const a = state.accounts.find((x) => x.id === id);
  if (!a) return;
  state.activeAccountId = id;
  if (a.chatIds?.length) state.activeChatId = a.chatIds[0];
  else {
    const cid = createChat(false);
    a.chatIds = [cid];
  }
  renderAll();
}

function createAccount() {
  const name = prompt("Account name?", "User " + (state.accounts.length + 1));
  if (!name?.trim()) return;
  const colors = ["#a78bfa", "#f472b6", "#34d399", "#22d3ee", "#f59e0b", "#ff2222", "#6366f1"];
  const id = uid("acc");
  const chatId = uid("chat");
  state.accounts.push({
    id,
    name: name.trim().slice(0, 32),
    color: colors[state.accounts.length % colors.length],
    createdAt: Date.now(),
    chatIds: [chatId],
    sharedChatIds: [],
    memories: [],
  });
  state.chats[chatId] = {
    id: chatId,
    title: "New chat",
    ownerId: id,
    shared: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    systemPrompt: DEFAULT_SYSTEM,
  };
  state.activeAccountId = id;
  state.activeChatId = chatId;
  renderAll();
}

function createChat(shared = false) {
  const acc = account();
  const id = uid("chat");
  state.chats[id] = {
    id,
    title: "New chat",
    ownerId: acc.id,
    shared: !!shared,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    systemPrompt: DEFAULT_SYSTEM,
  };
  if (shared) {
    if (!acc.sharedChatIds.includes(id)) acc.sharedChatIds.push(id);
  } else {
    if (!acc.chatIds.includes(id)) acc.chatIds.push(id);
  }
  state.activeChatId = id;
  renderAll();
  return id;
}

function openChat(id) {
  if (!state.chats[id]) return;
  state.activeChatId = id;
  const acc = account();
  const c = state.chats[id];
  if (c.shared && !acc.chatIds.includes(id) && !acc.sharedChatIds.includes(id)) {
    acc.sharedChatIds.push(id);
  }
  renderAll();
}

function deleteChat(id) {
  if (!state.chats[id]) return;
  if (!confirm("Delete this chat?")) return;
  delete state.chats[id];
  for (const a of state.accounts) {
    a.chatIds = (a.chatIds || []).filter((x) => x !== id);
    a.sharedChatIds = (a.sharedChatIds || []).filter((x) => x !== id);
  }
  if (state.activeChatId === id) {
    const acc = account();
    state.activeChatId = acc.chatIds[0] || acc.sharedChatIds[0] || createChat(false);
  }
  renderAll();
}

function toggleShareChat() {
  const c = chat();
  if (!c) return;
  c.shared = !c.shared;
  const acc = account();
  if (c.shared) {
    acc.chatIds = acc.chatIds.filter((x) => x !== c.id);
    if (!acc.sharedChatIds.includes(c.id)) acc.sharedChatIds.push(c.id);
  } else {
    acc.sharedChatIds = acc.sharedChatIds.filter((x) => x !== c.id);
    if (!acc.chatIds.includes(c.id)) acc.chatIds.push(c.id);
  }
  c.updatedAt = Date.now();
  renderAll();
}

function addMemory(title, content) {
  const acc = account();
  acc.memories = acc.memories || [];
  acc.memories.push({ id: uid("mem"), title: title || "Memory", content: content || "", createdAt: Date.now() });
  renderMemories();
  persist();
}

function editMemory(id) {
  const acc = account();
  const m = (acc.memories || []).find((x) => x.id === id);
  if (!m) return;
  const title = prompt("Title", m.title);
  if (title === null) return;
  const content = prompt("Content", m.content);
  if (content === null) return;
  m.title = title.slice(0, 64);
  m.content = content.slice(0, 2000);
  renderMemories();
  persist();
}

function deleteMemory(id) {
  const acc = account();
  acc.memories = (acc.memories || []).filter((x) => x.id !== id);
  renderMemories();
  persist();
}

function buildPrompt(userText) {
  const c = chat();
  const acc = account();
  const parts = [];
  if (c.systemPrompt) parts.push(`[System]\n${c.systemPrompt}`);
  if (state.settings.injectMemories && acc.memories?.length) {
    const memBlock = acc.memories.map((m) => `- ${m.title}: ${m.content}`).join("\n");
    parts.push(`[Memories]\n${memBlock}`);
  }
  // last few turns for context (tiny model)
  const recent = (c.messages || []).slice(-6);
  for (const m of recent) {
    parts.push(`[${m.role}]\n${m.content}`);
  }
  parts.push(`[user]\n${userText}`);
  return parts.join("\n\n");
}

async function sendMessage() {
  const input = $("#composerInput");
  const text = input.value.trim();
  if (!text || !air || generating) return;
  const c = chat();
  if (!c) return;

  input.value = "";
  autoResize(input);

  c.messages.push({ id: uid("msg"), role: "user", content: text, ts: Date.now() });
  if (c.messages.filter((m) => m.role === "user").length === 1) {
    c.title = titleFromMessages(c.messages);
  }
  c.updatedAt = Date.now();
  renderMessages();
  renderChatList();
  persist();

  generating = true;
  abortGen = false;
  $("#sendBtn").disabled = true;
  $("#stopBtn").hidden = false;
  $("#typing").hidden = false;

  try {
    const prompt = buildPrompt(text);
    const r = await air.generate(prompt, { maxChars: state.settings.maxChars || 420 });
    if (abortGen) {
      c.messages.push({ id: uid("msg"), role: "assistant", content: "(generation stopped)", ts: Date.now() });
    } else {
      c.messages.push({ id: uid("msg"), role: "assistant", content: r.text || "(empty)", ts: Date.now() });
    }
    c.updatedAt = Date.now();
  } catch (e) {
    c.messages.push({ id: uid("msg"), role: "assistant", content: "ERROR: " + (e.message || e), ts: Date.now() });
  }

  generating = false;
  $("#sendBtn").disabled = false;
  $("#stopBtn").hidden = true;
  $("#typing").hidden = true;
  renderMessages();
  renderChatList();
  persist();
}

async function regenerate(msgId) {
  const c = chat();
  if (!c || !air || generating) return;
  const idx = c.messages.findIndex((m) => m.id === msgId);
  if (idx < 0 || c.messages[idx].role !== "assistant") return;
  // find preceding user message
  let userText = "";
  for (let i = idx - 1; i >= 0; i--) {
    if (c.messages[i].role === "user") {
      userText = c.messages[i].content;
      break;
    }
  }
  if (!userText) return;
  c.messages.splice(idx, 1);
  renderMessages();
  // temporarily inject as if user just sent
  const input = $("#composerInput");
  input.value = userText;
  await sendMessage();
}

function copyMessage(msgId) {
  const c = chat();
  const m = c?.messages.find((x) => x.id === msgId);
  if (!m) return;
  navigator.clipboard?.writeText(m.content).then(() => {
    toast("Copied");
  });
}

function toast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nrxn-air-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.accounts || !data.chats) throw new Error("Invalid export");
      if (!confirm("Replace all local data with this export?")) return;
      state = data;
      renderAll();
      toast("Imported");
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm("Wipe all accounts, chats, and memories on this device?")) return;
  state = defaultState();
  renderAll();
  toast("Reset");
}

/* ─── Boot runtime ─── */

async function bootRuntime() {
  renderRuntime(null);
  renderModel("Waiting for model…");
  try {
    air = await new AIRRuntime().start();
    const s = await air.status();
    renderRuntime(s);
    const manifest = await loadManifest();
    renderModel(`${manifest.name} · loading…`);
    const bytes = await loadModelBytes(manifest, new URL("./model/", import.meta.url), (p) => {
      renderModel(`${manifest.name} · ${p.bytes.toLocaleString()}/${p.total.toLocaleString()} B`);
    });
    const m = await air.loadModel(bytes);
    renderModel(`${manifest.name} · ready · ${m.bytes.toLocaleString()} B`);
    toast("AIR ready · fully local");
  } catch (e) {
    renderRuntime({ version: "err" });
    renderModel("ERROR: " + e.message);
    console.error(e);
  }
}

/* ─── Events ─── */

function bindEvents() {
  $("#btnNewChat")?.addEventListener("click", () => createChat(false));
  $("#btnNewShared")?.addEventListener("click", () => createChat(true));
  $("#btnNewAccount")?.addEventListener("click", createAccount);
  $("#btnToggleSidebar")?.addEventListener("click", () => {
    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
    applyTheme();
    persist();
  });
  $("#btnShareChat")?.addEventListener("click", toggleShareChat);
  $("#btnDeleteChat")?.addEventListener("click", () => deleteChat(state.activeChatId));
  $("#sendBtn")?.addEventListener("click", sendMessage);
  $("#stopBtn")?.addEventListener("click", () => {
    abortGen = true;
  });
  $("#composerInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  $("#composerInput")?.addEventListener("input", (e) => autoResize(e.target));

  $("#accountList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-acc]");
    if (btn) switchAccount(btn.dataset.acc);
  });
  $("#chatList")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-chat]");
    if (btn) openChat(btn.dataset.chat);
  });
  $("#messages")?.addEventListener("click", (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) copyMessage(copy.dataset.copy);
    const regen = e.target.closest("[data-regen]");
    if (regen) regenerate(regen.dataset.regen);
  });
  $("#memoryList")?.addEventListener("click", (e) => {
    const edit = e.target.closest(".edit-mem");
    if (edit) editMemory(edit.dataset.mem);
    const del = e.target.closest(".del-mem");
    if (del) deleteMemory(del.dataset.mem);
  });
  $("#btnAddMemory")?.addEventListener("click", () => {
    const title = prompt("Memory title", "Note");
    if (!title) return;
    const content = prompt("What should AIR remember?");
    if (content == null) return;
    addMemory(title, content);
  });

  // Settings panel
  function openSettings(open) {
    $("#settingsPanel")?.classList.toggle("open", open);
    $("#settingsBackdrop")?.classList.toggle("open", open);
    if (open) renderSettings();
  }
  $("#btnSettings")?.addEventListener("click", () => openSettings(true));
  $("#btnCloseSettings")?.addEventListener("click", () => openSettings(false));
  $("#settingsBackdrop")?.addEventListener("click", () => openSettings(false));

  $("#themeSelect")?.addEventListener("change", (e) => {
    state.settings.theme = e.target.value;
    state.settings.customAccent = "";
    applyTheme();
    persist();
    renderSettings();
  });
  $("#themeSwatches")?.addEventListener("click", (e) => {
    const sw = e.target.closest("[data-theme]");
    if (!sw) return;
    state.settings.theme = sw.dataset.theme;
    state.settings.customAccent = "";
    applyTheme();
    persist();
    renderSettings();
  });
  $("#customAccent")?.addEventListener("change", (e) => {
    state.settings.customAccent = e.target.value;
    applyTheme();
    persist();
  });
  $("#densitySelect")?.addEventListener("change", (e) => {
    state.settings.density = e.target.value;
    applyTheme();
    persist();
  });
  $("#particlesToggle")?.addEventListener("change", (e) => {
    state.settings.showParticles = e.target.checked;
    applyTheme();
    persist();
  });
  $("#memoriesToggle")?.addEventListener("change", (e) => {
    state.settings.injectMemories = e.target.checked;
    persist();
  });
  $("#maxChars")?.addEventListener("change", (e) => {
    state.settings.maxChars = Math.max(64, Math.min(2000, +e.target.value || 420));
    persist();
  });
  $("#fontScale")?.addEventListener("input", (e) => {
    state.settings.fontScale = +e.target.value || 1;
    applyTheme();
    persist();
  });
  $("#systemPrompt")?.addEventListener("change", (e) => {
    const c = chat();
    if (c) {
      c.systemPrompt = e.target.value;
      persist();
    }
  });
  $("#btnExport")?.addEventListener("click", exportData);
  $("#btnImport")?.addEventListener("click", () => $("#importFile").click());
  $("#importFile")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importData(f);
    e.target.value = "";
  });
  $("#btnReset")?.addEventListener("click", clearAllData);

  // Tabs in sidebar
  $$(".side-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".side-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const panel = tab.dataset.panel;
      $$(".side-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === panel));
    });
  });
}

/* ─── Init ─── */

function init() {
  bindEvents();
  renderAll();
  bootRuntime();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
