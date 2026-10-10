import * as THREE from 'three';

const vector = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);

export function bindWorkerRig(scene) {
  scene.updateWorldMatrix(true,true);
  const pelvis=scene.getObjectByName('worker_pelvis');
  if(!pelvis) return null;
  const limb = (side,kind,joint,end) => {
    const upper=scene.getObjectByName(`worker_${side}_${kind}_pivot`);
    const lower=scene.getObjectByName(`worker_${side}_${joint}_pivot`);
    const tip=scene.getObjectByName(`worker_${side}_${end}`);
    if(!upper || !lower || !tip)return null;
    return {upper,lower,tip,axisA:lower.position.clone().normalize(),axisB:tip.position.clone().normalize(),
      lengthA:upper.getWorldPosition(vector()).distanceTo(lower.getWorldPosition(vector())),
      lengthB:lower.getWorldPosition(vector()).distanceTo(tip.getWorldPosition(vector())),
      restTip:scene.worldToLocal(tip.getWorldPosition(vector())),tipRotation:tip.getWorldQuaternion(new THREE.Quaternion())};
  };
  return {scene,pelvis,pelvisHome:pelvis.position.clone(),arms:['left','right'].map(s=>limb(s,'arm','elbow','hand')),
    legs:['left','right'].map(s=>limb(s,'leg','knee','foot')),sceneHomeRotation:scene.getWorldQuaternion(new THREE.Quaternion())};
}

// Analytic two-bone chain. No scaling of the person or stretching of the limbs.
export function solveTwoBone(chain,target,pole) {
  if(!chain)return;
  const {upper,lower,tip,lengthA:a,lengthB:b,axisA,axisB}=chain;
  upper.updateWorldMatrix(true,true);
  const origin=upper.getWorldPosition(vector());
  const toward=target.clone().sub(origin);
  const distance=THREE.MathUtils.clamp(toward.length(),Math.abs(a-b)+.0001,a+b-.0001);
  toward.normalize();
  const bend=pole.clone().sub(origin);
  bend.addScaledVector(toward,-bend.dot(toward)).normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance);
  const elbow=origin.clone().addScaledVector(toward,along).addScaledVector(bend,Math.sqrt(Math.max(0,a*a-along*along)));
  const rotate=(bone,axis,direction)=>{
    const parentRotation=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.setFromUnitVectors(axis,direction.normalize().applyQuaternion(parentRotation));
    bone.updateWorldMatrix(false,true);
  };
  rotate(upper,axisA,elbow.sub(origin));
  const joint=lower.getWorldPosition(vector());
  rotate(lower,axisB,target.clone().sub(joint));
  tip.updateWorldMatrix(false,true);
}

export function poseArticulatedWorker(rig,{handTargets=null,groundAt=()=>0,moving=false,distanceM=0}) {
  if(!rig)return;
  const {scene,pelvis}=rig;
  scene.updateWorldMatrix(true,true);
  const localTargets=handTargets?.map(target=>scene.worldToLocal(target.clone()));
  const targetHeight=localTargets?.reduce((sum,p)=>sum+p.y,0)/2;
  const crouch=Number.isFinite(targetHeight)?THREE.MathUtils.clamp((.9-targetHeight)*.8,0,.61):0;
  const parentInverse=pelvis.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  const down=vector(0,-crouch,0).applyQuaternion(parentInverse);
  pelvis.position.copy(rig.pelvisHome).add(down);
  scene.updateWorldMatrix(true,true);
  const rotationDelta=scene.getWorldQuaternion(new THREE.Quaternion()).multiply(rig.sceneHomeRotation.clone().invert());
  const stride=.62;
  for(let index=0;index<rig.legs.length;index++){
    const leg=rig.legs[index];if(!leg)continue;
    const cycle=((distanceM/stride+index*.5)%1+1)%1;
    const stance=cycle<.6;
    const progress=stance?cycle/.6:(cycle-.6)/.4;
    const offset=moving ? (stance?.5-progress:-.5+progress)*stride*.6 : 0;
    const lift=moving && !stance ? Math.sin(progress*Math.PI)*.065 : 0;
    const target=scene.localToWorld(leg.restTip.clone().add(vector(offset,0,0)));
    target.y=groundAt(target)+.1+lift;
    const pole=scene.localToWorld(vector(.7,.45,index===0?-.13:.13));
    solveTwoBone(leg,target,pole);
    const worldRotation=rotationDelta.clone().multiply(leg.tipRotation);
    leg.tip.quaternion.copy(leg.tip.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation));
  }
  for(let index=0;index<rig.arms.length;index++){
    const arm=rig.arms[index];if(!arm)continue;
    const swing=moving&&!handTargets?Math.sin(distanceM/stride*Math.PI*2+index*Math.PI)*.16:0;
    const target=handTargets?.[index] || scene.localToWorld(arm.restTip.clone().add(vector(swing,-crouch,0)));
    const pole=scene.localToWorld(vector(.07,1.03-crouch,index===0?-.5:.5));
    solveTwoBone(arm,target,pole);
  }
  scene.updateWorldMatrix(true,true);
}

export function cargoHandTargets(cargo,position,yaw) {
  const forward=vector(-Math.cos(yaw),0,Math.sin(yaw));
  const side=vector(forward.z,0,-forward.x);
  const length=Number(cargo.l)*.001,width=Number(cargo.w)*.001;
  const extent=Math.abs(forward.x)*length+Math.abs(forward.z)*width;
  const spread=(Math.abs(side.x)*length+Math.abs(side.z)*width)/2+.012;
  const centre=position.clone().add(vector(length/2,Math.min(.25,Number(cargo.h)*.001*.35),width/2)).addScaledVector(forward,-extent/2);
  return [centre.clone().addScaledVector(side,spread),centre.clone().addScaledVector(side,-spread)];
}

// Fit a rigid chassis to the front/rear wheel contact planes. The wheels stay
// round; only the whole device pitches at the ramp transition.
export function groundVehicle(group,wheels,groundAt){
  if(!wheels?.length)return;
  group.rotation.z=0;
  group.updateWorldMatrix(true,true);
  if(!group.userData.contacts){
    group.userData.contacts=wheels.map(wheel=>{
      const box=new THREE.Box3().setFromObject(wheel),centre=box.getCenter(vector());
      centre.y=box.min.y;
      return group.worldToLocal(centre);
    }).sort((a,b)=>a.x-b.x);
  }
  const contacts=group.userData.contacts;
  const a=contacts[0],b=contacts.at(-1);
  if(b.x-a.x<.1)return;
  const wa=group.localToWorld(a.clone()),wb=group.localToWorld(b.clone());
  const slope=(groundAt(wb)-groundAt(wa)-(b.y-a.y))/(b.x-a.x);
  group.rotation.z=Math.atan(slope);
  group.updateWorldMatrix(true,true);
  const contact=group.localToWorld(a.clone());
  group.position.y+=groundAt(contact)-contact.y;
  group.updateWorldMatrix(true,true);
}
