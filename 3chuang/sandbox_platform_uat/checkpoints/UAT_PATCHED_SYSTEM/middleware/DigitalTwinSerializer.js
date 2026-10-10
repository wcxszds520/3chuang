'use strict';
/**
 * DigitalTwinSerializer — 数字孪生 3D 渲染序列化器（UAT 补丁，API 适配器形态）
 *
 * 职责：将装箱引擎输出转换为前端 Three.js/WebGL 可直接渲染的 JSON：
 *  - stepSequence：按物理装载顺序（引擎 loadingIndex：由深到浅、由下到上）递增；
 *  - 坐标契约：外坐标 x（0=柜尾/深端，innerLength=门端）、y 重力轴、z 宽轴，
 *    附 containerFrame 元数据与单位声明，杜绝前端坐标系误读；
 *  - 旋转标识：每件带 orientation（如 YXZ=绕垂直轴 90°）与 rotationMatrixY
 *    （绕 y 轴旋转矩阵的 3×3 行主序数组），前端无需自行推断；
 *  - 渲染友好：颜色、批次、港序、businessLabel、warnings、containerFrame。
 */

const CONTAINER_FRAME = {
  axes: { x: 'length(0=deep end, innerLength=door)', y: 'height(0=floor, up)', z: 'width' },
  units: 'mm',
  doorSide: 'max-x',
  gravityAxis: 'y',
  upVector: [0, 1, 0]
};

function rotationFor(orientation) {
  // 引擎 orientation 标签：XYZ=原始姿态，YXZ=绕 y 轴 90° 换向，XZY=侧翻
  switch (String(orientation || 'XYZ').toUpperCase()) {
    case 'YXZ':
      return { yawDeg: 90, rollDeg: 0, rotationMatrixY: [0, 0, 1, 0, 1, 0, -1, 0, 0] };
    case 'XZY':
      return { yawDeg: 0, rollDeg: 90, rotationMatrixY: [1, 0, 0, 0, 0, 1, 0, -1, 0] };
    default:
      return { yawDeg: 0, rollDeg: 0, rotationMatrixY: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
  }
}

function serializePlacement(p, stepSequence) {
  const rot = rotationFor(p.orientation);
  return {
    stepSequence,
    cargoId: p.cargoId,
    unitId: p.unitId || null,
    sku: p.sku || null,
    name: p.name || null,
    position: { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100 },
    dimensions: { l: p.l, w: p.w, h: p.h },
    weightKg: p.weight || 0,
    orientation: p.orientation || 'XYZ',
    inverted: p.inverted === true,
    rotation: rot,
    color: p.color || null,
    type: p.type || 'normal',
    fragile: p.fragile === true,
    heavy: p.heavy === true,
    stackLevel: p.stackLevel || 1,
    batchId: p.batchId || null,
    batchLabel: p.batchLabel || null,
    portSequence: p.portSequence || 1,
    destinationPort: p.destinationPort || null,
    handling: { method: p.handlingMethod || null, forkEntry: p.forkEntry || null },
    source: p.algorithmMeta && p.algorithmMeta.spaceKind ? p.algorithmMeta.spaceKind : (p.algorithmMeta && p.algorithmMeta.placementMode) || null
  };
}

/**
 * @param {Object} orchestratorResult — AlgorithmOrchestrator 原始结果
 * @param {Object} container — 柜型规格
 * @returns {Object} digitalTwin JSON（与 /api/packing/generate 响应同层挂载于 data.digitalTwin）
 */
function serializeForDigitalTwin(orchestratorResult, container) {
  const loaded = [...(orchestratorResult.loadedCargo || [])].sort((a, b) => (a.loadingIndex || 0) - (b.loadingIndex || 0));
  const stepByStep = loaded.map((p, i) => serializePlacement(p, i + 1));
  const m = orchestratorResult.metrics || {};
  return {
    schema: 'PORTCUBE_DIGITAL_TWIN_V1',
    containerFrame: { ...CONTAINER_FRAME, spec: container },
    containerRender: {
      innerLength: container.innerLength,
      innerWidth: container.innerWidth,
      innerHeight: container.innerHeight,
      doorSide: 'max-x'
    },
    summary: {
      totalSteps: stepByStep.length,
      utilizationPct: Math.round((Number(m.space_utilization) || 0) * 100) / 100,
      totalWeightKg: orchestratorResult.totalWeight || 0,
      cog: orchestratorResult.cog || null,
      cogOffset: orchestratorResult.cogOffset || null,
      algorithm: m.algorithm_id || null,
      strategy: m.strategy_used || null,
      solveMs: m.elapsed_ms || null
    },
    warnings: orchestratorResult.warnings || [],
    unplaced: (orchestratorResult.unloadedCargo || []).map((u) => ({ cargoId: u.cargoId, sku: u.sku, reason: u.reason || null })),
    stepByStep
  };
}

module.exports = { serializeForDigitalTwin, rotationFor, CONTAINER_FRAME };
