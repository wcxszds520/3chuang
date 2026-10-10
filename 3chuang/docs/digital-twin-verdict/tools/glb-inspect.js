const fs = require('fs');
function inspect(p) {
  const b = fs.readFileSync(p);
  let off = 12, json = null, binLen = 0;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    if (type === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8'));
    else if (type === 0x004E4942) binLen = len;
    off += 8 + len;
  }
  const j = json || {};
  const meshes = (j.meshes || []).length;
  const prims = (j.meshes || []).reduce((a, m) => a + (m.primitives || []).length, 0);
  let verts = 0, tris = 0;
  (j.meshes || []).forEach(m => (m.primitives || []).forEach(pr => {
    const pa = j.accessors[pr.attributes.POSITION]; if (pa) verts += pa.count;
    if (pr.indices != null) { const ia = j.accessors[pr.indices]; if (ia) tris += ia.count / 3; }
  }));
  const mats = (j.materials || []).length;
  const texs = (j.textures || []).length;
  const anims = (j.animations || []).length;
  const skins = (j.skins || []).length;
  let texUsed = 0;
  (j.materials || []).forEach(m => {
    const pbr = m.pbrMetallicRoughness || {};
    if (pbr.baseColorTexture) texUsed++;
    if (pbr.metallicRoughnessTexture) texUsed++;
    if (m.normalTexture) texUsed++;
    if (m.emissiveTexture) texUsed++;
    if (m.occlusionTexture) texUsed++;
  });
  const imgSizes = (j.images || []).map(i => (i.bufferView != null && j.bufferViews[i.bufferView])
    ? (j.bufferViews[i.bufferView].byteLength / 1024).toFixed(0) + 'KB'
    : (i.mimeType || '?'));
  return {
    file: p.split(/[\\/]/).pop(),
    sizeKB: (b.length / 1024).toFixed(0),
    meshes, prims, verts, tris: Math.round(tris), mats,
    texRefs: texUsed, texs, anims, skins, binMB: (binLen / 1048576).toFixed(2),
    images: imgSizes.join('|') || '-'
  };
}
const list = process.argv.slice(2);
if (list.length === 0) {
  console.log('Usage: node glb-inspect.js <file.glb> [more.glb ...]');
  process.exit(0);
}
console.log(['file','sizeKB','mesh','prim','verts','tris','mat','texRefs','tex','anim','skin','binMB','imageData'].join('\t'));
list.forEach(p => {
  try { const r = inspect(p); console.log([r.file,r.sizeKB,r.meshes,r.prims,r.verts,r.tris,r.mats,r.texRefs,r.texs,r.anims,r.skins,r.binMB,r.images].join('\t')); }
  catch (e) { console.log(p + '\tERR ' + e.message); }
});
