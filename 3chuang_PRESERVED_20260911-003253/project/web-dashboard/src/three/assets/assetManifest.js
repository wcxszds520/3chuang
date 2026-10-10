export const HERO_ASSET_MANIFEST = Object.freeze({
  astra_wrapped: Object.freeze({url:'/assets/3d/rebuild-v3/cargo_wrapped.glb', kind:'cargo', revision:'PORTCUBE_REBUILD_V3'}),
  astra_fibc: Object.freeze({url:'/assets/3d/rebuild-v3/cargo_fibc.glb', kind:'cargo', revision:'PORTCUBE_REBUILD_V3'}),
  workerPush: Object.freeze({url:'/assets/3d/astra/portcube_worker_dock_push_a.glb', kind:'actor'}),
  palletJack: Object.freeze({url:'/assets/3d/rebuild-v3/pallet_jack_articulated.glb',kind:'actor', revision:'PORTCUBE_REBUILD_V3'}),
  palletJackShort: Object.freeze({url:'/assets/3d/rebuild-v3/pallet_jack_short.glb',kind:'actor', revision:'PORTCUBE_REBUILD_V3'}),
  workerCarry: Object.freeze({url:'/assets/3d/astra/portcube_worker_dock_carrybox_a.glb', kind:'actor'}),
  astra_carton: Object.freeze({url:'/assets/3d/rebuild-v3/cargo_carton.glb', kind:'cargo', revision:'PORTCUBE_REBUILD_V3'}),
  astra_crate: Object.freeze({url:'/assets/3d/rebuild-v3/cargo_crate.glb', kind:'cargo', revision:'PORTCUBE_REBUILD_V3'}),
  astra_palletized: Object.freeze({url:'/assets/3d/rebuild-v3/cargo_palletized.glb', kind:'cargo', revision:'PORTCUBE_REBUILD_V3'}),
  astra_equipment_case: Object.freeze({url:'/assets/3d/rebuild-v3/cargo_equipment_case.glb', kind:'cargo', revision:'PORTCUBE_REBUILD_V3'}),
  axisCalibration: Object.freeze({ url: '/assets/3d/axis-calibration.glb', kind: 'calibration' }),
  container20gp: Object.freeze({ url: '/assets/3d/rebuild-v3/container_20gp.glb', kind: 'container', typeId: '20GP', revision:'PORTCUBE_REBUILD_V3' }),
  container40gp: Object.freeze({ url: '/assets/3d/rebuild-v3/container_40gp.glb', kind: 'container', typeId: '40GP', revision:'PORTCUBE_REBUILD_V3' }),
  container40hq: Object.freeze({ url: '/assets/3d/rebuild-v3/container_40hq.glb', kind: 'container', typeId: '40HQ', revision:'PORTCUBE_REBUILD_V3' }),
  forkliftStandard: Object.freeze({ url: '/assets/3d/rebuild-v3/forklift_articulated.glb', kind: 'actor', revision:'PORTCUBE_REBUILD_V3' }),
  cargoKit: Object.freeze({ url: '/assets/3d/cargo-kit-inspection.glb', kind: 'cargo-kit' }),
  inspectionBay: Object.freeze({ url: '/assets/3d/inspection-bay.glb', kind: 'environment' }),
  workerA: Object.freeze({ url: '/assets/3d/rebuild-v3/worker_articulated.glb', kind: 'actor', revision:'PORTCUBE_REBUILD_V3' })
});

export function assetKeyForContainer(typeId) {
  return ({ '20GP': 'container20gp', '40GP': 'container40gp', '40HQ': 'container40hq' })[String(typeId).toUpperCase()] || 'container40hq';
}
