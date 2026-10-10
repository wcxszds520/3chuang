/**
 * 宁波港主流航线配置
 * 用途：为货物录入提供预设航线模板，快速填充目的港挂靠顺序
 */

module.exports = {
  routes: [
    {
      id: 'ningbo_shanghai_singapore_rotterdam_hamburg',
      name: '宁波-上海-新加坡-鹿特丹-汉堡（欧基航线）',
      description: '宁波港至欧洲主要港口的标准航线',
      ports: [
        { sequence: 1, name: '宁波', code: 'CNNGB', country: '中国' },
        { sequence: 2, name: '上海', code: 'CNSHA', country: '中国' },
        { sequence: 3, name: '新加坡', code: 'SGSIN', country: '新加坡' },
        { sequence: 4, name: '鹿特丹', code: 'NLRTM', country: '荷兰' },
        { sequence: 5, name: '汉堡', code: 'DEHAM', country: '德国' }
      ]
    },
    {
      id: 'ningbo_us_west_coast',
      name: '宁波-美西航线',
      description: '宁波港至美国西海岸的标准航线',
      ports: [
        { sequence: 1, name: '宁波', code: 'CNNGB', country: '中国' },
        { sequence: 2, name: '洛杉矶', code: 'USLAX', country: '美国' },
        { sequence: 3, name: '长滩', code: 'USLGB', country: '美国' },
        { sequence: 4, name: '奥克兰', code: 'USOAK', country: '美国' }
      ]
    },
    {
      id: 'ningbo_southeast_asia',
      name: '宁波-东南亚航线',
      description: '宁波港至东南亚主要港口的标准航线',
      ports: [
        { sequence: 1, name: '宁波', code: 'CNNGB', country: '中国' },
        { sequence: 2, name: '新加坡', code: 'SGSIN', country: '新加坡' },
        { sequence: 3, name: '曼谷', code: 'THBKK', country: '泰国' },
        { sequence: 4, name: '胡志明', code: 'VNSGN', country: '越南' },
        { sequence: 5, name: '雅加达', code: 'IDJKT', country: '印度尼西亚' }
      ]
    },
    {
      id: 'ningbo_middle_east',
      name: '宁波-中东航线',
      description: '宁波港至中东主要港口的标准航线',
      ports: [
        { sequence: 1, name: '宁波', code: 'CNNGB', country: '中国' },
        { sequence: 2, name: '新加坡', code: 'SGSIN', country: '新加坡' },
        { sequence: 3, name: '迪拜', code: 'AEDXB', country: '阿联酋' },
        { sequence: 4, name: '吉达', code: 'SAJED', country: '沙特阿拉伯' },
        { sequence: 5, name: '达曼', code: 'SADMM', country: '沙特阿拉伯' }
      ]
    }
  ],
  
  /**
   * 根据航线ID获取航线信息
   * @param {string} routeId - 航线ID
   * @returns {Object|null} 航线信息对象，如果未找到返回null
   */
  getRouteById(routeId) {
    return this.routes.find(route => route.id === routeId) || null;
  },
  
  /**
   * 获取所有航线列表（简化版，仅包含id和name）
   * @returns {Array} 航线列表
   */
  getRouteList() {
    return this.routes.map(route => ({
      id: route.id,
      name: route.name,
      description: route.description
    }));
  }
};
