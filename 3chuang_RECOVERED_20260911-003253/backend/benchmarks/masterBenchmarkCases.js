'use strict';
const { placement } = require('../services/packing/SourceBenchmarkSolver');
const { resolveOrientationRules } = require('../services/packing/OrientationConstraint');

const bin={innerLength:2400,innerWidth:1200,innerHeight:1800,maxWeight:5000,doorWidth:1200,doorHeight:1800};
const box=(id,length,width,height,quantity=1,extra={})=>({cargoId:id,sku:id,name:id,length,width,height,quantity,weight:10,
  canRotate:true,canLayFlat:false,orientationPolicy:'UPRIGHT_ONLY',stackable:true,maxStackLayers:20,
  maximumSupportedWeightKg:1000,portSequence:1,handlingMethod:'manual',packagingType:'WOOD_CRATE',...extra});
const rules={supportRatio:1,stacking:true,weightKnown:true,payload:true,pressure:false,declaredTopLoad:true};
const make=(id,cargoList,container=bin,extra={})=>({id,dataClassification:'SYNTHETIC_BENCHMARK',seed:20260922,cargoList,container,rules:{...rules},...extra});

async function buildMasterCases(){
  const {WORKSITE_DEMO}=await import('../../web-dashboard/src/domain/cargo/worksiteDemo.js');
  const {normalizeCargo}=await import('../../web-dashboard/src/domain/cargo/cargo.js');
  const {CONTAINER_CATALOG}=await import('../../web-dashboard/src/domain/container/catalog.js');
  const cases=[
    make('DEMO-WORKSITE-42',WORKSITE_DEMO.items.map(normalizeCargo),CONTAINER_CATALOG['20GP'],{dataClassification:'DEMO_DATA',rules:{...rules,lifo:true}}),
    make('identical-high-fill',[box('tile',400,400,300,108)]),
    make('heterogeneous-48',Array.from({length:48},(_,i)=>box('hetero-'+i,200+(i*73%11)*50,150+(i*41%7)*50,150+(i*29%9)*50))),
    make('mixed-large-small',[box('large',1200,600,600,4),box('medium',600,400,300,12),box('small',200,200,150,48)]),
    make('single-bin-overflow',[box('overflow',600,600,600,40)]),
    make('cavity-prone',[box('wide',1200,800,500,3),box('slim',800,400,300,8),box('gap',400,400,200,10)]),
    make('height-limited',[box('tall',600,400,1200,5),box('low',400,400,300,10)],{...bin,innerHeight:900,doorHeight:850}),
    make('fixed-orientation',[box('fixed',1300,500,400,5,{canRotate:false,orientationPolicy:'FIXED_ORIENTATION'})]),
    make('no-stacking',[box('floor-only',600,600,500,12,{stackable:false,maxStackLayers:1,maximumSupportedWeightKg:0})]),
    make('maximum-two-layers',[box('two',600,600,400,24,{maxStackLayers:2})]),
    make('bearing-limit',[box('weak',600,600,400,20,{maximumSupportedWeightKg:10})]),
    make('door-aperture',[box('door-wide',1200,1000,600,2,{canRotate:false,orientationPolicy:'FIXED_ORIENTATION'}),box('fits',400,400,400,6)],{...bin,doorWidth:900}),
    make('payload-overflow',[box('mass',400,400,300,20,{weight:100})],{...bin,maxWeight:750})
  ];
  const lockCargo=box('locked',600,600,400,2,{canRotate:false,orientationPolicy:'FIXED_ORIENTATION'});
  const ori=resolveOrientationRules(lockCargo).orientations.flatMap(x=>x.semanticVariants)[0];
  cases.push(make('fixed-placement',[lockCargo,box('new',400,400,400,8)],bin,{lockedPlacements:[placement(lockCargo,ori,1,{x:1200,y:0,z:0})]}));
  cases.push(make('replan-changed-width',[{...lockCargo,width:650},box('new',400,400,400,8)],bin,{replan:{changedField:'locked.width',oldValue:600,newValue:650},lockedPlacements:[]}));
  return cases;
}
module.exports={buildMasterCases,box,bin,rules};
