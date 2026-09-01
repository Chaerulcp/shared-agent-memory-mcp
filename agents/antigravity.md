# Antigravity (CLI `agy` & Antigravity IDE)

Kedua varian Antigravity sudah terhubung ke memori bersama Notion.

## Konfigurasi MCP

### Antigravity CLI (`agy`)
Didaftarkan via CLI resmi (2026-08-31):

```
"path/to/agy.exe" mcp add notion-memory node C:/path/to/shared-agent-memory-mcp/dist/index.js
```

Verifikasi: `agy.exe mcp list` → baris `notion-memory` berstatus `enabled`.
Config tersimpan di `~/.gemini/config/mcp_config.json` (bagian `mcpServers`).

### Antigravity IDE
Ditambahkan manual ke `~/.gemini/antigravity-ide/mcp_config.json`:

```json
{
  "mcpServers": {
    "notion-memory": {
      "command": "node",
      "args": ["C:/path/to/shared-agent-memory-mcp/dist/index.js"]
    }
  }
}
```

Token Notion tidak perlu ditulis di config — server otomatis membaca
`.env` dari root proyek `agent-memory-notion` (`NOTION_TOKEN`, `NOTION_DATABASE_ID`).

## Aturan (rules)

Aturan global Antigravity (semua varian: AGY, AGY CLI, AGY IDE) dibaca dari
`~/.gemini/GEMINI.md`. File itu sudah berisi instruksi READ/WRITE memori Notion.
Untuk aturan per-workspace, taruh file markdown di folder `.agents/rules/` pada
root proyek yang bersangkutan.

Batas ukuran file rules: 12.000 karakter.

## Verifikasi cepat

```
node C:/path/to/shared-agent-memory-mcp/scripts/test-mcp.mjs
```

Harus menampilkan daftar tool `memory_search, memory_recent, memory_get,
memory_add, memory_update, memory_delete` beserta hasil pencarian contoh.
