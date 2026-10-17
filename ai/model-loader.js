export async function fetchJSON(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(`Fetch failed (${r.status}): ${url}`);return r.json();}
export async function loadManifest(url=new URL("./model/manifest.json",import.meta.url)){return fetchJSON(url);}
export async function loadModelBytes(manifest,base=new URL("./model/",import.meta.url),onProgress=()=>{}){
  const parts=manifest.parts||[{file:"demo.nrxm",bytes:manifest.bytes,sha256:manifest.sha256}];
  const chunks=[];let total=0;
  for(let i=0;i<parts.length;i++){const part=parts[i];const r=await fetch(new URL(part.file,base));if(!r.ok)throw new Error(`Model part ${part.file} failed (${r.status})`);const b=new Uint8Array(await r.arrayBuffer());if(part.bytes&&b.byteLength!==part.bytes)throw new Error(`Size mismatch: ${part.file}`);const h=await sha256(b);if(part.sha256&&h!==part.sha256)throw new Error(`SHA-256 mismatch: ${part.file}`);chunks.push(b);total+=b.byteLength;onProgress({part:i+1,parts:parts.length,bytes:total,total:manifest.bytes||total});}
  const out=new Uint8Array(total);let off=0;for(const b of chunks){out.set(b,off);off+=b.length;}if(manifest.sha256&&await sha256(out)!==manifest.sha256)throw new Error("Model SHA-256 mismatch");return out;
}
export async function sha256(bytes){const h=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");}
