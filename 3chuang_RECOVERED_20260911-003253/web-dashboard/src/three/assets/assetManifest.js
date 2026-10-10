export const HERO_ASSET_MANIFEST = Object.freeze({
  review_container40hq: Object.freeze({url:'/assets/3d/commerce-v6/container.glb',kind:'container',typeId:'40HQ'}),
  industrial_container40hq: Object.freeze({url:'/assets/3d/industrial-v3/container.glb',kind:'container',typeId:'40HQ'}),
  rebuild_source5870: Object.freeze({url:'/assets/3d/rebuild-v2/container-source-5870.glb',kind:'container'}),
  rebuild_container40hq: Object.freeze({url:'/assets/3d/rebuild-v2/container-40hq.glb',kind:'container',typeId:'40HQ'}),
  ...Object.fromEntries(['carton','crate','equipment_case'].map(f=>['quality_'+f,Object.freeze({url:'/assets/3d/quality-v1/'+f+'.glb',kind:'parametric-cargo',contract:'component-affine-v1'})])),
  ...Object.fromEntries(['carton','carton_reinforced','carton_strapped','carton_long_flat','crate','crate_reinforced','equipment_case','equipment_case_reinforced','neutral_panel_standard','neutral_panel_reinforced','neutral_long','neutral_flat','neutral_banded'].map(variant=>[`external_${variant}`,Object.freeze({url:`/assets/3d/external-hero-v1/${variant.startsWith('neutral')?'neutral_panel_standard':variant}.glb`,kind:'parametric-cargo',contract:'component-affine-v1'})])),
  ...Object.fromEntries(['carton', 'carton_reinforced', 'carton_long_flat', 'carton_strapped', 'crate', 'crate_reinforced', 'crate_heavy_skid', 'equipment_case', 'equipment_case_reinforced', 'generic', 'generic_long_flat', 'palletized', 'palletized_industrial', 'wrapped'].map(variant => [`precision_${variant}`, Object.freeze({ url: `/assets/3d/precision-v3/${variant}.glb`, kind: 'parametric-cargo', contract: 'component-affine-v1' })])),
  workerPush: Object.freeze({url:'/assets/3d/astra/portcube_worker_dock_push_a.glb', kind:'actor'}),
  palletJack: Object.freeze({url:'/assets/3d/precision-v3/pallet_jack_articulated.glb',kind:'actor'}),
  workerCarry: Object.freeze({url:'/assets/3d/astra/portcube_worker_dock_carrybox_a.glb', kind:'actor'}),
  astra_carton: Object.freeze({url:'/assets/3d/astra/portcube_cargo_carton_a.glb', kind:'cargo'}),
  astra_crate: Object.freeze({url:'/assets/3d/astra/portcube_cargo_wood_crate_a.glb', kind:'cargo'}),
  astra_palletized: Object.freeze({url:'/assets/3d/astra/portcube_cargo_pallet_load_a.glb', kind:'cargo'}),
  astra_equipment_case: Object.freeze({url:'/assets/3d/astra/portcube_cargo_metal_case_a.glb', kind:'cargo'}),
  axisCalibration: Object.freeze({ url: '/assets/3d/axis-calibration.glb', kind: 'calibration' }),
  container20gp: Object.freeze({ url: '/assets/3d/precision-v3/container-20gp.glb', kind: 'container', typeId: '20GP' }),
  container40gp: Object.freeze({ url: '/assets/3d/precision-v3/container-40gp.glb', kind: 'container', typeId: '40GP' }),
  container40hq: Object.freeze({ url: '/assets/3d/precision-v3/container-40hq.glb', kind: 'container', typeId: '40HQ' }),
  forkliftStandard: Object.freeze({ url: '/assets/3d/precision-v3/forklift_articulated.glb', kind: 'actor' }),
  cargoKit: Object.freeze({ url: '/assets/3d/cargo-kit-inspection.glb', kind: 'cargo-kit' }),
  inspectionBay: Object.freeze({ url: '/assets/3d/inspection-bay.glb', kind: 'environment' }),
  workerA: Object.freeze({ url: '/assets/3d/precision-v3/worker_articulated.glb', kind: 'actor' })
});

export function assetKeyForContainer(typeId) {
  return ({ '20GP': 'container20gp', '40GP': 'container40gp', '40HQ': 'container40hq' })[String(typeId).toUpperCase()] || null;
}
