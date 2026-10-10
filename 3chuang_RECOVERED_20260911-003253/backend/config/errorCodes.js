/**
 * 统一错误码集合
 * 
 * 所有 API 错误响应使用此处定义的错误码，
 * 禁止裸抛堆栈到响应体。
 * 
 * Requirements: 9.6, 11.4
 */

const ERROR_CODES = {
  // 输入校验类
  INVALID_INPUT: {
    httpStatus: 400,
    message: '输入校验失败'
  },
  UNKNOWN_FIELDS: {
    httpStatus: 400,
    message: '请求包含未知字段'
  },
  PAYLOAD_TOO_LARGE: {
    httpStatus: 413,
    message: '请求体超过大小限制'
  },

  // 业务逻辑类
  OVERSIZE: {
    httpStatus: 422,
    message: '货物超限'
  },
  UNKNOWN_ALGORITHM: {
    httpStatus: 422,
    message: '非白名单算法 ID'
  },
  SCHEMA_INVALID: {
    httpStatus: 422,
    message: 'JSON Schema 校验失败'
  },
  OUT_OF_SCOPE: {
    httpStatus: 422,
    message: 'AI 问答超出上下文范围'
  },

  // 超时与限流类
  TIMEOUT: {
    httpStatus: 408,
    message: '计算超时'
  },
  RATE_LIMITED: {
    httpStatus: 429,
    message: '超过调用频率限制'
  },

  // 服务不可用类
  BLOCKING: {
    httpStatus: 503,
    message: '回归用例失败，发布阻断'
  },
  PREVENTIVE_BLOCK: {
    httpStatus: 503,
    message: '回归用例未执行，预防性阻断'
  },

  // 通用服务端错误
  INTERNAL_ERROR: {
    httpStatus: 500,
    message: '服务器内部错误'
  },
  DATABASE_ERROR: {
    httpStatus: 500,
    message: '数据库操作失败'
  },
  AI_SERVICE_ERROR: {
    httpStatus: 502,
    message: 'AI 服务调用失败'
  }
};

module.exports = ERROR_CODES;
