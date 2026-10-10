/**
 * 路演演示兜底服务
 * 
 * 功能：
 * 历史离线演示数据访问器。返回值必须按 OFFLINE_DEMO / DEMO_DATA 理解，
 * 不是企业订单、后端求解结果或合规结论。当前正式业务链不启用此兜底。
 */

const roadshowPerfectPlan = require('../config/roadshow-perfect-plan');

class DemoFallbackService {
  /**
   * 获取历史离线演示方案
   * @returns {Object} 明确标记的演示数据
   */
  static getRoadshowPerfectPlan() {
    console.log('[OFFLINE_DEMO] 加载历史演示数据');
    console.log(`   空间利用率: ${roadshowPerfectPlan.spaceUtilization}%`);
    console.log(`   合规评分: ${roadshowPerfectPlan.complianceReport.overallScore}分`);
    console.log(`   货物总数: ${roadshowPerfectPlan.totalCargoCount}件`);
    
    return roadshowPerfectPlan;
  }

  /**
   * 检查是否应该使用路演模式
   * @param {Array} cargoList - 货物列表
   * @param {string} containerTypeId - 柜型ID
   * @returns {boolean} 是否使用路演模式
   */
  static shouldUseRoadshowMode(cargoList, containerTypeId) {
    // 历史演示兜底已禁用；请调用当前后端确定性求解链。
    return false;
  }
}

module.exports = DemoFallbackService;
