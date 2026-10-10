/**
 * 测试环境变量加载
 */

require('dotenv').config();

console.log('\n=== 环境变量测试 ===\n');

console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('\n=== AI配置 ===\n');
console.log('AI_API_KEY:', process.env.AI_API_KEY ? '已配置' : '未配置');
console.log('AI_API_ENDPOINT:', process.env.AI_API_ENDPOINT);
console.log('AI_MODEL:', process.env.AI_MODEL);

console.log('\n=== 测试完成 ===\n');
