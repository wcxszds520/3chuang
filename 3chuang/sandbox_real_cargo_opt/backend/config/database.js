/**
 * 数据库配置模块（沙盒版）
 * 职责：创建和管理MySQL数据库连接池
 * 使用方法：const db = require('./config/database'); db.query(sql, params, callback);
 *
 * [MUTATION real-R2] 懒加载连接池：装箱引擎在传入直接容器对象时从不触库，
 * 模块加载即建池+探活会给每次冷启动叠加固定开销（并输出连接失败噪声）。
 * 改为首次 query() 时才建池；保留原 promise API 与 db.pool 直访通道。
 */

const mysql = require('mysql2');
require('dotenv').config();

let poolPromise = null;
let eagerProbeDone = false;

function getPool() {
  if (!poolPromise) {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ningbo_port_packing',
      waitForConnections: true,
      connectionLimit: 10,  // 最大连接数
      queueLimit: 0,        // 队列长度限制，0表示无限制
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    poolPromise = pool.promise();

    // 首次真实使用时做一次探活（保持原启动自检语义，但不阻塞冷启动）
    if (!eagerProbeDone) {
      eagerProbeDone = true;
      poolPromise.getConnection()
        .then((connection) => {
          console.log('✅ 数据库连接成功');
          connection.release();
        })
        .catch((err) => {
          console.error('❌ 数据库连接失败:', err.message);
        });
    }
  }
  return poolPromise;
}

// 兼容原 API：db.query(sql, params) —— 首次调用时才真正建池
module.exports = {
  query(sql, params) {
    return getPool().query(sql, params);
  },
  getConnection() {
    return getPool().getConnection();
  },
  get pool() {
    return getPool();
  }
};
