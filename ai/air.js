export class AIRRuntime{
 constructor(base=new URL(".",import.meta.url)){this.base=new URL(base);this.worker=null;this.seq=0;this.pending=new Map();}
 async start(){this.worker=new Worker(new URL("./air-worker.js",this.base),{type:"module"});this.worker.onmessage=e=>{const m=e.data||{},p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.ok?p.resolve(m.result):p.reject(new Error(m.error||"AIR worker error"));};this.worker.onerror=e=>{for(const [id,p] of this.pending){p.reject(new Error(e.message||"AIR worker crashed"));this.pending.delete(id);}};await this.call("boot");return this;}
 call(op,args={}){const id=String(++this.seq);return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,op,...args});});}
 async loadModel(bytes){const copy=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);return this.call("load-model",{bytes:copy},[copy.buffer]);}
 generate(prompt,{maxChars=320,seed}={}){return this.call("generate",{prompt:String(prompt||""),maxChars,seed:seed||Date.now()>>>0});}
 status(){return this.call("status");}
 stop(){this.worker?.terminate();this.worker=null;}
}
