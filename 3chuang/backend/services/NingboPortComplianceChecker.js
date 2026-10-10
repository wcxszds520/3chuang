/**
 * 宁波港合规校验服务
 * 
 * 【三大核心规则】（JT/T 1187-2018 + GB 16994.4-2023）：
 * 规则1：装柜顺序合规 - 最晚到港先装（内侧），最早到港后装（箱门端）
 * 规则2：偏载与重心合规 - 前后≤10%，左右≤5%，重心靠近底部
 * 规则3：总重与堆叠合规 - 总重≤额定载重，重货打底、易碎品上层
 * 
 * 6大维度：装柜顺序、偏载、超重、堆叠、截关、报关
 */

class NingboPortComplianceChecker {
  // 合规阈值常量
  static THRESHOLDS = {
    COG_FRONT_BACK_MAX: 10,    // 前后偏载最大10%
    COG_LEFT_RIGHT_MAX: 5,     // 左右偏载最大5%
    WEIGHT_20GP_MAX: 28000,    // 20GP最大28吨
    WEIGHT_40GP_MAX: 26000,    // 40GP/HQ最大26吨
    HEAVY_ON_LIGHT_RATIO: 1.5, // 重货压轻货容忍比例
    CY_CLOSING_CONFLICT_HOURS: 24, // 截关冲突阈值24小时
    CUSTOMS_DISTANCE_MAX: 1000 // 同票货物最大距离1000mm
  };

  /**
   * 1. 装柜顺序合规校验
   * 
   * 【核心规则1】JT/T 1187-2018《进出境集装箱船舶理箱业务规程》
   * 规则：loadingOrder应该与ETA顺序相反（早ETA晚装载）
   * 装柜顺序：批次3（最晚到港）→ 批次2（中间到港）→ 批次1（最早到港）
   * 物理位置：批次3在X=0（最内侧）→ 批次2在中间 → 批次1在X=Max（箱门端）
   */
  validateShippingOrder(loadedCargo) {
    console.log('[合规] 校验装柜顺序（核心规则1）...');
    
    const violations = [];
    let score = 100;
    
    // 检查是否有ETA数据
    const withETA = loadedCargo.filter(item => item.eta);
    if (withETA.length === 0) {
      return {
        dimension: '装柜顺序合规（核心规则1）',
        score: 100,
        status: 'pass',
        message: '无ETA数据，跳过校验',
        violations: []
      };
    }
    
    // 按X轴位置分组（X轴代表装柜顺序：X小=先装=内侧）
    const batches = {};
    withETA.forEach(item => {
      const etaKey = new Date(item.eta).toISOString().split('T')[0];
      if (!batches[etaKey]) {
        batches[etaKey] = {
          eta: item.eta,
          minX: Infinity,
          maxX: -Infinity,
          count: 0
        };
      }
      batches[etaKey].minX = Math.min(batches[etaKey].minX, item.position.x);
      batches[etaKey].maxX = Math.max(batches[etaKey].maxX, item.position.x);
      batches[etaKey].count++;
    });
    
    // 按ETA排序（从早到晚）
    const sortedBatches = Object.keys(batches).sort((a, b) => {
      const etaA = new Date(batches[a].eta).getTime();
      const etaB = new Date(batches[b].eta).getTime();
      return etaA - etaB;
    });
    
    // 检查：最早到港的应该在X轴最大处（箱门端）
    for (let i = 0; i < sortedBatches.length - 1; i++) {
      const earlierBatch = batches[sortedBatches[i]];
      const laterBatch = batches[sortedBatches[i + 1]];
      
      // 如果早到港的批次X坐标更小（更靠内侧），说明顺序错了
      if (earlierBatch.minX < laterBatch.maxX) {
        violations.push({
          cargo: sortedBatches[i],
          issue: `批次${sortedBatches[i]}（早到港）位置X=${earlierBatch.minX}mm靠内侧，违反LIFO规则`,
          suggestion: '调整装柜顺序，使晚到港货物先装（内侧），早到港货物后装（箱门端）'
        });
        score -= 20;
      }
    }
    
    // 输出批次位置信息（用于路演展示）
    console.log('  批次位置分布:');
    sortedBatches.forEach(batchKey => {
      const batch = batches[batchKey];
      console.log(`    ${batchKey}: X范围[${batch.minX}, ${batch.maxX}]mm, 货物${batch.count}件`);
    });
    
    return {
      dimension: '装柜顺序合规（核心规则1）',
      score: Math.max(0, score),
      status: score >= 90 ? 'pass' : score >= 70 ? 'warning' : 'critical',
      message: violations.length === 0 ? 
        '装柜顺序符合宁波港LIFO规则（晚到港先装，早到港后装）' : 
        `发现${violations.length}处违规`,
      violations,
      batchPositions: batches  // 新增：批次位置信息，用于路演展示
    };
  }

