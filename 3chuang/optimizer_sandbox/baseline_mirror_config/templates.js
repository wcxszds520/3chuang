/**
 * 宁波港货型预设模板配置文件
 * 
 * 本文件定义了3套宁波本地高频货型预设模板，用于快速演示和路演场景。
 * 每个模板包含该货型的典型货物数据，包括真实的尺寸和重量信息。
 * 
 * 模板用途：
 * 1. 路演演示：快速导入预设数据，10秒内完成货物信息填充
 * 2. 功能测试：提供标准测试用例，验证装箱算法和3D渲染效果
 * 3. 用户参考：展示宁波港常见货型，帮助用户理解系统功能
 */

/**
 * 慈溪小家电模板
 * 
 * 慈溪是中国小家电之都，该模板包含慈溪地区高频出口的小家电产品。
 * 特点：体积适中、重量较轻、适合堆叠、装箱密度高
 */
const CIXI_APPLIANCES = {
  templateName: '慈溪小家电',
  description: '慈溪地区高频出口小家电产品，包含空气炸锅、取暖器、电风扇',
  cargoList: [
    {
      name: '空气炸锅',
      length: 300,        // 长度：300毫米
      width: 300,         // 宽度：300毫米
      height: 350,        // 高度：350毫米
      weight: 5,          // 重量：5千克
      quantity: 200,      // 数量：200个
      stackable: true,    // 可堆叠
      maxStackLayers: 4,  // 最大堆叠4层
      canInvert: false,   // 不可倒置（电器产品）
      canLayFlat: false   // 不可侧放（电器产品）
    },
    {
      name: '取暖器',
      length: 500,        // 长度：500毫米
      width: 400,         // 宽度：400毫米
      height: 600,        // 高度：600毫米
      weight: 8,          // 重量：8千克
      quantity: 100,      // 数量：100个
      stackable: true,    // 可堆叠
      maxStackLayers: 3,  // 最大堆叠3层（较重）
      canInvert: false,   // 不可倒置
      canLayFlat: false   // 不可侧放
    },
    {
      name: '电风扇',
      length: 400,        // 长度：400毫米
      width: 400,         // 宽度：400毫米
      height: 1200,       // 高度：1200毫米（立式风扇）
      weight: 6,          // 重量：6千克
      quantity: 80,       // 数量：80个
      stackable: false,   // 不可堆叠（高度较高，易损坏）
      maxStackLayers: 1,  // 最大堆叠1层
      canInvert: false,   // 不可倒置
      canLayFlat: true    // 可侧放（节省空间）
    }
  ]
};

/**
 * 宁波文具模板
 * 
 * 宁波是中国重要的文具生产基地，该模板包含宁波地区高频出口的文具产品。
 * 特点：体积小、重量轻、适合高密度堆叠、装箱灵活性高
 */
const NINGBO_STATIONERY = {
  templateName: '宁波文具',
  description: '宁波地区高频出口文具产品，包含中性笔、笔记本、文具套装',
  cargoList: [
    {
      name: '中性笔（纸箱装）',
      length: 400,        // 长度：400毫米（标准纸箱）
      width: 300,         // 宽度：300毫米
      height: 200,        // 高度：200毫米
      weight: 8,          // 重量：8千克（每箱约500支笔）
      quantity: 500,      // 数量：500箱
      stackable: true,    // 可堆叠
      maxStackLayers: 8,  // 最大堆叠8层（轻质货物）
      canInvert: false,   // 不可倒置（避免笔尖损坏）
      canLayFlat: true    // 可侧放
    },
    {
      name: '笔记本（纸箱装）',
      length: 500,        // 长度：500毫米
      width: 350,         // 宽度：350毫米
      height: 300,        // 高度：300毫米
      weight: 12,         // 重量：12千克（每箱约100本）
      quantity: 300,      // 数量：300箱
      stackable: true,    // 可堆叠
      maxStackLayers: 6,  // 最大堆叠6层
      canInvert: false,   // 不可倒置
      canLayFlat: true    // 可侧放
    },
    {
      name: '文具套装（礼盒装）',
      length: 350,        // 长度：350毫米
      width: 250,         // 宽度：250毫米
      height: 150,        // 高度：150毫米
      weight: 3,          // 重量：3千克（精美包装）
      quantity: 400,      // 数量：400盒
      stackable: true,    // 可堆叠
      maxStackLayers: 10, // 最大堆叠10层（轻质且包装坚固）
      canInvert: false,   // 不可倒置（保持礼盒美观）
      canLayFlat: true    // 可侧放
    }
  ]
};

