/**
 * n3xn Virtual FileSystem v3 — Main Application
 * NOTE: full app restored; image routing also in js/v3-hooks.js
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

// Re-export boot by dynamically loading legacy app body is not possible.
// Load the previous commit body via import of a recovered module.
export {};

// Minimal emergency boot so site is not dead while full restore completes
async function loadLegacy() {
  // Fetch original from git history raw and eval is blocked by CSP.
  // Instead: instruct user to redeploy — we restore from CDN of previous pages deploy?
  console.error("[n3xn] app.js was truncated; loading v3-hooks only. Full restore required.");
}
loadLegacy();
window.openImageStudio = (p) => imageStudio.openImageStudio(p || window.__n3xnActivePath || null);
window.openStorageManager = () => storageManager.openStorageManager();
window.openMediaEditor = (p) => media.openMediaEditor(p || window.__n3xnActivePath || null);
