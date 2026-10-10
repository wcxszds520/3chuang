import * as THREE from 'three';

export function diagnosticFacts(plan, container) {
  const cargo=plan.loadedCargo||[],floor=cargo.filter(p=>Number(p.y)<=.001);
  const edges=[...new Set(floor.flatMap(p=>[Number(p.z),Number(p.z)+Number(p.w)]))].sort((a,b)=>a-b),lanes=[];
  for(let i=0;i<edges.length-1;i++){
    const present=floor.filter(p=>p.z<edges[i+1]-.000001&&p.z+p.w>edges[i]+.000001);
    if(present.length)lanes.push({fromZMm:edges[i],toZMm:edges[i+1],offsetMm:Math.min(...present.map(p=>p.x))});
  }
  const width=lanes.reduce((s,l)=>s+l.toZMm-l.fromZMm,0);let sum=0,primary=0;
  for(const l of [...lanes].sort((a,b)=>a.offsetMm-b.offsetMm)){sum+=l.toZMm-l.fromZMm;if(sum>=width*.9){primary=l.offsetMm;break;}}
  const weight=cargo.reduce((s,p)=>s+Number(p.weight),0);
  const cog=weight?{x:cargo.reduce((s,p)=>s+p.weight*(p.x+p.l/2),0)/weight,y:cargo.reduce((s,p)=>s+p.weight*(p.y+p.h/2),0)/weight,z:cargo.reduce((s,p)=>s+p.weight*(p.z+p.w/2),0)/weight}:{x:0,y:0,z:0};
  return {lanes,primary,cog,offsetMm:cog.x-container.innerLength/2};
}
export function createAlgorithmDiagnostics(plan, container) {
  const group=new THREE.Group();group.name='algorithm-diagnostics';group.visible=false;
  const {lanes,primary,cog}=diagnosticFacts(plan,container);
  const toWorld=(x,y,z)=>new THREE.Vector3((x-container.innerLength/2)/1000,y/1000,(z-container.innerWidth/2)/1000);
  function line(points,color){const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>toWorld(...p))),new THREE.LineBasicMaterial({color,depthTest:false}));mesh.renderOrder=100;group.add(mesh);}
  line([[0,0,0],[0,container.innerHeight,0],[0,container.innerHeight,container.innerWidth],[0,0,container.innerWidth],[0,0,0]],'#00d9ff');
  for(const lane of lanes){const z=(lane.fromZMm+lane.toZMm)/2;line([[0,25,z],[lane.offsetMm,25,z],[lane.offsetMm,200,z]],'#ffbd66');}
  line([[0,50,container.innerWidth/2],[primary,50,container.innerWidth/2]],'#ff5577');
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),new THREE.MeshBasicMaterial({color:'#ff5577',depthTest:false}));
  dot.position.copy(toWorld(cog.x,cog.y,cog.z));dot.renderOrder=101;group.add(dot);
  for(const box of plan.metrics?.exactVoid?.majorVoidBoundingBoxes||[]){
    const geometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(box.l/1000,box.h/1000,box.w/1000));
    const wire=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#ffbd66',transparent:true,opacity:.5}));
    wire.position.copy(toWorld(box.x+box.l/2,box.y+box.h/2,box.z+box.w/2));group.add(wire);
  }
  return group;
}
