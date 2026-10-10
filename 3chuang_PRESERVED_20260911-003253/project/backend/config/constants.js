/**
 * 全局数值常量集中管理
 * 
 * 所有超时阈值、SKU 分界点、容器尺寸等数值常量统一在此定义，
 * 业务代码内禁止出现未命名的魔法数字。
 * 
 * Requirements: 9.4
 */

// 超时阈值（毫秒）
const TIMEOUT_MS = 60000;           // 算法执行超时
const AI_TIMEOUT_MS = 10000;        // AI 调用超时
const CACHE_HIT_MAX_MS = 50;        // 缓存命中最大响应时间
const AI_CACHE_HIT_MAX_MS = 100;    // AI 语义缓存最大响应时间

// SKU 策略族分界点
const SKU_THRESHOLD_EXACT = 50;     // ≤ 50 使用精确/回溯类
const SKU_THRESHOLD_HEURISTIC = 500; // ≤ 500 使用启发式，> 500 使用元启发式

// 最大集装箱尺寸（40HQ 标准）
const MAX_CONTAINER_DIMENSIONS = {
  maxLength: 12032,   // mm
  maxWidth: 2352,     // mm
  maxHeight: 2698,    // mm
  maxWeight: 26000    // kg
};

// 限流配置
const RATE_LIMIT = {
  windowMs: 60000,        // 滑动窗口 60 秒
  maxRequests: 60,        // 每窗口最大请求数
  maxPayloadBytes: 1048576 // 请求体大小限制 1MB
};

// 算法白名单
const ALGORITHM_WHITELIST = [
  'realistic4d',
  'realistic4d-weight-first',
  'realistic4d-volume-first',
  'realistic4d-mixed',
  'realistic4d-multi-strategy',
  'fast-block'
];

// 缓存配置
const CACHE_TTL_SECONDS = 300;      // 结果缓存 TTL（秒）

// AI 配置
const AI_MAX_RETRIES = 1;           // AI Schema 校验失败重试次数
const AI_RECOMMENDATION_COUNT = 3;  // AI 推荐箱型数量
const AI_EXPLANATION_MAX_CHARS = 200; // AI 解释最大字数
const AI_REASON_MAX_CHARS = 80;     // AI 推荐理由最大字数

module.exports = {
  TIMEOUT_MS,
  AI_TIMEOUT_MS,
  CACHE_HIT_MAX_MS,
  AI_CACHE_HIT_MAX_MS,
  SKU_THRESHOLD_EXACT,
  SKU_THRESHOLD_HEURISTIC,
  MAX_CONTAINER_DIMENSIONS,
  RATE_LIMIT,
  ALGORITHM_WHITELIST,
  CACHE_TTL_SECONDS,
  AI_MAX_RETRIES,
  AI_RECOMMENDATION_COUNT,
  AI_EXPLANATION_MAX_CHARS,
  AI_REASON_MAX_CHARS
};
