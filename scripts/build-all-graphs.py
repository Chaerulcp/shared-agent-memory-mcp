"""Build graphify untuk semua project di perangkat. AST-only (tanpa LLM, tanpa API cost)."""
import json, os, subprocess, sys, time

HERMES_WORKSPACE = os.environ.get("HERMES_WORKSPACE", os.getcwd())
PROJECTS = json.load(open(sys.argv[1], encoding="utf-8"))
OUT = os.path.join(HERMES_WORKSPACE, "graphify-results.json")

results = []
ok = fail = skip = 0

for i, p in enumerate(PROJECTS, 1):
    path = p["path"]
    name = os.path.basename(path)
    t0 = time.time()
    entry = {"path": path, "name": name, "stack": p.get("stack", "")}
    try:
        r = subprocess.run(
            ["graphify", "update", ".", "--no-cluster"],
            cwd=path, capture_output=True, text=True,
            timeout=900, encoding="utf-8", errors="replace",
        )
        out = (r.stdout or "") + (r.stderr or "")
        entry["elapsed_s"] = round(time.time() - t0, 1)
        # parse "Rebuilt: X nodes, Y edges, Z communities"
        import re
        m = re.search(r"Rebuilt:\s*([\d,]+)\s*nodes?,\s*([\d,]+)\s*edges?", out)
        if m:
            entry["nodes"] = int(m.group(1).replace(",", ""))
            entry["edges"] = int(m.group(2).replace(",", ""))
            ok += 1
            status = "OK"
        elif r.returncode == 0:
            ok += 1
            entry["nodes"] = entry.get("nodes", 0)
            status = "OK(no-count)"
            entry["tail"] = out[-300:]
        else:
            fail += 1
            status = "FAIL"
            entry["error"] = out[-500:]
    except subprocess.TimeoutExpired:
        fail += 1
        status = "TIMEOUT"
        entry["error"] = "timeout 900s"
        entry["elapsed_s"] = 900
    except Exception as e:
        fail += 1
        status = "ERROR"
        entry["error"] = str(e)
    results.append(entry)
    print(f"[{i:3d}/{len(PROJECTS)}] {status:12s} {name} ({entry.get('nodes','-')}n/{entry.get('edges','-')}e) {entry.get('elapsed_s','?')}s", flush=True)
    # simpan progresif
    json.dump({"ok": ok, "fail": fail, "total": len(PROJECTS), "results": results},
              open(OUT, "w", encoding="utf-8"), indent=1)

print(f"\n=== SELESAI: {ok} ok, {fail} fail dari {len(PROJECTS)} ===")
