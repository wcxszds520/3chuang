/**
 * 高级模拟装箱数据生成器 V2
 * 
 * 核心策略：
 * 1. LIFO原则：远站点货物放最里面，近站点货物放门口
 * 2. 层层堆叠：从底部到顶部，充分利用高度
 * 3. 智能填充：不同货物可以共享深度空间
 * 4. 物理约束：必须有支撑，不能悬空
 */

/**
 * 计算装箱方案
 * @param {Object} containerSize - 容器尺寸 {length, width, height}
 * @param {Array} cargoTypes - 货物类型列表
 * @returns {Object} 装箱结果
 */
function calculatePacking(containerSize, cargoTypes) {
  console.log('========== 开始高级装箱模拟 V2 ==========');
  console.log('容器尺寸:', containerSize);
  
  // 步骤1：按卸货优先级排序（远->近，LIFO原则）
  const sortedCargo = [...cargoTypes].sort((a, b) => {
    const priorityMap = { 'Station_C (远)': 0, 'Station_B (中)': 1, 'Station_A (近)': 2 };
    return priorityMap[a.destination] - priorityMap[b.destination];
  });
  
  console.log('装载顺序（远->近）:', sortedCargo.map(c => c.destination));
  
  // 步骤2：初始化
  const loadedCargo = [];
  let totalWeight = 0;
  let loadingOrder = 1;
  
  // 步骤3：为每种货物分配深度区域（Y轴）
  let currentY = 0;
  const cargoZones = [];
  
  for (const cargoType of sortedCargo) {
    const zoneWidth = cargoType.w;
    const zonesNeeded = Math.ceil(cargoType.total / calculateZoneCapacity(containerSize, cargoType));
    
    for (let i = 0; i < zonesNeeded && currentY < containerSize.width; i++) {
      if (currentY + zoneWidth <= containerSize.width) {
        cargoZones.push({
          cargoType,
          startY: currentY,
          endY: currentY + zoneWidth,
          capacity: calculateZoneCapacity(containerSize, cargoType)
        });
        currentY += zoneWidth;
      }
    }
  }
  
  console.log(`\n创建了 ${cargoZones.length} 个装载区域`);
  
  // 步骤4：在每个区域内填充货物
  for (const zone of cargoZones) {
    const { cargoType, startY, capacity } = zone;
    const count = Math.min(capacity, cargoType.total - countLoaded(loadedCargo, cargoType.name));
    
    if (count <= 0) continue;
    
    console.log(`\n装载区域 Y=${startY}~${zone.endY}: ${cargoType.name} x${count}`);
    
    const zoneResult = fillZone(containerSize, cargoType, startY, count, loadingOrder);
    
    loadedCargo.push(...zoneResult.loaded);
    loadingOrder += zoneResult.loaded.length;
    totalWeight += zoneResult.loaded.length * cargoType.weight;
    
    console.log(`  实际装载: ${zoneResult.loaded.length} 件`);
  }
  
  // 步骤5：计算空间利用率
  const containerVolume = containerSize.length * containerSize.width * containerSize.height;
  const cargoVolume = loadedCargo.reduce((sum, item) => {
    return sum + (item.rotation.length * item.rotation.width * item.rotation.height);
  }, 0);
  const spaceUtilization = (cargoVolume / containerVolume * 100).toFixed(2);
  
  console.log('\n========== 装箱完成 ==========');
  console.log(`总装载: ${loadedCargo.length} 件`);
  console.log(`总重量: ${totalWeight} kg`);
  console.log(`空间利用率: ${spaceUtilization}%`);
  
  return {
    loadedCargo,
    totalCargoCount: loadedCargo.length,
    totalWeight,
    spaceUtilization: parseFloat(spaceUtilization),
    unloadedCargo: []
  };
}

/**
 * 计算区域容量
 */
function calculateZoneCapacity(containerSize, cargoType) {
  const { l, w, h } = cargoType;
  const cols = Math.floor(containerSize.length / l);
  const layers = Math.floor(containerSize.height / h);
  return cols * layers;
}

/**
 * 统计已装载数量
 */
function countLoaded(loadedCargo, cargoName) {
  return loadedCargo.filter(item => item.name === cargoName).length;
}

/**
 * 填充一个区域
 */
function fillZone(containerSize, cargoType, startY, maxCount, startOrder) {
  const loaded = [];
  const { l, w, h } = cargoType;
  let loadingOrder = startOrder;
  let count = 0;
  
  // 从左到右，从下到上填充
  let currentX = 0;
  
  while (currentX + l <= containerSize.length && count < maxCount) {
    let currentZ = 0;
    
    while (currentZ + h <= containerSize.height && count < maxCount) {
      // 后端坐标系：X=Length, Y=Width, Z=Height
      const position = { x: currentX, y: startY, z: currentZ };
      const rotation = { length: l, width: w, height: h };
      
      loaded.push({
        cargo: {
          name: cargoType.name,
          length: l,
          width: w,
          height: h,
          weight: cargoType.weight,
          quantity: 1,
          stackable: true,
          maxStackLayers: 10,
          canInvert: false,
          canLayFlat: false
        },
        position,
        rotation,
        loadingOrder: loadingOrder++,
        name: cargoType.name
      });
      
      count++;
      currentZ += h;
    }
    
    currentX += l;
  }
  
  return { loaded };
}

module.exports = {
  calculatePacking
};
