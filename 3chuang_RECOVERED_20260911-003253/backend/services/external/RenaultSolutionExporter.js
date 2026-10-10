'use strict';
const fs=require('fs'),path=require('path');
// Validation-only output. This exporter never generates, moves or repacks cargo.
// It accepts the production solver's equal-footprint single-item-layer subset.
function exportRenaultSolution({task,binPlans,outputDirectory,allowIncomplete=false}){
  if(task.source!=='renault_esicup_2015')throw Error('Renault source required');
  const expected=new Set(task.cargoList.flatMap(c=>c.externalMetadata.sourceFields.itemCodes)),seen=new Set();
  const bins=[['bin','type']],stacks=[['stack','bin','x0','y0','z0','x1','y1','z1']],layers=[['layer','stack','x0','y0','z0','x1','y1','z1','top']],rows=[['row','layer','x0','y0','z0','x1','y1','z1']],items=[['item','row','x0','y0','z0','x1','y1','z1']];
  let stackIndex=0,itemIndex=0;
  const coords=p=>[p.x,p.z,p.y,p.x+p.l,p.z+p.w,p.y+p.h];
  for(const bin of binPlans){
    bins.push([bin.id,bin.container.sourceType]);
    const columns=new Map();
    for(const p of bin.placements){
      if(!expected.has(p.sourcePhysicalItemId)||seen.has(p.sourcePhysicalItemId))throw Error('Source physical item identity mismatch');seen.add(p.sourcePhysicalItemId);
      if(coords(p).some(v=>!Number.isInteger(v)))throw Error('Official checker requires integer millimetres; exporter does not round source placement');
      const key=[p.x,p.z,p.l,p.w].join(':');if(!columns.has(key))columns.set(key,[]);columns.get(key).push(p);
    }
    for(const column of columns.values()){
      column.sort((a,b)=>a.y-b.y);const bottom=column[0],top=column.at(-1),stackId=`S${++stackIndex}`;
      if(bottom.y!==0||column.some((p,i)=>i>0&&p.y!==column[i-1].y+column[i-1].h))throw Error('Plan does not form a contiguous supported column');
      stacks.push([stackId,bin.id,...coords({...bottom,h:top.y+top.h})]);
      for(let i=0;i<column.length;i++){
        const p=column[i],layerId=`L${++itemIndex}`,rowId=`R${itemIndex}`;
        layers.push([layerId,stackId,...coords(p),i===column.length-1?1:0]);rows.push([rowId,layerId,...coords(p)]);items.push([p.sourcePhysicalItemId,rowId,...coords(p)]);
      }
    }
  }
  const missing=[...expected].filter(id=>!seen.has(id));
  if(missing.length&&!allowIncomplete)throw Object.assign(new Error('Full checker export requires every source item, including unshipped bin 0'),{code:'INCOMPLETE_INSTANCE',missingPhysicalIds:missing});
  fs.mkdirSync(outputDirectory,{recursive:true});
  for(const [name,data] of Object.entries({bins,stacks,layers,rows,items}))fs.writeFileSync(path.join(outputDirectory,`${name}.csv`),data.map(row=>row.join(';')+';').join('\n')+'\n');
  return {source:task.source,instanceId:task.instanceId,expectedCount:expected.size,exportedCount:seen.size,missingPhysicalIds:missing,complete:missing.length===0,bins:binPlans.map(b=>({id:b.id,type:b.container.sourceType,pieces:b.placements.length})),coordinateMapping:'internal X/Y/Z -> checker X/Z/Y',placementMutations:0};
}
module.exports={exportRenaultSolution};
