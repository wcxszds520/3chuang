const fs=require('fs');const path=require('path');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'isolated-env.local.json'),'utf8'));
if(config.DB_NAME!=='portcube_recovery_20260911_003253'||config.PORT!=='13000')throw new Error('Isolation guard failed');
const backend='D:/cixing/3chuang_RECOVERED_20260911-003253/backend';
if(fs.existsSync(path.join(backend,'.env')))throw new Error('Unexpected .env: isolate configuration before startup');
Object.assign(process.env,config);process.chdir(backend);require(path.join(backend,'server.js'));
