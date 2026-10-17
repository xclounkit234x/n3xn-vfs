export class AIRRuntime {
  constructor(base = new URL(".", import.meta.url)) {
    this.base = new URL(base);
    this.worker = null;
    this.seq = 0;
    this.pending = new Map();
  }
  start() {
    this.worker = new Worker(new URL("./air-worker.js", this.base), {type:"module"});
    this.worker.onmessage = e => {
      const m=e.data||{}, p=this.pending.get(m.id);
      if(!p) return;
      this.pending.delete(m.id);
      m.ok ? p.resolve(m.result) : p.reject(new Error(m.error||"AIR worker error"));
    };
    return this.call("boot").then(()=>this);
  }
  call(op,args={}) {
    const id=String(++this.seq);
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      this.worker.postMessage({id,op,...args});
    });
  }
  selfTest(bytes=4*1024*1024){ return this.call("self-test",{bytes}); }
}
