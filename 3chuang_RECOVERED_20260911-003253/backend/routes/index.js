/**
 * 路由总入口
 * 职责：汇总所有子路由模块，统一注册到Express应用
 * 使用方法：在server.js中引入并注册 app.use('/api', routes)
 */

const express = require('express');
const router = express.Router();

/**
 * 健康检查接口
 * 用于测试服务器是否正常运行
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.success({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '甬柜易算后端服务'
  }, '服务运行正常');
});

router.get('/capabilities', async (_req, res) => {
  const db = require('../config/database');
  let database;
  try {
    await db.query({ sql: 'SELECT 1 AS alive', timeout: 2000 });
    database = { status: 'CONNECTED', verifiedAt: new Date().toISOString(), persistence: 'AVAILABLE' };
  } catch (error) {
    database = { status: 'UNAVAILABLE', code: error.code || 'CONNECTION_FAILED', persistence: 'BROWSER_ONLY', verifiedAt: new Date().toISOString() };
  }
  const key = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.SILICONFLOW_API_KEY;
  const configured = Boolean(key && process.env.AI_API_ENDPOINT && (process.env.AI_MODEL || process.env.DEEPSEEK_MODEL));
  return res.success({ database, ai: { status: configured ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED', liveCallVerified: false },
    solver: { status: 'AVAILABLE', source: 'LOCAL_COMPUTATION' }, observedData: { status: 'MANUAL_ONLY', realtimeInterface: false } });
});

/**
 * 根路径接口
 * 返回API基本信息
 * GET /api/
 */
router.get('/', (req, res) => {
  res.success({
    name: '甬柜易算API',
    version: '1.0.0',
    description: '宁波港智能3D装箱小程序后端服务',
    endpoints: {
      health: '/api/health',
      cargo: '/api/cargo',
      container: '/api/container',
      packing: '/api/packing',
      port: '/api/port'
    }
  }, '欢迎使用甬柜易算API');
});

const cargoRoutes = require('./cargo');
const containerRoutes = require('./container');
const packingRoutes = require('./packing');
const aiPackingRoutes = require('./ai-packing');
const portRoutes = require('./port');
const complianceRoutes = require('./compliance');
const vlmRoutes = require('./vlm');
const ttsRoutes = require('./tts');
const dashboardRoutes = require('./dashboard');
const caseRoutes = require('./cases');

router.use('/cargo', cargoRoutes);
router.use('/container', containerRoutes);
router.use('/packing', packingRoutes);
router.use('/ai-packing', aiPackingRoutes);
router.use('/port', portRoutes);
router.use('/compliance', complianceRoutes);
router.use('/vlm', vlmRoutes);
router.use('/tts', ttsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/cases', caseRoutes);
router.use('/context-assistant', require('./context-assistant'));

module.exports = router;
