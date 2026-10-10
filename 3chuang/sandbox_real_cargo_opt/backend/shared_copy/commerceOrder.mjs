// Frozen product-design input. Quantities do not change in response to solver results.
// Dimensions and masses are for the complete outer transport unit, including bases.
const lines=[
 ['收纳用品套装','carton',480,360,320,9,80,'CARTON'],
 ['厨房用品套装','carton',600,400,400,12,54,'CARTON'],
 ['空气净化器','tall_carton',420,420,680,10,24,'CARTON'],
 ['立式风扇套装','tall_carton',500,450,750,12,18,'CARTON'],
 ['拆装边桌','flat_carton',1100,650,160,16,30,'CARTON'],
 ['储物架板件','flat_carton',1000,600,220,18,28,'CARTON'],
 ['窗帘杆套装','long_carton',1450,180,160,7,32,'CARTON'],
 ['灯具支架套装','long_carton',1200,240,200,8,32,'CARTON'],
 ['健身器材底座','honeycomb',1000,650,500,65,10,'HONEYCOMB_CASE'],
 ['金属桌架组件','honeycomb',800,600,650,48,8,'HONEYCOMB_CASE'],
 ['咖啡设备','crate',800,600,850,75,8,'WOOD_CRATE'],
 ['商用厨房设备','crate',1000,800,850,95,6,'WOOD_CRATE'],
 ['餐具整托补货','wrapped',1200,800,1250,240,5,'WRAPPED_PALLET'],
 ['收纳用品整托','wrapped',1200,1000,1400,210,4,'WRAPPED_PALLET'],
 ['压缩床品套装','bale',800,550,450,18,22,'FIBC_BAG'],
 ['压缩窗帘套装','bale',750,500,400,16,22,'FIBC_BAG']
];
export const COMMERCE_TIMES=['2026-09-16T09:00:00+08:00','2026-09-16T11:00:00+08:00','2026-09-16T14:00:00+08:00'];
export const commerceAssetId=(template,dims)=>template+'_'+dims.map(Number).join('_');
export const COMMERCE_ORDER=Object.freeze({id:'commerce-mixed-v4',orderNo:'PC-CONSOL-0916',label:'跨境集拼 · 多卖家混装',containerType:'40HQ',route:['宁波集拼仓','汉堡海外仓'],description:'三家卖家、三次到仓、十六个 SKU；按交接组卸货，同货主同批 SKU 聚集。',
 caseContext:{commerce:{enabled:true,lifo:true,planAt:COMMERCE_TIMES[2],door:{widthMm:2340,heightMm:2597},unloadScope:'DESTINATION_WAREHOUSE_HANDOVER',cutoffs:{cy:null,si:null,vgm:null}}},
 items:Object.freeze(lines.flatMap(([name,template,length,width,height,weight,quantity,packagingType],i)=>{
  quantity=Math.round(quantity*1.2);
  const group=i%3+1,customer=(Math.floor(i/3)%3)+1;const wave=Math.floor(i/6);const id=commerceAssetId(template,[length,width,height]);
  const row={cargoId:'CM4-'+String(i+1).padStart(2,'0'),sku:'EC-'+String(i+1).padStart(3,'0'),name,length,width,height,weight,quantity,packagingType,
   customerId:'SELLER-'+customer,customerName:['栖居家品','澄远电器','匠造家居'][customer-1],orderId:'PO-'+customer+'-'+group,lotId:'LOT-0916',unloadGroup:'HANDOVER-'+group,unloadSequence:group,
   portSequence:1,destinationPort:'Hamburg',batchId:'ARRIVAL-'+(wave+1),batchLabel:'到仓批次 '+(wave+1),arrivalBatchId:'ARRIVAL-'+(wave+1),expectedArrivalAt:COMMERCE_TIMES[wave],arrivedAt:COMMERCE_TIMES[wave],eta:'',
   stackable:true,stackLayerScope:'SAME_SKU',maxStackLayers:template==='bale'?4:template==='wrapped'?1:Math.min(8,Math.floor(2600/height)),maxSupportedWeight:template==='wrapped'?80:weight*8,
   orientationPolicy:'HORIZONTAL_ROTATION_ONLY',orientationConstraints:{lengthVertical:false,widthVertical:false,heightVertical:true},canRotate:true,canLayFlat:false,canInvert:false,fragile:false,dangerous:false,required:true,
   handlingMethod:weight>25?'forklift':'manual',forkEntry:weight>25?'FOUR_WAY':'NOT_APPLICABLE',handlingPolicy:'fixed',unitsPerPackage:1,source:'commerce-order-design',dataClassification:'DEMO_DATA',
   packagingConfig:{version:'commerce-v4',template,outerDimensionsMm:[length,width,height]},visualProfile:{version:'commerce-v4',assetId:id},riskNotes:[]};
  // Same SKU, owner, lot and unload group arrives twice. Arrival is not the stock lot.
  if(i===0)return [{...row,quantity:quantity-20},{...row,cargoId:row.cargoId+'-LATE',quantity:20,arrivalBatchId:'ARRIVAL-3',batchId:'ARRIVAL-3',batchLabel:'到仓批次 3',expectedArrivalAt:COMMERCE_TIMES[2],arrivedAt:COMMERCE_TIMES[2]}];
  return [row];
 }))});
