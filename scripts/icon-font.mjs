/**
 * Regenera y verifica la fuente de íconos (Material Symbols).
 *
 *   node scripts/icon-font.mjs            → verifica que la fuente actual tenga todos los íconos
 *   node scripts/icon-font.mjs --update   → vuelve a descargarla con los íconos que usa la app
 *
 * Por qué existe: la fuente viene recortada a los íconos usados (94 kB en vez de
 * ~4 MB). Si alguien agrega un <span className="material-symbols-outlined">nuevo_icono</span>
 * y no la regenera, ese ícono sale invisible. Correr esto después de agregar íconos.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT = path.join(ROOT, 'src/fonts/material-symbols-outlined.woff2');
const LIST = path.join(ROOT, 'src/fonts/icons.txt');
const NO_ICONS = path.join(ROOT, 'src/fonts/no-son-iconos.txt');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Nombres de ícono usados en el código. Cubre las cuatro formas en que la app
 * los escribe: texto suelto dentro del span, expresiones dentro del span
 * (`{isDarkMode ? 'light_mode' : 'dark_mode'}`), la prop `icon=`/`icon:` y los
 * mapas `*_ICONS`. Las expresiones aportan falsos positivos (la condición
 * también lleva cadenas, p. ej. 'activo'): se filtran con NO_ICONOS, que
 * mantiene el propio script al descubrir qué nombres rechaza Google.
 */
function iconsUsados() {
  const found = new Set();
  const noIconos = new Set(
    fs.existsSync(NO_ICONS) ? fs.readFileSync(NO_ICONS, 'utf8').split('\n').map(s => s.trim()).filter(Boolean) : []
  );
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) {
        const src = fs.readFileSync(p, 'utf8');
        // Contenido completo del span, incluidas expresiones multilínea
        for (const m of src.matchAll(/material-symbols-outlined[^>]*>([\s\S]{0,300}?)<\/span>/g)) {
          const body = m[1].trim();
          const suelto = body.match(/^([a-z][a-z_0-9]+)$/);
          if (suelto) found.add(suelto[1]);
          else for (const q of body.matchAll(/['"]([a-z][a-z_0-9]{2,})['"]/g)) found.add(q[1]);
        }
        for (const m of src.matchAll(/\bicon:\s*'([a-z][a-z_0-9]+)'/g)) found.add(m[1]);
        for (const m of src.matchAll(/\bicon="([a-z][a-z_0-9]+)"/g)) found.add(m[1]);
        // Mapas tipo CATEGORY_ICONS: { 'clave': 'nombre_icono', ... }
        for (const blk of src.matchAll(/_ICONS[^=]*=\s*\{([^}]*)\}/g))
          for (const m of blk[1].matchAll(/:\s*'([a-z][a-z_0-9]+)'/g)) found.add(m[1]);
        // Fallbacks: CATEGORY_ICONS[x] || 'label'
        for (const m of src.matchAll(/_ICONS\[[^\]]+\]\s*\|\|\s*'([a-z][a-z_0-9]+)'/g)) found.add(m[1]);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  return [...found].filter(i => !noIconos.has(i)).sort();
}

/** Lee las ligaduras (nombres de ícono) que realmente trae el .woff2. */
async function ligadurasEnFuente() {
  const { decompress } = await import('wawoff2');
  const buf = Buffer.from(await decompress(fs.readFileSync(FONT)));
  const tables = {};
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[buf.toString('latin1', o, o + 4)] = buf.readUInt32BE(o + 8);
  }

  // cmap: carácter → id de glifo
  const cm = tables.cmap;
  let sub = null;
  const nSub = buf.readUInt16BE(cm + 2);
  for (let i = 0; i < nSub; i++) {
    const o = cm + 4 + i * 8;
    if (buf.readUInt16BE(o) === 3 && [1, 10].includes(buf.readUInt16BE(o + 2))) sub = cm + buf.readUInt32BE(o + 4);
  }
  const charToGid = {};
  if (sub && buf.readUInt16BE(sub) === 4) {
    const segX2 = buf.readUInt16BE(sub + 6);
    const endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = buf.readUInt16BE(endO + s * 2), start = buf.readUInt16BE(startO + s * 2);
      const delta = buf.readInt16BE(deltaO + s * 2), ro = buf.readUInt16BE(rangeO + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xffff;
        else {
          const gi = rangeO + s * 2 + ro + (c - start) * 2;
          if (gi + 1 >= buf.length) continue;
          g = buf.readUInt16BE(gi);
          if (g) g = (g + delta) & 0xffff;
        }
        if (g) charToGid[c] = g;
      }
    }
  }

  // GSUB: secuencias de ligadura (resolviendo lookups de extensión, tipo 7)
  const g = tables.GSUB, lookupList = g + buf.readUInt16BE(g + 8);
  const seqs = new Set();
  const leerLig = (st) => {
    if (buf.readUInt16BE(st) !== 1) return;
    const covOff = st + buf.readUInt16BE(st + 2), nSets = buf.readUInt16BE(st + 4);
    const firsts = [];
    const covFmt = buf.readUInt16BE(covOff), n = buf.readUInt16BE(covOff + 2);
    if (covFmt === 1) for (let k = 0; k < n; k++) firsts.push(buf.readUInt16BE(covOff + 4 + k * 2));
    else for (let k = 0; k < n; k++) {
      const ro = covOff + 4 + k * 6;
      for (let x = buf.readUInt16BE(ro); x <= buf.readUInt16BE(ro + 2); x++) firsts.push(x);
    }
    for (let k = 0; k < nSets; k++) {
      const ls = st + buf.readUInt16BE(st + 6 + k * 2);
      const nLig = buf.readUInt16BE(ls);
      for (let m = 0; m < nLig; m++) {
        const lig = ls + buf.readUInt16BE(ls + 2 + m * 2);
        const comps = buf.readUInt16BE(lig + 2);
        const seq = [firsts[k]];
        for (let c = 1; c < comps; c++) seq.push(buf.readUInt16BE(lig + 2 + c * 2));
        seqs.add(seq.join(','));
      }
    }
  };
  const nLookups = buf.readUInt16BE(lookupList);
  for (let i = 0; i < nLookups; i++) {
    const lo = lookupList + buf.readUInt16BE(lookupList + 2 + i * 2);
    const type = buf.readUInt16BE(lo), nSubT = buf.readUInt16BE(lo + 4);
    for (let j = 0; j < nSubT; j++) {
      const st = lo + buf.readUInt16BE(lo + 6 + j * 2);
      if (type === 4) leerLig(st);
      else if (type === 7 && buf.readUInt16BE(st + 2) === 4) leerLig(st + buf.readUInt32BE(st + 4));
    }
  }

  return (nombre) => {
    const seq = [...nombre].map(ch => charToGid[ch.codePointAt(0)]);
    return !seq.some(x => !x) && seqs.has(seq.join(','));
  };
}

