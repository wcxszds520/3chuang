'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
// Lossless transport packaging only. Geometry bytes and image bytes are copied
// exactly from Blender's GLB; common texture payloads receive one cacheable URL.
function exportRuntime(root,asset){
 const file=path.join(root,asset.id+'.glb'),glb=fs.readFileSync(file);
 const n=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+n).toString('utf8'));
 if(doc.extensionsUsed?.some(x=>/compression|draco|meshopt/.test(x)))throw Error('Unsupported compressed buffer layout');
 const binStart=20+n+8,source=glb.subarray(binStart),images=new Map(),folder=path.join(root,'textures');fs.mkdirSync(folder,{recursive:true});
 for(const im of doc.images||[]){if(im.bufferView==null)continue;const v=doc.bufferViews[im.bufferView],bytes=source.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),hash=crypto.createHash('sha256').update(bytes).digest('hex'),ext=im.mimeType==='image/jpeg'?'jpg':'png',name=hash+'.'+ext;
  const target=path.join(folder,name);if(!fs.existsSync(target))fs.writeFileSync(target,bytes);images.set(im.bufferView,true);delete im.bufferView;im.uri='textures/'+name;
 }
 const remap=new Map(),views=[],parts=[];let offset=0;
 for(const [i,v] of doc.bufferViews.entries()){if(images.has(i))continue;const bytes=source.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);remap.set(i,views.length);views.push({...v,buffer:0,byteOffset:offset});parts.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}}
 for(const a of doc.accessors||[]){if(a.bufferView!=null)a.bufferView=remap.get(a.bufferView);if(a.sparse){a.sparse.indices.bufferView=remap.get(a.sparse.indices.bufferView);a.sparse.values.bufferView=remap.get(a.sparse.values.bufferView);}}
 doc.bufferViews=views;doc.buffers=[{byteLength:offset,uri:asset.id+'.bin'}];fs.writeFileSync(path.join(root,asset.id+'.bin'),Buffer.concat(parts));fs.writeFileSync(path.join(root,asset.id+'.gltf'),JSON.stringify(doc));
 return {...asset,runtimeUrl:'/assets/3d/'+path.basename(root)+'/'+asset.id+'.gltf',runtimeGeometryBytes:offset};
}
function prepareRuntime(root){const file=path.join(root,'manifest.json'),data=JSON.parse(fs.readFileSync(file));data.assets=data.assets.map(a=>exportRuntime(root,a));fs.writeFileSync(file,JSON.stringify(data,null,2));return data;}
module.exports={exportRuntime,prepareRuntime};