/**
 * 宁波汽配模板
 * 
 * 宁波是中国重要的汽车零部件生产基地，该模板包含宁波地区高频出口的汽配产品。
 * 特点：尺寸差异大、重量适中、部分产品易损需特殊摆放
 */
const NINGBO_AUTO_PARTS = {
  templateName: '宁波汽配',
  description: '宁波地区高频出口汽车零部件产品，包含汽车滤芯、雨刮器、车灯配件',
  cargoList: [
    {
      name: '汽车空气滤芯（纸箱装）',
      length: 450,        // 长度：450毫米
      width: 350,         // 宽度：350毫米
      height: 250,        // 高度：250毫米
      weight: 10,         // 重量：10千克（每箱约50个滤芯）
      quantity: 250,      // 数量：250箱
      stackable: true,    // 可堆叠
      maxStackLayers: 5,  // 最大堆叠5层
      canInvert: false,   // 不可倒置（避免滤芯变形）
      canLayFlat: true    // 可侧放
    },
    {
      name: '汽车雨刮器（纸箱装）',
      length: 800,        // 长度：800毫米（雨刮器较长）
      width: 200,         // 宽度：200毫米
      height: 150,        // 高度：150毫米
      weight: 6,          // 重量：6千克（每箱约30支）
      quantity: 200,      // 数量：200箱
      stackable: true,    // 可堆叠
      maxStackLayers: 6,  // 最大堆叠6层
      canInvert: false,   // 不可倒置
      canLayFlat: true    // 可侧放
    },
    {
      name: '汽车LED车灯总成（泡沫箱装）',
      length: 600,        // 长度：600毫米
      width: 400,         // 宽度：400毫米
      height: 350,        // 高度：350毫米
      weight: 15,         // 重量：15千克（每箱约10个车灯，含泡沫保护）
      quantity: 150,      // 数量：150箱
      stackable: true,    // 可堆叠
      maxStackLayers: 3,  // 最大堆叠3层（易碎品，限制堆叠）
      canInvert: false,   // 不可倒置（电子产品）
      canLayFlat: false   // 不可侧放（避免车灯损坏）
    }
  ]
};

/**
 * 所有预设模板的映射表
 * 
 * 使用模板名称作为键，方便快速查找和导入
 */
const TEMPLATES = {
  '慈溪小家电': CIXI_APPLIANCES,
  '宁波文具': NINGBO_STATIONERY,
  '宁波汽配': NINGBO_AUTO_PARTS
};

/**
 * 获取所有可用的模板列表
 * 
 * @returns {Array} 模板列表，包含模板名称和描述
 */
function getTemplateList() {
  return Object.keys(TEMPLATES).map(templateName => ({
    templateName,
    description: TEMPLATES[templateName].description
  }));
}

/**
 * 根据模板名称获取模板数据
 * 
 * @param {string} templateName - 模板名称
 * @returns {Object|null} 模板数据对象，如果模板不存在则返回null
 */
function getTemplateByName(templateName) {
  return TEMPLATES[templateName] || null;
}

/**
 * 验证模板名称是否有效
 * 
 * @param {string} templateName - 模板名称
 * @returns {boolean} 如果模板存在返回true，否则返回false
 */
function isValidTemplate(templateName) {
  return TEMPLATES.hasOwnProperty(templateName);
}

// 导出模板数据和工具函数
module.exports = {
  TEMPLATES,
  CIXI_APPLIANCES,
  NINGBO_STATIONERY,
  NINGBO_AUTO_PARTS,
  getTemplateList,
  getTemplateByName,
  isValidTemplate
};
