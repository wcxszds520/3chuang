/**
 * VLM Cargo Route - 视觉语言模型货物识别 API
 *
 * 暴露 VLM 拍照录货能力:
 *   POST /api/vlm/recognize-cargo   — 上传货物图片, 返回结构化货物属性
 *
 * 答辩意义: 中小卖家不会量尺寸/不懂品类, "拍照 2 秒自动填表"
 *           把专业能力普惠给所有人 — VLM 多模态 AI 在物流录入的落地。
 */

const express = require('express');
const router = express.Router();
const vlmCargoService = require('../services/VLMCargoService');

/**
 * POST /api/vlm/recognize-cargo
 * body: { image: "base64字符串", mimeType?: "image/jpeg" }
 * returns: { code, message, data: { name, length, width, height, weight, packagingType, fragile, dangerous, stackable, confidence, rawDescription, elapsedMs, model } | null }
 */
router.post('/recognize-cargo', async (req, res) => {
  try {
    const { image, mimeType = 'image/jpeg' } = req.body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        code: 400,
        message: 'image (base64) is required',
        data: null
      });
    }

    // 去掉可能的 data:image/jpeg;base64, 前缀, 取纯 base64
    const pureBase64 = image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    // 大小校验: base64 字符串 < 8MB (约 6MB 原图)
    if (pureBase64.length > 8 * 1024 * 1024) {
      return res.status(413).json({
        code: 413,
        message: 'Image too large (max 6MB)',
        data: null
      });
    }

    const result = await vlmCargoService.recognizeCargoWithMeta(pureBase64, mimeType);

    if (!result.success) {
      // VLM 不可用或识别失败：返回真实失败原因，前端必须展示失败而不是成功。
      return res.json({
        code: result.errorCode === 'VLM_API_KEY_MISSING' ? 503 : 502,
        message: 'VLM recognition failed, manual input required',
        data: null,
        error: {
          errorCode: result.errorCode,
          message: result.message,
          model: result.model,
          attempts: result.attempts
        }
      });
    }

    res.json({
      code: 200,
      message: 'Cargo recognized by VLM',
      data: result.data,
      meta: {
        model: result.model,
        attempts: result.attempts
      }
    });
  } catch (error) {
    console.error('[VLMRoute] recognize-cargo error:', error.message);
    res.status(500).json({
      code: 500,
      message: 'VLM recognition failed',
      data: null
    });
  }
});

/**
 * GET /api/vlm/status
 * 检查 VLM 服务是否可用 (供前端显示 "拍照识别" 按钮是否启用)
 */
router.get('/status', (req, res) => {
  res.json({
    code: 200,
    message: 'VLM status',
    data: {
      available: !!vlmCargoService.apiKey,
      model: vlmCargoService.model,
      timeoutMs: vlmCargoService.timeout,
      maxAttempts: vlmCargoService.maxAttempts
    }
  });
});

module.exports = router;
