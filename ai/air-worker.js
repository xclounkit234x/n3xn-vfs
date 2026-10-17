let instance=null, memory=null;

async function boot(){
  const url=new URL("./air.wasm",import.meta.url);
  const r=await fetch(url);
  if(!r.ok) throw new Error(`WASM fetch failed: ${r.status}`);
  const bytes=await r.arrayBuffer();
  const mod=await WebAssembly.instantiate(bytes,{});
  instance=mod.instance;
  memory=instance.exports.memory;
  if(!instance.exports.heap_alloc || !memory) throw new Error("AIR WASM exports are incomplete");
  return {
    version:instance.exports.version(),
    binaryBytes:bytes.byteLength,
    memoryBytes:memory.buffer.byteLength
  };
}

function capacity(){ return memory.buffer.byteLength; }

async function selfTest(bytes){
  const requested=Math.max(16,bytes|0);
  const before=capacity();
  let ptr=instance.exports.heap_alloc(requested);

  // The first allocator version did not grow WASM memory. AIR v0.2 does.
  // Grow explicitly from the worker when the requested allocation exceeds capacity.
  if(!ptr || ptr+requested>capacity()){
    const needed=ptr+requested;
    const pages=Math.ceil((needed-capacity())/65536);
    if(pages>0 && memory.grow(pages)<0) throw new Error("WASM memory.grow failed");
    ptr=instance.exports.heap_alloc(requested);
  }
  if(!ptr) throw new Error(`AIR allocator failed: requested ${requested} bytes, capacity ${capacity()} bytes`);

  return {ok:true,pointer:ptr,requested,capacityBefore:before,capacityAfter:capacity()};
}

self.onmessage=async e=>{
  const {id,op}=e.data||{};
  try{
    let result;
    if(op==="boot") result=await boot();
    else if(op==="self-test") result=await selfTest(e.data.bytes);
    else if(op==="status") result={version:instance?.exports.version?.()??null,memoryBytes:memory?.buffer.byteLength??0};
    else throw new Error(`Unknown AIR operation: ${op}`);
    self.postMessage({id,ok:true,result});
  }catch(err){ self.postMessage({id,ok:false,error:String(err?.message||err)}); }
};
