# Hermes

Hermes terpasang di `%LOCALAPPDATA%/hermes` (binary: `bin\hermes.exe`).
Memori bersama ini sudah terdaftar sebagai server MCP dan terverifikasi aktif
(`hermes mcp list` menampilkan `notion-memory` dengan status enabled).

## Cara kerja konfigurasi

`config.yaml` Hermes mendukung MCP stdio pada bagian `mcp_servers`. Entri yang dipakai:

```yaml
mcp_servers:
  notion-memory:
    command: node
    args:
      - C:/path/to/shared-agent-memory-mcp/dist/index.js
    env:
      NOTION_TOKEN: ${NOTION_TOKEN}
      NOTION_DATABASE_ID: ${NOTION_DATABASE_ID}
    enabled: true
```

Nilai `${NOTION_TOKEN}` dan `${NOTION_DATABASE_ID}` diambil dari file `.env` milik Hermes
(`%LOCALAPPDATA%/hermes\.env`), jadi token tidak ditulis langsung di
`config.yaml`. Variabel itu sudah ditambahkan ke `.env` tersebut.

## Verifikasi

```
hermes mcp list
```

Baris `notion-memory` harus muncul dengan status `enabled`. Jika berubah jadi error,
pastikan `NOTION_TOKEN` dan `NOTION_DATABASE_ID` ada di `.env` Hermes dan server bisa
dijalankan manual:

```
node C:/path/to/shared-agent-memory-mcp/dist/index.js
```

## Alternatif — CLI (jika MCP dinonaktifkan)

Hermes juga bisa menjalankan perintah terminal, jadi CLI selalu bisa dipakai langsung:

```
node C:/path/to/shared-agent-memory-mcp/dist/cli.js search "kata kunci"
node C:/path/to/shared-agent-memory-mcp/dist/cli.js recent --limit 5
node C:/path/to/shared-agent-memory-mcp/dist/cli.js add --title "..." --content "..." --agent hermes --category decision --tags "a,b"
node C:/path/to/shared-agent-memory-mcp/dist/cli.js get <id>
node C:/path/to/shared-agent-memory-mcp/dist/cli.js update <id> --content "..."
node C:/path/to/shared-agent-memory-mcp/dist/cli.js delete <id>
```

Salin isi `rules/AGENTS.md` ke file `AGENTS.md` di root proyek yang dikerjakan Hermes,
supaya Hermes tahu kapan harus membaca dan menyimpan memori.

