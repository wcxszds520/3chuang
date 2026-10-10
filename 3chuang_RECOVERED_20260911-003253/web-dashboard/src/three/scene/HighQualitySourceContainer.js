import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const SOURCE_CONTAINER_MODULES=Object.freeze({frameSectionM:.105,corrugationPitchM:.28,corrugationDepthM:.026,plankWidthM:.145,rodDiameterM:.036,hingeHeightM:.14,handleLengthM:.22,cornerCastingM:[.178,.162,.16]});
export function createHeroGroundMarks(parent,{length:l,width:w}){
 const points=[],z=w/2+.6;for(let n=0;n<=Math.floor(l);n+=2){const x=-l/2+n;points.push(x,-.205,z,x,-.205,z+.13);}points.push(-l/2,-.205,z,l/2,-.205,z);
 for(const side of [-1,1])for(let x=l/2+.5;x<l/2+3;x+=.6)points.push(x,-.205,side*(w/2+.1),x+.28,-.205,side*(w/2+.1));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const marks=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#b1a988',transparent:true,opacity:.28}));marks.name='hero_scale_and_approach';parent.add(marks);return marks;
}
export function createSourceWoodFloor(parent,{length:l,width:w}){
 const group=new THREE.Group();group.name='floor_longitudinal_plank_assembly';parent.add(group);
 const loader=new THREE.TextureLoader(),textures=['Color','Roughness','NormalGL'].map(role=>loader.load(`/assets/3d/external-hero-v1/floor/Wood058_2K-JPG_${role}.jpg`));textures[0].colorSpace=THREE.SRGBColorSpace;
 for(const t of textures){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;}
 const material=new THREE.MeshStandardMaterial({name:'Hero_floor_Wood058',map:textures[0],roughnessMap:textures[1],normalMap:textures[2],normalScale:new THREE.Vector2(.16,.16),color:'#71614f',roughness:.88});
 const n=Math.ceil(w/.145),pw=w/n;
 for(let row=0;row<n;row++){let x=-l/2;let segment=0;while(x<l/2-.001){const span=Math.min(l/2-x,segment===0?1.4+(row%4)*.46:2.6);const geometry=new THREE.BoxGeometry(span-.004,.055,pw-.004);const uv=geometry.getAttribute('uv'),pos=geometry.getAttribute('position');for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getZ(i)+row*.19)*2.5,(pos.getX(i)+x)*.65);const mesh=new THREE.Mesh(geometry,material);mesh.name='floor_plank';mesh.position.set(x+span/2,-.03,-w/2+(row+.5)*pw);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);x+=span;segment++;}}
 group.userData={plankWidthM:pw,nominalWidthM:.145,uv:'physical longitudinal scale, per component',source:'ambientCG/Wood058'};return group;
}
/** Rebuild spans around the exact source cavity. Hardware is never XYZ scaled. */
export function createHighQualitySourceContainer(parent,{length:l,width:w,height:h}){
 const dims=[l,w,h];if(!dims.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid source cavity');
 parent.name='HIGH_QUALITY_PARAMETRIC_SOURCE_CONTAINER';
 const paint=new THREE.MeshStandardMaterial({name:'source-powder-green',color:'#294d45',roughness:.62,metalness:.3,side:THREE.DoubleSide}),frame=new THREE.MeshStandardMaterial({name:'source-frame-green',color:'#193831',roughness:.48,metalness:.48}),hardware=new THREE.MeshStandardMaterial({name:'source-galvanized-hardware',color:'#a4b0ad',roughness:.29,metalness:.85}),rubber=new THREE.MeshStandardMaterial({color:'#171f1d',roughness:.9});
 const box=(name,size,pos,mat=frame,root=parent)=>{const g=new RoundedBoxGeometry(...size,2,Math.min(.006,...size.map(n=>n*.18))),m=new THREE.Mesh(g,mat);m.name=name;m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 const folded=(name,span,height,position,rotation)=>{const pitch=.28,vertices=[],uv=[],index=[];let x=0;
  const points=[];while(x<span){for(const [f,d] of [[0,0],[.26,0],[.36,.026],[.64,.026],[.74,0]]){const px=Math.min(span,x+f*pitch);if(!points.length||px>points.at(-1)[0])points.push([px,d]);}x+=pitch;}if(points.at(-1)[0]<span)points.push([span,0]);
  for(let i=0;i<points.length;i++){const [px,d]=points[i];vertices.push(px-span/2,0,d,px-span/2,height,d);uv.push(px,0,px,height);if(i){const a=2*i;index.push(a-2,a,a-1,a-1,a,a+1);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();const mesh=new THREE.Mesh(g,paint);mesh.name=name;mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 folded('side_right',l,h,[0,0,-w/2-.028],[0,0,0]);
 folded('side_left',l,h,[0,0,w/2+.028],[0,Math.PI,0]);
 folded('front_wall',w,h,[-l/2-.028,0,0],[0,Math.PI/2,0]);
 box('roof',[l,.035,w],[0,h+.025,0],paint);
 for(const x of [-l/2-.06,l/2+.06])for(const z of [-w/2-.06,w/2+.06]){box('corner_post',[.105,h+.08,.105],[x,h/2,z]);for(const y of [-.035,h+.035]){box('corner_casting',[.178,.162,.16],[x,y,z]);box('casting_socket',[.06,.026,.002],[x,y,z+(z>0?.081:-.081)],rubber);}}
 for(const y of [-.025,h+.025])for(const z of [-w/2-.05,w/2+.05])box('side_rail',[l+.2,.105,.105],[0,y,z]);
 for(const x of [-l/2-.05,l/2+.05])for(const y of [-.025,h+.025])box('end_frame',[.105,.105,w+.2],[x,y,0]);
 const loader=new THREE.TextureLoader(),color=loader.load('/assets/3d/external-hero-v1/floor/Wood058_2K-JPG_Color.jpg'),rough=loader.load('/assets/3d/external-hero-v1/floor/Wood058_2K-JPG_Roughness.jpg'),normal=loader.load('/assets/3d/external-hero-v1/floor/Wood058_2K-JPG_NormalGL.jpg');
 color.colorSpace=THREE.SRGBColorSpace;for(const t of [color,rough,normal]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;}
 const floor=new THREE.MeshStandardMaterial({name:'source-longitudinal-wood',map:color,roughnessMap:rough,normalMap:normal,normalScale:new THREE.Vector2(.18,.18),color:'#8f785f',roughness:.9});
 const count=Math.ceil(w/.145),plankWidth=w/count;
 for(let row=0;row<count;row++){let start=-l/2;while(start<l/2-.001){const span=Math.min(l/2-start,2.1+((row*7+Math.round(start*10))%5+5)%5*.24),p=box('floor_plank',[span-.003,.06,plankWidth-.004],[start+span/2,-.034,-w/2+(row+.5)*plankWidth],floor);const uv=p.geometry.getAttribute('uv'),pos=p.geometry.getAttribute('position');for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getZ(i)+row*.21)*3,(pos.getX(i)+span/2+start)*.75);start+=span;}}
 const doors={};for(const side of [-1,1]){const pivot=new THREE.Group();pivot.name=side<0?'left_door_pivot':'right_door_pivot';pivot.position.set(l/2+.12,0,side*w/2);parent.add(pivot);doors[side<0?'leftPivot':'rightPivot']=pivot;const half=w/2-.05,sign=-side;
  box('door_panel',[.048,h-.1,half],[0,h/2,sign*half/2],paint,pivot);
  for(const z of [sign*.025,sign*(half-.025)])box('door_gasket',[.065,h-.08,.025],[-.015,h/2,z],rubber,pivot);
  for(const y of [.06,h-.06])box('door_border',[.07,.05,half],[.008,y,sign*half/2],frame,pivot);
  for(let z=.16;z<half-.08;z+=.28)box('door_corrugation',[.035,h-.22,.07],[.04,h/2,sign*z],paint,pivot);
  for(const factor of [.29,.71]){const z=sign*half*factor;const rod=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,h-.28,16),hardware);rod.name='door_lock_rod';rod.position.set(.085,h/2,z);rod.castShadow=true;pivot.add(rod);for(const y of [.17,h*.32,h*.68,h-.17])box('rod_keeper',[.075,.055,.075],[.076,y,z],hardware,pivot);box('door_handle',[.035,.032,.22],[.11,h*.43,z+sign*.065],hardware,pivot);}
  for(const y of [.23,h*.36,h*.67,h-.23]){const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.029,.029,.14,16),hardware);hinge.name='door_hinge';hinge.position.set(.015,y,0);pivot.add(hinge);box('hinge_leaf',[.052,.074,.16],[.015,y,sign*.075],hardware,pivot);}
 }
 const review=new THREE.MeshStandardMaterial({opacity:0,transparent:true}),reviewCutaway=new THREE.Group();parent.add(reviewCutaway);
 parent.userData.parametricAudit={contract:'HIGH_QUALITY_PARAMETRIC_SOURCE_CONTAINER',usableDimensionsM:dims,fixedModules:SOURCE_CONTAINER_MODULES,wholeAssetScale:[1,1,1],floorBoardCount:count};
 return {doors,shellMaterials:{opaque:paint,review,operation:{farWall:paint,nearWall:paint,roof:paint},panels:[]},reviewCutaway,doorPanels:[],descriptor:{partCount:parent.children.length,doorCount:2,...parent.userData.parametricAudit}};
}
