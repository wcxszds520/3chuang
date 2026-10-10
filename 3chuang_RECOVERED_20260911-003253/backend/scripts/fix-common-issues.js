/**
 * 常见问题自动修复脚本
 * 
 * 运行方式：node scripts/fix-common-issues.js
 */

const fs = require('fs');
const path = require('path');

console.log('=== 宁波港3D装箱系统 - 问题诊断与修复 ===\n');

// 问题1: 检查.env文件
function checkEnvFile() {
  console.log('检查1: .env配置文件...');
  
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envPath)) {
    console.log('  ⚠️  .env文件不存在');
    
    if (fs.existsSync(envExamplePath)) {
      console.log('  ✅ 正在从.env.example创建.env文件...');
      fs.copyFileSync(envExamplePath, envPath);
      console.log('  ✅ .env文件已创建，请编辑配置数据库信息');
    } else {
      console.log('  ❌ .env.example也不存在，请手动创建');
    }
  } else {
    console.log('  ✅ .env文件存在');
    
    // 检查必需配置
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingVars = requiredVars.filter(v => !envContent.includes(v));
    
    if (missingVars.length > 0) {
      console.log(`  ⚠️  缺少必需配置: ${missingVars.join(', ')}`);
    } else {
      console.log('  ✅ 必需配置完整');
    }
    
    // 检查AI配置
    if (!envContent.includes('AI_API_KEY') || envContent.includes('your_deepseek_api_key_here')) {
      console.log('  ℹ️  AI功能未配置（可选，系统会自动降级）');
    } else {
      console.log('  ✅ AI功能已配置');
    }
  }
  
  console.log('');
}

// 问题2: 检查数据库连接
async function checkDatabase() {
  console.log('检查2: 数据库连接...');
  
  try {
    require('dotenv').config();
    const db = require('../config/database');
    
    await db.query('SELECT 1');
    console.log('  ✅ 数据库连接成功');
    
    // 检查表是否存在
    const [tables] = await db.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    const requiredTables = ['cargo', 'container_type', 'packing_plan'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`  ⚠️  缺少数据表: ${missingTables.join(', ')}`);
      console.log('  💡 运行: node setup-database.js 初始化数据库');
    } else {
      console.log('  ✅ 所有必需数据表存在');
    }
    
    await db.end();
  } catch (error) {
    console.log(`  ❌ 数据库连接失败: ${error.message}`);
    console.log('  💡 请检查.env中的数据库配置');
  }
  
  console.log('');
}

// 问题3: 检查依赖安装
function checkDependencies() {
  console.log('检查3: Node.js依赖...');
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('  ❌ node_modules不存在');
    console.log('  💡 运行: npm install');
  } else {
    console.log('  ✅ node_modules存在');
    
    // 检查关键依赖
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const keyDeps = ['express', 'mysql2', 'dotenv', 'cors'];
    
    const missingDeps = keyDeps.filter(dep => {
      const depPath = path.join(nodeModulesPath, dep);
      return !fs.existsSync(depPath);
    });
    
    if (missingDeps.length > 0) {
      console.log(`  ⚠️  缺少关键依赖: ${missingDeps.join(', ')}`);
      console.log('  💡 运行: npm install');
    } else {
      console.log('  ✅ 关键依赖完整');
    }
  }
  
  console.log('');
}

// 问题4: 检查端口占用
async function checkPort() {
  console.log('检查4: 端口占用...');
  
  require('dotenv').config();
  const PORT = process.env.PORT || 3000;
  
  const net = require('net');
  const server = net.createServer();
  
  return new Promise((resolve) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`  ⚠️  端口${PORT}已被占用`);
        console.log(`  💡 修改.env中的PORT或关闭占用进程`);
      }
      resolve();
    });
    
    server.once('listening', () => {
      console.log(`  ✅ 端口${PORT}可用`);
      server.close();
      resolve();
    });
    
    server.listen(PORT);
  });
}

// 问题5: 检查文件结构
function checkFileStructure() {
  console.log('检查5: 项目文件结构...');
  
  const requiredDirs = [
    'config',
    'models',
    'routes',
    'services',
    'middleware',
    '__tests__'
  ];
  
  const missingDirs = requiredDirs.filter(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    return !fs.existsSync(dirPath);
  });
  
  if (missingDirs.length > 0) {
    console.log(`  ⚠️  缺少目录: ${missingDirs.join(', ')}`);
  } else {
    console.log('  ✅ 项目结构完整');
  }
  
  // 检查关键文件
  const requiredFiles = [
    'server.js',
    'package.json',
    'config/database.js',
    'services/OptimizedPackingEngine.js',
    'services/AIPackingService.js'
  ];
  
  const missingFiles = requiredFiles.filter(file => {
    const filePath = path.join(__dirname, '..', file);
    return !fs.existsSync(filePath);
  });
  
  if (missingFiles.length > 0) {
    console.log(`  ⚠️  缺少文件: ${missingFiles.join(', ')}`);
  } else {
    console.log('  ✅ 关键文件完整');
  }
  
  console.log('');
}

// 主函数
async function main() {
  checkEnvFile();
  checkDependencies();
  checkFileStructure();
  await checkPort();
  await checkDatabase();
  
  console.log('=== 诊断完成 ===\n');
  console.log('💡 下一步：');
  console.log('  1. 如果有⚠️或❌，请按照提示修复');
  console.log('  2. 运行 npm start 启动服务');
  console.log('  3. 运行 npm test 验证功能');
  console.log('  4. 查看 SETUP_GUIDE.md 获取详细配置指南');
  console.log('');
}

main().catch(console.error);
