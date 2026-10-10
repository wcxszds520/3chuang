/**
 * VLM Cargo Service - 视觉语言模型货物识别 (VLM 拍照录货)
 *
 * 架构: 把 "拍照录货" 这件事交给 VLM (视觉语言模型)
 *   - 用户上传/拍摄货物照片 (前端 → base64)
 *   - 本服务调 SiliconFlow Qwen3-VL-32B 视觉模型
 *   - 2 秒内返回结构化货物属性: 名称/尺寸/品类/风险/包装
 *   - 前端自动填表, 用户确认即可加入订单
 *
 * 对答辩的意义 (P0 杀招 · 社会价值核心):
 *   中小卖家不会量尺寸、不懂品类、不知道危险品标识。
 *   "拍一张照片,2 秒自动填表" 把专业能力普惠给所有人。
 *   这是 VLM (视觉语言模型) 在跨境物流录入场景的落地,
 *   不是 OCR, 是 "看懂货物" 的多模态 AI。
 *
 * 降级策略: VLM 不可用时返回 null, 前端走原手动录入流程。
 */

const axios = require('axios');

class VLMCargoService {
  constructor() {
    // VLM 只使用 SiliconFlow 专用 key，避免误把 DeepSeek key 当作 VLM 可用。
    this.apiUrl = process.env.SILICONFLOW_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions';
    this.apiKey = process.env.SILICONFLOW_API_KEY || '';
    // 视觉模型独立配置：本轮统一使用 Qwen3-VL-32B。
    this.model = process.env.SILICONFLOW_VLM_MODEL || 'Qwen/Qwen3-VL-32B-Instruct';
    this.timeout = Number(process.env.VLM_TIMEOUT_MS) || 30000;
    this.maxAttempts = Math.max(1, Math.min(2, Number(process.env.VLM_MAX_ATTEMPTS) || 2));

    console.log('[VLMCargoService] Model:', this.model);
    console.log('[VLMCargoService] API Key configured:', this.apiKey ? 'YES' : 'NO');
  }

  /**
   * 识别货物属性
   * @param {string} imageBase64 - base64 图片 (不带 data:image 前缀, 纯 base64)
   * @param {string} mimeType - image/jpeg | image/png
   * @returns {Promise<Object|null>} 结构化货物属性；同时保留旧字段以兼容现有前端。
   */
  async recognizeCargo(imageBase64, mimeType = 'image/jpeg') {
    const result = await this.recognizeCargoWithMeta(imageBase64, mimeType);
    return result.success ? result.data : null;
  }

  /**
   * 带 attempt 元数据的真实识别。失败只返回失败原因, 不编造识别结果。
   */
  async recognizeCargoWithMeta(imageBase64, mimeType = 'image/jpeg') {
    if (!this.apiKey) {
      console.warn('[VLMCargoService] No API key, VLM disabled');
      return {
        success: false,
        data: null,
        model: this.model,
        errorCode: 'VLM_API_KEY_MISSING',
        message: 'SILICONFLOW_API_KEY is not configured',
        attempts: []
      };
    }

    const attempts = [];
    for (let attemptNo = 1; attemptNo <= this.maxAttempts; attemptNo += 1) {
      try {
        const data = await this._recognizeOnce(imageBase64, mimeType, attemptNo);
        attempts.push({
          attempt: attemptNo,
          ok: true,
          elapsedMs: data.elapsedMs,
          model: this.model
        });
        return {
          success: true,
          data,
          model: this.model,
          attempts
        };
      } catch (error) {
        const summary = this._summarizeError(error, attemptNo);
        attempts.push(summary);
        console.error('[VLMCargoService] Attempt failed:', summary.errorCode, summary.message);
      }
    }

    const last = attempts[attempts.length - 1] || {};
    return {
      success: false,
      data: null,
      model: this.model,
      errorCode: last.errorCode || 'VLM_RECOGNITION_FAILED',
      message: last.message || 'VLM recognition failed',
      attempts
    };
  }

  async _recognizeOnce(imageBase64, mimeType, attemptNo) {
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const systemPrompt = `你是跨境物流装箱系统的货物识别助手。用户上传一张货物照片,你需要识别并返回该货物的装箱属性。

必须返回 JSON 格式 (不要 markdown 代码块),字段如下:
{
  "cargo_name": "货物中文名称 (如:空气炸锅、电饭煲、纸箱装衣物)",
  "possible_sku": "如果图片中能看到 SKU/唛头/型号则填写,否则空字符串",
  "packaging_type": "carton|wooden|pallet|wrapped_pallet|bag|battery|mixed|unknown 之一",
  "material": "cardboard|wood|plastic|metal|mixed|unknown 之一",
  "is_wood_packaging": boolean,
  "is_fragile": boolean,
  "is_stackable": boolean,
  "visible_label_text": "能看清的标签/唛头/箱体文字,没有则空字符串",
  "risk_flags": ["wood_packaging_missing_ippc","fragile","dangerous_goods","manual_measurement_required"] 中可能出现的风险,
  "manual_review_required": boolean,
  "length": 估算长度mm (整数, 典型家电 200-600),
  "width": 估算宽度mm (整数),
  "height": 估算高度mm (整数),
  "weight": 估算单件重量kg (数字, 小家电 2-8, 大家电 10-25),
  "dangerous": boolean (锂电池/化学品/带电带磁为 true),
  "confidence": 0-1 的置信度,
  "rawDescription": "一句话描述你看到了什么 (用于前端展示)"
}

判断要点:
- packaging_type: 纸箱=carton, 木托/木箱=wooden 或 pallet, 缠绕膜托盘=wrapped_pallet, 软包/编织袋=bag, 电池/带UN标识=battery
- is_wood_packaging: 出现木托盘、木箱、木框、木质垫板均为 true
- dangerous: 看到锂电池、UN38.3 标识、易燃标识、化学品桶 → true
- is_fragile: 看到玻璃杯标志、易碎标签、精密仪器 → true
- 尺寸估算: 参考常见物体, 误差 ±20% 可接受
- 无法确定时 confidence 给 0.3-0.5, 让用户复核`;

    const userPrompt = '请识别这张货物照片的装箱属性,严格返回 JSON。';

    const startTime = Date.now();
    const response = await axios.post(
      this.apiUrl,
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 650,
        stream: false,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      }
    );

