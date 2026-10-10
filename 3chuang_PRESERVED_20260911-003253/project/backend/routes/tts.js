/**
 * TTS Route - 语音合成 API (火山引擎豆包语音)
 *
 * 暴露 TTS 能力:
 *   POST /api/tts/synthesize  — 文本 → WAV 音频 (火山引擎 seed-tts-2.0)
 *   GET  /api/tts/status      — 检查 TTS 服务是否可用
 *
 * 答辩意义: 装柜系统的语音播报从浏览器机械音升级为火山引擎豆包语音大模型,
 *   与 zhuochong ESP32 桌宠共用一套语音能力 — 体现技术栈一致性。
 */
const express = require('express');
const router = express.Router();
const volcTtsService = require('../services/VolcTtsService');

// 简单内存缓存: 避免重复合成相同文本 (装柜指令高度重复)
const ttsCache = new Map();
const CACHE_MAX = 50;

/**
 * POST /api/tts/synthesize
 * body: { text: "要合成的文本" }
 * returns: audio/wav 二进制 (前端用 Audio API 播放)
 */
router.post('/synthesize', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'text is required',
        data: null
      });
    }

    // 文本过长截断 (TTS 单次限制)
    const cleanText = text.trim().substring(0, 500);

    // 查缓存
    const cacheKey = cleanText;
    if (ttsCache.has(cacheKey)) {
      const cached = ttsCache.get(cacheKey);
      res.set('Content-Type', 'audio/wav');
      res.set('Content-Length', cached.length);
      res.set('X-TTS-Cache', 'HIT');
      return res.send(cached);
    }

    const wavBuffer = await volcTtsService.synthesize(cleanText);
    if (!wavBuffer) {
      // TTS 不可用, 返回 null 让前端降级到 Web Speech
      return res.json({
        code: 200,
        message: 'TTS unavailable, fallback to browser speech',
        data: null
      });
    }

    // 写缓存
    if (ttsCache.size >= CACHE_MAX) {
      const firstKey = ttsCache.keys().next().value;
      ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, wavBuffer);

    res.set('Content-Type', 'audio/wav');
    res.set('Content-Length', wavBuffer.length);
    res.set('X-TTS-Cache', 'MISS');
    res.set('X-TTS-Engine', 'volcengine-seed-tts-2.0');
    res.send(wavBuffer);
  } catch (error) {
    console.error('[TTSRoute] synthesize error:', error.message);
    res.status(500).json({
      code: 500,
      message: 'TTS synthesis failed',
      data: null
    });
  }
});

/**
 * GET /api/tts/status
 * 检查 TTS 服务是否可用 (供前端决定用火山引擎还是浏览器降级)
 */
router.get('/status', (req, res) => {
  res.json({
    code: 200,
    message: 'TTS status',
    data: {
      available: volcTtsService.isAvailable(),
      engine: volcTtsService.isAvailable() ? 'volcengine-seed-tts-2.0' : 'browser-fallback',
      speaker: volcTtsService.speaker,
      sampleRate: volcTtsService.sampleRate
    }
  });
});

module.exports = router;
