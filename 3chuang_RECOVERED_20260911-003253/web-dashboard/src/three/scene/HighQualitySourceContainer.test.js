import {afterEach,expect,test,vi} from 'vitest';
import * as THREE from 'three';
import {createHighQualitySourceContainer} from './HighQualitySourceContainer.js';
afterEach(()=>vi.restoreAllMocks());
test('different source cavities retain fixed hardware without whole-asset scaling',()=>{
 vi.spyOn(THREE.TextureLoader.prototype,'load').mockImplementation(()=>new THREE.Texture());
 const models=[[5.87,2.33,2.2],[12.09,2.35,2.68]].map(([length,width,height])=>{const root=new THREE.Group();const model=createHighQualitySourceContainer(root,{length,width,height});return {root,model,dims:[length,width,height]};});
 const dimensions=(root,name)=>{const object=root.getObjectByName(name);object.geometry.computeBoundingBox();return object.geometry.boundingBox.getSize(new THREE.Vector3()).toArray();};
 for(const {root,model,dims} of models){expect(root.scale.toArray()).toEqual([1,1,1]);expect(model.descriptor.usableDimensionsM).toEqual(dims);expect(root.getObjectByName('side_right').position.z).toBeCloseTo(-dims[1]/2-.028);expect(root.getObjectByName('front_wall').position.x).toBeCloseTo(-dims[0]/2-.028);expect(model.doors.leftPivot.position.x).toBeCloseTo(dims[0]/2+.12);expect(dimensions(root,'door_hinge')).toEqual(expect.arrayContaining([expect.closeTo(.14,5)]));}
 expect(dimensions(models[0].root,'door_hinge')).toEqual(dimensions(models[1].root,'door_hinge'));
 expect(dimensions(models[0].root,'corner_casting')).toEqual(dimensions(models[1].root,'corner_casting'));
 const rods=models.map(m=>dimensions(m.root,'door_lock_rod'));expect(rods[0][0]).toBeCloseTo(.036);expect(rods[1][0]).toBeCloseTo(.036);expect(rods[0][1]).not.toEqual(rods[1][1]);
});
