import * as THREE from 'three';
import { classifyCargoAppearance } from '../../domain/cargo/appearance.js';

export function cargoVisualBatchKey(cargo) {
  return `${classifyCargoAppearance(cargo).key}:${Number(cargo.l || cargo.length)}:${Number(cargo.h || cargo.height)}:${Number(cargo.w || cargo.width)}`;
}

export function cargoVisualDimensions(cargo) {
  return new THREE.Vector3(Number(cargo.l || cargo.length) * .001, Number(cargo.h || cargo.height) * .001, Number(cargo.w || cargo.width) * .001);
}

// Geometry is authored in metres. Sheets follow the cargo envelope, while
// hardware and label assemblies keep their aspect ratio and physical size.
// The caller normalizes only after this fitting step for instanced rendering.
export function fitPackagingPart(geometry, { sourceBounds, dimensions, name, labelBounds, family }) {
  const size = sourceBounds.getSize(new THREE.Vector3());
  const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
  const ratio = dimensions.clone().divide(size);
  const uniform = Math.min(1, ratio.x, ratio.y, ratio.z);
  geometry.computeBoundingBox();
  const partSize = geometry.boundingBox.getSize(new THREE.Vector3());
  const palletDeck = .15;
  const hasPallet = ['palletized', 'wrapped'].includes(family);
  const palletScale = Math.min(1, ratio.x, ratio.z, dimensions.y / palletDeck);
  const mapPalletY = value => {
    const y = value - sourceBounds.min.y;
    return (y <= palletDeck ? y * palletScale : palletDeck * palletScale + (y - palletDeck) * (dimensions.y - palletDeck * palletScale) / Math.max(.001, size.y - palletDeck)) - dimensions.y / 2;
  };
  const label = /label|barcode|text_line/.test(name.toLowerCase());
  const rigid = label || (/corner/.test(name.toLowerCase()) && Math.max(...partSize.toArray()) < .3) || /bolt|screw|latch|hinge|handle|bracket|caster|staple|rivet|fastener|card_flute|tape_side_overlap/.test(name.toLowerCase());
  if (!rigid && !/sealing_tape/.test(name.toLowerCase())) {
    const originalY = hasPallet ? Array.from({ length:geometry.attributes.position.count }, (_, index) => geometry.attributes.position.getY(index)) : null;
    geometry.translate(-sourceCenter.x, -sourceCenter.y, -sourceCenter.z);
    geometry.scale(ratio.x, ratio.y, ratio.z);
    if (originalY) {
      const normal = geometry.attributes.normal;
      const n = new THREE.Vector3();
      originalY.forEach((value, index) => {
        geometry.attributes.position.setY(index, mapPalletY(value));
        const localScale = value - sourceBounds.min.y <= palletDeck ? palletScale : (dimensions.y - palletDeck * palletScale) / Math.max(.001, size.y - palletDeck);
        if (normal) {
          n.fromBufferAttribute(normal, index); n.y *= ratio.y / Math.max(.0001, localScale); n.normalize();
          normal.setXYZ(index, n.x, n.y, n.z);
        }
      });
      if (normal) normal.needsUpdate = true;
      geometry.attributes.position.needsUpdate = true;
    }
    return geometry;
  }
  const bounds = label && labelBounds ? labelBounds : geometry.boundingBox;
  const center = bounds.getCenter(new THREE.Vector3());
  const targetCenter = center.clone().sub(sourceCenter).multiply(ratio);
  if (hasPallet) targetCenter.y = mapPalletY(center.y);
  const shapeScale = new THREE.Vector3(uniform, uniform, uniform);
  if (/sealing_tape/.test(name.toLowerCase())) shapeScale.z = ratio.z;
  for (const axis of ['x', 'y', 'z']) {
    const relative = center[axis] - sourceCenter[axis];
    const distance = size[axis] / 2 - Math.abs(relative);
    // Anchor face-mounted parts by their real inset, preventing hovering labels.
    if (distance < size[axis] * .16) targetCenter[axis] = Math.sign(relative) * (dimensions[axis] / 2 - distance * shapeScale[axis]);
  }
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(shapeScale.x, shapeScale.y, shapeScale.z);
  geometry.translate(targetCenter.x, targetCenter.y, targetCenter.z);
  return geometry;
}
