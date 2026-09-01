"""Rerun graphify untuk project yang belum punya graphify-out/graph.json."""
import json, os, subprocess, sys, time, re

PROJECTS = json.load(open(sys.argv[1], encoding="utf-8"))
RESULTS = sys.argv[2]

todo = []
for p in PROJECTS:
    g = os.path.join(p["path"], "graphify-out", "graph.json")
    if not os.path.exists(g) or os.path.getsize(g) < 100:
        todo.append(p)

print(f"Perlu rebuild: {len(todo)} project", flush=True)
results = []
ok = fail = 0
for i, p in enumerate(todo, 1):
    path, name = p["path"], os.path.basename(p["path"])
    t0 = time.time()
    entry = {"path": path, "name": name, "stack": p.get("stack", "")}
    try:
        r = subprocess.run(["graphify", "update", ".", "--no-cluster"],
                           cwd=path, capture_output=True, text=True, timeout=900,
                           encoding="utf-8", errors="replace")
        out = (r.stdout or "") + (r.stderr or "")
        entry["elapsed_s"] = round(time.time() - t0, 1)
        m = re.search(r"Rebuilt:\s*([\d,]+)\s*nodes?,\s*([\d,]+)\s*edges?", out)
        if m:
            entry["nodes"] = int(m.group(1).replace(",", ""))
            entry["edges"] = int(m.group(2).replace(",", ""))
            ok += 1; status = "OK"
        elif r.returncode == 0:
            ok += 1; status = "OK(nocnt)"; entry["tail"] = out[-200:]
        else:
            fail += 1; status = "FAIL"; entry["error"] = out[-300:]
    except subprocess.TimeoutExpired:
        fail += 1; status = "TIMEOUT"; entry["error"] = "timeout"; entry["elapsed_s"] = 900
    except Exception as e:
        fail += 1; status = "ERROR"; entry["error"] = str(e)
    results.append(entry)
    print(f"[{i:3d}/{len(todo)}] {status:9s} {name} ({entry.get('nodes','-')}n/{entry.get('edges','-')}e)", flush=True)
    json.dump({"ok": ok, "fail": fail, "total": len(todo), "results": results},
              open(RESULTS, "w", encoding="utf-8"), indent=1)

print(f"\n=== RERUN SELESAI: {ok} ok, {fail} fail dari {len(todo)} ===")
