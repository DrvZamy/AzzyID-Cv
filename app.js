(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const te = new TextEncoder();

  const state = {
    file: null,
    zip: null,
    entries: new Map(),
    items: [],
    fonts: [],
    sounds: [],
    models: [],
    flipbooks: [],
    activeTab: 'items',
  };

  const el = {
    fileInput: $('#fileInput'), dropzone: $('#dropzone'), fileBadge: $('#fileBadge'),
    packName: $('#packName'), fallbackNamespace: $('#fallbackNamespace'),
    optItems: $('#optItems'), optFonts: $('#optFonts'), optSounds: $('#optSounds'),
    optModels: $('#optModels'), optBbmodel: $('#optBbmodel'), optFlipbooks: $('#optFlipbooks'),
    scanBtn: $('#scanBtn'), downloadBtn: $('#downloadBtn'), analysisState: $('#analysisState'), healthBadge: $('#healthBadge'),
    progressText: $('#progressText'), progressPct: $('#progressPct'), progressBar: $('#progressBar'),
    statItems: $('#statItems'), statGlyphs: $('#statGlyphs'), statSounds: $('#statSounds'), statModels: $('#statModels'),
    countReady: $('#countReady'), countReview: $('#countReview'), countUnsupported: $('#countUnsupported'),
    tabCountItems: $('#tabCountItems'), tabCountFonts: $('#tabCountFonts'), tabCountSounds: $('#tabCountSounds'), tabCountModels: $('#tabCountModels'),
    resultsPanel: $('#resultsPanel'), resultRows: $('#resultRows'), searchInput: $('#searchInput'), toast: $('#toast'), themeBtn: $('#themeBtn')
  };

  function toast(message, ms = 3400) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setProgress(percent, text) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    el.progressBar.style.width = `${p}%`;
    el.progressPct.textContent = `${p}%`;
    el.progressText.textContent = text;
  }

  function setHealth(text, type = '') {
    el.healthBadge.textContent = text;
    el.healthBadge.className = `badge ${type || 'muted-badge'}`;
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/');
  }

  function safeName(value, fallback = 'asset') {
    const cleaned = String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
    return cleaned || fallback;
  }

  function safePath(value) {
    return String(value ?? '').split('/').map((p) => safeName(p, 'asset')).join('/');
  }

  function stripExt(path) { return String(path || '').replace(/\.(png|json|ogg|bbmodel)$/i, ''); }
  function fileBase(path) { return normalizePath(path).split('/').pop() || ''; }
  function withoutExt(path) { return fileBase(path).replace(/\.[^.]+$/, ''); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function stripFormatting(value) { return String(value ?? '').replace(/<[^>]+>/g, '').replace(/§[0-9A-FK-OR]/gi, '').replace(/&[0-9A-FK-OR]/gi, '').trim(); }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 3 | 8);
      return v.toString(16);
    });
  }

  function assetStatus(status, notes = []) {
    return { status, notes: Array.isArray(notes) ? notes : [String(notes)] };
  }

  function findEntry(candidates) {
    const list = candidates.filter(Boolean).map(normalizePath);
    for (const c of list) if (state.entries.has(c) && !state.entries.get(c).dir) return c;
    const lower = list.map(c => c.toLowerCase());
    for (const [key, entry] of state.entries) {
      if (entry.dir) continue;
      const k = normalizePath(key).toLowerCase();
      if (lower.some(c => k === c || k.endsWith('/' + c))) return key;
    }
    return null;
  }

  function entriesMatching(regex) {
    return [...state.entries.entries()].filter(([p, e]) => !e.dir && regex.test(normalizePath(p))).map(([p]) => p);
  }

  function splitLocation(ref, fallbackNs = 'minecraft') {
    let raw = String(ref ?? '').trim().replace(/^#/, '');
    raw = stripExt(raw.replace(/^assets\//, '').replace(/^textures\//, '').replace(/^models\//, '').replace(/^sounds\//, ''));
    if (raw.includes(':')) {
      const i = raw.indexOf(':');
      return { ns: safeName(raw.slice(0, i), fallbackNs), path: raw.slice(i + 1).replace(/^\//, '') };
    }
    return { ns: safeName(fallbackNs, 'minecraft'), path: raw.replace(/^\//, '') };
  }

  function textureCandidates(ref, fallbackNs) {
    if (!ref) return [];
    const { ns, path } = splitLocation(ref, fallbackNs);
    const p = stripExt(path).replace(/^textures\//, '');
    return [
      `assets/${ns}/textures/${p}.png`,
      `resourcepack/assets/${ns}/textures/${p}.png`,
      `contents/${fallbackNs}/resourcepack/assets/${ns}/textures/${p}.png`,
      `contents/${fallbackNs}/textures/${p}.png`,
      `contents/${ns}/textures/${p}.png`,
      `${ns}/textures/${p}.png`,
      `textures/${p}.png`
    ];
  }

  function modelCandidates(ref, fallbackNs = 'minecraft') {
    if (!ref) return [];
    const { ns, path } = splitLocation(ref, fallbackNs);
    const p = stripExt(path).replace(/^models\//, '');
    return [
      `assets/${ns}/models/${p}.json`,
      `resourcepack/assets/${ns}/models/${p}.json`,
      `contents/${fallbackNs}/resourcepack/assets/${ns}/models/${p}.json`,
      `contents/${fallbackNs}/models/${p}.json`,
      `contents/${ns}/models/${p}.json`,
      `${ns}/models/${p}.json`,
      `models/${p}.json`
    ];
  }

  function soundCandidates(ref, fallbackNs) {
    if (!ref) return [];
    const { ns, path } = splitLocation(ref, fallbackNs);
    const p = stripExt(path).replace(/^sounds\//, '');
    return [
      `assets/${ns}/sounds/${p}.ogg`,
      `resourcepack/assets/${ns}/sounds/${p}.ogg`,
      `contents/${fallbackNs}/resourcepack/assets/${ns}/sounds/${p}.ogg`,
      `contents/${fallbackNs}/sounds/${p}.ogg`,
      `contents/${ns}/sounds/${p}.ogg`,
      `${ns}/sounds/${p}.ogg`,
      `sounds/${p}.ogg`
    ];
  }

  function fontTextureCandidates(ref, fallbackNs) {
    if (!ref) return [];
    const loc = splitLocation(ref, fallbackNs);
    return textureCandidates(`${loc.ns}:${loc.path}`, loc.ns);
  }

  async function readText(path) {
    try { return await state.entries.get(path).async('text'); } catch { return null; }
  }

  async function readJson(path) {
    const text = await readText(path);
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  }

  function dataUrlToUint8Array(url) {
    const comma = String(url).indexOf(',');
    if (comma < 0) return null;
    const meta = url.slice(0, comma);
    const data = url.slice(comma + 1);
    try {
      if (/;base64/i.test(meta)) {
        const bin = atob(data);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
      return te.encode(decodeURIComponent(data));
    } catch { return null; }
  }

  async function loadImageFromBytes(bytes, mime = 'image/png') {
    const blob = new Blob([bytes], { type: mime });
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(blob); } catch { /* fallback below */ }
    }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal membaca gambar.')); };
      img.src = url;
    });
  }

  async function loadEntryImage(path) {
    const bytes = await state.entries.get(path).async('uint8array');
    return loadImageFromBytes(bytes);
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export gagal.')), 'image/png'));
  }

  async function canvasToBytes(canvas) {
    const blob = await canvasToBlob(canvas);
    return new Uint8Array(await blob.arrayBuffer());
  }

  // Fallback YAML parser for common ItemsAdder configs. js-yaml is used when the CDN is available.
  const MiniYAML = {
    parse(source) {
      const lines = String(source || '').replace(/\t/g, '  ').split(/\r?\n/);
      const root = {};
      const stack = [{ indent: -1, value: root, type: 'object' }];
      const stripComment = (line) => {
        let quote = null;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if ((c === '"' || c === "'") && line[i - 1] !== '\\') quote = quote === c ? null : (quote || c);
          if (c === '#' && !quote && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
        }
        return line;
      };
      const scalar = (raw) => {
        let s = String(raw ?? '').trim();
        if (!s) return {};
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
          const q = s[0]; s = s.slice(1, -1);
          return q === '"' ? s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : s.replace(/''/g, "'");
        }
        if (/^(true|yes|on)$/i.test(s)) return true;
        if (/^(false|no|off)$/i.test(s)) return false;
        if (/^(null|~)$/i.test(s)) return null;
        if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
        if (s.startsWith('[') && s.endsWith(']')) return splitInline(s.slice(1, -1)).map(scalar);
        if (s.startsWith('{') && s.endsWith('}')) {
          const out = {};
          for (const part of splitInline(s.slice(1, -1))) {
            const i = part.indexOf(':');
            if (i > 0) out[part.slice(0, i).trim()] = scalar(part.slice(i + 1));
          }
          return out;
        }
        return s;
      };
      const splitInline = (s) => {
        const out = []; let q = null, depth = 0, start = 0;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if ((c === '"' || c === "'") && s[i - 1] !== '\\') q = q === c ? null : (q || c);
          else if (!q && (c === '[' || c === '{')) depth++;
          else if (!q && (c === ']' || c === '}')) depth--;
          else if (!q && depth === 0 && c === ',') { out.push(s.slice(start, i).trim()); start = i + 1; }
        }
        out.push(s.slice(start).trim()); return out.filter(Boolean);
      };
      for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const original = stripComment(lines[lineNo]).replace(/\s+$/, '');
        if (!original.trim() || /^\s*(---|\.\.\.)\s*$/.test(original)) continue;
        const indent = original.match(/^\s*/)[0].length;
        const text = original.trim();
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
        let parent = stack[stack.length - 1];
        if (text.startsWith('- ' ) || text === '-') {
          if (parent.type !== 'array') continue;
          const body = text.slice(1).trim();
          if (!body) { const obj = {}; parent.value.push(obj); stack.push({ indent, value: obj, type: 'object' }); continue; }
          const ci = body.indexOf(':');
          if (ci > 0) {
            const obj = {}; parent.value.push(obj);
            const key = body.slice(0, ci).trim(); const rest = body.slice(ci + 1).trim();
            obj[key] = rest ? scalar(rest) : {};
            stack.push({ indent, value: obj, type: 'object' });
            if (!rest) stack.push({ indent: indent + 1, value: obj[key], type: 'object' });
          } else parent.value.push(scalar(body));
          continue;
        }
        let quote = null, colon = -1;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if ((c === '"' || c === "'") && text[i - 1] !== '\\') quote = quote === c ? null : (quote || c);
          if (c === ':' && !quote) { colon = i; break; }
        }
        if (colon < 0 || parent.type !== 'object') continue;
        const key = text.slice(0, colon).trim().replace(/^['"]|['"]$/g, '');
        const rest = text.slice(colon + 1).trim();
        if (rest === '|' || rest === '>') {
          const parts = []; const baseIndent = indent;
          while (lineNo + 1 < lines.length) {
            const next = lines[lineNo + 1]; const ni = next.match(/^\s*/)[0].length;
            if (next.trim() && ni <= baseIndent) break;
            lineNo++; parts.push(next.slice(Math.min(next.length, baseIndent + 2)));
          }
          parent.value[key] = rest === '>' ? parts.join(' ').trim() : parts.join('\n');
          continue;
        }
        if (rest) { parent.value[key] = scalar(rest); continue; }
        let nextType = 'object';
        for (let n = lineNo + 1; n < lines.length; n++) {
          const raw = stripComment(lines[n]).trim();
          if (!raw) continue;
          const ni = lines[n].match(/^\s*/)[0].length;
          if (ni <= indent) break;
          if (raw.startsWith('-')) nextType = 'array';
          break;
        }
        parent.value[key] = nextType === 'array' ? [] : {};
        stack.push({ indent, value: parent.value[key], type: nextType });
      }
      return root;
    }
  };

  function parseYaml(text) {
    if (window.jsyaml?.load) {
      try { return window.jsyaml.load(text); } catch { /* fallback */ }
    }
    try { return MiniYAML.parse(text); } catch { return null; }
  }

  function materialToJavaId(material) {
    const value = safeName(material || 'paper', 'paper').replace(/^minecraft[_.:-]/, '');
    return `minecraft:${value}`;
  }

  function inferNamespaceFromPath(path, fallback) {
    const parts = normalizePath(path).split('/');
    const ci = parts.lastIndexOf('contents');
    if (ci >= 0 && parts[ci + 1]) return safeName(parts[ci + 1], fallback);
    const ai = parts.lastIndexOf('assets');
    if (ai >= 0 && parts[ai + 1]) return safeName(parts[ai + 1], fallback);
    return fallback;
  }

  function decodeSymbol(value) {
    const s = String(value ?? '');
    if (/^\\u[0-9a-fA-F]{4}$/.test(s)) return String.fromCharCode(parseInt(s.slice(2), 16));
    if (/^U\+[0-9a-fA-F]{4,6}$/i.test(s)) return String.fromCodePoint(parseInt(s.slice(2), 16));
    return Array.from(s)[0] || '';
  }

  async function resolveJavaModel(modelRef, fallbackNs = 'minecraft', visited = new Set()) {
    if (!modelRef || visited.has(modelRef) || visited.size > 20) return null;
    visited.add(modelRef);
    const path = findEntry(modelCandidates(modelRef, fallbackNs));
    if (!path) return null;
    const doc = await readJson(path);
    if (!doc) return null;

    let parent = null;
    if (typeof doc.parent === 'string' && !/^minecraft:(item\/generated|item\/handheld|builtin\/)/.test(doc.parent)) {
      parent = await resolveJavaModel(doc.parent, splitLocation(modelRef, fallbackNs).ns, visited);
    }
    const textures = { ...(parent?.textures || {}), ...(doc.textures || {}) };
    const resolveTextureValue = (value, depth = 0) => {
      if (typeof value !== 'string' || depth > 12) return null;
      if (!value.startsWith('#')) return value;
      return resolveTextureValue(textures[value.slice(1)], depth + 1);
    };
    const resolvedTextures = {};
    for (const [k, v] of Object.entries(textures)) resolvedTextures[k] = resolveTextureValue(v);
    const elements = Array.isArray(doc.elements) ? doc.elements : (parent?.elements || []);
    const display = { ...(parent?.display || {}), ...(doc.display || {}) };
    const primaryTextureRef = resolvedTextures.layer0 || resolvedTextures.texture || resolvedTextures.all || resolvedTextures.icon || Object.values(resolvedTextures).find(Boolean) || null;
    const ns = splitLocation(modelRef, fallbackNs).ns;
    const primaryTexturePath = primaryTextureRef ? findEntry(textureCandidates(primaryTextureRef, ns)) : null;
    return {
      ref: modelRef,
      path,
      doc,
      textures: resolvedTextures,
      elements,
      display,
      primaryTextureRef,
      primaryTexturePath,
      is3d: elements.length > 0,
      handheld: /handheld/.test(String(doc.parent || '')) || /handheld/.test(String(parent?.doc?.parent || '')),
      textureSize: Array.isArray(doc.texture_size) ? doc.texture_size : (parent?.textureSize || null)
    };
  }

  function collectModelRefs(value, out = []) {
    if (!value || typeof value !== 'object') return out;
    if (Array.isArray(value)) { value.forEach(v => collectModelRefs(v, out)); return [...new Set(out)]; }
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'model' || key === 'fallback') && typeof child === 'string') out.push(child);
      else collectModelRefs(child, out);
    }
    return [...new Set(out)];
  }

  function readItemTextureRef(item) {
    const g = item.graphics || {};
    const r = item.resource || {};
    if (typeof g.texture === 'string') return g.texture;
    if (typeof g.icon === 'string') return g.icon;
    if (g.textures && typeof g.textures === 'object') return g.textures.normal || g.textures.default || Object.values(g.textures).find(v => typeof v === 'string') || null;
    if (typeof r.texture === 'string') return r.texture;
    if (Array.isArray(r.textures)) return r.textures.find(v => typeof v === 'string') || null;
    if (typeof r.textures === 'string') return r.textures;
    return null;
  }

  function readItemModelRef(item) {
    const g = item.graphics || {};
    const r = item.resource || {};
    return g.model || g.model_path || r.model_path || r.model || null;
  }

  async function analyzeYamlItem(namespace, itemId, item, sourcePath) {
    const id = safeName(itemId, 'item');
    const displayName = stripFormatting(item.name || item.display_name || item.displayName || id.replace(/_/g, ' '));
    const g = item.graphics || {};
    const r = item.resource || {};
    const material = item.material || g.material || r.material || 'PAPER';
    const javaItem = materialToJavaId(material);
    const rawModelId = r.model_id ?? r.custom_model_data ?? item.custom_model_data;
    const modelId = Number.isFinite(Number(rawModelId)) ? Number(rawModelId) : null;
    const mode = item.graphics ? 'modern' : (modelId !== null ? 'legacy' : 'legacy-auto');
    const modelRef = readItemModelRef(item);
    let textureRef = readItemTextureRef(item);
    let modelData = modelRef ? await resolveJavaModel(modelRef, namespace) : null;
    if (!textureRef && modelData?.primaryTextureRef) textureRef = modelData.primaryTextureRef;
    const texturePath = textureRef ? findEntry(textureCandidates(textureRef, namespace)) : modelData?.primaryTexturePath || null;
    let status = 'ready'; const notes = [];
    if (item.template === true) { status = 'unsupported'; notes.push('Template item dilewati.'); }
    else if (!texturePath) { status = 'unsupported'; notes.push('Texture utama tidak ditemukan.'); }
    else if (modelData?.is3d) { status = 'review'; notes.push('Model 3D akan dikonversi sebagai geometry/attachable dasar. Cek posisi tangan di Bedrock.'); }
    if (!item.graphics && modelId === null && status !== 'unsupported') { status = 'review'; notes.push('Legacy item tidak punya model_id eksplisit; mapping otomatis tidak dibuat.'); }
    return {
      kind: 'item', namespace, id, name: displayName, source: sourcePath, javaItem, material, mode, modelId,
      model: `${namespace}:${id}`, bedrockIdentifier: `${namespace}:${id}`, textureRef, texturePath, modelRef,
      modelData, target: `textures/items/${namespace}_${id}.png`, status, notes
    };
  }

  async function scanLegacyOverrides() {
    const results = [];
    const modelIndex = new Map();
    const paths = entriesMatching(/(?:^|\/)assets\/minecraft\/models\/item\/.+\.json$/i);
    for (const path of paths) {
      const m = normalizePath(path).match(/(?:^|\/)assets\/minecraft\/models\/item\/(.+)\.json$/i);
      if (!m) continue;
      const baseId = m[1].replace(/\//g, '_');
      const doc = await readJson(path);
      if (!doc || !Array.isArray(doc.overrides)) continue;
      for (const override of doc.overrides) {
        const cmd = Number(override?.predicate?.custom_model_data);
        const modelRef = typeof override?.model === 'string' ? override.model : null;
        if (!Number.isFinite(cmd) || !modelRef) continue;
        const loc = splitLocation(modelRef, 'custom');
        const id = safeName(loc.path.replace(/^item\//, '').replace(/\//g, '_'), 'item');
        const modelData = await resolveJavaModel(modelRef, loc.ns);
        const texturePath = modelData?.primaryTexturePath || null;
        const status = !texturePath ? 'unsupported' : (modelData?.is3d ? 'review' : 'ready');
        const notes = [];
        if (!texturePath) notes.push('Texture model Java tidak ditemukan.');
        if (modelData?.is3d) notes.push('Model 3D akan dibuat sebagai attachable dasar.');
        const item = {
          kind: 'item', namespace: loc.ns, id, name: id.replace(/_/g, ' '), source: path,
          javaItem: `minecraft:${baseId}`, material: baseId, mode: 'legacy', modelId: cmd,
          model: modelRef, bedrockIdentifier: `${loc.ns}:${id}`, textureRef: modelData?.primaryTextureRef || null,
          texturePath, modelRef, modelData, target: `textures/items/${loc.ns}_${id}.png`, status, notes
        };
        results.push(item);
        modelIndex.set(modelRef, { javaItem: item.javaItem, modelId: cmd, item });
      }
    }
    return { results, modelIndex };
  }

  async function scanModernItems(modelIndex) {
    const results = [];
    const paths = entriesMatching(/(?:^|\/)assets\/[^/]+\/items\/.+\.json$/i);
    for (const path of paths) {
      const m = normalizePath(path).match(/(?:^|\/)assets\/([^/]+)\/items\/(.+)\.json$/i);
      if (!m || m[1].toLowerCase() === 'minecraft') continue;
      const namespace = safeName(m[1], 'custom');
      const rawId = m[2];
      const id = safeName(rawId.replace(/\//g, '_'), 'item');
      const doc = await readJson(path);
      if (!doc) continue;
      const refs = collectModelRefs(doc);
      let modelData = null; let chosen = null;
      for (const ref of refs) {
        const resolved = await resolveJavaModel(ref, namespace);
        if (resolved) { modelData = resolved; chosen = ref; if (resolved.primaryTexturePath) break; }
      }
      let inferred = null;
      for (const ref of refs) if (modelIndex.has(ref)) { inferred = modelIndex.get(ref); break; }
      const javaItem = inferred?.javaItem || 'minecraft:paper';
      const texturePath = modelData?.primaryTexturePath || null;
      const notes = [];
      let status = texturePath ? 'ready' : 'unsupported';
      if (!texturePath) notes.push('Texture item model tidak ditemukan.');
      if (!inferred && status !== 'unsupported') { status = 'review'; notes.push('Base Java item tidak tersimpan di generated pack; fallback minecraft:paper.'); }
      if (modelData?.is3d && status !== 'unsupported') { status = 'review'; notes.push('Model 3D akan dibuat sebagai attachable dasar.'); }
      results.push({
        kind: 'item', namespace, id, name: id.replace(/_/g, ' '), source: path,
        javaItem, material: javaItem.replace(/^minecraft:/, ''), mode: 'modern', modelId: inferred?.modelId ?? null,
        model: `${namespace}:${rawId}`, bedrockIdentifier: `${namespace}:${id}`,
        textureRef: modelData?.primaryTextureRef || null, texturePath, modelRef: chosen, modelData,
        target: `textures/items/${namespace}_${id}.png`, status, notes
      });
    }
    return results;
  }

  async function scanGeneratedItems() {
    const legacy = await scanLegacyOverrides();
    const modern = await scanModernItems(legacy.modelIndex);
    const seen = new Set(); const merged = [];
    for (const item of [...modern, ...legacy.results]) {
      const key = item.mode === 'legacy' ? `${item.javaItem}:${item.modelId}` : `${item.javaItem}:${item.model}`;
      if (seen.has(key)) continue;
      seen.add(key); merged.push(item);
    }
    return merged;
  }

  async function scanYamlContents(yamlPaths, fallbackNs) {
    const items = []; const fontDefs = []; const soundDefs = [];
    let done = 0;
    for (const path of yamlPaths) {
      done++;
      setProgress(8 + (done / Math.max(1, yamlPaths.length)) * 28, `Membaca ${fileBase(path)}...`);
      const text = await readText(path); if (!text) continue;
      const doc = parseYaml(text); if (!doc || typeof doc !== 'object') continue;
      const namespace = safeName(doc.info?.namespace || inferNamespaceFromPath(path, fallbackNs), fallbackNs);
      if (doc.items && typeof doc.items === 'object') {
        for (const [id, item] of Object.entries(doc.items)) if (item && typeof item === 'object') items.push(await analyzeYamlItem(namespace, id, item, path));
      }
      if (doc.font_images && typeof doc.font_images === 'object') {
        for (const [id, def] of Object.entries(doc.font_images)) {
          if (!def || typeof def !== 'object') continue;
          const textureRef = def.path || def.texture || null;
          const texturePath = textureRef ? findEntry(textureCandidates(textureRef, namespace)) : null;
          const symbol = decodeSymbol(def.symbol);
          const status = !texturePath ? 'unsupported' : (symbol ? 'ready' : 'review');
          const notes = [];
          if (!texturePath) notes.push('PNG font image tidak ditemukan.');
          if (!symbol) notes.push('Karakter Unicode dipilih otomatis oleh ItemsAdder. Upload generated pack agar mapping glyph dapat diketahui.');
          fontDefs.push({
            kind: 'font', type: 'yaml-font-image', namespace, id: safeName(id), name: id, source: path,
            textureRef, texturePath, symbol, codepoint: symbol ? symbol.codePointAt(0) : null,
            height: Number(def.scale_ratio ?? def.height ?? 9), ascent: Number(def.y_position ?? def.ascent ?? 8),
            target: symbol ? `font/glyph_${(symbol.codePointAt(0) >> 8).toString(16).toUpperCase().padStart(2, '0')}.png` : '—', status, notes
          });
        }
      }
      if (doc.sounds && typeof doc.sounds === 'object') {
        for (const [id, defRaw] of Object.entries(doc.sounds)) {
          const def = typeof defRaw === 'string' ? { path: defRaw } : defRaw;
          if (!def || typeof def !== 'object') continue;
          const ref = def.path || def.sound || id;
          const pathFound = findEntry(soundCandidates(ref, namespace));
          const eventId = `${namespace}:${id}`;
          const notes = [];
          if (!pathFound) notes.push('File OGG tidak ditemukan.');
          soundDefs.push({
            kind: 'sound', namespace, id: safeName(id), name: eventId, source: path, eventId,
            files: pathFound ? [{ ref, path: pathFound, volume: def.settings?.volume, pitch: def.settings?.pitch, stream: def.settings?.stream }] : [],
            category: def.settings?.category || 'neutral', target: `sounds/${namespace}/${stripExt(ref)}.ogg`,
            status: pathFound ? 'ready' : 'unsupported', notes
          });
        }
      }
    }
    return { items, fontDefs, soundDefs };
  }

  async function scanJavaFonts() {
    const providers = [];
    const fontJsonPaths = entriesMatching(/(^|\/)assets\/[^/]+\/font\/.*\.json$/i);
    let index = 0;
    for (const path of fontJsonPaths) {
      index++;
      setProgress(38 + (index / Math.max(1, fontJsonPaths.length)) * 9, `Memindai font ${fileBase(path)}...`);
      const doc = await readJson(path);
      if (!doc || !Array.isArray(doc.providers)) continue;
      const namespace = inferNamespaceFromPath(path, safeName(el.fallbackNamespace.value, 'azypack'));
      for (let pi = 0; pi < doc.providers.length; pi++) {
        const provider = doc.providers[pi];
        if (!provider || provider.type !== 'bitmap' || typeof provider.file !== 'string' || !Array.isArray(provider.chars)) continue;
        const texturePath = findEntry(fontTextureCandidates(provider.file, namespace));
        const rows = provider.chars.map(row => Array.from(String(row || '')));
        const glyphs = [];
        rows.forEach((row, rowIndex) => row.forEach((char, colIndex) => {
          const codepoint = char.codePointAt(0);
          if (!char || char === '\u0000' || codepoint === 0) return;
          glyphs.push({ char, codepoint, row: rowIndex, col: colIndex });
        }));
        const notes = [];
        let status = texturePath && glyphs.length ? 'ready' : 'unsupported';
        if (!texturePath) notes.push(`Texture bitmap ${provider.file} tidak ditemukan.`);
        if (!glyphs.length) notes.push('Provider tidak memiliki karakter yang dapat diekspor.');
        if (glyphs.some(g => g.codepoint > 0xFFFF)) { status = status === 'unsupported' ? status : 'review'; notes.push('Ada glyph di luar BMP (di atas U+FFFF); Bedrock glyph page biasa tidak dapat memetakannya otomatis.'); }
        providers.push({
          kind: 'font', type: 'java-bitmap-provider', namespace,
          id: safeName(`${withoutExt(path)}_${pi}`, `font_${pi}`),
          name: `${namespace}:${withoutExt(path)} #${pi + 1}`,
          source: path, textureRef: provider.file, texturePath, chars: provider.chars, glyphs,
          rows: rows.length, columns: Math.max(0, ...rows.map(r => r.length)),
          height: Number(provider.height || 8), ascent: Number(provider.ascent ?? provider.height ?? 7),
          target: glyphs.length ? [...new Set(glyphs.filter(g => g.codepoint <= 0xFFFF).map(g => `font/glyph_${(g.codepoint >> 8).toString(16).toUpperCase().padStart(2, '0')}.png`))].join(', ') : '—',
          status, notes
        });
      }
    }
    return providers;
  }

  function normalizeSoundRef(value, fallbackNs) {
    const raw = String(value || '').replace(/^sounds\//, '').replace(/\.ogg$/i, '');
    return splitLocation(raw, fallbackNs);
  }

  async function scanJavaSounds(existing = []) {
    const sounds = [...existing];
    const referenced = new Set();
    const soundJsonPaths = entriesMatching(/(^|\/)assets\/[^/]+\/sounds\.json$/i);
    let n = 0;
    for (const path of soundJsonPaths) {
      n++;
      setProgress(47 + (n / Math.max(1, soundJsonPaths.length)) * 7, `Memindai sounds.json ${n}/${soundJsonPaths.length}...`);
      const doc = await readJson(path);
      if (!doc || typeof doc !== 'object') continue;
      const namespace = inferNamespaceFromPath(path, safeName(el.fallbackNamespace.value, 'azypack'));
      for (const [eventName, rawDef] of Object.entries(doc)) {
        const def = Array.isArray(rawDef) ? { sounds: rawDef } : rawDef;
        if (!def || typeof def !== 'object') continue;
        const rawFiles = Array.isArray(def.sounds) ? def.sounds : [];
        const files = [];
        for (const raw of rawFiles) {
          const data = typeof raw === 'string' ? { name: raw } : raw;
          if (!data || typeof data.name !== 'string') continue;
          const loc = normalizeSoundRef(data.name, namespace);
          const ref = `${loc.ns}:${loc.path}`;
          const found = findEntry(soundCandidates(ref, loc.ns));
          if (found) referenced.add(found);
          files.push({
            ref, path: found, volume: data.volume, pitch: data.pitch,
            stream: Boolean(data.stream), weight: data.weight, attenuation_distance: data.attenuation_distance
          });
        }
        const missing = files.filter(f => !f.path).length;
        const notes = [];
        let status = files.length && missing === 0 ? 'ready' : (files.length ? 'review' : 'unsupported');
        if (!files.length) notes.push('Event tidak memiliki daftar file sound.');
        if (missing) notes.push(`${missing} file OGG tidak ditemukan.`);
        if (def.replace === true) notes.push('Properti Java replace tidak memiliki padanan langsung; daftar ini diekspor sebagai definisi Bedrock baru.');
        sounds.push({
          kind: 'sound', type: 'java-sounds-json', namespace, id: safeName(eventName),
          name: `${namespace}:${eventName}`, eventId: `${namespace}:${eventName}`, source: path,
          files, category: def.category || 'neutral', target: 'sounds/sound_definitions.json', status, notes
        });
      }
    }

    // Keep loose OGG files available even when the pack does not include sounds.json.
    const oggPaths = entriesMatching(/(^|\/)assets\/[^/]+\/sounds\/.*\.ogg$/i);
    for (const path of oggPaths) {
      if (referenced.has(path) || sounds.some(s => s.files?.some(f => f.path === path))) continue;
      const parts = normalizePath(path).split('/');
      const ai = parts.lastIndexOf('assets');
      const namespace = safeName(parts[ai + 1] || el.fallbackNamespace.value, 'azypack');
      const si = parts.indexOf('sounds', ai + 2);
      const rel = stripExt(parts.slice(si + 1).join('/'));
      sounds.push({
        kind: 'sound', type: 'loose-ogg', namespace, id: safeName(rel.replace(/\//g, '.')),
        name: `${namespace}:${rel.replace(/\//g, '.')}`, eventId: `${namespace}:${rel.replace(/\//g, '.')}`,
        source: path, files: [{ ref: `${namespace}:${rel}`, path }], category: 'neutral',
        target: `sounds/${namespace}/${rel}.ogg`, status: 'review',
        notes: ['OGG tidak direferensikan oleh sounds.json; event dibuat otomatis dari nama file.']
      });
    }
    return sounds;
  }

  function javaModelToGeometry(modelData, identifier) {
    if (!modelData || !Array.isArray(modelData.elements) || !modelData.elements.length) return null;
    const cubes = [];
    for (const element of modelData.elements) {
      if (!Array.isArray(element.from) || !Array.isArray(element.to)) continue;
      const from = element.from.map(Number), to = element.to.map(Number);
      const cube = {
        origin: [from[0] - 8, from[1], 8 - to[2]],
        size: [to[0] - from[0], to[1] - from[1], to[2] - from[2]],
        uv: [0, 0]
      };
      if (element.rotation && typeof element.rotation === 'object') {
        const axis = element.rotation.axis;
        const angle = Number(element.rotation.angle || 0);
        cube.rotation = [axis === 'x' ? angle : 0, axis === 'y' ? -angle : 0, axis === 'z' ? -angle : 0];
        const o = Array.isArray(element.rotation.origin) ? element.rotation.origin.map(Number) : [8, 8, 8];
        cube.pivot = [o[0] - 8, o[1], 8 - o[2]];
      }
      if (element.faces && typeof element.faces === 'object') {
        const faceMap = {};
        for (const [faceName, face] of Object.entries(element.faces)) {
          if (!face || !Array.isArray(face.uv)) continue;
          const [u1, v1, u2, v2] = face.uv.map(Number);
          faceMap[faceName] = { uv: [u1, v1], uv_size: [u2 - u1, v2 - v1] };
        }
        if (Object.keys(faceMap).length) cube.uv = faceMap;
      }
      cubes.push(cube);
    }
    if (!cubes.length) return null;
    return {
      format_version: '1.16.0',
      'minecraft:geometry': [{
        description: {
          identifier,
          texture_width: Number(modelData.textureSize?.[0] || 16),
          texture_height: Number(modelData.textureSize?.[1] || 16),
          visible_bounds_width: 4,
          visible_bounds_height: 4,
          visible_bounds_offset: [0, 1.25, 0]
        },
        bones: [{
          name: 'bb_main',
          binding: 'q.item_slot_to_bone_name(context.item_slot)',
          pivot: [0, 0, 0], cubes
        }]
      }]
    };
  }

  function bbmodelToGeometry(doc, identifier) {
    if (!doc || !Array.isArray(doc.elements)) return null;
    const pseudo = {
      elements: doc.elements.filter(e => e && (e.type === 'cube' || (!e.type && e.from && e.to))).map(e => ({
        from: e.from, to: e.to, faces: e.faces,
        rotation: Array.isArray(e.rotation) ? {
          axis: ['x', 'y', 'z'].reduce((a, axis, i) => Math.abs(Number(e.rotation[i] || 0)) > Math.abs(Number(e.rotation[['x','y','z'].indexOf(a)] || 0)) ? axis : a, 'x'),
          angle: Math.max(...e.rotation.map(v => Math.abs(Number(v || 0)))), origin: e.origin || [8, 8, 8]
        } : e.rotation
      })),
      textureSize: [Number(doc.resolution?.width || 16), Number(doc.resolution?.height || 16)]
    };
    return javaModelToGeometry(pseudo, identifier);
  }

  async function scanModels(items) {
    const models = [];
    const linkedPaths = new Set();
    for (const item of items) {
      if (!item.modelData?.is3d) continue;
      linkedPaths.add(item.modelData.path);
      models.push({
        kind: 'model', type: 'item-java-model', namespace: item.namespace, id: item.id,
        name: `${item.namespace}:${item.id}`, source: item.modelData.path, item,
        geometryIdentifier: `geometry.${item.namespace}.${item.id}`,
        target: `models/entity/${item.namespace}_${item.id}.geo.json`,
        status: item.modelData.elements?.length ? 'review' : 'unsupported',
        notes: ['Model cuboid diekspor sebagai attachable dasar. UV/rotation kompleks, display transform, animasi, dan shader tetap perlu dites di Bedrock.']
      });
    }

    const javaModelPaths = entriesMatching(/(^|\/)assets\/[^/]+\/models\/.*\.json$/i);
    for (const path of javaModelPaths) {
      if (linkedPaths.has(path)) continue;
      const doc = await readJson(path);
      if (!doc || !Array.isArray(doc.elements) || !doc.elements.length) continue;
      const namespace = inferNamespaceFromPath(path, safeName(el.fallbackNamespace.value, 'azypack'));
      const rel = normalizePath(path).split(`/assets/${namespace}/models/`).pop()?.replace(/\.json$/i, '') || withoutExt(path);
      const modelData = await resolveJavaModel(`${namespace}:${rel}`, namespace);
      models.push({
        kind: 'model', type: 'standalone-java-model', namespace, id: safeName(rel.replace(/\//g, '_')),
        name: `${namespace}:${rel}`, source: path, modelData,
        geometryIdentifier: `geometry.${namespace}.${safeName(rel.replace(/\//g, '_'))}`,
        target: `extras/models/${namespace}_${safeName(rel.replace(/\//g, '_'))}.geo.json`,
        status: 'review', notes: ['Model tidak terhubung ke item yang terdeteksi; geometry diekspor ke folder extras untuk pemasangan manual.']
      });
    }

    const bbPaths = entriesMatching(/\.bbmodel$/i);
    for (const path of bbPaths) {
      const doc = await readJson(path);
      const fallback = safeName(el.fallbackNamespace.value, 'azypack');
      const namespace = safeName(doc?.meta?.model_format || inferNamespaceFromPath(path, fallback), fallback);
      const id = safeName(withoutExt(path), 'bbmodel');
      const geometry = bbmodelToGeometry(doc, `geometry.${namespace}.${id}`);
      const embedded = [];
      if (Array.isArray(doc?.textures)) {
        for (let i = 0; i < doc.textures.length; i++) {
          const t = doc.textures[i];
          const bytes = typeof t?.source === 'string' && t.source.startsWith('data:image/') ? dataUrlToUint8Array(t.source) : null;
          if (bytes) embedded.push({ index: i, name: safeName(t.name || `texture_${i}`), bytes });
        }
      }
      const notes = [];
      let status = geometry ? 'review' : 'unsupported';
      if (!geometry) notes.push('Tidak menemukan elemen cube yang dapat dikonversi.');
      if (!embedded.length) notes.push('Texture embedded tidak ditemukan; texture eksternal perlu dipasang manual.');
      if (Array.isArray(doc?.animations) && doc.animations.length) notes.push('Animasi .bbmodel tidak dikonversi otomatis pada mode statis.');
      notes.push('Outliner/bone kompleks dan keyframe membutuhkan exporter Bedrock khusus atau penyesuaian Blockbench.');
      models.push({
        kind: 'model', type: 'bbmodel-static', namespace, id, name: fileBase(path), source: path,
        bbdoc: doc, geometry, embedded,
        geometryIdentifier: `geometry.${namespace}.${id}`,
        target: `extras/bbmodel/${id}/${id}.geo.json`, status, notes
      });
    }
    return models;
  }

  async function scanFlipbooks() {
    const out = [];
    const mcmetaPaths = entriesMatching(/\.png\.mcmeta$/i);
    for (const path of mcmetaPaths) {
      const doc = await readJson(path);
      const pngPath = findEntry([path.replace(/\.mcmeta$/i, '')]);
      if (!doc?.animation || !pngPath) continue;
      const namespace = inferNamespaceFromPath(path, safeName(el.fallbackNamespace.value, 'azypack'));
      out.push({
        kind: 'flipbook', namespace, id: safeName(withoutExt(pngPath)), name: fileBase(pngPath), source: path, pngPath,
        frametime: Number(doc.animation.frametime || 1), interpolate: Boolean(doc.animation.interpolate), frames: doc.animation.frames,
        status: 'review', target: 'textures/flipbook_textures.json',
        notes: ['Bedrock flipbook terutama ditujukan untuk atlas texture. Animated item tertentu tetap perlu dites manual.']
      });
    }
    return out;
  }

  function mergeItems(yamlItems, generatedItems) {
    const merged = [];
    const keys = new Set();
    const put = (item, prefer = false) => {
      const key = item.mode === 'legacy' && item.modelId != null
        ? `${item.javaItem}|legacy|${item.modelId}`
        : `${item.javaItem}|${item.model || item.modelRef || `${item.namespace}:${item.id}`}`;
      if (keys.has(key)) return;
      keys.add(key); merged.push(item);
    };
    yamlItems.forEach(i => put(i, true));
    generatedItems.forEach(i => put(i));
    return merged;
  }

  function mergeFonts(list) {
    const out = []; const keys = new Set();
    for (const font of list) {
      const glyphKey = font.glyphs?.map(g => g.codepoint).join(',') || font.codepoint || font.id;
      const key = `${font.texturePath || font.textureRef}|${glyphKey}`;
      if (keys.has(key)) continue;
      keys.add(key); out.push(font);
    }
    return out;
  }

  function statusLabel(status) {
    if (status === 'ready') return 'Siap';
    if (status === 'review') return 'Perlu tes';
    return 'Tidak didukung';
  }

  function allAssets() {
    return [...state.items, ...state.fonts, ...state.sounds, ...state.models, ...state.flipbooks];
  }

  function updateStats() {
    const glyphCount = state.fonts.reduce((sum, f) => sum + (f.glyphs?.filter(g => g.codepoint <= 0xFFFF).length || (f.codepoint != null ? 1 : 0)), 0);
    el.statItems.textContent = state.items.length;
    el.statGlyphs.textContent = glyphCount;
    el.statSounds.textContent = state.sounds.length;
    el.statModels.textContent = state.models.length;
    el.tabCountItems.textContent = state.items.length;
    el.tabCountFonts.textContent = glyphCount;
    el.tabCountSounds.textContent = state.sounds.length;
    el.tabCountModels.textContent = state.models.length;
    const assets = allAssets();
    el.countReady.textContent = assets.filter(a => a.status === 'ready').length;
    el.countReview.textContent = assets.filter(a => a.status === 'review').length;
    el.countUnsupported.textContent = assets.filter(a => a.status === 'unsupported').length;
  }

  function getTabAssets() {
    if (state.activeTab === 'items') return state.items;
    if (state.activeTab === 'fonts') return state.fonts;
    if (state.activeTab === 'sounds') return state.sounds;
    return state.models;
  }

  function typeText(asset) {
    const map = {
      'java-bitmap-provider': 'Java bitmap font', 'yaml-font-image': 'ItemsAdder font_image',
      'java-sounds-json': 'Java sounds.json', 'loose-ogg': 'OGG tanpa definisi',
      'item-java-model': 'Item Java 3D', 'standalone-java-model': 'Java model', 'bbmodel-static': '.bbmodel statis'
    };
    if (asset.kind === 'item') return asset.mode === 'modern' ? 'Modern item model' : asset.mode === 'legacy' ? `Legacy CMD #${asset.modelId}` : 'ItemsAdder item';
    return map[asset.type] || asset.type || asset.kind;
  }

  function renderRows() {
    const q = el.searchInput.value.trim().toLowerCase();
    const assets = getTabAssets().filter(asset => !q || `${asset.name} ${asset.id} ${asset.namespace} ${asset.source} ${typeText(asset)} ${asset.notes?.join(' ')}`.toLowerCase().includes(q));
    el.resultRows.innerHTML = assets.map(asset => `
      <tr>
        <td class="asset-name"><strong>${escapeHtml(asset.name || `${asset.namespace}:${asset.id}`)}</strong><small>${escapeHtml(asset.namespace ? `${asset.namespace}:${asset.id}` : asset.id)}</small></td>
        <td><strong>${escapeHtml(typeText(asset))}</strong><div class="asset-name"><small title="${escapeHtml(asset.source)}">${escapeHtml(asset.source || '—')}</small></div></td>
        <td><code>${escapeHtml(asset.target || '—')}</code></td>
        <td><span class="tag ${escapeHtml(asset.status)}">${statusLabel(asset.status)}</span></td>
        <td class="note-cell">${escapeHtml(asset.notes?.join(' ') || 'Siap dikonversi.')}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="note-cell">Tidak ada aset pada tab ini.</td></tr>';
  }

  async function scanPack() {
    if (!state.file) return;
    el.scanBtn.disabled = true; el.downloadBtn.disabled = true;
    setHealth('Scanning', 'warn');
    el.analysisState.textContent = 'Membaca struktur ZIP...';
    state.items = []; state.fonts = []; state.sounds = []; state.models = []; state.flipbooks = [];
    updateStats();
    try {
      setProgress(3, 'Membuka ZIP...');
      state.zip = await JSZip.loadAsync(state.file, { checkCRC32: false });
      state.entries = new Map(Object.entries(state.zip.files).map(([p, entry]) => [normalizePath(p), entry]));
      const paths = [...state.entries.keys()];
      if (!paths.length) throw new Error('ZIP kosong atau tidak dapat dibaca.');
      const fallback = safeName(el.fallbackNamespace.value, 'azypack');
      const yamlPaths = paths.filter(p => /\.(yml|yaml)$/i.test(p) && !state.entries.get(p).dir);
      let yaml = { items: [], fontDefs: [], soundDefs: [] };
      if (yamlPaths.length) yaml = await scanYamlContents(yamlPaths, fallback);

      let generatedItems = [];
      if (el.optItems.checked) generatedItems = await scanGeneratedItems();
      state.items = el.optItems.checked ? mergeItems(yaml.items, generatedItems) : [];

      const javaFonts = el.optFonts.checked ? await scanJavaFonts() : [];
      state.fonts = el.optFonts.checked ? mergeFonts([...yaml.fontDefs, ...javaFonts]) : [];
      state.sounds = el.optSounds.checked ? await scanJavaSounds(yaml.soundDefs) : [];
      state.models = (el.optModels.checked || el.optBbmodel.checked) ? await scanModels(state.items) : [];
      if (!el.optModels.checked) state.models = state.models.filter(m => m.type === 'bbmodel-static');
      if (!el.optBbmodel.checked) state.models = state.models.filter(m => m.type !== 'bbmodel-static');
      state.flipbooks = el.optFlipbooks.checked ? await scanFlipbooks() : [];

      updateStats(); renderRows();
      el.resultsPanel.classList.remove('hidden');
      const assets = allAssets();
      if (!assets.length) {
        setHealth('Kosong', 'bad');
        el.analysisState.textContent = 'Tidak ada aset yang dikenali';
        setProgress(100, 'Scan selesai tanpa aset');
        throw new Error('Tidak menemukan item, glyph, sound, model, atau .bbmodel yang dapat dikenali. Coba upload generated pack /iazip atau ZIP folder ItemsAdder/contents.');
      }
      const bad = assets.filter(a => a.status === 'unsupported').length;
      const review = assets.filter(a => a.status === 'review').length;
      setHealth(bad ? 'Ada masalah' : review ? 'Perlu tes' : 'Siap', bad ? 'bad' : review ? 'warn' : 'ok');
      el.analysisState.textContent = `${assets.length} grup aset ditemukan`;
      setProgress(100, 'Scan selesai');
      el.downloadBtn.disabled = false;
      toast(`Scan selesai: ${state.items.length} item, ${state.fonts.reduce((s,f)=>s+(f.glyphs?.length||1),0)} glyph, ${state.sounds.length} sound.`);
    } catch (err) {
      console.error(err);
      if (!allAssets().length) {
        setHealth('Error', 'bad');
        el.analysisState.textContent = 'Scan gagal';
        setProgress(0, 'Periksa struktur ZIP');
      }
      toast(err.message || 'Gagal membaca pack.', 5200);
    } finally {
      el.scanBtn.disabled = !state.file;
    }
  }

  function buildMappings(itemTextureKeys) {
    const mappings = { format_version: 2, items: {} };
    for (const item of state.items) {
      const icon = itemTextureKeys.get(item);
      if (!icon || item.status === 'unsupported') continue;
      const base = {
        bedrock_identifier: item.bedrockIdentifier,
        display_name: item.name || item.displayName || item.id,
        bedrock_options: { icon, display_handheld: Boolean(item.modelData?.is3d || item.modelData?.handheld) }
      };
      let def = null;
      if (item.mode === 'legacy' && Number.isFinite(Number(item.modelId))) {
        def = { type: 'legacy', custom_model_data: Number(item.modelId), ...base };
      } else if (item.mode === 'modern' && item.model) {
        def = { type: 'definition', model: item.model, ...base };
      }
      if (!def) continue;
      (mappings.items[item.javaItem || 'minecraft:paper'] ||= []).push(def);
    }
    return mappings;
  }

  async function generatePackIconBytes() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(20, 20, 236, 236); g.addColorStop(0, '#7557ff'); g.addColorStop(1, '#22cdbb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(5,9,18,.28)'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 125px system-ui'; ctx.fillText('A', 128, 126);
    return canvasToBytes(canvas);
  }

  async function buildGlyphPages(packZip) {
    const glyphsByPage = new Map();
    for (const font of state.fonts) {
      if (font.status === 'unsupported' || !font.texturePath) continue;
      if (font.type === 'java-bitmap-provider') {
        let image;
        try { image = await loadEntryImage(font.texturePath); } catch { continue; }
        const rows = Math.max(1, font.rows || font.chars?.length || 1);
        const cols = Math.max(1, font.columns || 1);
        const sourceCellW = Math.floor(image.width / cols);
        const sourceCellH = Math.floor(image.height / rows);
        for (const glyph of font.glyphs || []) {
          if (glyph.codepoint > 0xFFFF || sourceCellW < 1 || sourceCellH < 1) continue;
          const page = glyph.codepoint >> 8;
          const record = {
            codepoint: glyph.codepoint, image,
            sx: glyph.col * sourceCellW, sy: glyph.row * sourceCellH, sw: sourceCellW, sh: sourceCellH,
            desiredHeight: Number(font.height || sourceCellH), ascent: Number(font.ascent || font.height || sourceCellH), source: font.source
          };
          (glyphsByPage.get(page) || glyphsByPage.set(page, []).get(page)).push(record);
        }
      } else if (font.codepoint != null && font.codepoint <= 0xFFFF) {
        try {
          const image = await loadEntryImage(font.texturePath);
          const page = font.codepoint >> 8;
          const record = { codepoint: font.codepoint, image, sx: 0, sy: 0, sw: image.width, sh: image.height, desiredHeight: Number(font.height || image.height), ascent: Number(font.ascent || font.height || image.height), source: font.source };
          (glyphsByPage.get(page) || glyphsByPage.set(page, []).get(page)).push(record);
        } catch { /* reported during scan */ }
      }
    }

    const outputs = [];
    for (const [page, recordsRaw] of glyphsByPage) {
      // Last provider wins, matching Java font provider override behavior closely enough for generated packs.
      const byCodepoint = new Map(); recordsRaw.forEach(r => byCodepoint.set(r.codepoint, r));
      const records = [...byCodepoint.values()];
      let cellSize = 16;
      for (const r of records) cellSize = Math.max(cellSize, r.sw, r.sh);
      cellSize = Math.min(256, Math.ceil(cellSize));
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = cellSize * 16;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const r of records) {
        const low = r.codepoint & 0xFF, col = low & 15, row = low >> 4;
        const scale = Math.min(1, cellSize / Math.max(r.sw, r.sh));
        const dw = Math.max(1, Math.round(r.sw * scale)), dh = Math.max(1, Math.round(r.sh * scale));
        const dx = col * cellSize;
        const dy = row * cellSize + Math.max(0, cellSize - dh);
        ctx.drawImage(r.image, r.sx, r.sy, r.sw, r.sh, dx, dy, dw, dh);
      }
      const hex = page.toString(16).toUpperCase().padStart(2, '0');
      const target = `font/glyph_${hex}.png`;
      packZip.file(target, await canvasToBytes(canvas));
      outputs.push({ page: hex, target, glyphs: records.length, cell_size: cellSize });
    }
    return outputs;
  }

  async function buildSounds(packZip) {
    const definitions = { format_version: '1.14.0', sound_definitions: {} };
    const copied = new Map(); const events = [];
    for (const sound of state.sounds) {
      if (sound.status === 'unsupported') continue;
      const bedrockFiles = [];
      for (const file of sound.files || []) {
        if (!file.path) continue;
        let target = copied.get(file.path);
        if (!target) {
          const loc = normalizeSoundRef(file.ref, sound.namespace);
          target = `sounds/${safeName(loc.ns)}/${safePath(loc.path)}.ogg`;
          copied.set(file.path, target);
          packZip.file(target, await state.entries.get(file.path).async('uint8array'));
        }
        const entry = { name: target.replace(/\.ogg$/i, '') };
        if (file.volume != null) entry.volume = Number(file.volume);
        if (file.pitch != null) entry.pitch = Number(file.pitch);
        if (file.weight != null) entry.weight = Number(file.weight);
        if (file.stream) entry.stream = true;
        bedrockFiles.push(entry);
      }
      if (!bedrockFiles.length) continue;
      const colonName = sound.eventId || `${sound.namespace}:${sound.id}`;
      const dottedName = colonName.replace(':', '.').replace(/\//g, '.');
      const def = { category: sound.category || 'neutral', sounds: bedrockFiles };
      definitions.sound_definitions[dottedName] = def;
      if (colonName !== dottedName) definitions.sound_definitions[colonName] = JSON.parse(JSON.stringify(def));
      events.push({ java_event: colonName, bedrock_events: colonName === dottedName ? [dottedName] : [colonName, dottedName], files: bedrockFiles.map(f => f.name) });
    }
    if (Object.keys(definitions.sound_definitions).length) packZip.file('sounds/sound_definitions.json', JSON.stringify(definitions, null, 2));
    return { copied: copied.size, events };
  }

  async function buildModelAssets(packZip, itemTextureTargets) {
    const outputs = [];
    for (const model of state.models) {
      if (model.status === 'unsupported') continue;
      if (model.type === 'item-java-model' && model.item && el.optModels.checked) {
        const geometry = javaModelToGeometry(model.item.modelData, model.geometryIdentifier);
        if (!geometry) continue;
        const geoPath = `models/entity/${safeName(model.item.namespace)}_${safeName(model.item.id)}.geo.json`;
        packZip.file(geoPath, JSON.stringify(geometry, null, 2));
        const texture = itemTextureTargets.get(model.item) || 'textures/items/missing';
        const attachable = {
          format_version: '1.20.30',
          'minecraft:attachable': { description: {
            identifier: model.item.bedrockIdentifier,
            materials: { default: 'entity_alphatest', enchanted: 'entity_alphatest_glint' },
            textures: { default: texture, enchanted: 'textures/misc/enchanted_item_glint' },
            geometry: { default: model.geometryIdentifier },
            render_controllers: ['controller.render.item_default']
          }}
        };
        const attPath = `attachables/${safeName(model.item.namespace)}_${safeName(model.item.id)}.attachable.json`;
        packZip.file(attPath, JSON.stringify(attachable, null, 2));
        outputs.push({ source: model.source, geometry: geoPath, attachable: attPath, mode: 'basic-static' });
      } else if (model.type === 'standalone-java-model' && el.optModels.checked) {
        const geometry = javaModelToGeometry(model.modelData, model.geometryIdentifier);
        if (!geometry) continue;
        const path = `extras/models/${safeName(model.namespace)}_${safeName(model.id)}.geo.json`;
        packZip.file(path, JSON.stringify(geometry, null, 2)); outputs.push({ source: model.source, geometry: path, mode: 'manual' });
      } else if (model.type === 'bbmodel-static' && el.optBbmodel.checked && model.geometry) {
        const base = `extras/bbmodel/${safeName(model.id)}`;
        const geoPath = `${base}/${safeName(model.id)}.geo.json`;
        packZip.file(geoPath, JSON.stringify(model.geometry, null, 2));
        for (const tex of model.embedded || []) packZip.file(`${base}/${safeName(tex.name)}.png`, tex.bytes);
        const template = {
          note: 'Template manual. Ganti identifier/texture lalu hubungkan ke mapping item yang sesuai.',
          format_version: '1.20.30',
          'minecraft:attachable': { description: {
            identifier: `${model.namespace}:${model.id}`,
            materials: { default: 'entity_alphatest' },
            textures: { default: `textures/${safeName(model.id)}` },
            geometry: { default: model.geometryIdentifier },
            render_controllers: ['controller.render.item_default']
          }}
        };
        packZip.file(`${base}/attachable.template.json`, JSON.stringify(template, null, 2));
        outputs.push({ source: model.source, geometry: geoPath, mode: 'bbmodel-static', textures: (model.embedded || []).length });
      }
    }
    return outputs;
  }

  function buildFlipbooks(itemTextureKeys) {
    const flipbooks = [];
    for (const anim of state.flipbooks) {
      const relatedItem = state.items.find(i => i.texturePath === anim.pngPath);
      const target = relatedItem ? itemTextureKeys.get(relatedItem) : null;
      if (!target) continue;
      flipbooks.push({
        flipbook_texture: target,
        atlas_tile: relatedItem.bedrockIdentifier,
        ticks_per_frame: Math.max(1, Number(anim.frametime || 1)),
        blend_frames: Boolean(anim.interpolate)
      });
    }
    return flipbooks;
  }

  function safeReportAsset(asset) {
    const base = {
      kind: asset.kind, type: asset.type, namespace: asset.namespace, id: asset.id, name: asset.name,
      source: asset.source, target: asset.target, status: asset.status, notes: asset.notes || []
    };
    if (asset.kind === 'item') Object.assign(base, {
      java_item: asset.javaItem, mode: asset.mode, custom_model_data: asset.modelId,
      model: asset.model, bedrock_identifier: asset.bedrockIdentifier,
      texture_source: asset.texturePath, model_source: asset.modelData?.path || asset.modelRef || null
    });
    if (asset.kind === 'font') Object.assign(base, {
      texture_source: asset.texturePath, glyph_count: asset.glyphs?.length || (asset.codepoint != null ? 1 : 0),
      codepoints: asset.glyphs?.slice(0, 2048).map(g => `U+${g.codepoint.toString(16).toUpperCase().padStart(4, '0')}`) || (asset.codepoint != null ? [`U+${asset.codepoint.toString(16).toUpperCase().padStart(4, '0')}`] : [])
    });
    if (asset.kind === 'sound') Object.assign(base, { event: asset.eventId, files: asset.files?.map(f => ({ source: f.path, ref: f.ref })) || [] });
    return base;
  }

  async function buildBundle() {
    const enabledAssets = allAssets().filter(a => a.status !== 'unsupported');
    if (!enabledAssets.length) throw new Error('Tidak ada aset yang dapat diekspor. Jalankan scan dan periksa status aset.');
    const packName = el.packName.value.trim() || 'Azy Converted Pack';
    const slug = safeName(packName, 'azy_converted_pack');
    const packZip = new JSZip();
    const itemTextureData = {}; const itemTextureKeys = new Map(); const itemTextureTargets = new Map();
    const usedNames = new Set();

    const exportItems = el.optItems.checked ? state.items.filter(i => i.texturePath && i.status !== 'unsupported') : [];
    let done = 0;
    for (const item of exportItems) {
      done++; setProgress(5 + (done / Math.max(1, exportItems.length)) * 24, `Menyalin item ${item.namespace}:${item.id}...`);
      let base = `${safeName(item.namespace)}_${safeName(item.id)}`, filename = `${base}.png`, suffix = 2;
      while (usedNames.has(filename)) filename = `${base}_${suffix++}.png`;
      usedNames.add(filename);
      const target = `textures/items/${filename}`;
      packZip.file(target, await state.entries.get(item.texturePath).async('uint8array'));
      const iconKey = safeName(item.bedrockIdentifier.replace(':', '_'), base);
      itemTextureData[iconKey] = { textures: [target.replace(/\.png$/i, '')] };
      itemTextureKeys.set(item, iconKey); itemTextureTargets.set(item, target.replace(/\.png$/i, ''));
    }
    if (Object.keys(itemTextureData).length) {
      packZip.file('textures/item_texture.json', JSON.stringify({ resource_pack_name: slug, texture_name: 'atlas.items', texture_data: itemTextureData }, null, 2));
    }

    setProgress(32, 'Membangun halaman glyph Bedrock...');
    const glyphPages = el.optFonts.checked ? await buildGlyphPages(packZip) : [];
    setProgress(49, 'Mengonversi sound...');
    const soundOutput = el.optSounds.checked ? await buildSounds(packZip) : { copied: 0, events: [] };
    setProgress(61, 'Membuat geometry dan attachable...');
    const modelOutput = await buildModelAssets(packZip, itemTextureTargets);
    const flipbooks = el.optFlipbooks.checked ? buildFlipbooks(itemTextureKeys) : [];
    if (flipbooks.length) packZip.file('textures/flipbook_textures.json', JSON.stringify(flipbooks, null, 2));

    const manifest = {
      format_version: 2,
      header: { name: packName, description: 'Converted by Azy Pack Bridge v2', uuid: uuid(), version: [2, 0, 0], min_engine_version: [1, 21, 0] },
      modules: [{ type: 'resources', uuid: uuid(), version: [2, 0, 0] }],
      metadata: { authors: ['Azy Pack Bridge'], generated_with: { azy_pack_bridge: ['2.0.0'] } }
    };
    packZip.file('manifest.json', JSON.stringify(manifest, null, 2));
    packZip.file('pack_icon.png', await generatePackIconBytes());

    const mappings = buildMappings(itemTextureKeys);
    const mappingCount = Object.values(mappings.items).reduce((sum, entries) => sum + entries.length, 0);
    const report = {
      generated_at: new Date().toISOString(), converter: 'Azy Pack Bridge 2.0.0', input: state.file?.name,
      pack_name: packName,
      summary: {
        items_found: state.items.length, item_textures_exported: exportItems.length, geyser_mappings: mappingCount,
        glyph_pages: glyphPages, sound_events: soundOutput.events.length, sound_files: soundOutput.copied,
        model_exports: modelOutput.length, flipbooks: flipbooks.length,
        ready: allAssets().filter(a => a.status === 'ready').length,
        review: allAssets().filter(a => a.status === 'review').length,
        unsupported: allAssets().filter(a => a.status === 'unsupported').length
      },
      limitations: [
        'Tidak ada converter universal yang dapat menjamin 100% identik antara renderer Java dan Bedrock.',
        'Model cuboid diekspor sebagai attachable dasar; animasi, shader, display transform, emissive layer, banyak material, furniture/entity mechanics, dan model plugin khusus dapat membutuhkan edit manual.',
        'Font image tanpa symbol/codepoint memerlukan generated Java resource pack agar kode glyph dapat diketahui.',
        'Animated item texture dan custom sound harus diuji pada versi Bedrock/Geyser target.'
      ],
      assets: allAssets().map(safeReportAsset),
      mappings: soundOutput.events
    };

    setProgress(72, 'Membuat resource pack .mcpack...');
    const mcpack = await packZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const bundle = new JSZip();
    bundle.file(`${slug}.mcpack`, mcpack);
    bundle.file(`geyser/custom_mappings/${slug}_items.json`, JSON.stringify(mappings, null, 2));
    bundle.file('conversion-report.json', JSON.stringify(report, null, 2));
    bundle.file('INSTALL.txt', [
      `${packName} — Azy Pack Bridge v2`, '',
      'PEMASANGAN GEYSER',
      `1. Salin ${slug}.mcpack ke folder Geyser/packs/`,
      `2. Salin geyser/custom_mappings/${slug}_items.json ke folder Geyser/custom_mappings/`,
      '3. Aktifkan custom content pada konfigurasi Geyser bila opsi tersebut tersedia pada versi yang kamu gunakan.',
      '4. Restart server/Geyser, hapus cache pack Bedrock lama, lalu masuk kembali.', '',
      'FIX RANK PNG / FONT',
      '- File font/glyph_XX.png sudah berada di dalam .mcpack.',
      '- Untuk glyph ItemsAdder yang symbol-nya dibuat otomatis, input harus berupa generated pack hasil /iazip agar kode Unicode tersedia di assets/*/font/*.json.', '',
      'SOUND',
      '- OGG dan sounds/sound_definitions.json berada di dalam .mcpack.',
      '- Event colon dan dotted alias dibuat agar lebih mudah dicocokkan; lihat conversion-report.json.', '',
      'MODEL',
      '- Model item cuboid dasar diekspor ke models/entity + attachables.',
      '- .bbmodel standalone diekspor ke extras/bbmodel sebagai geometry/template manual.',
      '- Status "Perlu tes" bukan error: aset berhasil diekspor tetapi perbedaan Java/Bedrock dapat memerlukan penyesuaian.', '',
      'Bila texture lama masih terlihat, hapus cached resource pack di client Bedrock sebelum mengetes ulang.'
    ].join('\n'));

    setProgress(84, 'Mengompres bundle ZIP...');
    const blob = await bundle.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, meta => {
      setProgress(84 + meta.percent * 0.16, `Mengompres ${Math.round(meta.percent)}%...`);
    });
    return { blob, filename: `${slug}_bedrock_bundle_v2.zip` };
  }

  async function convertAndDownload() {
    el.downloadBtn.disabled = true;
    try {
      setHealth('Building', 'warn'); setProgress(2, 'Menyiapkan bundle...');
      const output = await buildBundle();
      const url = URL.createObjectURL(output.blob);
      const a = document.createElement('a'); a.href = url; a.download = output.filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 6000);
      setProgress(100, 'Bundle berhasil dibuat'); setHealth('Selesai', 'ok');
      toast('Selesai! Bundle .mcpack + mapping Geyser sudah di-download.', 4600);
    } catch (err) {
      console.error(err); setHealth('Error', 'bad'); toast(err.message || 'Konversi gagal.', 5200);
    } finally { el.downloadBtn.disabled = !allAssets().length; }
  }

  function acceptFile(file) {
    if (!file || !/\.zip$/i.test(file.name)) { toast('Pilih file ZIP ItemsAdder atau generated resource pack.'); return; }
    state.file = file; state.zip = null; state.entries = new Map();
    state.items = []; state.fonts = []; state.sounds = []; state.models = []; state.flipbooks = [];
    el.fileBadge.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    el.scanBtn.disabled = false; el.downloadBtn.disabled = true; el.resultsPanel.classList.add('hidden');
    el.analysisState.textContent = 'File siap dipindai'; setHealth('Ready', 'ok'); setProgress(0, 'Klik Scan pack'); updateStats();
  }

  el.fileInput.addEventListener('change', e => acceptFile(e.target.files?.[0]));
  ['dragenter', 'dragover'].forEach(type => el.dropzone.addEventListener(type, e => { e.preventDefault(); el.dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(type => el.dropzone.addEventListener(type, e => { e.preventDefault(); el.dropzone.classList.remove('drag'); }));
  el.dropzone.addEventListener('drop', e => acceptFile(e.dataTransfer?.files?.[0]));
  el.scanBtn.addEventListener('click', scanPack);
  el.downloadBtn.addEventListener('click', convertAndDownload);
  el.searchInput.addEventListener('input', renderRows);
  $$('.tab').forEach(btn => btn.addEventListener('click', () => {
    $$('.tab').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    state.activeTab = btn.dataset.tab; renderRows();
  }));
  el.themeBtn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; el.themeBtn.textContent = next === 'light' ? '☀' : '☾';
    try { localStorage.setItem('azy-pack-theme', next); } catch { /* ignore */ }
  });
  try {
    const saved = localStorage.getItem('azy-pack-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch { /* ignore */ }
  el.themeBtn.textContent = document.documentElement.dataset.theme === 'light' ? '☀' : '☾';
  updateStats(); renderRows();
})();
