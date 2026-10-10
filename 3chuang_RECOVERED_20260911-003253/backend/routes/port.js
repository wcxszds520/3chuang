/**
 * Port Updates API Routes
 * 港口动态 API 路由（当前未接入数据源）
 */

const express = require('express');
const router = express.Router();
const PortUpdateService = require('../services/PortUpdateService');

/**
 * GET /api/port/updates
 * 获取已配置的港口动态；未配置时返回空列表
 * 
 * @returns {Array} 港口动态数组,包含 type, title, content, timestamp 字段
 */
router.get('/updates', async (req, res) => {
  try {
    const updates = await PortUpdateService.getLatestUpdates();
    
    // 返回 JSON 数组,HTTP 200 状态
    res.status(200).json(updates);
  } catch (error) {
    console.error('[Port API] 获取港口动态失败:', error);
    
    // 容错机制:即使出错也返回空数组,确保前端不会崩溃
    res.status(200).json([]);
  }
});

module.exports = router;
