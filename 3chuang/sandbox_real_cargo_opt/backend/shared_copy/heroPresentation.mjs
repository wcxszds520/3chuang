export const PRESENTATION_VERSION='external-hero-v1';
export const NEUTRAL_VARIANTS=['neutral_panel_standard','neutral_panel_reinforced','neutral_long','neutral_flat','neutral_banded'];
const stableHash=value=>[...String(value)].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
/** A read-only presentation projection. Never supplies or changes physical facts. */
export function sourcePresentation(item){
 const source=item.externalMetadata||item, id=source.externalItemId||item.sku||item.sourceCargoId;
 const material=source.sourceFields?.['Package material']??null;
 const l=Number(source.lengthMm??item.length),w=Number(source.widthMm??item.width),h=Number(source.heightMm??item.height),weight=source.weightKg??item.weight;
 const hash=stableHash(id),aspect=Math.max(l,w)/Math.min(l,w),flat=h/Math.max(l,w)<.38;
 let family='NEUTRAL_INDUSTRIAL_PACKAGE',variant=flat?'neutral_flat':aspect>2?'neutral_long':NEUTRAL_VARIANTS[hash%5];
 if(material==='CARDBOARD'){family='CARTON';variant=flat?'carton_long_flat':weight>250?'carton_reinforced':aspect>1.4?'carton_strapped':'carton';}
 if(material==='WOOD'){family='WOOD_CRATE';variant=weight>600?'crate_heavy_skid':Math.max(l,w,h)>1400?'crate_reinforced':'crate';}
 if(material==='METAL'){family='METAL_CASE';variant=weight>800?'equipment_case_reinforced':'equipment_case';}
 const tones={CARTON:['#aa8760','#a58967','#b29673'],WOOD_CRATE:['#a58d66','#9d835c','#ad946d'],METAL_CASE:['#64777b','#7a8079','#626e74'],NEUTRAL_INDUSTRIAL_PACKAGE:['#82918a','#7a858c','#968e7e']};
 return {version:PRESENTATION_VERSION,sourceCargoId:id,sourceMaterial:material,presentationFamily:family,structuralVariant:variant,colorVariant:tones[family][hash%3],labelStyle:`restrained-${hash%2}`,surfaceVariant:family==='CARTON'?'ambientCG-Cardboard004':family==='WOOD_CRATE'?'ambientCG-Wood058':family==='METAL_CASE'?'powder-coated-with-hardware':'neutral-matte',businessFactMutation:false};
}
export function presentationPlan(plan,cargo,{enabled=false,wall=false}={}){
 if(!enabled)return plan;
 const sources=new Map(cargo.map(c=>[c.cargoId,c]));
 const enrich=p=>({...p,presentationProfile:sourcePresentation(sources.get(p.sourceCargoId)||sources.get(p.cargoId)||p)});
 const loaded=(plan.loadedCargo||[]).map(enrich);
 // A contiguous solver-space interval. Cargo transforms and physical dimensions
 // are retained exactly; only visibility changes for the wall review.
 let wallIds=null;if(wall){let best=null;const starts=[...new Set(loaded.map(p=>p.x))];for(const start of starts){const group=loaded.filter(p=>p.x>=start&&p.x<start+5000);const families=new Set(group.map(p=>p.presentationProfile.presentationFamily));if(families.size>=3&&(!best||group.length>best.length))best=group;}wallIds=(best||loaded).map(p=>p.cargoId);}
 return {...plan,loadedCargo:loaded,unloadedCargo:(plan.unloadedCargo||[]).map(enrich),presentationOnly:{version:PRESENTATION_VERSION,wall,wallIds},containerInfo:{...plan.containerInfo,presentationVersion:PRESENTATION_VERSION}};
}