async function descargar(iconos) {
  const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${iconos.join(',')}&display=block`;
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  const fontUrl = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error('No se pudo obtener la URL de la fuente:\n' + css.slice(0, 300));
  const woff2 = Buffer.from(await (await fetch(fontUrl)).arrayBuffer());
  fs.writeFileSync(FONT, woff2);
  fs.writeFileSync(LIST, iconos.join('\n') + '\n');
  console.log(`Fuente actualizada: ${iconos.length} íconos, ${(woff2.length / 1024).toFixed(0)} kB`);
}

const iconos = iconsUsados();

if (process.argv.includes('--update')) {
  await descargar(iconos);
  // Lo que Google no reconoció no es un ícono (suele ser una cadena de la
  // condición de un ternario). Se anota para no volver a pedirlo ni reportarlo.
  const enFuente = await ligadurasEnFuente();
  const rechazados = iconos.filter(i => !enFuente(i));
  if (rechazados.length) {
    const previos = fs.existsSync(NO_ICONS)
      ? fs.readFileSync(NO_ICONS, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
      : [];
    fs.writeFileSync(NO_ICONS, [...new Set([...previos, ...rechazados])].sort().join('\n') + '\n');
    fs.writeFileSync(LIST, iconos.filter(i => enFuente(i)).join('\n') + '\n');
    console.log(`Descartados por no ser íconos reales: ${rechazados.join(', ')}`);
  }
}

const tiene = await ligadurasEnFuente();
const faltan = iconsUsados().filter(i => !tiene(i));
console.log(`Íconos usados en el código: ${iconsUsados().length}`);
if (faltan.length) {
  console.error(`✗ Faltan en la fuente: ${faltan.join(', ')}`);
  console.error('  Corré: node scripts/icon-font.mjs --update');
  process.exit(1);
}
console.log('✓ Todos los íconos usados están en la fuente');
