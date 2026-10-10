import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = path.join(ROOT, 'data/external/raw');
const NORMALIZED = path.join(ROOT, 'data/external/normalized');
const WEB = path.join(ROOT, 'web-dashboard/public/data/external');
const RETRIEVED_AT = new Date().toISOString();
const ADAPTER_VERSION = '1.0.0';

const CANONICAL = {
  renault: ['https://gitlab.com/esicup-challenge-2015/data', 'https://benchmark.gent.cs.kuleuven.be/mclp/problem.html', 'https://benchmark.gent.cs.kuleuven.be/mclp/resources.html', 'https://benchmark.gent.cs.kuleuven.be/mclp/results.html'],
  ortec: ['https://github.com/ESICUP/datasets/tree/main/3d_rectangular/alonso_2019', 'https://github.com/ESICUP/datasets'],
  thpack: ['https://people.brunel.ac.uk/~mastjjb/jeb/orlib/thpackinfo.html', 'https://people.brunel.ac.uk/~mastjjb/jeb/orlib/files/'],
  wtpack: ['https://people.brunel.ac.uk/~mastjjb/jeb/orlib/conloadinfo.html', 'https://people.brunel.ac.uk/~mastjjb/jeb/orlib/files/'],
  irregular: ['https://github.com/ESICUP/datasets/tree/main/3d_irregular', 'https://github.com/ESICUP/datasets'],
  atlas: ['https://www.sciencedirect.com/science/article/pii/S0377221719306368', 'https://doi.org/10.1016/j.ejor.2019.07.057', 'https://www.researchgate.net/publication/334727834_Automating_the_planning_of_container_loading_for_Atlas_Copco_Coping_with_real-life_stacking_and_stability_constraints', 'https://www.diva-portal.org/smash/get/diva2%3A1073644/FULLTEXT01.pdf'],
  beantech: ['https://iolab.uniud.it/publication/ce-sc-11-b/', 'https://air.uniud.it/handle/11390/696871', 'https://www.researchgate.net/publication/215778478_Local_Search_for_a_Multi-Drop_Multi-Container_Loading_Problem', 'http://satt.diegm.uniud.it/3DPacking']
};

async function ensure(dir) { await mkdir(dir, { recursive: true }); }
async function json(file, value) { await ensure(path.dirname(file)); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
async function text(file) { return readFile(file, 'utf8'); }
async function sha256(file) { return createHash('sha256').update(await readFile(file)).digest('hex'); }
async function filesRecursively(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await filesRecursively(full));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}
async function rawFiles(sourceDir) {
  const base = path.join(RAW, sourceDir);
  const files = await filesRecursively(base);
  return Promise.all(files.filter((file) => path.basename(file) !== 'source-manifest.json').map(async (file) => ({
    path: path.relative(base, file).replaceAll('\\', '/'), bytes: (await stat(file)).size, sha256: await sha256(file)
  })));
}
function externalItem(overrides) {
  return {
    externalSource: null, externalDataset: null, externalInstance: null, externalItemId: null,
    name: null, packagingType: null,
    lengthMm: null, widthMm: null, heightMm: null,
    weightKg: null, quantity: null,
    orientationConstraints: null, stackability: 'UNKNOWN', maxStackLayers: null,
    loadBearing: null, loadBearingUnit: null, loadBearingSourceDefinition: null,
    alwaysOnTop: null, alwaysOnBottom: null, stackingGroup: null,
    hazardous: null, palletAttached: null,
    destination: null, deliveryStage: null,
    geometryType: 'BOX', geometryAsset: null, boundingBox: null, sourceGeometryMetadata: null,
    containerDefinition: null,
    sourceFields: {}, unknownFields: [],
    ...overrides
  };
}
function summarize(instance) {
  const items = instance.items || [];
  const pieces = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const weightKnown = items.length > 0 && items.every((item) => Number.isFinite(item.weightKg));
  const totalWeightKg = weightKnown ? items.reduce((sum, item) => sum + item.weightKg * item.quantity, 0) : null;
  const volumeKnown = items.length > 0 && items.every((item) => [item.lengthMm, item.widthMm, item.heightMm].every(Number.isFinite));
  const totalVolumeM3 = volumeKnown ? items.reduce((sum, item) => sum + item.lengthMm * item.widthMm * item.heightMm * item.quantity / 1e9, 0) : null;
  const available = (field) => items.some((item) => item[field] != null && item[field] !== 'UNKNOWN');
  return { id: instance.id, label: instance.label, group: instance.family || instance.setName || instance.source, itemTypeCount: items.length, pieces, totalWeightKg, totalVolumeM3,
    completeness: instance.completeness, features: { dimensions: volumeKnown, weight: weightKnown, orientation: available('orientationConstraints'), loadBearing: available('loadBearing'), multiContainer: Boolean(instance.multiContainer), mesh: available('geometryAsset') }, missingFields: instance.missingFields || [] };
}
function packagingFromMaterial(material) {
  if (/cardboard/i.test(material || '')) return 'CARTON';
  if (/wood/i.test(material || '')) return 'WOOD_CRATE';
  return null;
}
function splitSemi(line) { return line.split(';').map((value) => value.trim()).filter((_, index, all) => !(index === all.length - 1 && all[index] === '')); }

