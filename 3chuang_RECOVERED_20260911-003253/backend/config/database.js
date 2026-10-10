/**
 * 数据库配置模块
 * 职责：创建和管理MySQL数据库连接池
 * 使用方法：const db = require('./config/database'); db.query(sql, params, callback);
 */

const mysql = require('mysql2');
require('dotenv').config();

if (process.env.EXPECTED_DB_NAME && process.env.DB_NAME !== process.env.EXPECTED_DB_NAME) {
  throw new Error('Database isolation guard: DB_NAME differs from EXPECTED_DB_NAME');
}

/**
 * 创建MySQL连接池
 * 连接池可以复用数据库连接，提高性能
 * 支持通过环境变量配置数据库连接参数
 */
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

/**
 * 测试数据库连接
 * 在应用启动时验证数据库是否可以正常连接
 */
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    return;
  }
  console.log('✅ 数据库连接成功');
  connection.release();
});

// 导出Promise版本的连接池，支持async/await语法
module.exports = pool.promise();
