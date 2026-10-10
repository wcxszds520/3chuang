/**
 * Cargo 数据模型类单元测试
 * 
 * 测试目标：
 * - 验证 Cargo 类的所有方法正常工作
 * - 验证数据验证规则正确执行
 * - 验证边界条件和异常情况
 */

const Cargo = require('../../models/Cargo');

describe('Cargo 数据模型类', () => {
  
  describe('构造函数', () => {
    test('应该正确创建货物对象', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200
      });

      expect(cargo.cargoId).toBe('cargo_001');
      expect(cargo.name).toBe('空气炸锅');
      expect(cargo.length).toBe(300);
      expect(cargo.width).toBe(300);
      expect(cargo.height).toBe(350);
      expect(cargo.weight).toBe(5);
      expect(cargo.quantity).toBe(200);
      expect(cargo.stackable).toBe(true);  // 默认值
      expect(cargo.maxStackLayers).toBe(999);  // 默认值
      expect(cargo.canRotate).toBe(true);  // 默认允许绕竖直轴转向
      expect(cargo.canInvert).toBe(false);  // 保守默认：禁止倒置
      expect(cargo.canLayFlat).toBe(false);  // 保守默认：禁止侧放
    });

    test('应该支持自定义约束条件', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_002',
        name: '易碎品',
        length: 500,
        width: 400,
        height: 600,
        weight: 10,
        quantity: 50,
        stackable: false,
        maxStackLayers: 2,
        canInvert: false,
        canLayFlat: false
      });

      expect(cargo.stackable).toBe(false);
      expect(cargo.maxStackLayers).toBe(2);
      expect(cargo.canInvert).toBe(false);
      expect(cargo.canLayFlat).toBe(false);
    });
  });

  describe('getVolume() 方法', () => {
    test('应该正确计算单件货物体积', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200
      });

      // 体积 = 300 × 300 × 350 = 31,500,000 立方毫米
      expect(cargo.getVolume()).toBe(31500000);
    });
  });

  describe('getTotalVolume() 方法', () => {
    test('应该正确计算总体积', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200
      });

      // 总体积 = 31,500,000 × 200 = 6,300,000,000 立方毫米
      expect(cargo.getTotalVolume()).toBe(6300000000);
    });
  });

  describe('getTotalWeight() 方法', () => {
    test('应该正确计算总重量', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200
      });

      // 总重量 = 5 × 200 = 1000kg
      expect(cargo.getTotalWeight()).toBe(1000);
    });
  });

  describe('validate() 方法 - 正数检查（需求 2.3）', () => {
    test('应该拒绝负数长度', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: -100,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10
      });

      expect(() => cargo.validate()).toThrow('请输入正数');
    });

    test('应该拒绝零长度', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 0,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10
      });

      expect(() => cargo.validate()).toThrow('请输入正数');
    });

    test('应该拒绝负数重量', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 300,
        width: 300,
        height: 350,
        weight: -5,
        quantity: 10
      });

      expect(() => cargo.validate()).toThrow('请输入正数');
    });

    test('应该拒绝负数数量', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: -10
      });

      expect(() => cargo.validate()).toThrow('请输入正数');
    });
  });

  describe('validate() 方法 - 尺寸限制检查（需求 2.4）', () => {
    test('应该拒绝超出40HQ柜型尺寸的货物', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '超大货物',
        length: 15000,  // 超过40HQ的12032mm
        width: 2000,
        height: 2000,
        weight: 100,
        quantity: 1
      });

      expect(() => cargo.validate()).toThrow('货物尺寸超出最大柜型限制');
    });

    test('应该拒绝宽度超限的货物（即使旋转也无法装入）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '超宽货物',
        length: 13000,  // 超过40HQ的最大尺寸12032mm
        width: 3000,    // 超过40HQ的2698mm
        height: 2000,
        weight: 100,
        quantity: 1
      });

      expect(() => cargo.validate()).toThrow('货物尺寸超出最大柜型限制');
    });

    test('应该拒绝高度超限的货物（即使旋转也无法装入）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '超高货物',
        length: 13000,  // 超过40HQ的最大尺寸12032mm
        width: 2000,
        height: 3000,   // 超过40HQ的2698mm
        weight: 100,
        quantity: 1
      });

      expect(() => cargo.validate()).toThrow('货物尺寸超出最大柜型限制');
    });

    test('应该接受可以旋转摆放的货物', () => {
      // 货物尺寸 2698×2352×1000，虽然长度2698超过宽度限制2352
      // 但旋转后可以摆放（2698作为高度，2352作为宽度，1000作为长度）
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '可旋转货物',
        length: 2698,
        width: 2352,
        height: 1000,
        weight: 100,
        quantity: 1
      });

      expect(() => cargo.validate()).not.toThrow();
    });

    test('应该接受刚好等于40HQ尺寸的货物', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '最大尺寸货物',
        length: 12032,
        width: 2352,
        height: 2698,
        weight: 100,
        quantity: 1
      });

      expect(() => cargo.validate()).not.toThrow();
    });
  });

  describe('validate() 方法 - 重量限制检查（需求 2.5）', () => {
    test('应该拒绝单件重量超过26000kg的货物', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '超重货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 30000,  // 超过26000kg
        quantity: 1
      });

      expect(() => cargo.validate()).toThrow('单件货物重量超出柜型载重限制');
    });

    test('应该接受刚好等于26000kg的货物', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '最大重量货物',
        length: 1000,
        width: 1000,
        height: 1000,
        weight: 26000,
        quantity: 1
      });

      expect(() => cargo.validate()).not.toThrow();
    });
  });

  describe('validate() 方法 - 综合测试', () => {
    test('应该接受完全合法的货物数据', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200
      });

      expect(cargo.validate()).toBe(true);
    });

    test('应该接受宁波港预设模板中的货物数据', () => {
      // 慈溪小家电模板 - 空气炸锅
      const airFryer = new Cargo({
        cargoId: 'cargo_001',
        name: '空气炸锅',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200
      });
      expect(airFryer.validate()).toBe(true);

      // 慈溪小家电模板 - 取暖器
      const heater = new Cargo({
        cargoId: 'cargo_002',
        name: '取暖器',
        length: 500,
        width: 400,
        height: 600,
        weight: 8,
        quantity: 100
      });
      expect(heater.validate()).toBe(true);

      // 慈溪小家电模板 - 电风扇
      const fan = new Cargo({
        cargoId: 'cargo_003',
        name: '电风扇',
        length: 400,
        width: 400,
        height: 1200,
        weight: 6,
        quantity: 80
      });
      expect(fan.validate()).toBe(true);
    });
  });

  describe('isHeavy() 方法', () => {
    test('应该正确识别重货（≥20kg）', () => {
      const heavyCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '重货',
        length: 500,
        width: 400,
        height: 600,
        weight: 25,
        quantity: 10
      });

      expect(heavyCargo.isHeavy()).toBe(true);
    });

    test('应该正确识别非重货（<20kg）', () => {
      const lightCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '轻货',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200
      });

      expect(lightCargo.isHeavy()).toBe(false);
    });

    test('应该正确处理边界值（刚好20kg）', () => {
      const boundaryCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '边界货物',
        length: 400,
        width: 400,
        height: 500,
        weight: 20,
        quantity: 50
      });

      expect(boundaryCargo.isHeavy()).toBe(true);
    });
  });

  describe('isFragile() 方法', () => {
    test('应该正确识别易碎品', () => {
      const fragileCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '易碎品',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 100,
        fragile: true
      });

      expect(fragileCargo.isFragile()).toBe(true);
    });

    test('应该正确识别非易碎品', () => {
      const normalCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '普通货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 100,
        fragile: false
      });

      expect(normalCargo.isFragile()).toBe(false);
    });

    test('默认应该为非易碎品', () => {
      const defaultCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '默认货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 100
      });

      expect(defaultCargo.isFragile()).toBe(false);
    });
  });

  describe('getCargoType() 方法', () => {
    test('应该返回"fragile"对于易碎品（优先级最高）', () => {
      const fragileCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '易碎重货',
        length: 500,
        width: 400,
        height: 600,
        weight: 25,  // 重货
        quantity: 10,
        fragile: true  // 易碎品优先
      });

      expect(fragileCargo.getCargoType()).toBe('fragile');
    });

    test('应该返回"heavy"对于重货', () => {
      const heavyCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '重货',
        length: 500,
        width: 400,
        height: 600,
        weight: 25,
        quantity: 10,
        fragile: false
      });

      expect(heavyCargo.getCargoType()).toBe('heavy');
    });

    test('应该返回"normal"对于普通货物', () => {
      const normalCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '普通货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 15,
        quantity: 100,
        fragile: false
      });

      expect(normalCargo.getCargoType()).toBe('normal');
    });
  });

  describe('getRotations() 方法', () => {
    test('应该返回标准摆放（无约束）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 300,
        width: 200,
        height: 400,
        weight: 5,
        quantity: 10,
        canInvert: true,
        canLayFlat: true
      });

      const rotations = cargo.getRotations();
      expect(rotations.length).toBeGreaterThan(0);
      expect(rotations[0]).toHaveProperty('x');
      expect(rotations[0]).toHaveProperty('y');
      expect(rotations[0]).toHaveProperty('z');
      expect(rotations[0]).toHaveProperty('rotation');
    });

    test('应该只返回标准摆放（不可倒置、不可侧放）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '受限货物',
        length: 300,
        width: 200,
        height: 400,
        weight: 5,
        quantity: 10,
        canRotate: false,
        canInvert: false,
        canLayFlat: false
      });

      const rotations = cargo.getRotations();
      expect(rotations.length).toBe(1);
      expect(rotations[0].description).toBe('标准摆放');
    });

    test('应该包含侧放选项（可侧放）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '可侧放货物',
        length: 300,
        width: 200,
        height: 400,
        weight: 5,
        quantity: 10,
        canInvert: false,
        canLayFlat: true
      });

      const rotations = cargo.getRotations();
      expect(rotations.length).toBeGreaterThan(1);
      const hasSideRotation = rotations.some(r => r.description.includes('侧放'));
      expect(hasSideRotation).toBe(true);
    });
  });

  describe('toJSON() 方法', () => {
    test('应该返回完整的JSON对象', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 200,
        stackable: true,
        maxStackLayers: 3,
        canInvert: false,
        canLayFlat: false,
        fragile: true
      });

      const json = cargo.toJSON();
      
      expect(json).toHaveProperty('cargoId', 'cargo_001');
      expect(json).toHaveProperty('name', '测试货物');
      expect(json).toHaveProperty('length', 300);
      expect(json).toHaveProperty('width', 300);
      expect(json).toHaveProperty('height', 350);
      expect(json).toHaveProperty('weight', 5);
      expect(json).toHaveProperty('quantity', 200);
      expect(json).toHaveProperty('stackable', true);
      expect(json).toHaveProperty('maxStackLayers', 3);
      expect(json).toHaveProperty('canInvert', false);
      expect(json).toHaveProperty('canLayFlat', false);
      expect(json).toHaveProperty('fragile', true);
      expect(json).toHaveProperty('cargoType');
      expect(json).toHaveProperty('isHeavy');
      expect(json).toHaveProperty('isFragile');
    });

    test('应该包含计算字段', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '易碎重货',
        length: 500,
        width: 400,
        height: 600,
        weight: 25,
        quantity: 10,
        fragile: true
      });

      const json = cargo.toJSON();
      
      expect(json.cargoType).toBe('fragile');
      expect(json.isHeavy).toBe(true);
      expect(json.isFragile).toBe(true);
    });
  });

  describe('Realistic 4D 字段测试', () => {
    test('应该正确设置packagingType', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '纸箱货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 100,
        packagingType: 'carton'
      });

      expect(cargo.packagingType).toBe('carton');
    });

    test('应该使用默认packagingType（wooden）', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '默认货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 100
      });

      expect(cargo.packagingType).toBe('wooden');
    });

    test('应该正确设置sku和batchId', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 100,
        sku: 'SKU-001',
        batchId: 'BATCH-001'
      });

      expect(cargo.sku).toBe('SKU-001');
      expect(cargo.batchId).toBe('BATCH-001');
    });

    test('应该使用cargoId作为默认sku', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 100
      });

      expect(cargo.sku).toBe('cargo_001');
    });

    test('isHeavyCargo()应该正确识别重货（>15kg）', () => {
      const heavyCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '重货',
        length: 300,
        width: 300,
        height: 350,
        weight: 20,
        quantity: 10
      });

      const lightCargo = new Cargo({
        cargoId: 'cargo_002',
        name: '轻货',
        length: 300,
        width: 300,
        height: 350,
        weight: 10,
        quantity: 10
      });

      expect(heavyCargo.isHeavyCargo()).toBe(true);
      expect(lightCargo.isHeavyCargo()).toBe(false);
    });

    test('canSupportHeavyCargo()应该正确判断包装强度', () => {
      const woodenCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '木箱货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'wooden'
      });

      const cartonCargo = new Cargo({
        cargoId: 'cargo_002',
        name: '纸箱货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'carton'
      });

      expect(woodenCargo.canSupportHeavyCargo()).toBe(true);
      expect(cartonCargo.canSupportHeavyCargo()).toBe(false);
    });

    test('getMaxStackLayers()应该根据包装类型返回正确值', () => {
      const cartonCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '纸箱货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'carton',
        maxStackLayers: 5
      });

      const woodenCargo = new Cargo({
        cargoId: 'cargo_002',
        name: '木箱货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'wooden'
      });

      expect(cartonCargo.getMaxStackLayers()).toBe(5);
      expect(woodenCargo.getMaxStackLayers()).toBe(Infinity);
    });
  });

  describe('validate() 方法 - Realistic 4D字段验证', () => {
    test('应该拒绝无效的packagingType', () => {
      const cargo = new Cargo({
        cargoId: 'cargo_001',
        name: '测试货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'invalid'
      });

      expect(() => cargo.validate()).toThrow('packagingType必须是以下之一: carton, wooden, pallet');
    });

    test('应该接受有效的packagingType', () => {
      const cartonCargo = new Cargo({
        cargoId: 'cargo_001',
        name: '纸箱货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'carton'
      });

      const woodenCargo = new Cargo({
        cargoId: 'cargo_002',
        name: '木箱货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'wooden'
      });

      const palletCargo = new Cargo({
        cargoId: 'cargo_003',
        name: '托盘货物',
        length: 300,
        width: 300,
        height: 350,
        weight: 5,
        quantity: 10,
        packagingType: 'pallet'
      });

      expect(() => cartonCargo.validate()).not.toThrow();
      expect(() => woodenCargo.validate()).not.toThrow();
      expect(() => palletCargo.validate()).not.toThrow();
    });
  });
});
