# Azy ItemsAdder → Bedrock Converter

Static website converter untuk mengubah custom item ItemsAdder menjadi:

- Bedrock resource pack (`.mcpack`)
- Geyser custom item mapping format v2
- Conversion report JSON
- Installation guide

## Deploy

Upload semua file ini ke Netlify, Cloudflare Pages, GitHub Pages, atau static hosting lain:

- `index.html`
- `style.css`
- `app.js`

Tidak membutuhkan backend. File ZIP diproses langsung di browser.

## Dependency

Website memuat JSZip 3.10.1 dan js-yaml 4.1.0 melalui jsDelivr CDN.

## Yang didukung

- ItemsAdder modern `graphics.texture`
- ItemsAdder modern `graphics.textures`
- ItemsAdder modern `graphics.model` sebagai sumber icon texture
- ItemsAdder legacy `resource.texture` / `resource.textures`
- ItemsAdder legacy `resource.model_path` sebagai sumber icon texture
- Legacy mapping bila `resource.model_id` tersedia
- Geyser custom item mapping v2

## Batasan

- Legacy item tanpa `model_id` eksplisit ditandai `Needs Review` dan tidak dibuat mapping otomatis.
- Model Java 3D tidak dikonversi menjadi geometry Bedrock. Texture pertama digunakan sebagai icon bila ditemukan.
- Custom blocks, furniture, font images, GUI, custom armor geometry, dan sound belum dikonversi.
- Untuk pack yang sangat besar, batas memori browser perangkat tetap berlaku.
