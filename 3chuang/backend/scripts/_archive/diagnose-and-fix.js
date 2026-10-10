/**
 * 诊断和修复后端服务连接问题
 */

const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const PORTS_TO_CHECK = [3000, 3001, 3002];

async function checkPort(port) {
  try {
    const response = await axios.get(`http://localhost:${port}/api/container/list`, {
      timeout: 2000
    });
    return { port, status: 'running', data: response.data };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return { port, status: 'not_running' };
    } else if (error.response) {
      return { port, status: 'running_with_error', error: error.response.status };
    } else {
      return { port, status: 'unknown', error: error.message };
    }
  }
}

async function findRunningPort() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   诊断后端服务连接问题                ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log('【步骤1】检查后端服务运行状态\n');
  
  const results = await Promise.all(PORTS_TO_CHECK.map(checkPort));
  
  let runningPort = null;
  
  for (const result of results) {
    if (result.status === 'running') {
      console.log(`✅ 端口 ${result.port}: 服务正常运行`);
      runningPort = result.port;
    } else if (result.status === 'not_running') {
      console.log(`❌ 端口 ${result.port}: 服务未运行`);
    } else {
      console.log(`⚠️  端口 ${result.port}: ${result.status} (${result.error})`);
    }
  }
  
  return runningPort;
}

async function checkProcesses() {
  console.log('\n【步骤2】检查Node.js进程\n');
  
  try {
    // Windows系统使用netstat命令
    const { stdout } = await execPromise('netstat -ano | findstr :3000');
    console.log('端口3000占用情况:');
    console.log(stdout);
  } catch (error) {
    console.log('端口3000未被占用');
  }
  
  try {
    const { stdout } = await execPromise('netstat -ano | findstr :3001');
    console.log('\n端口3001占用情况:');
    console.log(stdout);
  } catch (error) {
    console.log('端口3001未被占用');
  }
}

async function provideSolution(runningPort) {
  console.log('\n【步骤3】解决方案\n');
  
  if (runningPort) {
    console.log(`✅ 后端服务运行在端口 ${runningPort}\n`);
    
    if (runningPort !== 3000) {
      console.log('⚠️  问题：微信小程序配置的是端口3000，但服务运行在端口' + runningPort);
      console.log('\n解决方案（选择一个）：\n');
      console.log(`方案1: 修改微信小程序配置`);
      console.log(`   文件: miniprogram/utils/request.js`);
      console.log(`   修改: const BASE_URL = 'http://localhost:${runningPort}/api';`);
      console.log('');
      console.log('方案2: 修改后端服务端口');
      console.log('   文件: backend/.env');
      console.log('   修改: PORT=3000');
      console.log('   然后重启后端服务: npm start');
    } else {
      console.log('✅ 端口配置正确！');
      console.log('\n但微信小程序仍然连接失败，可能原因：');
      console.log('1. 微信开发者工具未重新加载代码');
      console.log('2. 微信开发者工具的网络权限被限制');
      console.log('3. 防火墙阻止了连接');
      console.log('\n解决方案：');
      console.log('1. 完全关闭微信开发者工具，重新打开');
      console.log('2. 检查微信开发者工具 → 设置 → 代理设置');
      console.log('3. 检查Windows防火墙设置');
    }
  } else {
    console.log('❌ 后端服务未运行！\n');
    console.log('解决方案：\n');
    console.log('1. 启动后端服务:');
    console.log('   cd backend');
    console.log('   npm start');
    console.log('');
    console.log('2. 如果启动失败，检查：');
    console.log('   - 数据库是否运行');
    console.log('   - backend/.env 文件是否存在');
    console.log('   - 端口3000是否被其他程序占用');
    console.log('');
    console.log('3. 查看详细错误信息:');
    console.log('   cd backend');
    console.log('   npm start');
    console.log('   (查看控制台输出的错误信息)');
  }
}

async function main() {
  try {
    const runningPort = await findRunningPort();
    await checkProcesses();
    await provideSolution(runningPort);
    
    console.log('\n========================================\n');
    
  } catch (error) {
    console.error('\n❌ 诊断失败:', error.message);
  }
}

main();
