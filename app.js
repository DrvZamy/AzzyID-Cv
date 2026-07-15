(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    file: null,
    zip: null,
    entries: new Map(),
    items: [],
    currentFilter: 'all',
    outputBundle: null,
  };

  const el = {
    fileInput: $('#fileInput'), dropzone: $('#dropzone'), fileBadge: $('#fileBadge'),
    packName: $('#packName'), fallbackNamespace: $('#fallbackNamespace'), modernMappings: $('#modernMappings'),
    scanBtn: $('#scanBtn'), downloadBtn: $('#downloadBtn'), resultsPanel: $('#resultsPanel'), resultRows: $('#resultRows'),
    searchInput: $('#searchInput'), themeBtn: $('#themeBtn'), toast: $('#toast'), analysisState: $('#analysisState'),
    progressBar: $('#progressBar'), progressText: $('#progressText'), progressPct: $('#progressPct'),
    statItems: $('#statItems'), statTextures: $('#statTextures'), statReady: $('#statReady'), statReview: $('#statReview'),
    countAll: $('#countAll'), countReady: $('#countReady'), countReview: $('#countReview'), countUnsupported: $('#countUnsupported')
  };

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), 2800);
  }

  function setProgress(percent, text) {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    el.progressBar.style.width = `${pct}%`;
    el.progressPct.textContent = `${pct}%`;
    el.progressText.textContent = text;
  }

  function safeName(value, fallback = 'item') {
    const cleaned = String(value || '').toLowerCase().trim().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
    return cleaned || fallback;
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  }

  function stripExt(path) { return path.replace(/\.(png|json)$/i, ''); }
  function stripFormatting(value) {
    return String(value ?? '').replace(/<[^>]+>/g, '').replace(/§[0-9A-FK-OR]/gi, '').replace(/&[0-9A-FK-OR]/gi, '').trim();
  }

  function materialToJavaId(material) {
    const value = safeName(material || 'paper', 'paper').replace(/^minecraft[_.-]/, '');
    return `minecraft:${value}`;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function findEntryExactOrSuffix(candidates) {
    for (const c of candidates.map(normalizePath)) {
      if (state.entries.has(c)) return c;
    }
    const lowerCandidates = candidates.map(c => normalizePath(c).toLowerCase());
    for (const key of state.entries.keys()) {
      const lower = key.toLowerCase();
      if (lowerCandidates.some(c => lower.endsWith('/' + c) || lower === c)) return key;
    }
    return null;
  }

  function splitResourceLocation(ref, fallbackNs) {
    let raw = stripExt(String(ref || '').replace(/^assets\//, '').replace(/^textures\//, ''));
    if (raw.includes(':')) {
      const idx = raw.indexOf(':');
      return { ns: safeName(raw.slice(0, idx), fallbackNs), path: raw.slice(idx + 1).replace(/^textures\//, '') };
    }
    return { ns: fallbackNs, path: raw.replace(/^textures\//, '') };
  }

  function textureCandidates(ref, namespace) {
    if (!ref) return [];
    const { ns, path } = splitResourceLocation(ref, namespace);
    const p = stripExt(path).replace(/^\//, '');
    return [
      `contents/${namespace}/textures/${p}.png`,
      `contents/${namespace}/resourcepack/assets/${ns}/textures/${p}.png`,
      `resourcepack/assets/${ns}/textures/${p}.png`,
      `assets/${ns}/textures/${p}.png`,
      `${ns}/textures/${p}.png`,
      `textures/${p}.png`
    ];
  }

  function modelCandidates(ref, namespace) {
    if (!ref) return [];
    const { ns, path } = splitResourceLocation(ref, namespace);
    const p = stripExt(path).replace(/^models\//, '');
    return [
      `contents/${namespace}/models/${p}.json`,
      `contents/${namespace}/resourcepack/assets/${ns}/models/${p}.json`,
      `resourcepack/assets/${ns}/models/${p}.json`,
      `assets/${ns}/models/${p}.json`,
      `${ns}/models/${p}.json`,
      `models/${p}.json`
    ];
  }

  async function parseModelForTexture(modelRef, namespace) {
    const modelPath = findEntryExactOrSuffix(modelCandidates(modelRef, namespace));
    if (!modelPath) return { modelPath: null, textureRef: null, is3d: false };
    try {
      const text = await state.entries.get(modelPath).async('text');
      const model = JSON.parse(text);
      const textureValues = Object.values(model.textures || {}).filter(v => typeof v === 'string' && !v.startsWith('#'));
      return { modelPath, textureRef: textureValues[0] || null, is3d: Array.isArray(model.elements) && model.elements.length > 0 };
    } catch {
      return { modelPath, textureRef: null, is3d: false };
    }
  }

  function readTextureRef(item) {
    const g = item.graphics || {};
    const r = item.resource || {};
    if (typeof g.texture === 'string') return g.texture;
    if (typeof g.icon === 'string') return g.icon;
    if (g.textures && typeof g.textures === 'object') {
      return g.textures.normal || g.textures.default || Object.values(g.textures).find(v => typeof v === 'string') || null;
    }
    if (typeof r.texture === 'string') return r.texture;
    if (Array.isArray(r.textures) && r.textures.length) return r.textures[0];
    if (typeof r.textures === 'string') return r.textures;
    return null;
  }

  function readModelRef(item) {
    const g = item.graphics || {};
    const r = item.resource || {};
    return g.model || r.model_path || null;
  }

  function baseMaterial(item) {
    const g = item.graphics || {};
    const r = item.resource || {};
    return item.material || g.material || r.material || 'PAPER';
  }

  function inferNamespaceFromPath(path, fallback) {
    const parts = normalizePath(path).split('/');
    const i = parts.lastIndexOf('contents');
    if (i >= 0 && parts[i + 1]) return safeName(parts[i + 1], fallback);
    return fallback;
  }

  function collectYamlDocs() {
    return [...state.entries.keys()].filter(p => /\.(ya?ml)$/i.test(p) && !state.entries.get(p).dir);
  }

  function resourcePackPathMatch(path, regex) {
    const normalized = normalizePath(path);
    const match = normalized.match(regex);
    return match || null;
  }

  function hasGeneratedResourcePack() {
    return [...state.entries.keys()].some(path => {
      const p = normalizePath(path).toLowerCase();
      return p.endsWith('/pack.mcmeta') || p === 'pack.mcmeta' || p.includes('/assets/') || p.startsWith('assets/');
    });
  }

  async function readJsonEntry(path) {
    try {
      const text = await state.entries.get(path).async('text');
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function firstStringByKeys(value, keys) {
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) {
      for (const child of value) {
        const hit = firstStringByKeys(child, keys);
        if (hit) return hit;
      }
      return null;
    }
    for (const key of keys) {
      if (typeof value[key] === 'string') return value[key];
    }
    for (const child of Object.values(value)) {
      const hit = firstStringByKeys(child, keys);
      if (hit) return hit;
    }
    return null;
  }

  function collectModelRefs(value, out = []) {
    if (!value || typeof value !== 'object') return out;
    if (Array.isArray(value)) {
      value.forEach(child => collectModelRefs(child, out));
      return out;
    }
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'model' || key === 'fallback') && typeof child === 'string' && child.includes(':')) out.push(child);
      else collectModelRefs(child, out);
    }
    return [...new Set(out)];
  }

  function javaModelCandidates(ref) {
    if (!ref || typeof ref !== 'string') return [];
    const loc = splitResourceLocation(ref, 'minecraft');
    const p = stripExt(loc.path).replace(/^models\//, '');
    return [
      `assets/${loc.ns}/models/${p}.json`,
      `resourcepack/assets/${loc.ns}/models/${p}.json`,
      `${loc.ns}/models/${p}.json`,
      `models/${p}.json`
    ];
  }

  async function resolveModelTexture(modelRef, visited = new Set()) {
    if (!modelRef || visited.has(modelRef) || visited.size > 12) return { modelPath: null, textureRef: null, is3d: false };
    visited.add(modelRef);
    const modelPath = findEntryExactOrSuffix(javaModelCandidates(modelRef));
    if (!modelPath) return { modelPath: null, textureRef: null, is3d: false };
    const model = await readJsonEntry(modelPath);
    if (!model) return { modelPath, textureRef: null, is3d: false };

    const textures = model.textures && typeof model.textures === 'object' ? model.textures : {};
    const preferred = textures.layer0 || textures.texture || textures.all || textures.icon ||
      Object.values(textures).find(v => typeof v === 'string' && !v.startsWith('#')) || null;
    const is3d = Array.isArray(model.elements) && model.elements.length > 0;
    if (preferred) return { modelPath, textureRef: preferred, is3d };

    if (typeof model.parent === 'string' && !model.parent.startsWith('minecraft:item/generated') && !model.parent.startsWith('minecraft:item/handheld')) {
      const parent = await resolveModelTexture(model.parent, visited);
      return { modelPath, textureRef: parent.textureRef, is3d: is3d || parent.is3d };
    }
    return { modelPath, textureRef: null, is3d };
  }

  async function scanLegacyResourcePackOverrides() {
    const results = [];
    const modelIndex = new Map();
    const paths = [...state.entries.keys()].filter(path =>
      /(?:^|\/)assets\/minecraft\/models\/item\/.+\.json$/i.test(normalizePath(path)) && !state.entries.get(path).dir
    );

    for (const path of paths) {
      const match = resourcePackPathMatch(path, /(?:^|\/)assets\/minecraft\/models\/item\/(.+)\.json$/i);
      if (!match) continue;
      const baseId = match[1].replace(/\//g, '_');
      const doc = await readJsonEntry(path);
      if (!doc || !Array.isArray(doc.overrides)) continue;

      for (const override of doc.overrides) {
        const cmdRaw = override?.predicate?.custom_model_data;
        const modelRef = typeof override?.model === 'string' ? override.model : null;
        if (cmdRaw == null || !modelRef) continue;
        const modelId = Number(cmdRaw);
        if (!Number.isFinite(modelId)) continue;
        const loc = splitResourceLocation(modelRef, 'custom');
        const itemId = safeName(loc.path.replace(/^item\//, '').replace(/\//g, '_'), 'item');
        const info = await resolveModelTexture(modelRef);
        const texturePath = info.textureRef ? findEntryExactOrSuffix(textureCandidates(info.textureRef, loc.ns)) : null;
        const bedrockIdentifier = `${safeName(loc.ns, 'custom')}:${itemId}`;
        const item = {
          namespace: loc.ns,
          id: itemId,
          displayName: itemId.replace(/_/g, ' '),
          material: baseId,
          javaItem: `minecraft:${baseId}`,
          bedrockIdentifier,
          modelId,
          mode: 'legacy',
          model: modelRef,
          textureRef: info.textureRef,
          texturePath,
          modelRef,
          modelPath: info.modelPath,
          is3d: info.is3d,
          status: texturePath ? (info.is3d ? 'review' : 'ready') : 'unsupported',
          notes: info.is3d ? ['Model Java 3D terdeteksi; texture pertama dipakai sebagai icon Bedrock.'] : [],
          sourcePath: path,
          original: override
        };
        if (!texturePath) item.notes.push('Texture dari model Java tidak ditemukan.');
        results.push(item);
        modelIndex.set(modelRef, { javaItem: item.javaItem, modelId, item });
      }
    }
    return { results, modelIndex };
  }

  async function scanModernResourcePackItems(modelIndex) {
    const results = [];
    const paths = [...state.entries.keys()].filter(path =>
      /(?:^|\/)assets\/[^/]+\/items\/.+\.json$/i.test(normalizePath(path)) && !state.entries.get(path).dir
    );

    for (const path of paths) {
      const match = resourcePackPathMatch(path, /(?:^|\/)assets\/([^/]+)\/items\/(.+)\.json$/i);
      if (!match) continue;
      const namespace = safeName(match[1], 'custom');
      const rawId = match[2];
      if (namespace === 'minecraft') continue;
      const id = safeName(rawId.replace(/\//g, '_'), 'item');
      const itemModel = `${namespace}:${rawId}`;
      const doc = await readJsonEntry(path);
      if (!doc) continue;

      const refs = collectModelRefs(doc);
      let info = { modelPath: null, textureRef: null, is3d: false };
      let chosenModelRef = null;
      for (const ref of refs) {
        const candidate = await resolveModelTexture(ref);
        if (candidate.textureRef || candidate.modelPath) {
          info = candidate;
          chosenModelRef = ref;
          if (candidate.textureRef) break;
        }
      }

      let inferred = null;
      for (const ref of refs) {
        if (modelIndex.has(ref)) { inferred = modelIndex.get(ref); break; }
      }
      const javaItem = inferred?.javaItem || 'minecraft:paper';
      const texturePath = info.textureRef ? findEntryExactOrSuffix(textureCandidates(info.textureRef, namespace)) : null;
      const status = !texturePath ? 'unsupported' : (info.is3d || !inferred ? 'review' : 'ready');
      const notes = [];
      if (!texturePath) notes.push('Texture untuk item model definition tidak ditemukan.');
      if (info.is3d) notes.push('Model Java 3D terdeteksi; texture pertama dipakai sebagai icon Bedrock.');
      if (!inferred) notes.push('Base Java item tidak tersimpan di resource pack modern. Dipakai fallback minecraft:paper; cek mapping jika material aslinya bukan PAPER.');

      results.push({
        namespace,
        id,
        displayName: id.replace(/_/g, ' '),
        material: javaItem.replace(/^minecraft:/, ''),
        javaItem,
        bedrockIdentifier: `${namespace}:${id}`,
        modelId: inferred?.modelId ?? null,
        mode: 'modern',
        model: itemModel,
        textureRef: info.textureRef,
        texturePath,
        modelRef: chosenModelRef,
        modelPath: info.modelPath,
        is3d: info.is3d,
        status,
        notes,
        sourcePath: path,
        original: doc
      });
    }
    return results;
  }

  async function scanGeneratedResourcePack() {
    const legacy = await scanLegacyResourcePackOverrides();
    const modern = await scanModernResourcePackItems(legacy.modelIndex);

    const seen = new Set();
    const merged = [];
    for (const item of [...modern, ...legacy.results]) {
      const key = item.mode === 'modern' ? `modern:${item.model}` : `legacy:${item.javaItem}:${item.modelId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged;
  }

  async function analyzeItem(namespace, itemId, item, sourcePath) {
    const id = safeName(itemId, 'item');
    const bedrockIdentifier = `${safeName(namespace, 'custom')}:${id}`;
    const displayName = stripFormatting(item.name || item.display_name || item.displayName || id.replace(/_/g, ' '));
    const material = baseMaterial(item);
    const javaItem = materialToJavaId(material);
    const modelIdRaw = item.resource?.model_id ?? item.resource?.custom_model_data ?? item.custom_model_data;
    const modelId = Number.isFinite(Number(modelIdRaw)) ? Number(modelIdRaw) : null;
    const hasGraphics = !!item.graphics;
    const modelRef = readModelRef(item);
    let textureRef = readTextureRef(item);
    let texturePath = textureRef ? findEntryExactOrSuffix(textureCandidates(textureRef, namespace)) : null;
    let modelInfo = { modelPath: null, textureRef: null, is3d: false };

    if ((!texturePath || modelRef) && modelRef) {
      modelInfo = await parseModelForTexture(modelRef, namespace);
      if (!textureRef && modelInfo.textureRef) textureRef = modelInfo.textureRef;
      if (!texturePath && textureRef) texturePath = findEntryExactOrSuffix(textureCandidates(textureRef, namespace));
    }

    const isTemplate = item.template === true;
    let mode = hasGraphics ? 'modern' : (modelId !== null ? 'legacy' : 'legacy-auto');
    let status = 'ready';
    const notes = [];

    if (isTemplate) {
      status = 'unsupported';
      notes.push('Template item dilewati.');
    } else if (!texturePath) {
      status = 'unsupported';
      notes.push('Texture utama tidak ditemukan.');
    } else if (modelInfo.is3d) {
      status = 'review';
      notes.push('Model Java 3D tidak dapat dikonversi 1:1; texture pertama dipakai sebagai icon Bedrock.');
    }

    if (!hasGraphics && modelId === null && status !== 'unsupported') {
      status = 'review';
      notes.push('Legacy item tanpa model_id eksplisit: mapping Geyser tidak dibuat otomatis agar tidak salah ID.');
    }

    if (hasGraphics && !el.modernMappings.checked && status !== 'unsupported') {
      status = 'review';
      notes.push('Modern mapping dinonaktifkan dari pengaturan.');
    }

    return {
      namespace, id, displayName, material, javaItem, bedrockIdentifier, modelId, mode,
      model: `${safeName(namespace, 'custom')}:${id}`,
      textureRef, texturePath, modelRef, modelPath: modelInfo.modelPath, is3d: modelInfo.is3d,
      status, notes, sourcePath, original: item
    };
  }

  async function scanPack() {
    if (!state.file) return;
    if (!window.JSZip || !window.jsyaml) {
      toast('Library converter gagal dimuat. Pastikan website memiliki akses internet.');
      return;
    }

    el.scanBtn.disabled = true;
    el.downloadBtn.disabled = true;
    el.analysisState.textContent = 'Scanning';
    setProgress(5, 'Membuka ZIP...');

    try {
      state.zip = await JSZip.loadAsync(state.file);
      state.entries = new Map(Object.entries(state.zip.files));
      const yamlPaths = collectYamlDocs();
      const fallback = safeName(el.fallbackNamespace.value, 'custom');
      let found = [];
      let sourceMode = '';

      if (yamlPaths.length) {
        let processed = 0;
        for (const path of yamlPaths) {
          processed++;
          setProgress(10 + (processed / yamlPaths.length) * 60, `Membaca ${path.split('/').pop()}...`);
          let text;
          try { text = await state.entries.get(path).async('text'); } catch { continue; }
          let doc;
          try { doc = jsyaml.load(text); } catch { continue; }
          if (!doc || typeof doc !== 'object' || !doc.items || typeof doc.items !== 'object') continue;

          const namespace = safeName(doc.info?.namespace || inferNamespaceFromPath(path, fallback), fallback);
          for (const [itemId, item] of Object.entries(doc.items)) {
            if (!item || typeof item !== 'object') continue;
            found.push(await analyzeItem(namespace, itemId, item, path));
          }
        }
        if (found.length) sourceMode = 'ItemsAdder contents';
      }

      if (!found.length && hasGeneratedResourcePack()) {
        setProgress(22, 'YAML tidak ada — mendeteksi generated Java resource pack...');
        found = await scanGeneratedResourcePack();
        sourceMode = 'Generated resource pack';
      }

      if (!found.length) {
        throw new Error('Pack terbaca, tapi tidak ditemukan item ItemsAdder. Tools sekarang menerima ItemsAdder/contents atau generated Java resource pack yang berisi assets/<namespace>/items atau legacy CustomModelData overrides.');
      }

      state.items = found;
      setProgress(86, 'Menyusun preview...');
      updateStats();
      renderRows();
      el.resultsPanel.classList.toggle('hidden', found.length === 0);
      el.downloadBtn.disabled = found.length === 0;
      el.analysisState.textContent = sourceMode || 'Selesai';
      setProgress(100, `${found.length} item ditemukan • ${sourceMode}`);
      toast(`${found.length} item ditemukan dari ${sourceMode}.`);
    } catch (err) {
      console.error(err);
      state.items = [];
      updateStats();
      el.analysisState.textContent = 'Error';
      setProgress(0, 'Scan gagal');
      toast(err.message || 'Gagal membaca pack.');
    } finally {
      el.scanBtn.disabled = !state.file;
    }
  }

  function updateStats() {
    const ready = state.items.filter(i => i.status === 'ready').length;
    const review = state.items.filter(i => i.status === 'review').length;
    const unsupported = state.items.filter(i => i.status === 'unsupported').length;
    const textures = new Set(state.items.filter(i => i.texturePath).map(i => i.texturePath)).size;
    el.statItems.textContent = state.items.length;
    el.statTextures.textContent = textures;
    el.statReady.textContent = ready;
    el.statReview.textContent = review;
    el.countAll.textContent = state.items.length;
    el.countReady.textContent = ready;
    el.countReview.textContent = review;
    el.countUnsupported.textContent = unsupported;
  }

  function statusLabel(status) {
    if (status === 'ready') return 'Ready';
    if (status === 'review') return 'Needs Review';
    return 'Unsupported';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function renderRows() {
    const q = el.searchInput.value.trim().toLowerCase();
    const items = state.items.filter(item => {
      const filterOk = state.currentFilter === 'all' || item.status === state.currentFilter;
      const hay = `${item.namespace}:${item.id} ${item.displayName} ${item.material}`.toLowerCase();
      return filterOk && (!q || hay.includes(q));
    });
    el.resultRows.innerHTML = items.map(item => `
      <tr title="${escapeHtml(item.notes.join(' '))}">
        <td class="item-cell"><strong>${escapeHtml(item.displayName)}</strong><small>${escapeHtml(item.namespace)}:${escapeHtml(item.id)}</small></td>
        <td><code>${escapeHtml(item.javaItem)}</code></td>
        <td>${item.mode === 'modern' ? 'Modern' : item.mode === 'legacy' ? `Legacy #${item.modelId}` : 'Legacy auto'}</td>
        <td class="muted">${item.texturePath ? escapeHtml(item.texturePath.split('/').pop()) : '—'}</td>
        <td><span class="tag ${item.status}">${statusLabel(item.status)}</span></td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">Tidak ada item yang cocok.</td></tr>';
  }

  function buildMappings() {
    const mappings = { format_version: 2, items: {} };
    for (const item of state.items) {
      if (!item.texturePath || item.status === 'unsupported') continue;
      let def = null;
      if (item.mode === 'modern' && el.modernMappings.checked) {
        def = {
          type: 'definition',
          model: item.model,
          bedrock_identifier: item.bedrockIdentifier,
          display_name: item.displayName,
          bedrock_options: { icon: item.bedrockIdentifier }
        };
      } else if (item.mode === 'legacy' && item.modelId !== null) {
        def = {
          type: 'legacy',
          custom_model_data: item.modelId,
          bedrock_identifier: item.bedrockIdentifier,
          display_name: item.displayName,
          bedrock_options: { icon: item.bedrockIdentifier }
        };
      }
      if (!def) continue;
      (mappings.items[item.javaItem] ||= []).push(def);
    }
    return mappings;
  }

  async function generatePackIconBlob() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#7657ff'); g.addColorStop(1, '#21c7b5');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(6,10,20,.22)'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 128px system-ui, sans-serif'; ctx.fillText('A', 128, 128);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  async function buildBundle() {
    const readyItems = state.items.filter(i => i.texturePath && i.status !== 'unsupported');
    if (!readyItems.length) throw new Error('Tidak ada item yang memiliki texture untuk diekspor.');

    const packName = el.packName.value.trim() || 'Converted Bedrock Pack';
    const slug = safeName(packName, 'converted_pack');
    const packZip = new JSZip();
    const textureData = {};
    const usedFileNames = new Set();

    let done = 0;
    for (const item of readyItems) {
      done++;
      setProgress(8 + (done / readyItems.length) * 52, `Menyalin texture ${item.namespace}:${item.id}...`);
      let filename = `${safeName(item.namespace)}_${safeName(item.id)}.png`;
      let n = 2;
      while (usedFileNames.has(filename)) filename = `${safeName(item.namespace)}_${safeName(item.id)}_${n++}.png`;
      usedFileNames.add(filename);
      const data = await state.entries.get(item.texturePath).async('uint8array');
      packZip.file(`textures/items/${filename}`, data);
      textureData[item.bedrockIdentifier] = { textures: [`textures/items/${filename.replace(/\.png$/i, '')}`] };
    }

    const manifest = {
      format_version: 2,
      header: {
        name: packName,
        description: 'Generated by Azy ItemsAdder → Bedrock Converter',
        uuid: uuid(), version: [1, 0, 0], min_engine_version: [1, 21, 0]
      },
      modules: [{ type: 'resources', uuid: uuid(), version: [1, 0, 0] }],
      metadata: { authors: ['Azy Converter'], generated_with: { azy_ia_bedrock_converter: ['1.1.0'] } }
    };
    packZip.file('manifest.json', JSON.stringify(manifest, null, 2));
    packZip.file('textures/item_texture.json', JSON.stringify({ resource_pack_name: slug, texture_name: 'atlas.items', texture_data: textureData }, null, 2));
    const iconBlob = await generatePackIconBlob();
    if (iconBlob) packZip.file('pack_icon.png', await iconBlob.arrayBuffer());

    const mcpackBytes = await packZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    setProgress(72, 'Membuat Geyser mappings...');

    const mappings = buildMappings();
    const report = {
      generated_at: new Date().toISOString(),
      pack_name: packName,
      totals: {
        items: state.items.length,
        ready: state.items.filter(i => i.status === 'ready').length,
        review: state.items.filter(i => i.status === 'review').length,
        unsupported: state.items.filter(i => i.status === 'unsupported').length,
        mappings_generated: Object.values(mappings.items).reduce((sum, arr) => sum + arr.length, 0)
      },
      items: state.items.map(({ original, ...item }) => item)
    };

    const bundle = new JSZip();
    bundle.file(`${slug}.mcpack`, mcpackBytes);
    bundle.file(`geyser/custom_mappings/${slug}_items.json`, JSON.stringify(mappings, null, 2));
    bundle.file('conversion-report.json', JSON.stringify(report, null, 2));
    bundle.file('INSTALL.txt', [
      `${packName} - Installation`, '',
      '1. Extract bundle ini.',
      `2. Pindahkan ${slug}.mcpack ke folder Geyser/packs/`,
      `3. Pindahkan geyser/custom_mappings/${slug}_items.json ke folder Geyser/custom_mappings/`,
      '4. Pastikan enable-custom-content: true di config Geyser.',
      '5. Restart Geyser/server.', '',
      'CATATAN:',
      '- Item status Needs Review perlu diperiksa manual.',
      '- Model Java 3D tidak dikonversi menjadi geometry Bedrock; texture pertama hanya dipakai sebagai icon.',
      '- Legacy ItemsAdder tanpa model_id eksplisit tidak dibuatkan mapping karena ID otomatis tidak aman untuk ditebak.',
      '- Website converter ini berfokus pada custom item dan texture 2D, bukan custom block/furniture/GUI/font.'
    ].join('\n'));

    setProgress(88, 'Mengompres bundle...');
    const blob = await bundle.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, meta => {
      setProgress(88 + meta.percent * .12, 'Mengompres bundle...');
    });
    return { blob, filename: `${slug}_bedrock_bundle.zip` };
  }

  async function convertAndDownload() {
    el.downloadBtn.disabled = true;
    try {
      setProgress(3, 'Menyiapkan converter...');
      const output = await buildBundle();
      const url = URL.createObjectURL(output.blob);
      const a = document.createElement('a');
      a.href = url; a.download = output.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setProgress(100, 'Bundle berhasil dibuat');
      toast('Selesai! Bundle Bedrock + Geyser sudah di-download.');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Konversi gagal.');
    } finally {
      el.downloadBtn.disabled = state.items.length === 0;
    }
  }

  function acceptFile(file) {
    if (!file || !/\.zip$/i.test(file.name)) {
      toast('Pilih file .zip ItemsAdder.');
      return;
    }
    state.file = file;
    state.items = [];
    el.fileBadge.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    el.scanBtn.disabled = false;
    el.downloadBtn.disabled = true;
    el.resultsPanel.classList.add('hidden');
    el.analysisState.textContent = 'Siap scan';
    setProgress(0, 'File siap dipindai');
    updateStats();
  }

  el.fileInput.addEventListener('change', e => acceptFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(type => el.dropzone.addEventListener(type, e => { e.preventDefault(); el.dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(type => el.dropzone.addEventListener(type, e => { e.preventDefault(); el.dropzone.classList.remove('drag'); }));
  el.dropzone.addEventListener('drop', e => acceptFile(e.dataTransfer.files[0]));
  el.scanBtn.addEventListener('click', scanPack);
  el.downloadBtn.addEventListener('click', convertAndDownload);
  el.searchInput.addEventListener('input', renderRows);
  $$('.filter').forEach(btn => btn.addEventListener('click', () => {
    $$('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); state.currentFilter = btn.dataset.filter; renderRows();
  }));
  el.themeBtn.addEventListener('click', () => {
    const light = document.documentElement.dataset.theme === 'light';
    document.documentElement.dataset.theme = light ? 'dark' : 'light';
    el.themeBtn.textContent = light ? '☾' : '☀';
    localStorage.setItem('azy-theme', light ? 'dark' : 'light');
  });
  const savedTheme = localStorage.getItem('azy-theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  el.themeBtn.textContent = document.documentElement.dataset.theme === 'light' ? '☀' : '☾';
})();
