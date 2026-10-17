#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument("input"); p.add_argument("output"); p.add_argument("--chunk-mib",type=int,default=23)
a=p.parse_args(); src=Path(a.input); out=Path(a.output); out.mkdir(parents=True,exist_ok=True)
size=a.chunk_mib*1024*1024; parts=[]; whole=hashlib.sha256()
with src.open("rb") as f:
    i=0
    while data:=f.read(size):
        name=f"model.part-{i:05d}"; (out/name).write_bytes(data)
        h=hashlib.sha256(data).hexdigest(); whole.update(data)
        parts.append({"file":name,"bytes":len(data),"sha256":h}); i+=1
(out/"manifest.json").write_text(json.dumps({"format":"nrxn-air-model-v1","chunkBytes":size,"originalBytes":src.stat().st_size,"parts":parts,"sha256":whole.hexdigest()},indent=2)+"\n")
print(f"wrote {len(parts)} chunks")
