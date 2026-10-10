import * as THREE from 'three';

export const HERO_VIEWS = Object.freeze([
  ['hero-far', '总览'], ['hero-door', '门口'], ['hero-medium', '柜中'],
  ['hero-rear', '纵深'], ['hero-near', '细节']
]);

export function heroCameraPreset(view, { length: l, width: w, height: h }) {
  const box=(x0,x1,y0=-.22,y1=h+.18,z0=-w/2-.12,z1=w/2+.16)=>new THREE.Box3(new THREE.Vector3(x0,y0,z0),new THREE.Vector3(x1,y1,z1));
  const presets={
    'hero-far':{bounds:box(-l/2-.38,l/2+1.1),target:[l*.015,h*.43,0],direction:[.55,.29,1],fov:30,margin:.84},
    'hero-door':{bounds:box(l/2-3.4,l/2+4.6,-.32,h+.18,-w/2-.12,w/2+3.6),target:[l/2+.1,h*.42,.6],direction:[1,.3,.68],fov:32,margin:.8},
    'hero-medium':{bounds:box(-l*.24,l*.3),target:[l*.025,h*.48,0],direction:[.27,.2,1],fov:32,margin:.88},
    'hero-rear':{bounds:box(-l/2-.3,l/2+.4),target:[-l*.08,h*.45,0],direction:[-1,.34,.62],fov:32,margin:.86},
    'hero-near':{bounds:box(-l*.08,l*.19,h*.06,h*.88,0,w/2+.05),target:[l*.055,h*.47,w*.17],direction:[.2,.14,1],fov:32,margin:.9}
  };
  const p=presets[view]||presets['hero-far'];
  return {...p,name:view,up:new THREE.Vector3(0,1,0),target:new THREE.Vector3(...p.target),direction:new THREE.Vector3(...p.direction),cropScale:1,transitionDuration:.65};
}
