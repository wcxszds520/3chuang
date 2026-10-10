'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'../..'),publicRoot=path.join(root,'web-dashboard/public/assets/3d/commerce-v4');
let queue=Promise.resolve();
function runtimeAsset(outputRoot,id){
 const file=path.join(outputRoot,'manifest.json'),data=JSON.parse(fs.readFileSync(file,'utf8'));
 const row=data.assets.find(a=>a.id===id);if(!row)throw Error('模型索引未生成');
 const ready=require('./packagingRuntimeAssets').exportRuntime(outputRoot,row);
 // Newly generated assets keep their intact UVs until an authored overview is available.
 ready.lodUrl=ready.url;ready.runtimeLodUrl=ready.runtimeUrl;ready.lodTriangles=ready.triangles;ready.lodMethod='FULL_DETAIL_SAFE_FALLBACK';
 data.assets=data.assets.map(a=>a.id===id?ready:a);fs.writeFileSync(file,JSON.stringify(data,null,2));return ready;
}
function manifest(version='commerce-v4'){const f=path.join(root,'web-dashboard/public/assets/3d',version,'manifest.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):{version:'commerce-v4',assets:[]};}
async function buildAsset(input){
 const job=async()=>{
  const {PACKAGING_CATALOG}=await import('../../shared/commercePackaging.mjs');
  const template=String(input.template||'');if(!PACKAGING_CATALOG.some(p=>p.templates.includes(template))||template==='custom')throw Error('请选择可生成的包装结构');
  const version=input.version==='commerce-v6'||template==='fibc'?'commerce-v6':'commerce-v4';const outputRoot=path.join(root,'web-dashboard/public/assets/3d',version);
  const dimensions=(input.dimensionsMm||[]).map(Number);if(dimensions.length!==3||dimensions.some(d=>!Number.isFinite(d)||d<100||d>14000||Math.round(d*1000)!==d*1000))throw Error('外尺寸应为 100–14000 mm，最多三位小数');
  const id=template+'_'+dimensions.join('_'),cached=manifest(version).assets.find(a=>a.id===id);if(cached?.runtimeUrl)return cached;if(cached)return runtimeAsset(outputRoot,id);
  const dir=path.join(root,'artifacts/commerce-v4-20260915/asset-requests');fs.mkdirSync(dir,{recursive:true});const request=path.join(dir,id+'.json');
  fs.writeFileSync(request,JSON.stringify({template,dimensionsMm:dimensions,title:String(input.title||template).slice(0,100)}));
  await new Promise((resolve,reject)=>{const p=spawn(process.env.PORTCUBE_BLENDER||'D:\\blender\\blender.exe',['--background','--factory-startup','--threads','2','--python',path.join(root,'assets-src/blender',version,'build.py'),'--',request],{windowsHide:true});let output='';p.stdout.on('data',d=>{output+=d;});p.stderr.on('data',d=>{output+=d;});const timer=setTimeout(()=>{p.kill();reject(Error('包装建模超时'));},180000);p.on('error',e=>{clearTimeout(timer);reject(e);});p.on('close',code=>{clearTimeout(timer);fs.writeFileSync(path.join(dir,id+'.log'),output);code===0?resolve():reject(Error('Blender 包装生成失败，请查看构建记录'));});});
  return runtimeAsset(outputRoot,id);
 };
 const result=queue.then(job);queue=result.catch(()=>{});return result;
}
module.exports={manifest,buildAsset};
