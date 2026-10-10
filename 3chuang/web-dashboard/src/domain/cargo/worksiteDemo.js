// Designed demonstration inputs, never measurements from a real shipment.
// Gross package masses include their supplied transport bases.
const ports = ['Hamburg', 'Rotterdam', 'Antwerp'];
const common = { dangerous:false, canRotate:false, canLayFlat:false, canInvert:false,
  orientationPolicy:'FIXED_ORIENTATION', handlingPolicy:'fixed', source:'worksite-demo-design', dataClassification:'DEMO_DATA' };
const base = (port, suffix) => ({ ...common, cargoId:`worksite-${port}-${suffix}`, sku:`WS-${port}-${suffix}`,
  portSequence:port, destinationPort:ports[port-1], batchId:`WS-PORT-${port}`, batchLabel:`第 ${port} 港 · 现场演示`, eta:'', quantity:1 });
const groundUnit = { length:1200, width:1000, stackable:false, maxStackLayers:1,
  handlingMethod:'forklift', forkEntry:'FOUR_WAY', transportUnit:'整体托盘运输单元',
  packagingProfile:{ palletJackCompatible:true }, wooden:true,
  riskNotes:['演示输入：包装毛重包含托盘', '门外交接，箱内使用地牛；实际叉孔、坡道和设备能力须核实'] };

export const WORKSITE_DEMO = Object.freeze({
  id:'worksite-42', label:'现场作业 · 42 件混合包装', orderNo:'DEMO-WORKSITE-42',
  description:'三港均衡混装：站立人工三层纸箱、整托货、木箱、设备箱和易碎保护箱。展示叉车门外交接与地牛入箱；全部数据为设计演示输入。',
  dataClassification:'DEMO_DATA', containerType:'20GP', route:['Ningbo','Hamburg','Rotterdam','Antwerp'],
  items:Object.freeze([1,2,3].flatMap(port=>[
    {...base(port,'CTN'),name:['零售配件箱','维修工具箱','售后备件箱'][port-1],packagingType:'CARTON',
      length:600,width:500,height:550,weight:8,quantity:12,handlingMethod:'manual',stackable:true,
      maxStackLayers:3,maxSupportedWeight:24,heavy:false,wooden:false,forkEntry:'NOT_APPLICABLE',
      riskNotes:['演示包装承载 24 kg；实际订单需包装试验资料','人工最多三层，禁止踩踏货物']},
    {...base(port,'PLT'),...groundUnit,name:'缠膜整托备件',packagingType:'PALLETIZED_CARTONS',height:1600,weight:220},
    {...base(port,'CASE'),...groundUnit,name:port===1?'易碎仪器保护木箱':port===2?'控制设备运输箱':'木箱机械组件',
      packagingType:port===2?'EQUIPMENT_CASE':'WOOD_CRATE',height:port===2?1500:1550,weight:180,
      fragile:port===1, riskNotes:[...groundUnit.riskNotes,port===1?'易碎、禁止上压':'保持直立、禁止上压']}
  ]))
});
