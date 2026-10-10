/**
 * Jest测试环境设置文件
 * 在所有测试运行前执行
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
// Integration fixtures must never address the normal application database.
// An explicit test database may be supplied; it must still be test-namespaced.
const testDatabase = process.env.PORTCUBE_TEST_DB || 'portcube_master_rebuild_test';
if (!/^portcube_[a-z0-9_]*test[a-z0-9_]*$/i.test(testDatabase)) throw new Error('PORTCUBE_TEST_DB must name an isolated portcube test database');
process.env.DB_NAME = testDatabase;
process.env.EXPECTED_DB_NAME = testDatabase;
