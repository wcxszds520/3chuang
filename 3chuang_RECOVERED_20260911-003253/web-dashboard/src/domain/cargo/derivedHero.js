import {createExternalTaskSession} from './externalDatasets.js';
export async function createDerivedHeroSession(){
 const response=await fetch('/data/external/derived/renault-hero-v1.json');if(!response.ok)throw Error('派生来源清单读取失败');
 const registry=await response.json(),selected=new Map(registry.rows.map(r=>[r.sourceCargoId,r]));
 const instance={...registry.instance,items:registry.instance.items.filter(i=>selected.has(i.externalItemId)).map(i=>({...i,quantity:selected.get(i.externalItemId).selectedQuantity}))};
 const session=createExternalTaskSession(registry.dataset,instance);
 // Selection is explicit derived data. Original source record remains in the
 // provenance map and is rechecked independently by the backend adapter.
 session.cargo=session.cargo.map(c=>({...c,derivedProvenance:selected.get(c.sku)})).sort((a,b)=>a.sku.localeCompare(b.sku));
 session.sourceContainer=registry.container;session.selectedContainerType=registry.container.typeId;session.benchmarkMode='DERIVED_SINGLE_CONTAINER_DEMO';session.dataClassification='RENAULT_DERIVED_SINGLE_CONTAINER_DEMO';
 session.datasetCapabilities={...session.datasetCapabilities,benchmarkMode:session.benchmarkMode,fullSourceProblem:false};
 session.externalDataset={...session.externalDataset,derivedDemoId:registry.derivedDemoId,taskType:registry.taskType,displayName:'Renault / ESICUP',instanceLabel:'工业数据单柜演示',officialBenchmarkResult:false,containers:[registry.container],derivationRows:registry.rows};
 session.dataSource.cargo='货物规格来自 Renault / ESICUP 工业数据；当前数量与组合为单柜派生配置';
 return session;
}
