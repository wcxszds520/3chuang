/**
 * 柜型管理路由模块
 * 职责：处理集装箱柜型相关的API请求
 * 使用方法：在routes/index.js中引入并注册 router.use('/container', containerRoutes)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * 查询柜型列表接口
 * GET /api/container/list
 * 
 * 功能说明：
 * - 从数据库查询所有标准柜型数据（20GP、40GP、40HQ）
 * - 返回柜型的名称、内部尺寸、额定载重、适用场景描述
 * 
 * 响应格式：
 * {
 *   "code": 200,
 *   "message": "查询成功",
 *   "data": {
 *     "containerTypes": [
 *       {
 *         "typeId": "20GP",
 *         "name": "20英尺标准柜",
 *         "innerLength": 5898,
 *         "innerWidth": 2352,
 *         "innerHeight": 2393,
 *         "maxWeight": 28000,
 *         "description": "适用于小批量、高密度货物"
 *       }
 *     ]
 *   }
 * }
 * 
 * 需求引用：4.1, 4.2, 4.3, 4.4
 */
router.get('/list', async (req, res, next) => {
  try {
    // 从数据库查询所有柜型数据
    // 按照type_id排序，确保返回顺序为：20GP、40GP、40HQ
    const [rows] = await db.query(
      `SELECT 
        type_id AS typeId,
        name,
        inner_length AS innerLength,
        inner_width AS innerWidth,
        inner_height AS innerHeight,
        max_weight AS maxWeight,
        description
      FROM container_type
      ORDER BY 
        CASE type_id
          WHEN '20GP' THEN 1
          WHEN '40GP' THEN 2
          WHEN '40HQ' THEN 3
          ELSE 4
        END`
    );

    // 检查是否查询到数据
    if (!rows || rows.length === 0) {
      return res.error('未找到柜型数据，请确保数据库已正确初始化', 404);
    }

    // 返回成功响应
    res.success({
      containerTypes: rows
    }, '查询成功');

  } catch (error) {
    // 捕获数据库查询错误，传递给错误处理中间件
    console.error('查询柜型列表失败:', error);
    next(error);
  }
});

module.exports = router;