  /**
   * 2. 重心偏载校验
   * 
   * 【核心规则2】GB 16994.4-2023《港口作业安全要求 第4部分：普通货物集装箱》
   * 规则：前后偏载≤10%，左右偏载≤5%，重心尽量靠近底部
   */
  validateCOGOffset(loadedCargo, container) {
    console.log('[合规] 校验重心偏载（核心规则2）...');
    
    if (loadedCargo.length === 0) {
      return {
        dimension: '偏载合规（核心规则2）',
        score: 100,
        status: 'pass',
        message: '无货物，无偏载风险',
        violations: []
      };
    }
    
    // 计算重心
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;
    
    loadedCargo.forEach(item => {
      const weight = item.weight * (item.quantity || 1);
      const centerX = item.position.x + (item.rotation?.length || item.length) / 2;
      const centerY = item.position.y + (item.rotation?.height || item.height) / 2;
      const centerZ = item.position.z + (item.rotation?.width || item.width) / 2;
      
      totalWeight += weight;
      weightedX += centerX * weight;
      weightedY += centerY * weight;
      weightedZ += centerZ * weight;
    });
    
    const cogX = weightedX / totalWeight;
    const cogY = weightedY / totalWeight;
    const cogZ = weightedZ / totalWeight;
    
    // 计算偏差百分比
    const centerX = container.innerLength / 2;
    const centerZ = container.innerWidth / 2;
    
    const offsetX = Math.abs(cogX - centerX) / container.innerLength * 100;
    const offsetZ = Math.abs(cogZ - centerZ) / container.innerWidth * 100;
    const heightRatio = (cogY / container.innerHeight * 100).toFixed(1);
    
    const violations = [];
    let score = 100;
    
    if (offsetX > NingboPortComplianceChecker.THRESHOLDS.COG_LEFT_RIGHT_MAX) {
      violations.push({
        type: '左右偏载超标',
        value: `${offsetX.toFixed(2)}%`,
        threshold: `${NingboPortComplianceChecker.THRESHOLDS.COG_LEFT_RIGHT_MAX}%`,
        suggestion: '调整货物左右分布，使重心居中'
      });
      score -= 25;
    }
    
    if (offsetZ > NingboPortComplianceChecker.THRESHOLDS.COG_FRONT_BACK_MAX) {
      violations.push({
        type: '前后偏载超标',
        value: `${offsetZ.toFixed(2)}%`,
        threshold: `${NingboPortComplianceChecker.THRESHOLDS.COG_FRONT_BACK_MAX}%`,
        suggestion: '调整货物前后分布，避免头重脚轻'
      });
      score -= 25;
    }
    
    // 检查重心高度（应该≤50%）
    if (parseFloat(heightRatio) > 50) {
      violations.push({
        type: '重心过高',
        value: `${heightRatio}%`,
        threshold: '≤50%',
        suggestion: '重心偏高，建议将重货放在底层'
      });
      score -= 15;
    }
    
    console.log(`  重心位置: X=${cogX.toFixed(0)}mm, Y=${cogY.toFixed(0)}mm, Z=${cogZ.toFixed(0)}mm`);
    console.log(`  偏载百分比: 前后${offsetZ.toFixed(1)}%（≤10%），左右${offsetX.toFixed(1)}%（≤5%）`);
    console.log(`  重心高度: ${heightRatio}%（建议≤50%）`);
    
    return {
      dimension: '偏载合规（核心规则2）',
      score: Math.max(0, score),
      status: score >= 90 ? 'pass' : score >= 70 ? 'warning' : 'critical',
      message: violations.length === 0 ? 
        `重心偏差正常（前后${offsetZ.toFixed(1)}%≤10%，左右${offsetX.toFixed(1)}%≤5%，高度${heightRatio}%）` : 
        `重心偏差超标`,
      violations,
      metrics: {
        offsetX: offsetX.toFixed(2) + '%',
        offsetZ: offsetZ.toFixed(2) + '%',
        heightRatio: heightRatio + '%',
        cogPosition: { 
          x: cogX.toFixed(0) + 'mm', 
          y: cogY.toFixed(0) + 'mm', 
          z: cogZ.toFixed(0) + 'mm' 
        }
      }
    };
  }

