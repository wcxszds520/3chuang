const fs=require('fs');const {createRequire}=require('module');const req=createRequire('D:/cixing/3chuang_RECOVERED_20260911-003253/backend/package.json');
const cfg=JSON.parse(fs.readFileSync(__dirname+'/isolated-env.local.json','utf8'));
(async()=>{const c=await req('mysql2/promise').createConnection({host:cfg.DB_HOST,port:Number(cfg.DB_PORT),user:cfg.DB_USER,password:cfg.DB_PASSWORD,database:cfg.DB_NAME});
 const [rows]=await c.query("SELECT plan_id,created_at,JSON_UNQUOTE(JSON_EXTRACT(plan_data,'$.ext_placementHash')) AS placement_hash FROM packing_plan WHERE total_cargo_count=212 AND created_at < '2026-09-10 17:26:56' ORDER BY created_at DESC LIMIT 10");
 const [matched]=await c.query("SELECT plan_id,created_at,plan_data FROM packing_plan WHERE total_cargo_count=212 AND created_at < '2026-09-10 17:26:56' AND JSON_UNQUOTE(JSON_EXTRACT(plan_data,'$.ext_placementHash'))='155f34bf236fc0c8' ORDER BY created_at DESC");
 for(const item of matched)fs.writeFileSync(__dirname+'/historical-plan-'+item.plan_id+'.json',JSON.stringify(item,null,2));
 const [grants]=await c.query('SHOW GRANTS');
 const report={checkedAt:new Date().toISOString(),database:cfg.DB_NAME,old212Records:rows,matchingHistoricalPlanIds:matched.map(x=>x.plan_id),isolatedPrivileges:grants};fs.writeFileSync(__dirname+'/old-record-search.json',JSON.stringify(report,null,2));await c.end();console.log(JSON.stringify({old212Records:rows,matchingHistoricalPlanIds:matched.map(x=>x.plan_id)}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
