import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cargoVisualBatchKey, fitPackagingPart } from './packagingGeometryFit.js';

describe('packaging dimensions and assembly details', () => {
  it('keeps pallet fork-pocket height when the payload envelope gets taller', () => {
    const sourceBounds = new THREE.Box3(new THREE.Vector3(-.6,0,-.4),new THREE.Vector3(.6,1.2,.4));
    const deck = new THREE.BoxGeometry(1.2,.025,.8).translate(0,.1375,0);
    fitPackagingPart(deck,{sourceBounds,dimensions:new THREE.Vector3(1.2,1.8,.8),family:'palletized',name:'pallet_deck'});
    deck.computeBoundingBox();
    expect(deck.boundingBox.max.y + .9).toBeCloseTo(.15,6);
    expect(deck.boundingBox.getSize(new THREE.Vector3()).y).toBeCloseTo(.025,6);
  });
  it('retains a label assembly aspect ratio on an elongated cargo envelope', () => {
    const sourceBounds = new THREE.Box3(new THREE.Vector3(-.3, -.2, -.2), new THREE.Vector3(.3, .2, .2));
    const dimensions = new THREE.Vector3(1.2, .8, .4);
    const label = new THREE.BoxGeometry(.18, .10, .001).translate(-.1, .03, .1995);
    label.computeBoundingBox();
    const bounds = label.boundingBox.clone();
    const barcode = new THREE.BoxGeometry(.10, .03, .0004).translate(-.1, .015, .2);
    fitPackagingPart(label, { sourceBounds, dimensions, name:'shipping_label', labelBounds:bounds });
    fitPackagingPart(barcode, { sourceBounds, dimensions, name:'generic_barcode', labelBounds:bounds });
    label.computeBoundingBox(); barcode.computeBoundingBox();
    const size = label.boundingBox.getSize(new THREE.Vector3());
    expect(size.x / size.y).toBeCloseTo(1.8, 5);
    expect(size.x).toBeCloseTo(.18, 5);
    expect(label.boundingBox.max.z).toBeCloseTo(.2, 5);
    expect(barcode.boundingBox.getCenter(new THREE.Vector3()).x).toBeCloseTo(label.boundingBox.getCenter(new THREE.Vector3()).x, 5);
  });
  it('fits sheets to the exact target and never shares deformed geometry across different dimensions', () => {
    const geometry = new THREE.BoxGeometry(.6, .4, .4); geometry.computeBoundingBox();
    fitPackagingPart(geometry, { sourceBounds:geometry.boundingBox.clone(), dimensions:new THREE.Vector3(1.1, .7, .52), name:'carton_body' });
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1.1, 6); expect(size.y).toBeCloseTo(.7, 6); expect(size.z).toBeCloseTo(.52, 6);
    const cargo = {packagingType:'CARTON',l:600,h:400,w:400};
    expect(cargoVisualBatchKey(cargo)).not.toBe(cargoVisualBatchKey({...cargo,l:900}));
    expect(cargoVisualBatchKey(cargo)).toBe(cargoVisualBatchKey({...cargo,cargoId:'different-unit'}));
  });
});
