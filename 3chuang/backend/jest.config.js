/**
 * Jest测试框架配置文件
 * 配置测试环境、覆盖率报告等选项
 */

module.exports = {
  // 测试环境：Node.js环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 覆盖率收集配置
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  
  // 测试超时时间（毫秒）
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
  
  // 设置环境变量
  setupFiles: ['<rootDir>/jest.setup.js']
};
