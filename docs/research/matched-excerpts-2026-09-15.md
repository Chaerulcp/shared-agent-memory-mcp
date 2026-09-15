# Cuplikan hasil pencarian, 15 September 2026

Mode `semantic` dan hasil `hybrid` yang lolos ambang kemiripan vektor sekarang menyertakan `match` pada setiap memori hasil:

```json
{
  "match": {
    "excerpt": "potongan konten yang mendapat skor terbaik",
    "start": 1000,
    "end": 1903
  }
}
```

`start` inklusif dan `end` eksklusif, dihitung dalam karakter Unicode dari `content`. Karena itu `Array.from(content).slice(start, end).join("")` sama dengan `excerpt`. Potongan memiliki panjang maksimal 1.200 karakter. `content` lengkap tetap dikembalikan, sehingga ini menambah konteks lokasi kecocokan tetapi belum mengurangi ukuran respons. Hasil hybrid yang hanya cocok melalui FTS5, serta mode keyword, tidak memiliki `match`.

SQLite memilih indeks potongan dari baris dengan jarak minimum per memori. Perilaku memilih kolom bukan agregat dari baris minimum untuk satu fungsi `MIN()` dijelaskan dalam [dokumentasi SQLite](https://www.sqlite.org/lang_select.html#bareagg); jika dua potongan memiliki jarak identik, salah satunya dapat dipilih. Cuplikan adalah potongan dengan skor vektor terbaik, bukan penanda kalimat atau frasa yang tepat di dalamnya. Judul ikut dalam embedding, sehingga relevansi dapat berasal dari judul meski cuplikan kontennya umum.

Pengujian MCP nyata dengan cache sementara dan model MiniLM lokal mengembalikan memori `secrets` dari fakta di akhir catatan panjang untuk mode semantic dan hybrid. Keduanya menghasilkan offset `1000–1903` dan cuplikan yang dapat direkonstruksi dari konten; mode keyword mengembalikan memori yang sama tanpa `match`. Uji otomatis juga mencakup potongan terbaik setelah potongan pertama dan hit hybrid yang hanya berasal dari keyword.

Pada [benchmark sintetis pendek setelah perubahan](./retrieval-with-excerpts-2026-09-15.json), Recall@5 dan MRR@10 tetap 1,00 pada 100, 1.000, dan 10.000 memori. P95 hangat pada 10.000 memori adalah 83,6 ms semantic dan 90,1 ms hybrid. Angka ini berasal dari satu run; selisih terhadap [run sebelum cuplikan](./retrieval-after-chunking-2026-09-14.json) tidak menunjukkan peningkatan kecepatan yang terukur secara statistik. Pengujian memori nyata yang dianonimkan dan diberi label relevansi masih diperlukan.