    const elapsed = Date.now() - startTime;
    const content = response.data?.choices?.[0]?.message?.content || '';
    console.log(`[VLMCargoService] Attempt ${attemptNo} response in ${elapsed}ms:`, content.substring(0, 200));

    const parsed = this._parseJsonContent(content);
    return this._normalizeResult(parsed, elapsed);
  }

  _parseJsonContent(content) {
    let text = String(content || '').trim();
    if (!text) {
      const error = new Error('VLM returned empty content');
      error.code = 'VLM_EMPTY_CONTENT';
      throw error;
    }

    if (text.startsWith('```json')) text = text.slice(7);
    else if (text.startsWith('```')) text = text.slice(3);
    if (text.endsWith('```')) text = text.slice(0, -3);
    text = text.trim();

    try {
      return JSON.parse(text);
    } catch {
      const extracted = this._extractFirstJsonObject(text);
      if (extracted) return JSON.parse(extracted);
      const error = new Error('VLM returned non-JSON content');
      error.code = 'VLM_JSON_PARSE_FAILED';
      throw error;
    }
  }

  _extractFirstJsonObject(text) {
    const start = text.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = !inString;
      } else if (!inString && ch === '{') {
        depth += 1;
      } else if (!inString && ch === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  _summarizeError(error, attemptNo) {
    const status = error.response?.status || null;
    const responseMessage = error.response?.data?.message || error.response?.data?.error?.message || '';
    const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '');
    const errorCode = isTimeout
      ? 'VLM_TIMEOUT'
      : error.code || (status ? `VLM_HTTP_${status}` : 'VLM_RECOGNITION_FAILED');
    return {
      attempt: attemptNo,
      ok: false,
      elapsedMs: Number(error.config?.metadata?.elapsedMs || 0),
      model: this.model,
      httpStatus: status,
      errorCode,
      message: String(responseMessage || error.message || 'VLM recognition failed').slice(0, 240)
    };
  }

  /**
   * 归一化 VLM 返回, 保证字段类型/范围合法
   */
  _normalizeResult(raw, elapsedMs) {
    const toInt = (v, min, max, fallback) => {
      const n = parseInt(v, 10);
      if (Number.isNaN(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const toFloat = (v, min, max, fallback) => {
      const n = parseFloat(v);
      if (Number.isNaN(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
    const text = (v, fallback = '') => typeof v === 'string' ? v.trim() : fallback;

    const validPackaging = ['carton', 'wooden', 'pallet', 'wrapped_pallet', 'bag', 'battery', 'mixed', 'unknown'];
    const rawPackaging = text(raw.packaging_type || raw.packagingType, 'unknown');
    const packagingType = validPackaging.includes(rawPackaging) ? rawPackaging : 'unknown';
    const material = text(raw.material, packagingType === 'carton' ? 'cardboard' : packagingType === 'wooden' || packagingType === 'pallet' ? 'wood' : 'unknown');
    const cargoName = text(raw.cargo_name || raw.name, '未识别货物').substring(0, 40);
    const confidence = toFloat(raw.confidence, 0, 1, 0.5);
    const riskFlags = Array.isArray(raw.risk_flags)
      ? raw.risk_flags.map((flag) => String(flag).trim()).filter(Boolean).slice(0, 8)
      : [];
    const isWoodPackaging = toBool(raw.is_wood_packaging) || packagingType === 'wooden' || packagingType === 'pallet' || material === 'wood';
    const isFragile = toBool(raw.is_fragile ?? raw.fragile);
    const isStackable = toBool(raw.is_stackable ?? raw.stackable);
    const dangerous = toBool(raw.dangerous);

    return {
      cargo_name: cargoName,
      possible_sku: text(raw.possible_sku).substring(0, 40),
      packaging_type: packagingType,
      material: material.substring(0, 40),
      is_wood_packaging: isWoodPackaging,
      is_fragile: isFragile,
      is_stackable: isStackable,
      visible_label_text: text(raw.visible_label_text).substring(0, 120),
      risk_flags: riskFlags,
      confidence,
      manual_review_required: toBool(raw.manual_review_required) || confidence < 0.75 || riskFlags.length > 0,
      name: cargoName,
      length: toInt(raw.length, 10, 3000, 400),
      width: toInt(raw.width, 10, 3000, 300),
      height: toInt(raw.height, 10, 3000, 250),
      weight: toFloat(raw.weight, 0.1, 500, 5),
      packagingType: packagingType === 'pallet' || packagingType === 'wrapped_pallet' ? 'wooden' : packagingType,
      fragile: isFragile,
      dangerous,
      stackable: isStackable,
      rawDescription: typeof raw.rawDescription === 'string' ? raw.rawDescription.substring(0, 100) : '',
      elapsedMs,
      model: this.model
    };
  }
}

module.exports = new VLMCargoService();
