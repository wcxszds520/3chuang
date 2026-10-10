/**
 * AI 离线预录响应数据
 * 
 * 用于 Demo_Mode 离线模式：断网时使用预录响应返回 fallback = true
 * 覆盖 5 套基准数据集：小批量/中批量/大批量/混装/慈溪家电
 * 
 * Requirements: 4.7, 13.4
 */

/**
 * 预录的箱型推荐响应
 * key: cargo hash (MD5)
 * 由于离线模式下 hash 可能不匹配，提供按数据集名称的 fallback
 */
const offlineRecommendations = {
  // 小批量场景（≤20件）
  small: {
    recommendations: [
      { typeId: '20GP', name: '20尺标准柜', score: 95, reason: '小批量货物总体积小，20尺柜容量匹配度最高，经济性最优' },
      { typeId: '40GP', name: '40尺标准柜', score: 60, reason: '40尺柜空间富余较多，适合后续有加货需求的场景' },
      { typeId: '40HQ', name: '40尺高柜', score: 40, reason: '40尺高柜空间过大，小批量使用不经济' }
    ]
  },

  // 中批量场景（20-100件）
  medium: {
    recommendations: [
      { typeId: '40GP', name: '40尺标准柜', score: 92, reason: '中批量货物体积适中，40尺标准柜容量匹配度高，性价比最优' },
      { typeId: '40HQ', name: '40尺高柜', score: 78, reason: '40尺高柜额外高度提供缓冲空间，适合高度较高货物' },
      { typeId: '20GP', name: '20尺标准柜', score: 45, reason: '20尺柜容积可能不足，需要精确计算是否装得下' }
    ]
  },

  // 大批量场景（>100件）
  large: {
    recommendations: [
      { typeId: '40HQ', name: '40尺高柜', score: 96, reason: '大批量货物需要最大容积，40尺高柜提供最充裕的装载空间' },
      { typeId: '40GP', name: '40尺标准柜', score: 72, reason: '40尺标准柜基本满足需求，但高度可能受限' },
      { typeId: '20GP', name: '20尺标准柜', score: 25, reason: '20尺柜容积严重不足，不建议大批量使用' }
    ]
  },

  // 混装场景（多SKU混合）
  mixed: {
    recommendations: [
      { typeId: '40HQ', name: '40尺高柜', score: 93, reason: '混装场景货物规格多样，高柜额外高度有利于灵活堆叠' },
      { typeId: '40GP', name: '40尺标准柜', score: 80, reason: '40尺标准柜适合大部分混装场景，性价比较高' },
      { typeId: '20GP', name: '20尺标准柜', score: 50, reason: '混装货物种类多，20尺柜空间利用难度大' }
    ]
  },

  // 慈溪家电场景
  'cixi-appliances': {
    recommendations: [
      { typeId: '40HQ', name: '40尺高柜', score: 94, reason: '慈溪家电体积大、数量多，40尺高柜最大化装载空间利用率' },
      { typeId: '40GP', name: '40尺标准柜', score: 76, reason: '40尺标准柜可装下大部分家电，但高度受限需注意堆叠' },
      { typeId: '20GP', name: '20尺标准柜', score: 35, reason: '家电体积较大，20尺柜容积不足以满足批量出货需求' }
    ]
  }
};

/**
 * 预录的结果解释响应
 */
const offlineExplanations = {
  small: {
    explanation: '本方案采用体积优先策略，将小批量货物紧凑排列于20尺标准柜内。通过智能旋转和边缘填充，有效利用了柜内空间。货物重心分布均匀，满足宁波港进港规则要求。',
    highlights: ['紧凑排列', '重心均匀', '满足合规'],
    risks: []
  },

  medium: {
    explanation: '本方案采用重量平衡+体积优先混合策略。中批量货物按堆叠能力分层装载：底层放置重货确保稳定性，中层利用可堆叠货物的垂直空间，顶层填充轻质货物。整体利用率良好，重心偏差在安全范围内。',
    highlights: ['分层装载', '重心平衡', '利用率良好'],
    risks: []
  },

  large: {
    explanation: '大批量装箱采用多策略融合方案：首先按SKU分组，然后对每组应用最优排列方向。通过AI分析确定最佳装载顺序，重货在下、轻货在上，充分利用40尺高柜的垂直空间。方案满足所有合规要求。',
    highlights: ['多策略融合', 'SKU分组优化', '垂直空间利用'],
    risks: ['大批量装载需注意底层承重']
  },

  mixed: {
    explanation: '混装场景采用智能分层策略：AI分析各SKU尺寸特征后，将相似高度的货物归为同一层，减少层间空隙。不同规格货物通过旋转适配实现紧密排列，最大化空间利用率。重心经过优化计算，确保运输安全。',
    highlights: ['智能分层', '旋转适配', '重心优化'],
    risks: ['混装规格差异大需注意堆叠稳定性']
  },

  'cixi-appliances': {
    explanation: '慈溪家电专用方案：空气炸锅、取暖器、电风扇按堆叠能力和到港顺序智能排列。可堆叠家电充分利用垂直空间（空气炸锅3层、取暖器2层），不可堆叠货物填充剩余空间。方案兼顾装载效率和卸货便利性。',
    highlights: ['堆叠优化', '卸货便利', '家电专用策略'],
    risks: ['电风扇不可堆叠需单独放置']
  }
};

/**
 * 预录的策略建议响应
 */
