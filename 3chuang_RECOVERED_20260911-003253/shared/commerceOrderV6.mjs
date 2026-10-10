// Independently authored mixed ecommerce order, frozen before packing.
// Packaging limits below are design inputs, never certifications of real goods.
import {COMMERCE_ORDER as prior,COMMERCE_TIMES} from './commerceOrder.mjs';
const quantities=[144,140,36,32,40,36,60,48,6,6,4,4,2,2,24,24];
const groups=[3,1,1,1,2,2,2,2,2,2,1,1,1,3,3,3];
const layers=[7,6,3,3,8,8,10,10,6,6,6,6,1,1,3,3];
const capacities=[54,60,20,24,112,126,63,72,100,90,150,190,0,0,36,32];
const arrivalWaves=[0,0,1,1,0,1,1,2,0,0,0,0,1,1,0,2];
const owners={1:['APPLIANCE','澄远电器'],2:['FURNITURE','匠造家居'],3:['HOME','栖居家品']};
const original=prior.items.filter(c=>!c.cargoId.endsWith('-LATE'));
export const COMMERCE_ORDER=Object.freeze({...prior,id:'commerce-mixed-v6.1',orderNo:'PC-CONSOL-0916-V6.1',
 description:'三家卖家、三次到仓；整单设备与可拆补货并存，按海外仓三个交接组出库。',
 caseContext:{...prior.caseContext,commerce:{...prior.caseContext.commerce,door:{widthMm:2340,heightMm:2585},inputDesign:'ECOMMERCE_MIX_V6_FROZEN'}},
 items:Object.freeze(original.flatMap((old,i)=>{
  const group=groups[i],[customerId,customerName]=owners[group],unitBase=['honeycomb','crate','wrapped'].includes(old.packagingConfig.template);
  const noTop=old.packagingConfig.template==='wrapped',soft=old.packagingConfig.template==='bale',whole=old.packagingConfig.template==='crate';
  const row={...old,cargoId:'CM6-'+String(i+1).padStart(2,'0'),quantity:quantities[i],customerId,customerName,orderId:whole?'PO-EQUIPMENT-SET':'PO-'+customerId+'-RESTOCK',
   unloadGroup:'HANDOVER-'+group,unloadSequence:group,lotId:'LOT-'+customerId+'-0916',arrivalBatchId:'ARRIVAL-'+(arrivalWaves[i]+1),batchId:'ARRIVAL-'+(arrivalWaves[i]+1),batchLabel:'到仓批次 '+(arrivalWaves[i]+1),arrivedAt:COMMERCE_TIMES[arrivalWaves[i]],expectedArrivalAt:COMMERCE_TIMES[arrivalWaves[i]],
   allowPartialShipment:!whole,required:true,shipmentPriority:whole?2:1,stackable:!noTop,maxStackLayers:layers[i],maxSupportedWeight:capacities[i],stackLayerScope:'ALL_PACKAGES',alwaysOnBottom:unitBase,stackingCompatibility:soft?'SAME_SKU':null,
   packagingType:old.packagingConfig.template==='bale'?'TEXTILE_BALE':old.packagingType,
   packagingEvidence:{status:'DESIGNED',reference:'ECOMMERCE_MIX_V6_PACKAGING_SPEC',note:'包装方案设定；实际托底、抗压与操作条件须按货物资料复核'},
   packagingConfig:{...old.packagingConfig,contactPolicy:unitBase?'FLOOR_ONLY_BASE':noTop?'NO_TOP_LOAD':'RECTANGULAR_ENVELOPE'},
   riskNotes:noTop?['不在软包或未核定整托上堆放其他货物']:unitBase?['托底包装落地；盖板承载为方案输入，实际需核对']:[]};
  if(i===0)return [{...row,quantity:112},{...row,cargoId:row.cargoId+'-LATE',quantity:32,arrivalBatchId:'ARRIVAL-3',batchId:'ARRIVAL-3',batchLabel:'到仓批次 3',arrivedAt:COMMERCE_TIMES[2],expectedArrivalAt:COMMERCE_TIMES[2]}];
  return [row];
 }))});
