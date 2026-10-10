import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'all';
const apiPort = process.env.PORTCUBE_API_PORT || '13000';
const webPort = process.env.PORTCUBE_WEB_PORT || '14173';
const children = [];
function run(entry, cwd, env) {
  const child = spawn(process.execPath, entry, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('exit', code => { if (code) process.exitCode = code; });
}
if (mode === 'all' || mode === 'backend') run(['server.js'], path.join(root, 'backend'), {
  PORT: apiPort,
  DB_NAME: 'portcube_master_rebuild_20260922', EXPECTED_DB_NAME: 'portcube_master_rebuild_20260922'
});
if (mode === 'all' || mode === 'web') run(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', webPort, '--strictPort'], path.join(root, 'web-dashboard'), {
  PORTCUBE_API_TARGET: `http://127.0.0.1:${apiPort}`
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { for (const child of children) child.kill(); });
console.log(`PORTCUBE: http://127.0.0.1:${webPort}/ | API http://127.0.0.1:${apiPort}/api/health | isolated database`);
