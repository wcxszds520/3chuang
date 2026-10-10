import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { batchStaticSubtree } from './staticBatching.js';
describe('semantic subtree draw-call batching', () => {
  it('preserves world bounds and door pivot animation while merging matching materials', () => {
    const scene=new THREE.Group(), pivot=new THREE.Group();scene.add(pivot);pivot.position.set(4,2,1);pivot.rotation.y=.35;
    for(let i=0;i<12;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.5),new THREE.MeshStandardMaterial({color:'#765c43'}));mesh.position.x=i*.4;pivot.add(mesh);}
    const before=new THREE.Box3().setFromObject(scene);
    expect(batchStaticSubtree(pivot,'door')).toEqual({before:12,after:1});
    const after=new THREE.Box3().setFromObject(scene);expect(before.min.distanceTo(after.min)).toBeLessThan(.00001);expect(before.max.distanceTo(after.max)).toBeLessThan(.00001);
    pivot.rotation.y=1.2;expect(new THREE.Box3().setFromObject(scene).min.distanceTo(after.min)).toBeGreaterThan(.1);
  });
  it('does not merge different authored surfaces with the same material name', () => {
    const root=new THREE.Group();
    for(const color of ['#ffffff','#111111']){const m=new THREE.MeshStandardMaterial({color});m.name='paint';root.add(new THREE.Mesh(new THREE.BoxGeometry(),m));}
    expect(batchStaticSubtree(root,'paint')).toEqual({before:2,after:2});
  });
});
