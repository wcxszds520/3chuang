import { readFileSync } from 'node:fs';
import { UnloadMachine } from '../web-dashboard/src/three/operation/unloadMachine.js';
const plan=JSON.parse(readFileSync('tmp/realism-worksite.json'));
const m=new UnloadMachine(plan);m.play();
for(let i=0;i<70000 && !['COMPLETED','BLOCKED'].includes(m.phase);i++)m.tick(.1);
const s=m.getSnapshot();
console.log(JSON.stringify({phase:s.phase,completed:s.completedCount,total:s.total,sku:s.currentCargo?.sku,reasons:s.blockedReasons,remaining:m.remaining().length,staged:s.placedCargo.length},null,2));
