/**
 * 港口动态数据源占位服务。
 * 当前没有接入经验证的港口数据源，因此始终返回空列表。
 */

class PortUpdateService {
  /**
   * 获取最新港口动态更新
   * @returns {Promise<Array>} 港口动态更新数组
   */
  async getLatestUpdates() {
    return [];
  }
}

module.exports = new PortUpdateService();
