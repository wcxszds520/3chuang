import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {bindWorkerRig,poseArticulatedWorker,groundVehicle} from './articulatedActors.js';
import {configureFloorPalletPath,floorPalletPose} from '../operation/floorHandling.js';
import {buildOperationSlots} from '../operation/stagingLayout.js';

async function asset(name){
 const b=readFileSync(new URL(`../../../public/assets/3d/operations-v2/${name}.glb`,import.meta.url));
 return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength), '')).scene;
}
describe('Blender articulated asset contracts',()=>{
 it('keeps exported vehicle envelopes and the operator clear of both pickup slots during handoff',async()=>{
   const container={innerLength:12032,innerWidth:2352,innerHeight:2698};
   const cargo={x:967.695,y:0,z:1572,l:1200,w:780,h:850};
   const path={doorZ:786,target:{x:cargo.x,y:0,z:cargo.z}};configureFloorPalletPath(path,cargo,container);
   const obstacles=[...buildOperationSlots([cargo,cargo],container).values()].map(p=>new THREE.Box3(new THREE.Vector3(p.x/1000,-.22,p.z/1000),new THREE.Vector3((p.x+cargo.l)/1000,.63,(p.z+cargo.w)/1000)));
   const forklift=await asset('forklift_articulated');forklift.rotation.y=Math.PI;
   const jack=await asset('pallet_jack_articulated');jack.rotation.y=Math.PI;
   for(const phase of ['FORK_WITHDRAW','JACK_APPROACH','JACK_INSERT','RETURN_FOR_NEXT'])for(let i=0;i<=100;i++){
     const pose=floorPalletPose({container,phase},cargo,path,i/100,'move');
     for(const [mesh,position] of [[forklift,pose.forklift.position],[jack,pose.jack.position]]){
       mesh.rotation.y=Math.PI+(mesh===forklift?pose.forklift.yaw:pose.jack.yaw);mesh.position.set(position.x/1000,position.y/1000,position.z/1000);mesh.updateMatrixWorld(true);
       const box=new THREE.Box3().setFromObject(mesh);
       for(const obstacle of obstacles)expect(box.intersectsBox(obstacle),`${phase} ${i} vehicle`).toBe(false);
     }
     const p=pose.worker.position;
     const person=new THREE.Box3(new THREE.Vector3(p.x/1000-.25,-.22,p.z/1000-.25),new THREE.Vector3(p.x/1000+.25,1.6,p.z/1000+.25));
     for(const obstacle of obstacles)expect(person.intersectsBox(obstacle),`${phase} ${i} person`).toBe(false);
   }
 });
 it('has real limb joints and reachable wrist contacts without stretching',async()=>{
   const scene=await asset('worker_articulated');scene.rotation.y=Math.PI;
   const rig=bindWorkerRig(scene);expect(rig.arms.every(Boolean)&&rig.legs.every(Boolean)).toBe(true);
   const hands=[new THREE.Vector3(-.28,1.08,.28),new THREE.Vector3(-.28,1.08,-.28)];
   poseArticulatedWorker(rig,{handTargets:hands,groundAt:()=>0,distanceM:.14,moving:false});
   rig.arms.forEach((arm,i)=>expect(arm.tip.getWorldPosition(new THREE.Vector3()).distanceTo(hands[i])).toBeLessThan(.025));
   rig.legs.forEach(leg=>expect(leg.tip.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(.1,2));
   expect(scene.scale.toArray()).toEqual([1,1,1]);
 });
 it('provides carriage, wheel and tiller nodes and grounds the rigid jack on a slope',async()=>{
   const forklift=await asset('forklift_articulated');
   expect(forklift.getObjectByName('forklift_carriage')).toBeTruthy();
   for(const wheel of ['fl','fr','rl','rr'])expect(forklift.getObjectByName(`wheel_${wheel}`)).toBeTruthy();
   const jack=await asset('pallet_jack_articulated');
   expect(jack.getObjectByName('jack_handle')).toBeTruthy();
   const group=new THREE.Group();jack.rotation.y=Math.PI;group.add(jack);group.position.y=-.1;
   const wheels=[];jack.traverse(n=>{if(/^jack_wheel_\d+$/.test(n.name))wheels.push(n);});
   expect(wheels.length).toBeGreaterThanOrEqual(3);
   groundVehicle(group,wheels,p=>-.1-p.x*.1);
   expect(Math.abs(group.rotation.z)).toBeGreaterThan(.05);
   const front=group.localToWorld(group.userData.contacts[0].clone());
   expect(front.y).toBeCloseTo(-.1-front.x*.1,3);
   expect(group.scale.toArray()).toEqual([1,1,1]);
 });
});
