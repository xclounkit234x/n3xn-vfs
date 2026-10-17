let wasm = null;
let HEAP = null;

function post(type, data={}) { self.postMessage({type, ...data}); }

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.type === 'load') {
      const res = await fetch(m.wasm || './air.wasm');
      if (!res.ok) throw new Error(`WASM HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, {});
      wasm = result.instance;
      HEAP = new Uint8Array(wasm.exports.memory.buffer);
      post('ready', {version: wasm.exports.air_version(), wasmBytes: bytes.byteLength, memoryBytes: HEAP.byteLength});
      return;
    }
    if (m.type === 'selftest') {
      if (!wasm) throw new Error('AIR is not loaded');
      const requested = Math.max(64 * 1024, Math.min(64 * 1024 * 1024, m.heapBytes || 1024 * 1024));
      const capacity = wasm.exports.air_heap_init(requested);
      const p = wasm.exports.air_alloc(Math.min(4096, capacity), 16);
      if (!p) throw new Error('AIR allocator failed');
      const text = new TextEncoder().encode(m.text || 'NRXN AIR');
      HEAP.set(text, p);
      const checksum = wasm.exports.air_checksum(p, text.length);
      post('selftest', {capacity, used: wasm.exports.air_heap_used(), checksum, text: m.text || 'NRXN AIR'});
      return;
    }
    if (m.type === 'stop') {
      wasm = null; HEAP = null; post('stopped');
      return;
    }
  } catch (error) {
    post('error', {message: error?.stack || String(error)});
  }
};
