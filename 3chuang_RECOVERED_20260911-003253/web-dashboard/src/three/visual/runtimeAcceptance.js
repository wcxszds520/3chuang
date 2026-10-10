import * as THREE from 'three';

// Development acceptance helper. It never writes cargo, placements or plans.
export const TONE_MAPPINGS = { NEUTRAL: THREE.NeutralToneMapping, AGX: THREE.AgXToneMapping, ACES: THREE.ACESFilmicToneMapping };
export function tuneRuntime(runtime, { toneMapping, exposure, cargoEnvironment, containerEnvironment, actorEnvironment } = {}) {
  if (toneMapping) runtime.renderer.toneMapping = TONE_MAPPINGS[toneMapping];
  if (exposure !== undefined) runtime.renderer.toneMappingExposure = exposure;
  const tuneRoot = (root, value) => { if (value === undefined) return; root?.traverse(node => { if (!node.isMesh) return; for (const m of Array.isArray(node.material) ? node.material : [node.material]) m.envMapIntensity = value; }); };
  for (const batch of runtime.placedBatches.values()) tuneRoot(batch.mesh, cargoEnvironment);
  tuneRoot(runtime.heroContainer, containerEnvironment);
  tuneRoot(runtime.forklift.group, actorEnvironment); tuneRoot(runtime.worker.group, actorEnvironment); tuneRoot(runtime.jackAsset, actorEnvironment);
  runtime.renderer.shadowMap.needsUpdate = true;
  return runtimeReport(runtime);
}
export function runtimeReport(runtime) {
  const materials=[];
  runtime.scene.traverse(n=>{if(!n.isMesh)return;for(const m of Array.isArray(n.material)?n.material:[n.material]){
    if(materials.some(row=>row.uuid===m.uuid))continue;
    materials.push({uuid:m.uuid,name:m.name,color:m.color?.getHexString(),roughness:m.roughness,metalness:m.metalness,environment:m.envMapIntensity,transparent:m.transparent,depthWrite:m.depthWrite,side:m.side,
      textures:Object.entries(m).filter(([,t])=>t?.isTexture).map(([slot,t])=>({slot,name:t.name,colorSpace:t.colorSpace,anisotropy:t.anisotropy,width:t.image?.width,height:t.image?.height}))});
  }});
  const plan=runtime.machine.plan;
  return {camera:{position:runtime.camera.position.toArray(),quaternion:runtime.camera.quaternion.toArray(),target:runtime.controls.target.toArray(),fov:runtime.camera.fov,aspect:runtime.camera.aspect},
    renderer:{toneMapping:runtime.renderer.toneMapping,exposure:runtime.renderer.toneMappingExposure,maxAnisotropy:runtime.renderer.capabilities.getMaxAnisotropy(),pixelRatio:runtime.renderer.getPixelRatio()},
    plan:{requestId:plan.requestId ?? plan.planId,planId:plan.planId,caseId:plan.caseId,placementHash:plan.placementHash ?? plan.ext_placementHash,loadedCount:plan.loadedCargo?.length},materials};
}