  /**
   * 3. 超重校验
   * 
   * 【核心规则3】GB 16994.4-2023 + 船公司通用限重
   * 规则：20GP≤28t，40GP/HQ≤26t
   */
  validateWeight(loadedCargo, container) {
    console.log('[合规] 校验总重量（核心规则3）...');
    
    const totalWeight = loadedCargo.reduce((sum, item) => {
      // 注意：loadedCargo中每个item已经是单件货物，不需要再乘以quantity
      const weight = item.weight || 0;
      return sum + weight;
    }, 0);
    
    const maxWeight = container.typeId === '20GP' ? 
      NingboPortComplianceChecker.THRESHOLDS.WEIGHT_20GP_MAX : 
      NingboPortComplianceChecker.THRESHOLDS.WEIGHT_40GP_MAX;
    
    const weightRatio = (totalWeight / maxWeight * 100).toFixed(1);
    const violations = [];
    let score = 100;
    
    if (totalWeight > maxWeight) {
      violations.push({
        type: '超重',
        value: `${totalWeight.toFixed(0)}kg`,
        threshold: `${maxWeight}kg`,
        suggestion: `减少货物数量或更换更大柜型，当前超重${(totalWeight - maxWeight).toFixed(0)}kg`
      });
      score = 0;
    } else if (totalWeight > maxWeight * 0.95) {
      violations.push({
        type: '接近超重',
        value: `${totalWeight.toFixed(0)}kg`,
        threshold: `${maxWeight}kg`,
        suggestion: '重量已达额定载重95%，建议谨慎添加货物'
      });
      score = 75;
    }
    
    console.log(`  总重量: ${totalWeight.toFixed(0)}kg / ${maxWeight}kg（${weightRatio}%）`);
    
    return {
      dimension: '超重合规（核心规则3）',
      score,
      status: score >= 90 ? 'pass' : score >= 70 ? 'warning' : 'critical',
      message: violations.length === 0 ? 
        `总重量${totalWeight.toFixed(0)}kg，仅占${container.name}额定载重的${weightRatio}%，无超重风险` : 
        '超重风险',
      violations,
      metrics: {
        totalWeight: totalWeight.toFixed(0) + 'kg',
        maxWeight: maxWeight + 'kg',
        weightRatio: weightRatio + '%'
      }
    };
  }

