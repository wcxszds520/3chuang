// Business packaging configuration. Geometry and physical limits remain separate.
export const PACKAGING_CATALOG = Object.freeze([
  ['CARTON','瓦楞纸箱','carton',['carton','tall_carton','flat_carton','long_carton']],
  ['HONEYCOMB_CASE','蜂窝板围箱','honeycomb',['honeycomb']],
  ['WOOD_CRATE','封闭木箱','crate',['crate']],
  ['WOOD_FRAME','框架木箱','wood_frame',['wood_frame']],
  ['EQUIPMENT_CASE','金属运输箱','flightcase',['flightcase']],
  ['PLASTIC_TOTE','塑料周转箱','plastic_tote',['plastic_tote']],
  ['WRAPPED_PALLET','托盘化单元','wrapped',['wrapped']],
  ['TEXTILE_BALE','压缩家纺包','bale',['bale']],
  ['FIBC_BAG','柔性集装袋','fibc',['fibc']],
  ['DRUM','桶装','drum',['drum']],
  ['IBC','组合容器','ibc',['ibc']],
  ['REEL','卷盘货物','reel',['reel']],
  ['CUSTOM','专用运输包装','custom',['custom']]
].map(([id,label,family,templates])=>Object.freeze({id,label,family,templates})));

export const BUSINESS_FIELDS=Object.freeze(['customerId','customerName','orderId','lotId','arrivalBatchId','expectedArrivalAt','arrivedAt','unloadGroup','unloadSequence','required','allowPartialShipment','shipmentPriority','packagingEvidence','transportUnitId','unitsPerPackage','packagingConfig','visualProfile','rawImportRecord','stackLayerScope','alwaysOnBottom','alwaysOnTop','stackingCompatibility']);
export function businessFields(input={}) {return Object.fromEntries(BUSINESS_FIELDS.filter(k=>input[k]!==undefined).map(k=>[k,structuredClone(input[k])]));}
export function clusterKey(c={}) {return JSON.stringify([c.customerId||'',c.sku||c.sourceCargoId||c.cargoId,c.lotId||'',c.unloadGroup||c.unloadSequence||c.portSequence||1]);}

const names=[[/air purifier/i,'空气净化器'],[/coffee/i,'咖啡设备'],[/curtain/i,'窗帘配件'],[/table|desk/i,'桌具套装'],[/bedding|textile/i,'家纺用品'],[/storage|organizer/i,'收纳用品'],[/lamp|light/i,'灯具套装'],[/chair/i,'座椅套装'],[/kitchen/i,'厨房用品'],[/tool/i,'工具套装']];
export function configurePackaging(raw={}) {
  const c={...raw};const l=Number(c.length??c.lengthMm),w=Number(c.width??c.widthMm),h=Number(c.height??c.heightMm),mass=c.weight??c.weightKg;
  const prior=c.packagingConfig||{};const type=String(c.packagingType||'').toUpperCase();
  const explicit=PACKAGING_CATALOG.find(t=>t.id===type);let family=prior.template||explicit?.family;
  const material=String(c.externalMetadata?.sourceFields?.['Package material']||c.sourceFields?.['Package material']||'').toUpperCase();
  if(!family)family=material==='WOOD'?'crate':material==='METAL'?'flightcase':material==='PLASTIC'?'plastic_tote':'carton';
  if(family==='carton')family=l/Math.max(w,h)>3?'long_carton':h/Math.max(l,w)<.3?'flat_carton':h>Math.max(l,w)*1.3?'tall_carton':'carton';
  const configuredName=!c.name||!/[\u3400-\u9fff]/.test(c.name);
  if(configuredName) {
    const translation=names.find(([pattern])=>pattern.test(c.name||''))?.[1];
    const candidate=translation||(family==='long_carton'?'长条家居配件':family==='flat_carton'?(Number(mass)>60?'设备板件套装':'拆装家具板件'):family==='crate'?'设备组件':family==='flightcase'?'精密设备':Number(mass)>60?'五金组件套装':family==='tall_carton'?'立式家用电器':'家居用品套装');
    c.originalName=c.originalName??c.name??null;c.name=candidate;
  }
  c.packagingConfig={version:'commerce-v4',...prior,template:family,outerDimensionsMm:[l,w,h],nameBasis:configuredName?'CONFIGURED_DISPLAY_NAME':prior.nameBasis||'INPUT_NAME',originalName:c.originalName??prior.originalName??null};
  return c;
}

export const FREIGHT_RULES=Object.freeze([
 {id:'CTU-2014',title:'CTU 装载与系固指导',kind:'GUIDANCE',effective:'2014',url:'https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx'},
 {id:'SOLAS-VGM',title:'装船前取得 VGM',kind:'SHIP_LOADING',effective:'2016-07-01',url:'https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx'},
 {id:'IMDG-42-24',title:'危险货物 IMDG 42-24',kind:'DANGEROUS_GOODS',effective:'2026-01-01',url:'https://www.imo.org/en/publications/pages/imdg%20code.aspx'},
 {id:'ISPM15',title:'木包装处理与标识',kind:'WOOD_PACKAGING',url:'https://www.ippc.int/en/archive-old-pages/phytosanitary-system/ispm-15-implementation/'},
 {id:'BOOKING-CUTOFF',title:'订舱 CY / SI / VGM 截止时间',kind:'BOOKING_SPECIFIC',url:'https://www.maersk.com/fr-fr/support/faqs/how-can-i-find-out-the-vessel-cut-off-time'},
 {id:'ACTUAL-CONTAINER',title:'实际门洞与箱体能力',kind:'EQUIPMENT',url:'https://www.hapag-lloyd.com/en/services-information/cargo-fleet/container/40-standard-high-cube.html'}
].map(r=>({...r,checkedAt:'2026-09-15'})));
