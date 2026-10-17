// NRXN AIR chunked-model loader. Designed for HTTPS/HTTP multi-file deployments.
// It verifies every chunk and the final SHA-256 before returning the model bytes.
export async function loadChunkedModel(manifestUrl, onProgress=()=>{}) {
  const manifest = await fetch(manifestUrl, {cache:'no-store'}).then(r=>{
    if(!r.ok) throw new Error(`Manifest HTTP ${r.status}`); return r.json();
  });
  const base = new URL('.', manifestUrl);
  const chunks = [...manifest.chunks].sort((a,b)=>a.index-b.index);
  const parts=[]; let total=0;
  for(let i=0;i<chunks.length;i++){
    const c=chunks[i];
    const r=await fetch(new URL(c.file,base));
    if(!r.ok) throw new Error(`Chunk ${c.index} HTTP ${r.status}`);
    const b=new Uint8Array(await r.arrayBuffer());
    if(b.byteLength!==c.bytes) throw new Error(`Chunk ${c.index} size mismatch`);
    const digest=await crypto.subtle.digest('SHA-256',b);
    const hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hex!==c.sha256) throw new Error(`Chunk ${c.index} SHA-256 mismatch`);
    parts.push(b); total+=b.byteLength;
    onProgress({done:i+1,total:chunks.length,bytes:total,expectedBytes:manifest.bytes});
  }
  const model=new Uint8Array(total); let p=0;
  for(const b of parts){model.set(b,p);p+=b.byteLength;}
  const digest=await crypto.subtle.digest('SHA-256',model);
  const hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hex!==manifest.sha256) throw new Error('Final model SHA-256 mismatch');
  return {manifest,bytes:model};
}
