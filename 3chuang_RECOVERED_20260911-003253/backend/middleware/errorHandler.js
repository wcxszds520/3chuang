/**
 * 全局错误处理中间件
 * 
 * 职责：
 * - 捕获所有未处理的异常
 * - 映射到统一错误码（ERROR_CODES）
 * - 剥离 stack trace（生产环境禁止泄露）
 * - 返回统一包络 { code, message, data, ts }
 * 
 * Requirements: 9.6, 11.4
 */

const ERROR_CODES = require('../config/errorCodes');

/**
 * 全局错误处理函数
 * @param {Error} err - 错误对象
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - Express next 函数
 */
const errorHandler = (err, req, res, next) => {
  // 记录完整错误到服务端日志（含 stack）
  console.error('❌ 服务器错误:', err.message || err);
  if (err.stack) {
    console.error(err.stack);
  }

  // 解析错误码
  const errorInfo = _resolveError(err);

  // 返回统一包络，禁止暴露 stack trace
  res.status(errorInfo.httpStatus).json({
    code: errorInfo.code,
    message: errorInfo.message,
    data: errorInfo.data || null,
    ts: Date.now()
  });
};

/**
 * 解析错误对象，映射到统一错误码
 * @private
 */
function _resolveError(err) {
  // 1. 业务代码主动抛出的带 errorCode 的错误
  if (err.errorCode && ERROR_CODES[err.errorCode]) {
    const def = ERROR_CODES[err.errorCode];
    return {
      code: err.errorCode,
      httpStatus: err.statusCode || def.httpStatus,
      message: err.message || def.message,
      data: err.details || null
    };
  }

  // 2. 带 statusCode 的自定义错误
  if (err.statusCode) {
    const code = _httpStatusToCode(err.statusCode);
    return {
      code,
      httpStatus: err.statusCode,
      message: err.message || ERROR_CODES[code]?.message || '操作失败',
      data: err.details || null
    };
  }

  // 3. 数据库错误
  if (err.code && err.code.startsWith && err.code.startsWith('ER_')) {
    if (err.code === 'ER_DUP_ENTRY') {
      return {
        code: 'INVALID_INPUT',
        httpStatus: 400,
        message: '数据已存在，请勿重复提交',
        data: null
      };
    }
    return {
      code: 'DATABASE_ERROR',
      httpStatus: 500,
      message: ERROR_CODES.DATABASE_ERROR.message,
      data: null
    };
  }

  // 4. 参数验证错误
  if (err.name === 'ValidationError') {
    return {
      code: 'INVALID_INPUT',
      httpStatus: 400,
      message: err.message || ERROR_CODES.INVALID_INPUT.message,
      data: err.details || null
    };
  }

  // 5. 默认：内部错误
  return {
    code: 'INTERNAL_ERROR',
    httpStatus: 500,
    message: ERROR_CODES.INTERNAL_ERROR.message,
    data: null
  };
}

/**
 * HTTP 状态码到错误码的简单映射
 * @private
 */
function _httpStatusToCode(statusCode) {
  switch (statusCode) {
    case 400: return 'INVALID_INPUT';
    case 408: return 'TIMEOUT';
    case 413: return 'PAYLOAD_TOO_LARGE';
    case 422: return 'SCHEMA_INVALID';
    case 429: return 'RATE_LIMITED';
    case 503: return 'BLOCKING';
    default: return 'INTERNAL_ERROR';
  }
}

module.exports = errorHandler;
