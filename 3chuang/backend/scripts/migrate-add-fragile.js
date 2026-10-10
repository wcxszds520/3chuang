/**
 * 数据库迁移脚本 - 添加fragile字段
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
  let connection;
  try {
    // 创建数据库连接（强制使用IPv4）
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'wcxszds520',
      database: 'ningbo_port_packing'
    });
    
    console.log('✓ 数据库连接成功');
    
    const sql = fs.readFileSync(
      path.join(__dirname, '../config/migrations/add-fragile-field.sql'),
      'utf8'
    );
    
    await connection.query(sql);
    console.log('✓ fragile字段添加成功');
    
  } catch (err) {
    if (err.message.includes('Duplicate column')) {
      console.log('✓ fragile字段已存在，跳过迁移');
    } else {
      console.error('✗ 迁移失败:', err.message);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