const offlineStrategies = {
  small: {
    algorithmId: 'realistic4d_volume',
    sortStrategy: '按体积降序排列，小件填缝',
    reason: '小批量货物采用体积降序+单层密排策略，最大化底面积利用',
    strategy: '体积优先+密排',
    sortSuggestion: '按体积降序排列，小件填缝',
    reasoning: '小批量货物采用体积降序+单层密排策略，最大化底面积利用',
    expectedUtilization: '70-85%'
  },

  medium: {
    algorithmId: 'realistic4d_weight',
    sortStrategy: '重货先装底部，轻货填充上层',
    reason: '中批量采用重量降序+多层平衡策略，兼顾稳定性和利用率',
    strategy: '重量优先+多层平衡',
    sortSuggestion: '重货先装底部，轻货填充上层',
    reasoning: '中批量采用重量降序+多层平衡策略，兼顾稳定性和利用率',
    expectedUtilization: '65-80%'
  },

  large: {
    algorithmId: 'realistic4d_dense',
    sortStrategy: '按SKU分组，组内体积降序',
    reason: '大批量采用自定义排序+分层填充策略，按SKU分组最大化空间',
    strategy: '分组填充+紧凑排列',
    sortSuggestion: '按SKU分组，组内体积降序',
    reasoning: '大批量采用自定义排序+分层填充策略，按SKU分组最大化空间',
    expectedUtilization: '70-85%'
  },

  mixed: {
    algorithmId: 'realistic4d_dense',
    sortStrategy: '相似高度货物同层，减少空隙',
    reason: '混装采用高度分组+密排策略，相似高度货物同层减少空隙',
    strategy: '高度分组+密排',
    sortSuggestion: '相似高度货物同层，减少空隙',
    reasoning: '混装采用高度分组+密排策略，相似高度货物同层减少空隙',
    expectedUtilization: '65-80%'
  },

  'cixi-appliances': {
    algorithmId: 'realistic4d_stacking',
    sortStrategy: '堆叠能力强的货物打底，充分利用垂直空间',
    reason: '家电场景优先堆叠能力强的货物打底，充分利用垂直空间',
    strategy: '堆叠优先+分层',
    sortSuggestion: '堆叠能力强的货物打底，充分利用垂直空间',
    reasoning: '家电场景优先堆叠能力强的货物打底，充分利用垂直空间',
    expectedUtilization: '70-85%'
  }
};

/**
 * 根据货物数量和SKU数推断数据集类型
 * @param {Array} cargoList - 货物清单
 * @returns {string} 数据集类型 key
 */
function inferDatasetType(cargoList) {
  if (!cargoList || cargoList.length === 0) return 'small';

  const totalQuantity = cargoList.reduce((sum, c) => sum + (c.quantity || 1), 0);
  const skuCount = cargoList.length;

  // 检测慈溪家电特征
  const cixiKeywords = ['空气炸锅', '取暖器', '电风扇', '家电'];
  const hasCixiCargo = cargoList.some(c =>
    cixiKeywords.some(kw => (c.name || '').includes(kw))
  );
  if (hasCixiCargo) return 'cixi-appliances';

  // 按数量和SKU数判断
  if (skuCount >= 4 || (skuCount >= 3 && totalQuantity > 50)) return 'mixed';
  if (totalQuantity > 100) return 'large';
  if (totalQuantity > 20) return 'medium';
  return 'small';
}

/**
 * 获取离线推荐响应
 * @param {string|null} cargoHash - 货物 hash（可选）
 * @param {Array} cargoList - 货物清单（用于推断数据集类型）
 * @returns {Object} 推荐响应
 */
function getOfflineRecommendation(cargoHash, cargoList) {
  const datasetType = inferDatasetType(cargoList);
  const response = offlineRecommendations[datasetType] || offlineRecommendations.medium;
  return {
    ...response,
    fallback: true,
    source: 'offline_preset',
    sourceCode: 'OFFLINE_DEMO',
    dataClassification: 'DEMO_DATA'
  };
}

/**
 * 获取离线解释响应
 * @param {string|null} cargoHash - 货物 hash（可选）
 * @param {Array} cargoList - 货物清单（用于推断数据集类型）
 * @returns {Object} 解释响应
 */
function getOfflineExplanation(cargoHash, cargoList) {
  const datasetType = inferDatasetType(cargoList);
  const response = offlineExplanations[datasetType] || offlineExplanations.medium;
  return {
    ...response,
    explanation: `【OFFLINE_DEMO 预录文本，不作为算法或合规结论】${response.explanation}`,
    fallback: true,
    source: 'offline_preset',
    sourceCode: 'OFFLINE_DEMO',
    dataClassification: 'DEMO_DATA'
  };
}

/**
 * 获取离线策略响应
 * @param {string|null} cargoHash - 货物 hash（可选）
 * @param {Array} cargoList - 货物清单（用于推断数据集类型）
 * @returns {Object} 策略响应
 */
function getOfflineStrategy(cargoHash, cargoList) {
  const datasetType = inferDatasetType(cargoList);
  const response = offlineStrategies[datasetType] || offlineStrategies.medium;
  return {
    ...response,
    fallback: true,
    source: 'offline_preset',
    sourceCode: 'OFFLINE_DEMO',
    dataClassification: 'DEMO_DATA'
  };
}

module.exports = {
  offlineRecommendations,
  offlineExplanations,
  offlineStrategies,
  inferDatasetType,
  getOfflineRecommendation,
  getOfflineExplanation,
  getOfflineStrategy
};
