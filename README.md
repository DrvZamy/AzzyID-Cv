# Azy Pack Bridge v2.3

Website statis untuk mengonversi resource pack ItemsAdder Java menjadi bundle Bedrock + Geyser langsung di browser.

## Perbaikan rank v2.3

- Tidak membuat atau membutuhkan plugin tambahan.
- Rank PNG lebar tetap memakai satu karakter Unicode ItemsAdder asli.
- Halaman `font/glyph_XX.png` dibuat sebagai grid 16×16 slot dengan tinggi slot tetap 16 px dan lebar slot mengikuti rank.
- Metrik `height` dan `ascent` dari font JSON Java dipakai untuk menjaga ukuran serta posisi vertikal.
- Menghindari halaman font persegi raksasa yang sebelumnya membuat prefix turun ke baris bawah atau texture hilang di Bedrock mobile.

## Menjalankan

1. Upload seluruh isi folder ini ke root repository GitHub/Netlify.
2. Pastikan folder `vendor` ikut di-upload.
3. Buka website lalu upload ZIP generated Java resource pack hasil `/iazip`.
4. Tekan **Scan pack** dan **Download bundle ZIP**.
5. Pasang `.mcpack` ke `plugins/Geyser-*/packs/` dan mapping JSON ke `plugins/Geyser-*/custom_mappings/`.
6. Hapus cache resource pack lama di client Bedrock lalu masuk ulang.

## Output

- `<pack>.mcpack` — Bedrock Resource Pack.
- `geyser/custom_mappings/<pack>_items.json` — mapping custom item Geyser.
- `conversion-report.json` — laporan aset dan ukuran halaman glyph.
- `INSTALL.txt` — petunjuk pemasangan.

## Catatan

Generated pack hasil `/iazip` diperlukan untuk font image yang codepoint/symbol-nya ditentukan otomatis oleh ItemsAdder. Website statis tidak dapat menyembunyikan source code secara mutlak; CSP, header Netlify, runtime terenkode, dan tanpa source map hanya mempersulit penyalinan kasual.
