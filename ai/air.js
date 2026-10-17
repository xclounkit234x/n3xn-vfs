export class NRXNAIR {
  constructor(root = new URL('./', document.baseURI)) {
    this.root = new URL(root);
    this.worker = null;
    this.ready = false;
  }
  async load() {
    if (this.worker) return;
    this.worker = new Worker(new URL('air-worker.js', this.root), {type:'module'});
    const worker = this.worker;
    await new Promise((resolve, reject) => {
      const on = (e) => {
        if (e.data?.type === 'ready') { this.ready = true; this.info = e.data; cleanup(); resolve(e.data); }
        if (e.data?.type === 'error') { cleanup(); reject(new Error(e.data.message)); }
      };
      const cleanup = () => worker.removeEventListener('message', on);
      worker.addEventListener('message', on);
      worker.postMessage({type:'load', wasm:new URL('air.wasm', this.root).href});
    });
    return this.info;
  }
  selfTest(text='NRXN AIR', heapBytes=4*1024*1024) {
    return new Promise((resolve,reject) => {
      const w=this.worker;
      const on=e=>{
        if(e.data?.type==='selftest'){cleanup();resolve(e.data)}
        if(e.data?.type==='error'){cleanup();reject(new Error(e.data.message))}
      };
      const cleanup=()=>w.removeEventListener('message',on);
      w.addEventListener('message',on);
      w.postMessage({type:'selftest',text,heapBytes});
    });
  }
  stop(){ if(this.worker){this.worker.postMessage({type:'stop'});this.worker.terminate();this.worker=null;this.ready=false;} }
}
