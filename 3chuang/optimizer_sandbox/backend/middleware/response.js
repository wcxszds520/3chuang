/**
 * 统一响应格式中间件
 * 
 * 职责：为所有 API 接口提供统一的 JSON 响应包络
 * 包络格式：{ code, message, data, ts }
 * 
 * 使用方法：在路由中调用 res.success(data) 或 res.error(message, code)
 * 
 * Requirements: 9.6
 */

const ERROR_CODES = require('../config/errorCodes');

/**
 * 成功响应
 * @param {Object} res - Express 响应对象
 * @param {*} data - 响应数据
 * @param {String} message - 响应消息
 */
const success = (res, data = {}, message = '操作成功') => {
  res.json({
    code: 200,
    message: message,
    data: data,
    ts: Date.now()
  });
};

/**
 * 错误响应
 * @param {Object} res - Express 响应对象
 * @param {String} message - 错误消息
 * @param {Number|String} code - HTTP 状态码或错误码字符串
 */
const error = (res, message = '操作失败', code = 400) => {
  // 支持传入错误码字符串（如 'OVERSIZE'）
  if (typeof code === 'string' && ERROR_CODES[code]) {
    const def = ERROR_CODES[code];
    res.status(def.httpStatus).json({
      code: code,
      message: message || def.message,
      data: null,
      ts: Date.now()
    });
    return;
  }

  // 兼容传入数字状态码
  const httpStatus = typeof code === 'number' ? code : 400;
  res.status(httpStatus).json({
    code: httpStatus,
    message: message,
    data: null,
    ts: Date.now()
  });
};

/**
 * 响应格式中间件
 * 将 success 和 error 方法挂载到 res 对象上
 */
const responseMiddleware = (req, res, next) => {
  res.success = (data, message) => success(res, data, message);
  res.error = (message, code) => error(res, message, code);
  next();
};

module.exports = responseMiddleware;
