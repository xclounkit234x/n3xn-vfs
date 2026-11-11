/**
 * n3xn VFS v3 hooks — image open routing + storage without rewriting all of app.js
 */
import * as imageStudio from "./image-studio.js";
import * as storageManager from "./storage-manager.js";

const IMG = new Set(["png","jpg","jpeg","webp","gif","bmp","svg"]);

function extOf(path) {
  return (String(path || "").split(".").pop() || "").toLowerCase();
}

// Capture phase: when a tree file is activated, open Image Studio for images
document.addEventListener(
  "click",
  (e) => {
    const item = e.target && e.target.closest && e.target.closest(".tree-item");
    if (!item) return;
    // path updates in same click handler in app — wait a tick
    setTimeout(() => {
      const path = document.getElementById("current-path")?.textContent || "";
      if (!path || path.endsWith("/") || IMG.has(extOf(path)) === false) return;
      // If Monaco already opened text, still open studio for images
      if (IMG.has(extOf(path))) {
        imageStudio.openImageStudio(path).catch((err) => console.warn(err));
      }
    }, 0);
  },
  true
);

window.openImageStudio = (p) => imageStudio.openImageStudio(p || window.__n3xnActivePath || null);
window.openStorageManager = () => storageManager.openStorageManager();

// Storage button if present later
function ensureStorageBtn() {
  if (document.getElementById("btn-storage-manager")) return;
  const area = document.querySelector(".user-area");
  if (!area) return;
  const b = document.createElement("button");
  b.id = "btn-storage-manager";
  b.className = "btn small ghost";
  b.title = "Storage Manager";
  b.textContent = "Storage";
  b.onclick = () => storageManager.openStorageManager();
  area.insertBefore(b, area.firstChild);
}
setInterval(ensureStorageBtn, 1500);
console.info("[n3xn] v3-hooks ready");
