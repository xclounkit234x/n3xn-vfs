# n3xn Virtual FileSystem v3

**Encrypted, local-first virtual filesystem** with a full **Image Studio** (smooth paint suite), Monaco Editor, terminal, multi-account support, encrypted browser storage, GitHub integration, WebAssembly/Python tooling, `.n3-site` support, React/JSX execution, debugging tools, Storage Manager, and optional end-to-end encrypted real-time collaboration over WSS.

n3xn VFS is designed around a browser-local filesystem. Network functionality is optional and is only used by features that require it.

## What’s new in v3

* **Image Studio** — first-class image editor bound directly to VFS paths
  * 16 tools: brush, soft, ink, calligraphy, eraser, spray, line, rect, oval, fill, eyedropper, smudge, neon, rainbow, mirror, pixelate
  * Smooth quadratic strokes, pressure-like ink, neon glow, rainbow hue cycling, mirror symmetry
  * Nonlinear undo/redo (50 steps), opacity & size controls
  * Open any `.png` / `.jpg` / `.webp` / `.gif` / `.bmp` / `.svg` from the tree → edits save straight back into the encrypted VFS
  * Save As, Download PNG, New blank canvas
* **Storage Manager** — quota usage, file list, delete, and VFS health UI
* Tighter integration: Media button routes images to Image Studio; tree clicks open Image Studio for image files

## Features

### 🎨 Image Studio (v3)

Click any image in the file tree or use the Media button to open the studio. Drawing tools write high-quality canvas strokes; **Save to VFS** encrypts and stores the PNG at the current path (or a path you choose).

### 🔐 Local encrypted filesystem
