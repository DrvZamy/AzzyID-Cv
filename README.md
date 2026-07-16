# Azy Pack Bridge v2

Website statis untuk memindai dan mengonversi aset resource pack ItemsAdder Java menjadi bundle Bedrock + Geyser di browser.

## Menjalankan

1. Extract folder ini.
2. Buka `index.html`, atau upload seluruh isi folder ke Netlify.
3. Upload ZIP folder `ItemsAdder/contents` atau generated Java resource pack hasil `/iazip`.
4. Tekan **Scan pack**, periksa status aset, lalu **Download bundle ZIP**.

Tidak ada backend dan file pack tidak dikirim ke server. Library ZIP sudah disertakan secara lokal. Parser YAML memakai js-yaml dari CDN dan memiliki parser fallback untuk konfigurasi umum saat CDN tidak tersedia.

## Output

- `<pack>.mcpack` — Bedrock Resource Pack.
- `geyser/custom_mappings/<pack>_items.json` — mapping custom item format v2.
- `conversion-report.json` — daftar aset, hasil, dan keterbatasan.
- `INSTALL.txt` — petunjuk pemasangan.

## Dukungan v2

- Item texture 2D dari YAML ItemsAdder dan generated resource pack.
- Legacy CustomModelData dan modern Java item definitions.
- Java bitmap font menjadi `font/glyph_XX.png` untuk rank PNG/emoji di chat, buku, dan UI berbasis font.
- Custom OGG + `sounds/sound_definitions.json`.
- Model cuboid Java menjadi geometry + attachable dasar.
- `.bbmodel` statis menjadi geometry/template manual dan mengekstrak texture embedded.
- `.png.mcmeta` menjadi flipbook Bedrock ketika texture dapat dihubungkan ke item.

## Batasan penting

Java Edition dan Bedrock Edition memakai renderer, model, font, audio event, dan animasi yang berbeda. Converter tidak dapat menjamin semua pack tampil 100% identik. Model dengan bone/animasi rumit, shader/emissive, furniture/entity mechanics, display transform khusus, item display, atau format plugin lain dapat membutuhkan penyuntingan manual atau pipeline khusus.

Untuk rank PNG yang simbolnya dibuat otomatis oleh ItemsAdder, gunakan generated pack hasil `/iazip`. YAML tanpa `symbol` tidak menyimpan codepoint yang dipilih ItemsAdder.
