export async function loadChunkManifest(url){const r=await fetch(url);if(!r.ok)throw new Error(`Manifest fetch failed: ${r.status}`);return r.json();}
