/**
 * 演示模式预录装箱方案 (Req 13.4)
 * 
 * 当用户导入演示数据后，同时保存对应的预录装箱方案到 store.precomputedPlan。
 * 断网时 request.js 会自动使用此数据作为 /packing/generate 的降级响应。
 * 
 * 数据结构与 /api/packing/generate 响应一致：
 * { spaceUtilization, totalWeight, loadedCargo[], unloadedCargo[], ... }
 */

/**
 * 生成预录装箱方案
 * 根据货物列表和柜型生成一个合理的预录方案
 * 使用简单的贪心排列算法，确保离线时有可展示的 3D 结果
 * 
 * @param {Array} cargoList - 货物列表（SKU 级别，含 quantity）
 * @param {Object} container - 柜型信息
 * @returns {Object} 预录装箱方案
 */
function generatePrecomputedPlan(cargoList, container) {
  // 默认使用 40HQ 柜型
  const containerInfo = container || {
    typeId: '40HQ',
    name: '40英尺高柜',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    maxWeight: 26000
  };

  // 展开 SKU 为单件货物
  const expandedCargo = [];
  let colorIndex = 0;
  const colors = ['#4A90D9', '#E8734A', '#50C878', '#9B59B6', '#F39C12', '#1ABC9C'];

  cargoList.forEach((sku, skuIdx) => {
    const qty = sku.quantity || 1;
    const color = colors[skuIdx % colors.length];
    for (let i = 0; i < qty; i++) {
      expandedCargo.push({
        ...sku,
        quantity: 1,
        _skuIndex: skuIdx,
        _itemIndex: i,
        _color: color
      });
    }
  });

  // 简单贪心排列：按行列层排列货物
  const loadedCargo = [];
  let currentX = 0;
  let currentY = 0;
  let currentZ = 0;
  let rowMaxHeight = 0;
  let layerMaxWidth = 0;
  let loadingIndex = 0;
  let totalWeight = 0;
  let totalVolume = 0;

  const maxX = containerInfo.innerWidth;
  const maxY = containerInfo.innerHeight;
  const maxZ = containerInfo.innerLength;
  const containerVolume = (maxX * maxY * maxZ) / 1e9; // 立方米

  for (const item of expandedCargo) {
    const l = item.length || 400;
    const w = item.width || 350;
    const h = item.height || 300;
    const weight = item.weight || 5;

    // 检查是否能放入当前行
    if (currentX + w > maxX) {
      // 换行
      currentX = 0;
      currentZ += layerMaxWidth;
      layerMaxWidth = 0;
    }

    // 检查是否能放入当前层（Z 方向）
    if (currentZ + l > maxZ) {
      // 换层
      currentZ = 0;
      currentY += rowMaxHeight;
      rowMaxHeight = 0;
      layerMaxWidth = 0;
      currentX = 0;
    }

    // 检查是否超出高度
    if (currentY + h > maxY) {
      // 放不下了，跳过
      break;
    }

    // 放置货物
    loadedCargo.push({
      cargoId: `precomputed_${item.name}_${loadingIndex}`,
      name: item.name,
      skuId: item.name,
      x: currentX,
      y: currentY,
      z: currentZ,
      l: l,
      w: w,
      h: h,
      weight: weight,
      color: item._color,
      type: weight >= 20 ? 'heavy' : (item.fragile ? 'fragile' : 'normal'),
      fragile: item.fragile || false,
      batchKey: item.eta || 'default',
      batchIndex: item._skuIndex,
      skuIndex: item._skuIndex,
      loadingIndex: loadingIndex,
      totalSKUsInBatch: cargoList.length
    });

    totalWeight += weight;
    totalVolume += (l * w * h) / 1e9;
    loadingIndex++;

    // 更新位置
    currentX += w;
    if (h > rowMaxHeight) rowMaxHeight = h;
    if (l > layerMaxWidth) layerMaxWidth = l;
  }

  // 未装入的货物
  const unloadedCargo = expandedCargo.slice(loadingIndex).map((item, idx) => ({
    cargoId: `unloaded_${item.name}_${idx}`,
    name: item.name,
    length: item.length,
    width: item.width,
    height: item.height,
    weight: item.weight,
    reason: '空间不足'
  }));

  // 计算利用率
  const spaceUtilization = containerVolume > 0
    ? Math.min(99.9, (totalVolume / containerVolume) * 100)
    : 0;

  return {
    spaceUtilization: parseFloat(spaceUtilization.toFixed(2)),
    totalWeight: parseFloat(totalWeight.toFixed(2)),
    totalCargoCount: loadedCargo.length,
    loadedCargo: loadedCargo,
    unloadedCargo: unloadedCargo,
    containerType: containerInfo.typeId,
    // 标记为预录数据
    _precomputed: true,
    _generatedAt: new Date().toISOString(),
    // AI 解释降级文本
    ext_aiExplanation: {
      explanation: `[离线模式] 本方案为预录演示数据，基于贪心排列算法生成。共装入${loadedCargo.length}件货物，空间利用率${spaceUtilization.toFixed(1)}%。实际在线计算可获得更优方案。`,
      highlights: ['离线可用', '演示数据'],
      risks: unloadedCargo.length > 0 ? [`${unloadedCargo.length}件货物未装入（预录方案限制）`] : []
    }
  };
}

export default {
  generatePrecomputedPlan
};
