/**
 * 全球主要港口数据库
 * 包含宁波港常见航线目的港，支持中文/英文/港口代码搜索
 * 
 * 数据来源：宁波舟山港主要航线挂靠港
 */

const PORTS = [
  // === 欧洲航线 ===
  { name: '鹿特丹', code: 'NLRTM', country: '荷兰', region: 'europe' },
  { name: '汉堡', code: 'DEHAM', country: '德国', region: 'europe' },
  { name: '安特卫普', code: 'BEANR', country: '比利时', region: 'europe' },
  { name: '费利克斯托', code: 'GBFXT', country: '英国', region: 'europe' },
  { name: '比雷埃夫斯', code: 'GRPIR', country: '希腊', region: 'europe' },
  { name: '巴塞罗那', code: 'ESBCN', country: '西班牙', region: 'europe' },
  { name: '热那亚', code: 'ITGOA', country: '意大利', region: 'europe' },
  { name: '勒阿弗尔', code: 'FRLEH', country: '法国', region: 'europe' },
  { name: '哥德堡', code: 'SEGOT', country: '瑞典', region: 'europe' },
  { name: '格但斯克', code: 'PLGDN', country: '波兰', region: 'europe' },

  // === 东南亚航线 ===
  { name: '新加坡', code: 'SGSIN', country: '新加坡', region: 'southeast-asia' },
  { name: '巴生港', code: 'MYPKG', country: '马来西亚', region: 'southeast-asia' },
  { name: '曼谷', code: 'THBKK', country: '泰国', region: 'southeast-asia' },
  { name: '胡志明', code: 'VNSGN', country: '越南', region: 'southeast-asia' },
  { name: '海防', code: 'VNHPH', country: '越南', region: 'southeast-asia' },
  { name: '雅加达', code: 'IDJKT', country: '印尼', region: 'southeast-asia' },
  { name: '马尼拉', code: 'PHMNL', country: '菲律宾', region: 'southeast-asia' },

  // === 东亚航线 ===
  { name: '东京', code: 'JPTYO', country: '日本', region: 'east-asia' },
  { name: '大阪', code: 'JPOSA', country: '日本', region: 'east-asia' },
  { name: '釜山', code: 'KRPUS', country: '韩国', region: 'east-asia' },
  { name: '仁川', code: 'KRINC', country: '韩国', region: 'east-asia' },
  { name: '高雄', code: 'TWKHH', country: '中国台湾', region: 'east-asia' },
  { name: '香港', code: 'HKHKG', country: '中国香港', region: 'east-asia' },

  // === 南亚/中东航线 ===
  { name: '科伦坡', code: 'LKCMB', country: '斯里兰卡', region: 'south-asia' },
  { name: '孟买', code: 'INBOM', country: '印度', region: 'south-asia' },
  { name: '卡拉奇', code: 'PKKHI', country: '巴基斯坦', region: 'south-asia' },
  { name: '迪拜', code: 'AEJEA', country: '阿联酋', region: 'middle-east' },
  { name: '吉达', code: 'SAJED', country: '沙特', region: 'middle-east' },
  { name: '阿巴斯港', code: 'IRBND', country: '伊朗', region: 'middle-east' },

  // === 非洲航线 ===
  { name: '达累斯萨拉姆', code: 'TZDAR', country: '坦桑尼亚', region: 'africa' },
  { name: '蒙巴萨', code: 'KEMBA', country: '肯尼亚', region: 'africa' },
  { name: '拉各斯', code: 'NGLOS', country: '尼日利亚', region: 'africa' },
  { name: '德班', code: 'ZADUR', country: '南非', region: 'africa' },
  { name: '亚历山大', code: 'EGALY', country: '埃及', region: 'africa' },

  // === 美洲航线 ===
  { name: '洛杉矶', code: 'USLAX', country: '美国', region: 'america' },
  { name: '长滩', code: 'USLGB', country: '美国', region: 'america' },
  { name: '纽约', code: 'USNYC', country: '美国', region: 'america' },
  { name: '萨凡纳', code: 'USSAV', country: '美国', region: 'america' },
  { name: '温哥华', code: 'CAVAN', country: '加拿大', region: 'america' },
  { name: '桑托斯', code: 'BRSSZ', country: '巴西', region: 'america' },
  { name: '布宜诺斯艾利斯', code: 'ARBUE', country: '阿根廷', region: 'america' },
  { name: '利马', code: 'PECLL', country: '秘鲁', region: 'america' },

  // === 大洋洲航线 ===
  { name: '悉尼', code: 'AUSYD', country: '澳大利亚', region: 'oceania' },
  { name: '墨尔本', code: 'AUMEL', country: '澳大利亚', region: 'oceania' },
  { name: '奥克兰', code: 'NZAKL', country: '新西兰', region: 'oceania' },
];

/**
 * 搜索港口（支持中文名、英文代码、国家名模糊匹配）
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 最大返回数量，默认 8
 * @returns {Array} 匹配的港口列表
 */
function searchPorts(keyword, limit = 8) {
  if (!keyword || keyword.trim().length === 0) {
    // 无关键词时返回热门港口（宁波港最常见目的港）
    return PORTS.filter(p => 
      ['NLRTM', 'DEHAM', 'SGSIN', 'USLAX', 'KRPUS', 'JPTYO', 'BEANR', 'GBFXT'].includes(p.code)
    );
  }

  const kw = keyword.trim().toLowerCase();
  
  const results = PORTS.filter(port => {
    return port.name.toLowerCase().includes(kw) ||
           port.code.toLowerCase().includes(kw) ||
           port.country.toLowerCase().includes(kw);
  });

  return results.slice(0, limit);
}

/**
 * 验证港口是否有效
 * @param {string} portName - 港口名称
 * @returns {Object|null} 匹配的港口对象或 null
 */
function validatePort(portName) {
  if (!portName) return null;
  const name = portName.trim();
  return PORTS.find(p => p.name === name || p.code === name) || null;
}

/**
 * 获取所有港口
 * @returns {Array}
 */
function getAllPorts() {
  return PORTS;
}

module.exports = {
  PORTS,
  searchPorts,
  validatePort,
  getAllPorts
};
