/**
 * 数据库初始化脚本
 * 用于创建数据库和初始化表结构
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔄 正在连接MySQL服务器...');
    
    // 首先连接到MySQL服务器（不指定数据库）
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    
    console.log('✅ MySQL服务器连接成功');
    
    // 创建数据库
    const dbName = process.env.DB_NAME || 'ningbo_port_packing';
    console.log(`🔄 正在创建数据库: ${dbName}...`);
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 ${dbName} 创建成功`);
    
    // 切换到新创建的数据库
    await connection.query(`USE ${dbName}`);
    
    // 读取并执行init.sql脚本
    console.log('🔄 正在执行初始化SQL脚本...');
    const sqlFilePath = path.join(__dirname, 'config', 'init.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // 分割SQL语句（按分号分割，但忽略注释中的分号）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        await connection.query(statement);
      }
    }
    
    console.log('✅ 初始化SQL脚本执行成功');
    
    // 验证表是否创建成功
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`✅ 数据库表创建成功，共 ${tables.length} 个表:`);
    tables.forEach(table => {
      console.log(`   - ${Object.values(table)[0]}`);
    });
    
    console.log('\n🎉 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行初始化
setupDatabase();
