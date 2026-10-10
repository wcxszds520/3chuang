const http=require('http');const fs=require('fs');const path=require('path');
const root='D:/cixing/3chuang_RECOVERED_20260911-003253/web-dashboard/dist';
const snapshot='D:/cixing/3chuang_PRESERVED_20260911-003253/project/tmp/rebuild-start-20260910-172656/legacy-212-before.json';
const sourceSession=JSON.parse(fs.readFileSync(snapshot,'utf8')).session;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf','.mp4':'video/mp4'};
const access=fs.createWriteStream(path.join(__dirname,'http-access.jsonl'),{flags:'a'});
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Portcube-Recovery-Root',root);
 if(req.url.startsWith('/api/')){const proxy=http.request({hostname:'127.0.0.1',port:13000,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:13000'}},up=>{res.writeHead(up.statusCode,up.headers);up.pipe(res)});proxy.on('error',()=>{res.statusCode=502;res.end('Isolated backend unavailable')});req.pipe(proxy);return;}
 if(req.url==='/_recovery-import-historical-212'){
  const saved=JSON.parse(fs.readFileSync(path.join(__dirname,'historical-212-storage.json'),'utf8'));
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>恢复已核实的历史212方案</title><script>localStorage.setItem('+JSON.stringify(saved.key)+','+JSON.stringify(saved.value).replace(/</g,'\\u003c')+');location.replace("/workspace/twin");</script>');return;
 }
 if(req.url==='/_recovery-import-212'){
  // Restore the exact archived initial session; its standalone solver result is not mislabeled as a saved backend plan.
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>恢复212件案例输入</title><script>localStorage.setItem("portcube.web.session.v1",'+JSON.stringify(JSON.stringify(sourceSession)).replace(/</g,'\\u003c')+');location.replace("/workspace/twin");</script>');return;
 }
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.statusCode=400;res.end();return}
 let file=path.resolve(root,'.'+pathname);if(!file.startsWith(path.resolve(root)+path.sep)&&file!==path.resolve(root)){res.statusCode=403;res.end();return}
 if(!path.extname(pathname))file=path.join(root,'index.html');
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.statusCode=404;res.end('Not found');access.write(JSON.stringify({path:pathname,status:404})+'\n');return}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',stat.size);access.write(JSON.stringify({path:pathname,status:200,file,bytes:stat.size})+'\n');fs.createReadStream(file).pipe(res)});
});server.listen(14173,'127.0.0.1',()=>console.log('Recovered static build: http://127.0.0.1:14173/'));
