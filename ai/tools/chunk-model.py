#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser(description="Split an AIR model into GitHub-friendly chunks (<24 MiB).")
p.add_argument("input");p.add_argument("output");p.add_argument("--chunk-mib",type=int,default=23)
a=p.parse_args();src=Path(a.input);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
chunk_bytes=a.chunk_mib*1024*1024
if chunk_bytes>=24*1024*1024: raise SystemExit("chunk size must be below 24 MiB")
parts=[];whole=hashlib.sha256();total=0
with src.open("rb") as f:
 i=0
 while True:
  data=f.read(chunk_bytes)
  if not data: break
  name=f"model.part-{i:05d}";(out/name).write_bytes(data);h=hashlib.sha256(data).hexdigest();whole.update(data);total+=len(data);parts.append({"file":name,"bytes":len(data),"sha256":h});i+=1
manifest={"format":"nrxn-air-model-v1","source":src.name,"chunkBytes":chunk_bytes,"originalBytes":total,"parts":parts,"sha256":whole.hexdigest()}
(out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print(f"wrote {len(parts)} chunks ({total} bytes), SHA-256 {manifest['sha256']}")