async function buildRenault() {
  const source = 'renault_esicup_2015';
  const base = path.join(RAW, source);
  const instances = [];
  for (const setName of ['instancesA', 'instancesB', 'instancesX']) {
    const setDir = path.join(base, setName);
    for (const entry of await readdir(setDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const instanceId = `${setName}-${entry.name}`;
      const dir = path.join(setDir, entry.name);
      const itemLines = (await text(path.join(dir, 'input_items.csv'))).split(/\r?\n/).filter(Boolean);
      const headers = splitSemi(itemLines.shift());
      const binLines = (await text(path.join(dir, 'input_bin.csv'))).split(/\r?\n/).filter(Boolean);
      const binHeaders = splitSemi(binLines.shift());
      const containers = binLines.map((line) => Object.fromEntries(splitSemi(line).map((value, index) => [binHeaders[index], Number.isFinite(Number(value)) ? Number(value) : value])));
      const groups = new Map();
      for (const line of itemLines) {
        const values = splitSemi(line);
        const row = Object.fromEntries(values.map((value, index) => [headers[index], value]));
        const key = [row.Product, row['length (mm)'], row['width (mm)'], row['height (mm)'], row['weight (kg)'], row['Package material'], row['Orientation constrained']].join('|');
        const current = groups.get(key) || { row, ids: [] };
        current.ids.push(row['item code']); groups.set(key, current);
      }
      const items = [...groups.values()].map(({ row, ids }) => externalItem({
        externalSource: 'Renault / ESICUP Challenge 2015', externalDataset: setName, externalInstance: entry.name, externalItemId: String(row.Product || ids[0]),
        name: String(row.Product || `Renault item ${ids[0]}`), packagingType: packagingFromMaterial(row['Package material']),
        lengthMm: Number(row['length (mm)']), widthMm: Number(row['width (mm)']), heightMm: Number(row['height (mm)']), weightKg: Number(row['weight (kg)']), quantity: ids.length,
        orientationConstraints: row['Orientation constrained']
          ? { containerAxisAlignment: row['Orientation constrained'], mappingStatus: 'CORE_EXTENSION_PENDING_SOLVER_SUPPORT' }
          : { mode: 'FREE', mappingStatus: 'SUPPORTED' },
        containerDefinition: containers, sourceFields: { ...row, itemCodes: ids, units: { dimensions: 'mm', weight: 'kg' } },
        unknownFields: ['stackability', 'maxStackLayers', 'hazardous', 'palletAttached', 'destination', 'deliveryStage']
      }));
      instances.push({ id: instanceId, label: `${setName} / ${entry.name}`, source, setName, rawPath: `${setName}/${entry.name}`, items, containers, multiContainer: containers.length > 1, completeness: 54, missingFields: ['stackability', 'hazardous', 'destination', 'deliveryStage'] });
    }
  }
  return { source, displayName: 'Renault / ESICUP 多集装箱工业基准', dataClassification: 'INDUSTRIAL_SUPPLIED_BENCHMARK', instances };
}

async function buildOrtec() {
  const source = 'ortec_alonso_2019';
  const base = path.join(RAW, source);
  const instanceFiles = (await readdir(base)).filter((name) => /^inst3d\d+\.csv$/i.test(name)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const instances = [];
  for (const file of instanceFiles) {
    const lines = (await text(path.join(base, file))).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let cursor = 0;
    const section = (name, width) => {
      const header = lines[cursor++].split(/\s+/); if (header[0].toLowerCase() !== `#${name}`) throw new Error(`${file}: expected #${name}`);
      const count = Number(header[1]); const rows = lines.slice(cursor, cursor + count).map((line) => line.split(/\s+/).slice(0, width).map(Number)); cursor += count; return rows;
    };
    const products = section('products', 14), layers = section('layers', 8), pallets = section('pallets', 5), trucks = section('trucks', 9);
    const layerById = new Map(layers.map((layer) => [layer[0], layer]));
    const items = products.map((v) => {
      const rotations = { x: Boolean(v[7]), y: Boolean(v[8]), z: Boolean(v[9]) };
      const referencedLayer = layerById.get(v[13]) || null;
      return externalItem({ externalSource: 'ORTEC / Alonso 2019', externalDataset: 'alonso_2019', externalInstance: file.replace('.csv', ''), externalItemId: String(v[0]), name: `ORTEC product ${v[0]}`, packagingType: null,
        lengthMm: v[4], widthMm: v[3], heightMm: v[5], weightKg: v[6], quantity: v[2], orientationConstraints: rotations,
        stackability: 'UNKNOWN', maxStackLayers: null,
        alwaysOnTop: Boolean(v[11]), alwaysOnBottom: Boolean(v[12]), stackingGroup: String(v[10]), deliveryStage: null, containerDefinition: { type: 'INDUSTRIAL_LOGISTICS_VEHICLE', trucks },
        sourceFields: { productIdentifier: v[0], deliveryDay: v[1], demand: v[2], widthMm: v[3], lengthMm: v[4], heightMm: v[5], weightKg: v[6], rotationX: v[7], rotationY: v[8], rotationZ: v[9], stackingGroup: v[10], alwaysOnTop: v[11], alwaysOnBottom: v[12], layerDefinition: v[13], referencedLayerDefinition: referencedLayer, units: { dimensions: 'mm', weight: 'kg' } },
        unknownFields: ['packagingType', 'stackability', 'maxStackLayers', 'loadBearing', 'hazardous', 'palletAttached', 'destination', 'deliveryStage'] });
    });
    instances.push({ id: `ortec-${file.replace('.csv', '')}`, label: file.replace('.csv', ''), source, rawPath: file, items, layers, pallets, trucks, multiContainer: trucks.length > 1, vehicleSemantics: '工业物流车辆基准 / 非海运标准柜', completeness: 69, missingFields: ['packagingType', 'loadBearing', 'hazardous', 'destination'] });
  }
  return { source, displayName: 'ORTEC 真实工业物流实例（111组）', dataClassification: 'REAL_INDUSTRIAL_LOGISTICS', sourceNotice: '工业物流车辆基准 / 非海运标准柜', instances };
}

function tokensOf(value) { return value.trim().split(/\s+/).map(Number); }
async function buildThpack() {
  const source = 'orlib_thpack', instances = [];
  for (let family = 1; family <= 9; family += 1) {
    const lines = (await text(path.join(RAW, source, `thpack${family}.txt`))).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let c = 0;
    const count = Number(lines[c++]);
    for (let p = 0; p < count; p += 1) {
      const header = lines[c++].split(/\s+/).map(Number);
      const problem = header[0], seed = family <= 7 ? header[1] : null;
      const dimensions = lines[c++].split(/\s+/).map(Number);
      const container = { lengthOriginal: dimensions[0], widthOriginal: dimensions[1], heightOriginal: dimensions[2], originalUnit: family <= 7 ? 'cm' : 'NOT_PROVIDED' };
      const n = Number(lines[c++]), items = [];
      for (let i = 0; i < n; i += 1) {
        const v = lines[c++].split(/\s+/).map(Number);
        const unitKnown = family <= 7;
        const structurallyValid = v.length === 8 && v.every(Number.isFinite);
        items.push(externalItem({ externalSource: 'OR-Library THPACK', externalDataset: `thpack${family}`, externalInstance: String(problem), externalItemId: String(v[0]), name: `THPACK box ${v[0]}`, packagingType: null,
          lengthMm: structurallyValid && unitKnown ? v[1] * 10 : null, widthMm: structurallyValid && unitKnown ? v[3] * 10 : null, heightMm: structurallyValid && unitKnown ? v[5] * 10 : null, weightKg: null, quantity: Number.isFinite(v.at(-1)) ? v.at(-1) : null, orientationConstraints: structurallyValid ? { lengthVertical: Boolean(v[2]), widthVertical: Boolean(v[4]), heightVertical: Boolean(v[6]) } : null, containerDefinition: container,
          sourceFields: structurallyValid ? { boxType: v[0], length: { originalValue: v[1], originalUnit: unitKnown ? 'cm' : 'NOT_PROVIDED' }, width: { originalValue: v[3], originalUnit: unitKnown ? 'cm' : 'NOT_PROVIDED' }, height: { originalValue: v[5], originalUnit: unitKnown ? 'cm' : 'NOT_PROVIDED' }, indicators: [v[2], v[4], v[6]], quantity: v[7], seed } : { rawValues: v, seed, parseStatus: 'SOURCE_ROW_MALFORMED_ADAPTER_REQUIRED' },
          unknownFields: ['weightKg', 'packagingType', 'stackability', 'maxStackLayers', 'loadBearing', 'hazardous', 'palletAttached', 'destination', 'deliveryStage'].concat(unitKnown && structurallyValid ? [] : ['normalizedDimensions']).concat(structurallyValid ? [] : ['orientationConstraints']) }));
      }
      instances.push({ id: `thpack${family}-${problem}`, label: `thpack${family} / problem ${problem}`, source, family: `thpack${family}`, rawPath: `thpack${family}.txt`, items, container, multiContainer: family === 9, completeness: family <= 7 ? 38 : 25, missingFields: ['weight', 'packagingType', 'loadBearing', 'destination'].concat(family <= 7 ? [] : ['dimensionUnit']) });
    }
  }
  return { source, displayName: 'THPACK 3D Container Loading Benchmark', dataClassification: 'ACADEMIC_BENCHMARK', sourceNotice: '学术基准，不是企业真实订单', instances };
}

async function buildWtpack() {
  const source = 'orlib_wtpack', instances = [];
  for (let family = 1; family <= 7; family += 1) {
    const tokens = tokensOf(await text(path.join(RAW, source, `wtpack${family}.txt`))); let c = 0, problem = 1;
    while (c < tokens.length) {
      const container = { length: { originalValue: tokens[c++], originalUnit: 'cm' }, width: { originalValue: tokens[c++], originalUnit: 'cm' }, height: { originalValue: tokens[c++], originalUnit: 'cm' } };
      if (c >= tokens.length) break;
      const n = tokens[c++], totalCargoVolumeM3 = tokens[c++], items = [];
      for (let i = 0; i < n; i += 1) {
        const v = tokens.slice(c, c + 11); c += 11;
        items.push(externalItem({ externalSource: 'OR-Library WTPACK', externalDataset: `wtpack${family}`, externalInstance: String(problem), externalItemId: String(i + 1), name: `WTPACK box ${i + 1}`, packagingType: null,
          lengthMm: v[0] * 10, widthMm: v[2] * 10, heightMm: v[4] * 10, weightKg: v[7], quantity: v[6], orientationConstraints: { lengthVertical: Boolean(v[1]), widthVertical: Boolean(v[3]), heightVertical: Boolean(v[5]) },
          loadBearing: { lengthUpright: v[8], widthUpright: v[9], heightUpright: v[10] }, loadBearingUnit: 'kg/cm²', loadBearingSourceDefinition: 'Load bearing ability in kg/cm² for each dimension placed upright; not total supported weight.', containerDefinition: container,
          sourceFields: { dimensions: [{ originalValue: v[0], originalUnit: 'cm' }, { originalValue: v[2], originalUnit: 'cm' }, { originalValue: v[4], originalUnit: 'cm' }], indicators: [v[1], v[3], v[5]], quantity: v[6], weight: { originalValue: v[7], originalUnit: 'kg' }, pressure: { values: [v[8], v[9], v[10]], originalUnit: 'kg/cm²', definition: 'orientation-dependent load bearing ability' } },
          unknownFields: ['packagingType', 'stackability', 'maxStackLayers', 'hazardous', 'palletAttached', 'destination', 'deliveryStage', 'normalizedLoadBearingKg'] }));
      }
      instances.push({ id: `wtpack${family}-${problem}`, label: `wtpack${family} / problem ${problem}`, source, family: `wtpack${family}`, rawPath: `wtpack${family}.txt`, items, container, totalCargoVolumeM3, completeness: 62, missingFields: ['packagingType', 'stackability', 'destination', 'normalizedLoadBearingKg'] }); problem += 1;
    }
  }
  return { source, displayName: 'WTPACK 重量与承压基准', dataClassification: 'ACADEMIC_BENCHMARK', sourceNotice: '学术基准；承压原值为 kg/cm²，不等同于可承载总重量 kg', instances };
}

async function geometryMetadata(file) {
  const buffer = await readFile(file);
  const format = path.extname(file).slice(1).toUpperCase();
  const points = [];
  if (format === 'OBJ') {
    for (const line of buffer.toString('utf8').split(/\r?\n/)) {
      const match = line.trim().match(/^v\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
      if (match) points.push(match.slice(1, 4).map(Number));
    }
  } else if (format === 'STL') {
    const ascii = buffer.subarray(0, 80).toString('utf8').trimStart().startsWith('solid') && buffer.includes(Buffer.from('vertex'));
    if (ascii) {
      for (const match of buffer.toString('utf8').matchAll(/vertex\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)/gi)) points.push(match.slice(1, 4).map(Number));
    } else if (buffer.length >= 84) {
      const triangles = buffer.readUInt32LE(80);
      for (let triangle = 0; triangle < triangles; triangle += 1) {
        const base = 84 + triangle * 50 + 12;
        if (base + 36 > buffer.length) break;
        for (let vertex = 0; vertex < 3; vertex += 1) points.push([0, 4, 8].map((offset) => buffer.readFloatLE(base + vertex * 12 + offset)));
      }
    }
  }
  const finite = points.filter((point) => point.length === 3 && point.every(Number.isFinite));
  if (!finite.length) return { format, bytes: buffer.length, readable: true, vertexCount: 0, boundingBoxOriginal: null };
  const min = [0, 1, 2].map((axis) => Math.min(...finite.map((point) => point[axis])));
  const max = [0, 1, 2].map((axis) => Math.max(...finite.map((point) => point[axis])));
  return { format, bytes: buffer.length, readable: true, vertexCount: finite.length, boundingBoxOriginal: { min, max, size: max.map((value, axis) => value - min[axis]), originalUnit: 'NOT_PROVIDED' } };
}

async function buildIrregular() {
  const source = 'esicup_irregular', base = path.join(RAW, source);
  const definitions = [
    { id: 'irregular-liu-2015', label: 'Liu 2015 · 混合异形 OBJ', metadata: 'liu_2015/Experiment1.json', kind: 'industrial-shaped object' },
    { id: 'irregular-stoyan-2004', label: 'Stoyan 2004 · 非凸多面体', metadata: 'stoyan_2004_nonconvex/Example2.json', kind: 'non-convex geometry' },
    { id: 'irregular-egeblad-2009', label: 'Egeblad 2009 · 长薄件', metadata: 'egeblad_2009_long_thin/Merged1.json', kind: 'long/thin item' },
    { id: 'irregular-silva-2021', label: 'Silva 2021 · 工业形状 STL', asset: 'silva_2021_industrial_shape/banana.stl', kind: 'STL mesh based instance' }
  ];
  const instances = [];
  for (const def of definitions) {
    let itemTypes = def.metadata ? JSON.parse(await text(path.join(base, def.metadata)))['item-types'] : [{ path: def.asset, demand: 1 }];
    const items = [];
    for (const [index, item] of itemTypes.entries()) {
      const basename = path.basename(item.path); const candidates = await filesRecursively(base); const asset = candidates.find((file) => path.basename(file) === basename && file.toLowerCase().endsWith(path.extname(item.path).toLowerCase()));
      if (!asset) throw new Error(`${def.id}: missing geometry ${item.path}`);
      const geometry = await geometryMetadata(asset);
      items.push(externalItem({ externalSource: 'ESICUP 3D Irregular', externalDataset: def.kind, externalInstance: def.id, externalItemId: String(index + 1), name: basename, packagingType: null, quantity: item.demand, geometryType: 'MESH', geometryAsset: path.relative(base, asset).replaceAll('\\', '/'), boundingBox: geometry.boundingBoxOriginal, sourceGeometryMetadata: geometry, sourceFields: { demand: item.demand, sourcePath: item.path, bytes: geometry.bytes, readable: geometry.readable, geometryFormat: geometry.format }, unknownFields: ['lengthMm', 'widthMm', 'heightMm', 'weightKg', 'packagingType', 'stackability', 'loadBearing', 'handling', 'normalizedBoundingBoxMm'] }));
    }
    instances.push({ id: def.id, label: def.label, source, rawPath: def.metadata || def.asset, items, completeness: 23, missingFields: ['dimensions', 'weight', 'stackability', 'loadBearing', 'handling'], geometryReadability: 'VERIFIED' });
  }
  return { source, displayName: 'ESICUP 异形三维几何基准', dataClassification: 'IRREGULAR_GEOMETRY_BENCHMARK', sourceNotice: '仅验证几何资产可读；本批不支持任意 mesh 求解', instances };
}

async function manifestFor(dataset, details) {
  const base = path.join(RAW, dataset.source);
  const manifest = { sourceName: dataset.displayName, sourceType: details.sourceType, canonicalUrls: details.canonicalUrls, actualDownloadUrls: details.actualDownloadUrls, repository: details.repository || null, commitOrVersion: details.commitOrVersion || null, retrievedAt: RETRIEVED_AT, licenseOrUsageNotes: details.licenseOrUsageNotes, rawFiles: await rawFiles(dataset.source), sha256: 'Each rawFiles entry contains its SHA256', units: details.units, originalFieldDefinitions: details.originalFieldDefinitions, adapterVersion: ADAPTER_VERSION, dataClassification: dataset.dataClassification, downloadStatus: details.downloadStatus || 'DOWNLOADED', notes: details.notes || [] };
  await json(path.join(base, 'source-manifest.json'), manifest); return manifest;
}

async function writeDataset(dataset) {
  const target = path.join(NORMALIZED, dataset.source, 'instances.json');
  await json(target, { schema: 'PORTCUBE_EXTERNAL_CARGO/1.0', adapterVersion: ADAPTER_VERSION, ...dataset });
  return target;
}

async function main() {
  await ensure(NORMALIZED);
  await rm(path.join(WEB, 'instances'), { recursive: true, force: true });
  await ensure(path.join(WEB, 'instances'));
  const datasets = [await buildRenault(), await buildOrtec(), await buildThpack(), await buildWtpack(), await buildIrregular()];
  const detailMap = {
    renault_esicup_2015: { sourceType: 'git', canonicalUrls: CANONICAL.renault, actualDownloadUrls: ['https://gitlab.com/esicup-challenge-2015/data.git'], repository: 'https://gitlab.com/esicup-challenge-2015/data.git', commitOrVersion: '16e141f2c64e56cacbec11484d7f1d5203d4a9fc', licenseOrUsageNotes: 'Public challenge data supplied by Renault; repository has no explicit license file. Preserve attribution and review intended reuse.', units: { dimensions: 'mm', weight: 'kg' }, originalFieldDefinitions: ['item code', 'length (mm)', 'width (mm)', 'height (mm)', 'weight (kg)', 'Package material', 'Orientation constrained', 'Product', 'bin type and dimensions'], notes: ['checker.zip and visualization.zip retained as unexecuted validator/tool artifacts.', 'Global maximum weight above item parameter is preserved but not converted into an item-specific load-bearing field.'] },
    ortec_alonso_2019: { sourceType: 'git sparse-checkout', canonicalUrls: CANONICAL.ortec, actualDownloadUrls: ['https://github.com/ESICUP/datasets.git#3d_rectangular/alonso_2019'], repository: 'https://github.com/ESICUP/datasets.git', commitOrVersion: '154a8f006a8e72f65d734f2d1e36777f678f31f8', licenseOrUsageNotes: 'Public ESICUP benchmark repository; no top-level license file observed. Preserve publication attribution.', units: { dimensions: 'mm', weight: 'kg' }, originalFieldDefinitions: ['product identifier', 'delivery day', 'demand', 'width/length/height', 'weight', 'rotation X/Y/Z', 'stacking group', 'always on top/bottom', 'layer/pallet/truck definitions and axle limits'], notes: ['Truck definitions retain industrial vehicle semantics and are never labelled 20GP/40GP/40HQ.'] },
    orlib_thpack: { sourceType: 'HTTP files', canonicalUrls: CANONICAL.thpack, actualDownloadUrls: Array.from({ length: 9 }, (_, i) => `https://people.brunel.ac.uk/~mastjjb/jeb/orlib/files/thpack${i + 1}.txt`), commitOrVersion: 'OR-Library files dated 2004-09-07', licenseOrUsageNotes: 'Public academic benchmark files; preserve OR-Library and publication attribution.', units: { thpack1To7Dimensions: 'cm (cross-referenced by canonical WTPACK description)', thpack8To9Dimensions: 'NOT_PROVIDED', weight: 'NOT_PROVIDED' }, originalFieldDefinitions: ['problem and optional seed', 'container dimensions', 'box type', 'three dimensions and vertical-orientation indicators', 'quantity'], notes: ['No weight values are synthesized.', 'THPACK8/9 dimensions remain unnormalized because the canonical description does not provide a unit.'] },
    orlib_wtpack: { sourceType: 'HTTP files', canonicalUrls: CANONICAL.wtpack, actualDownloadUrls: Array.from({ length: 7 }, (_, i) => `https://people.brunel.ac.uk/~mastjjb/jeb/orlib/files/wtpack${i + 1}.txt`), commitOrVersion: 'OR-Library files dated 2004-09-10', licenseOrUsageNotes: 'Public academic benchmark files; preserve OR-Library and publication attribution.', units: { dimensions: 'cm', weight: 'kg', loadBearing: 'kg/cm²' }, originalFieldDefinitions: ['container length/width/height', 'box dimensions and vertical-orientation indicators', 'quantity', 'weight kg', 'orientation-dependent load bearing kg/cm²'], notes: ['Pressure values are preserved and never converted to PORTCUBE maximumSupportedWeightKg.'] },
    esicup_irregular: { sourceType: 'git sparse-checkout, representative subset', canonicalUrls: CANONICAL.irregular, actualDownloadUrls: ['https://github.com/ESICUP/datasets.git#3d_irregular'], repository: 'https://github.com/ESICUP/datasets.git', commitOrVersion: '154a8f006a8e72f65d734f2d1e36777f678f31f8', licenseOrUsageNotes: 'Public ESICUP collection; individual publication attribution retained. No top-level license file observed.', units: { geometryCoordinates: 'source-defined / not normalized', weight: 'UNKNOWN' }, originalFieldDefinitions: ['JSON container size-x/size-y', 'item-types path and demand', 'OBJ/STL geometry asset'], notes: ['Selected four representative datasets only.', 'Weight, stackability, load bearing, and handling remain UNKNOWN.'] }
  };
  const manifests = {};
  for (const dataset of datasets) { manifests[dataset.source] = await manifestFor(dataset, detailMap[dataset.source]); await writeDataset(dataset); }

  const pending = [
    { source: 'atlas_copco', displayName: 'Atlas Copco 真实海运集装箱业务', dataClassification: 'PENDING_EXTERNAL_SOURCE', status: 'METADATA_AVAILABLE_DATAFILE_NOT_PUBLICLY_RETRIEVED', canonicalUrls: CANONICAL.atlas, notes: ['Publisher returned HTTP 403 to direct retrieval.', 'Open author manuscript confirms Input50.csv metadata, 50 shipments and 1948 packages, but the actual CSV was not found in canonical/institutional/author/public searches.', 'No synthetic rows were created.'] },
    { source: 'beantech', displayName: 'BeanTech 多卸点多集装箱实例', dataClassification: 'PENDING_EXTERNAL_SOURCE', status: 'SOURCE_FOUND_DATASET_UNAVAILABLE', canonicalUrls: CANONICAL.beantech, notes: ['University publication pages are reachable.', 'Historical dataset URL now redirects to the lab homepage.', 'Public search and Internet Archive CDX query did not retrieve instance files; no instances were fabricated.'] }
  ];
  for (const item of pending) {
    const manifest = { sourceName: item.displayName, sourceType: 'publication metadata / historical dataset site', canonicalUrls: item.canonicalUrls, actualDownloadUrls: [], repository: null, commitOrVersion: null, retrievedAt: RETRIEVED_AT, licenseOrUsageNotes: 'Metadata only. Dataset file was not obtained.', rawFiles: await rawFiles(item.source), sha256: 'Each rawFiles entry contains its SHA256', units: {}, originalFieldDefinitions: item.source === 'atlas_copco' ? ['Problem', 'Stage', 'Package', 'StandardSize', 'Weight kg', 'OuterLength/Width/Height m', 'OuterVolume cbm', 'HazardousContent', 'PalletAttached'] : [], adapterVersion: ADAPTER_VERSION, dataClassification: item.dataClassification, downloadStatus: item.status, notes: item.notes };
    await json(path.join(RAW, item.source, 'source-manifest.json'), manifest); manifests[item.source] = manifest;
    await json(path.join(NORMALIZED, item.source, 'status.json'), { schema: 'PORTCUBE_EXTERNAL_CARGO/1.0', ...item, retrievedAt: RETRIEVED_AT });
  }

  const catalog = { schema: 'PORTCUBE_EXTERNAL_CATALOG/1.0', generatedAt: RETRIEVED_AT, datasets: [], pending: pending.map(({ source, displayName, dataClassification, status, notes }) => ({ source, displayName, dataClassification, status, notes })) };
  for (const dataset of datasets) {
    const summaries = [];
    for (const instance of dataset.instances) {
      const instanceFile = `${dataset.source}__${instance.id.replace(/[^a-z0-9_-]/gi, '_')}.json`;
      await json(path.join(WEB, 'instances', instanceFile), { schema: 'PORTCUBE_EXTERNAL_CARGO/1.0', source: dataset.source, displayName: dataset.displayName, dataClassification: dataset.dataClassification, sourceNotice: dataset.sourceNotice || null, ...instance });
      summaries.push({ ...summarize(instance), instanceUrl: `/data/external/instances/${instanceFile}` });
    }
    catalog.datasets.push({ source: dataset.source, displayName: dataset.displayName, dataClassification: dataset.dataClassification, sourceNotice: dataset.sourceNotice || null, instanceCount: dataset.instances.length, instances: summaries });
  }
  await json(path.join(WEB, 'catalog.json'), catalog);
  await json(path.join(ROOT, 'data/external/manifest.json'), { schema: 'PORTCUBE_EXTERNAL_MANIFEST/1.0', generatedAt: RETRIEVED_AT, adapterVersion: ADAPTER_VERSION, sources: [...datasets.map((dataset) => ({ source: dataset.source, displayName: dataset.displayName, dataClassification: dataset.dataClassification, instanceCount: dataset.instances.length, downloadStatus: 'DOWNLOADED', sourceManifest: `raw/${dataset.source}/source-manifest.json`, normalized: `normalized/${dataset.source}/instances.json` })), ...pending.map((item) => ({ source: item.source, displayName: item.displayName, dataClassification: item.dataClassification, instanceCount: 0, downloadStatus: item.status, sourceManifest: `raw/${item.source}/source-manifest.json`, normalized: `normalized/${item.source}/status.json` }))] });
  console.log(JSON.stringify({ datasets: catalog.datasets.map((dataset) => ({ source: dataset.source, instances: dataset.instanceCount })), pending: catalog.pending }, null, 2));
}

await main();