  /**
   * 4. 堆叠合规校验
   * 
   * 【核心规则3】GB 16994.4-2023 物理安全底线
   * 规则：不超过maxStackLayers，重货打底、易碎品上层、禁止上重下轻
   * 
   * 优化：只检查同一X-Z位置上的堆叠（同一垂直柱）
   */
  validateStacking(loadedCargo) {
    console.log('[合规] 校验堆叠规则（核心规则3）...');
    
    const violations = [];
    let score = 100;
    
    // 按X-Z位置分组（同一垂直柱）
    const columns = {};
    loadedCargo.forEach(item => {
      const x = Math.floor(item.position.x / 100) * 100;  // 按100mm精度分组
      const z = Math.floor(item.position.z / 100) * 100;
      const key = `${x}-${z}`;
      
      if (!columns[key]) columns[key] = [];
      columns[key].push(item);
    });
    
    const columnCount = Object.keys(columns).length;
    console.log(`  堆叠垂直柱数: ${columnCount}个`);
    
    // 检查每一个垂直柱
    Object.keys(columns).forEach(columnKey => {
      const column = columns[columnKey];
      
      // 按Y坐标排序（从下到上）
      column.sort((a, b) => a.position.y - b.position.y);
      
      // 检查每一层
      for (let i = 0; i < column.length - 1; i++) {
        const lowerItem = column[i];
        const upperItem = column[i + 1];
        
        const lowerCargo = lowerItem.cargo || lowerItem;
        const upperCargo = upperItem.cargo || upperItem;
        
        // 检查下层是否有易碎品被非易碎品压住
        if (lowerCargo.fragile === true && upperCargo.fragile !== true) {
          violations.push({
            type: '易碎品被压',
            column: columnKey,
            lowerCargo: lowerCargo.name,
            upperCargo: upperCargo.name,
            suggestion: `易碎品${lowerCargo.name}被${upperCargo.name}压住，违反安全规则`
          });
          score -= 20;
        }
        
        // 检查是否重货压轻货
        const lowerWeight = lowerCargo.weight || 0;
        const upperWeight = upperCargo.weight || 0;
        
        if (upperWeight > lowerWeight * NingboPortComplianceChecker.THRESHOLDS.HEAVY_ON_LIGHT_RATIO) {
          violations.push({
            type: '重货压轻货',
            column: columnKey,
            lowerWeight: lowerWeight.toFixed(1),
            upperWeight: upperWeight.toFixed(1),
            suggestion: `上层${upperCargo.name}(${upperWeight.toFixed(0)}kg)明显重于下层${lowerCargo.name}(${lowerWeight.toFixed(0)}kg)，建议调整`
          });
          score -= 15;
        }
      }
    });
    
    // 统计货物类型分布
    const fragileCount = loadedCargo.filter(item => {
      const cargo = item.cargo || item;
      return cargo.fragile === true;
    }).length;
    
    const heavyCount = loadedCargo.filter(item => {
      const cargo = item.cargo || item;
      return (cargo.weight || 0) >= 20;
    }).length;
    
    console.log(`  货物类型: 重货${heavyCount}件, 易碎品${fragileCount}件`);
    
    return {
      dimension: '堆叠合规（核心规则3）',
      score: Math.max(0, score),
      status: score >= 90 ? 'pass' : score >= 70 ? 'warning' : 'critical',
      message: violations.length === 0 ? 
        `堆叠${columnCount}个垂直柱，符合安全规则（重货打底、易碎品上层）` : 
        `发现${violations.length}处堆叠问题`,
      violations,
      metrics: {
        columnCount: columnCount,
        fragileCount: fragileCount,
        heavyCount: heavyCount
      }
    };
  }

  /**
   * 5. 截关时间校验
   * 规则：检查CY_Closing冲突
   */
  validateCYClosing(loadedCargo) {
    console.log('[合规] 校验截关时间...');
    
    const withClosing = loadedCargo.filter(item => item.cyClosing);
    if (withClosing.length === 0) {
      return {
        dimension: '截关合规',
        score: 100,
        status: 'pass',
        message: '无截关时间数据',
        violations: []
      };
    }
    
    const violations = [];
    let score = 100;
    
    // 检查是否有截关时间过于接近的货物
    for (let i = 0; i < withClosing.length - 1; i++) {
      const current = withClosing[i];
      const next = withClosing[i + 1];
      
      const time1 = new Date(current.cyClosing).getTime();
      const time2 = new Date(next.cyClosing).getTime();
      const hoursDiff = Math.abs(time1 - time2) / (1000 * 60 * 60);
      
      if (hoursDiff < NingboPortComplianceChecker.THRESHOLDS.CY_CLOSING_CONFLICT_HOURS) {
        violations.push({
          type: '截关冲突',
          cargo1: current.name,
          cargo2: next.name,
          timeDiff: `${hoursDiff.toFixed(1)}小时`,
          suggestion: '两批货物截关时间过近，可能影响进港安排'
        });
        score -= 10;
      }
    }
    
    return {
      dimension: '截关合规',
      score: Math.max(0, score),
      status: score >= 90 ? 'pass' : score >= 70 ? 'warning' : 'critical',
      message: violations.length === 0 ? '截关时间安排合理' : `发现${violations.length}处截关冲突`,
      violations
    };
  }

  /**
   * 6. 报关合规校验
   * 规则：同票货物应集中存放
   */
  validateCustomsDeclaration(loadedCargo) {
    console.log('[合规] 校验报关单集中度...');
    
    const withDeclaration = loadedCargo.filter(item => item.customsDeclaration);
    if (withDeclaration.length === 0) {
      return {
        dimension: '报关合规',
        score: 100,
        status: 'pass',
        message: '无报关单数据',
        violations: []
      };
    }
    
    // 按报关单分组
    const groups = {};
    withDeclaration.forEach(item => {
      const decl = item.customsDeclaration;
      if (!groups[decl]) groups[decl] = [];
      groups[decl].push(item);
    });
    
    const violations = [];
    let score = 100;
    
    // 检查每组货物是否集中
    Object.keys(groups).forEach(decl => {
      const items = groups[decl];
      if (items.length < 2) return;
      
      // 计算最大距离
      let maxDistance = 0;
      for (let i = 0; i < items.length - 1; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const pos1 = items[i].position;
          const pos2 = items[j].position;
          const distance = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) +
            Math.pow(pos1.y - pos2.y, 2) +
            Math.pow(pos1.z - pos2.z, 2)
          );
          maxDistance = Math.max(maxDistance, distance);
        }
      }
      
