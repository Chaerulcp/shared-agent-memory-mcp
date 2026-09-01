# Obsidian Vault (Penyimpanan Pengetahuan #2)

Vault: `C:/path/to/your/ObsidianVault`
GitHub: `Chaerulcp/obsidian-vault` (PRIVATE)

## Cara kerjanya

`src/obsidian.ts` di proyek ini melakukan **dual-write**:

- `addMemory` → tulis Notion + file Markdown di `memories/<kategori>/<id8>-<slug>.md`, lalu auto `git commit + push`
- `updateMemory` → update Notion + tulis ulang file (pindah folder jika kategori berubah), auto commit+push
- `deleteMemory` → Notion (arsip/trash) + file dipindah ke `memories/_archived/` (atau dihapus jika hard), auto commit+push

Semua operasi vault **fire-and-forget**: kegagalan git/offline tidak pernah menggagalkan
penyimpanan ke Notion. Commit yang tertunda akan ikut push berikutnya.

## Konfigurasi

- Lokasi vault bisa ditimpa lewat env `OBSIDIAN_VAULT_PATH` (default: path di atas).
- Jika folder vault tidak ada, semua operasi vault otomatis di-skip (Notion-only mode).
- Auto-sync hanya aktif jika folder vault mengandung `.git` (sudah di-init).

## Format file

YAML frontmatter lengkap (`id`, `title`, `agent`, `category`, `tags`, `importance`,
`status`, `notion_url`, `created_at`, `updated_at`) + body Markdown.
Kompatibel dengan plugin Dataview di Obsidian.

## Di perangkat lain

```bash
git clone https://github.com/Chaerulcp/obsidian-vault.git
# buka folder-nya sebagai vault di Obsidian
# sebelum bekerja, tarik perubahan: git pull
```

## Sinkronisasi ke Notion (arah sebaliknya)

Editan manual di Obsidian TIDAK otomatis masuk ke Notion. Jika perlu sinkron balik,
jalankan sekali: baca semua file vault, bandingkan frontmatter `updated_at` dengan
Notion, lalu `memory_update` untuk yang berubah (bisa dibuat skrip `sync-back` jika
dibutuhkan nanti).
