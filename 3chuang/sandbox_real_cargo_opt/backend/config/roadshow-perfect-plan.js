/**
 * 历史合成演示方案（OFFLINE_DEMO / DEMO_DATA）
 * 空间利用率：87.3%
 * 合规评分：95分
 * 其数值只用于旧版离线界面回归，不代表企业订单或实际合规证据。
 */

module.exports = {
  sourceCode: 'OFFLINE_DEMO',
  dataClassification: 'DEMO_DATA',
  planId: 'roadshow_perfect_plan_2026',
  containerType: {
    typeId: '40HQ',
    name: '40英尺高柜',
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    maxWeight: 26000
  },
  spaceUtilization: 87.3,
  totalWeight: 8875.0,  // 真实总重量
  totalCargoCount: 1350,  // 真实货物数量
  
  // 完美的装载货物列表（按装柜顺序，紧密排列）
  loadedCargo: [
    // 批次1：电风扇（最晚到港2026-04-25，最先装，最内侧0-4000mm，绿色）
    // 450件，紧密排列无间隙
    ...Array.from({ length: 450 }, (_, i) => {
      const col = i % 6;  // 6列 (6*380=2280mm < 2352mm)
      const layer = Math.floor((i % 18) / 6);  // 3层 (3*320=960mm)
      const row = Math.floor(i / 18);  // 25排
      
      return {
        cargoId: `cargo_fan_${i + 1}`,
        name: '电风扇',
        length: 450,
        width: 380,
        height: 320,
        weight: 6.5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        eta: '2026-04-25',
        portSequence: 4,
        cyClosing: '2026-04-20T18:00:00',
        customsDeclaration: 'NB202604001',
        position: {
          x: col * 380,
          y: layer * 320,
          z: (row % 9) * 450  // 只用9排，Z=0-4050mm
        },
        rotation: {
          length: 450,
          width: 380,
          height: 320,
          rotation: { x: 0, y: 0, z: 0 }
        },
        loadingOrder: i + 1,
        stackLevel: layer,
        dropOrder: 3
      };
    }),
    
    // 批次2：取暖器（中间到港2026-04-20，中间装，4000-8000mm，红色）
    // 400件，紧密排列
    ...Array.from({ length: 400 }, (_, i) => {
      const col = i % 5;  // 5列 (5*400=2000mm)
      const layer = Math.floor((i % 10) / 5);  // 2层 (2*350=700mm)
      const row = Math.floor(i / 10);  // 40排
      
      return {
        cargoId: `cargo_heater_${i + 1}`,
        name: '取暖器',
        length: 500,
        width: 400,
        height: 350,
        weight: 8.0,
        quantity: 1,
        stackable: true,
        maxStackLayers: 2,
        eta: '2026-04-20',
        portSequence: 2,
        cyClosing: '2026-04-13T18:00:00',
        customsDeclaration: 'NB202604001',
        position: {
          x: col * 400,
          y: layer * 350,
          z: 4000 + (row % 8) * 500  // Z=4000-8000mm
        },
        rotation: {
          length: 500,
          width: 400,
          height: 350,
          rotation: { x: 0, y: 0, z: 0 }
        },
        loadingOrder: 450 + i + 1,
        stackLevel: layer,
        dropOrder: 2
      };
    }),
    
    // 批次3：空气炸锅（最早到港2026-04-15，最后装，8000-12000mm箱门端，蓝色）
    // 500件，紧密排列
    ...Array.from({ length: 500 }, (_, i) => {
      const col = i % 6;  // 6列 (6*350=2100mm)
      const layer = Math.floor((i % 18) / 6);  // 3层 (3*300=900mm)
      const row = Math.floor(i / 18);  // 28排
      
      return {
        cargoId: `cargo_fryer_${i + 1}`,
        name: '空气炸锅',
        length: 400,
        width: 350,
        height: 300,
        weight: 5.5,
        quantity: 1,
        stackable: true,
        maxStackLayers: 3,
        eta: '2026-04-15',
        portSequence: 3,
        cyClosing: '2026-04-10T18:00:00',
        customsDeclaration: 'NB202604001',
        position: {
          x: col * 350,
          y: layer * 300,
          z: 8000 + (row % 10) * 400  // Z=8000-12000mm
        },
        rotation: {
          length: 400,
          width: 350,
          height: 300,
          rotation: { x: 0, y: 0, z: 0 }
        },
        loadingOrder: 850 + i + 1,
        stackLevel: layer,
        dropOrder: 1
      };
    })
  ],
  
  unloadedCargo: [],
  
  // 完美的合规报告
  complianceReport: {
    overallScore: 95,
    complianceLevel: 'excellent',
    summary: '合规校验通过，5/6项达标，符合宁波港进港规则',
    results: [
      {
        dimension: '装柜顺序合规',
        score: 100,
        status: 'pass',
        message: '装柜顺序完全符合出货时间规则',
        violations: []
      },
      {
        dimension: '偏载合规',
        score: 95,
        status: 'pass',
        message: '重心偏差正常（左右2.1%，前后4.3%）',
        violations: [],
        metrics: {
          offsetX: '2.1%',
          offsetZ: '4.3%',
          cogPosition: { x: '1200', y: '450', z: '6000' }
        }
      },
      {
        dimension: '超重合规',
        score: 100,
        status: 'pass',
        message: '总重量8875kg，占额定载重34.1%',
        violations: [],
        metrics: {
          totalWeight: '8875kg',
          maxWeight: '26000kg',
          weightRatio: '34.1%'
        }
      },
      {
        dimension: '堆叠合规',
        score: 100,
        status: 'pass',
        message: '堆叠3层，符合安全规则',
        violations: [],
        metrics: {
          layerCount: 3
        }
      },
      {
        dimension: '截关合规',
        score: 100,
        status: 'pass',
        message: '截关时间安排合理，无冲突',
        violations: []
      },
      {
        dimension: '报关合规',
        score: 75,
        status: 'warning',
        message: '报关单集中存放，轻微分散',
        violations: [
          {
            type: '报关单分散',
            declaration: 'NB202604001',
            maxDistance: '1200mm',
            suggestion: '建议进一步集中存放'
          }
        ]
      }
    ],
    risks: [
      {
        type: '报关单分散',
        declaration: 'NB202604001',
        maxDistance: '1200mm',
        suggestion: '建议进一步集中存放'
      }
    ],
    timestamp: new Date().toISOString()
  },
  
  shippingConflicts: []
};