      if (maxDistance > NingboPortComplianceChecker.THRESHOLDS.CUSTOMS_DISTANCE_MAX) {
        violations.push({
          type: '报关单分散',
          declaration: decl,
          maxDistance: `${maxDistance.toFixed(0)}mm`,
          suggestion: `报关单${decl}的货物分散过远，建议集中存放以便海关查验`
        });
        score -= 10;
      }
    });
    
    return {
      dimension: '报关合规',
      score: Math.max(0, score),
      status: score >= 90 ? 'pass' : score >= 70 ? 'warning' : 'critical',
      message: violations.length === 0 ? `${Object.keys(groups).length}个报关单，货物集中存放` : `发现${violations.length}处分散问题`,
      violations
    };
  }

  /**
   * 生成完整合规报告
   * 
   * 【三大核心规则优先展示】
   * 核心规则1：装柜顺序合规（JT/T 1187-2018）
   * 核心规则2：偏载与重心合规（GB 16994.4-2023）
   * 核心规则3：总重与堆叠合规（GB 16994.4-2023）
   */
  generateComplianceReport(loadedCargo, container) {
    console.log('[合规] 生成完整合规报告（三大核心规则优先）...');
    
    const results = [
      this.validateShippingOrder(loadedCargo),      // 核心规则1
      this.validateCOGOffset(loadedCargo, container), // 核心规则2
      this.validateWeight(loadedCargo, container),   // 核心规则3
      this.validateStacking(loadedCargo),            // 核心规则3
      this.validateCYClosing(loadedCargo),
      this.validateCustomsDeclaration(loadedCargo)
    ];
    
    // 计算总分（6个维度平均）
    const overallScore = Math.round(
      results.reduce((sum, r) => sum + r.score, 0) / results.length
    );
    
    // 确定合规等级
    let complianceLevel = 'excellent';
    if (overallScore < 90) complianceLevel = 'warning';
    if (overallScore < 70) complianceLevel = 'critical';
    
    // 汇总所有违规项
    const allViolations = results.flatMap(r => r.violations);
    
    // 统计三大核心规则通过情况
    const coreRulesPass = {
      rule1: results[0].status === 'pass',  // 装柜顺序
      rule2: results[1].status === 'pass',  // 偏载与重心
      rule3: results[2].status === 'pass' && results[3].status === 'pass'  // 总重与堆叠
    };
    
    const coreRulesPassCount = Object.values(coreRulesPass).filter(v => v).length;
    
    // 生成摘要（突出三大核心规则）
    let summary;
    if (coreRulesPassCount === 3) {
      summary = `✓ 三大核心规则全部通过，符合JT/T 1187-2018和GB 16994.4-2023标准`;
    } else {
      const failedRules = [];
      if (!coreRulesPass.rule1) failedRules.push('装柜顺序');
      if (!coreRulesPass.rule2) failedRules.push('偏载与重心');
      if (!coreRulesPass.rule3) failedRules.push('总重与堆叠');
      summary = `⚠️ 三大核心规则中${failedRules.join('、')}存在风险，需要优化`;
    }
    
    // 输出三大核心规则通过情况
    console.log('\n=== 三大核心规则校验结果 ===');
    console.log(`  规则1（装柜顺序）: ${coreRulesPass.rule1 ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`  规则2（偏载与重心）: ${coreRulesPass.rule2 ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`  规则3（总重与堆叠）: ${coreRulesPass.rule3 ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`  综合评分: ${overallScore}分`);
    
    return {
      overallScore,
      complianceLevel,
      summary,
      coreRulesPass,  // 新增：三大核心规则通过情况
      coreRulesPassCount,  // 新增：通过的核心规则数量
      results,
      risks: allViolations,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = NingboPortComplianceChecker;
