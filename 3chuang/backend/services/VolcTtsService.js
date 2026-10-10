/**
 * VolcEngine TTS Service - 火山引擎豆包语音合成 (Node.js 版)
 * ==========================================================
 * 移植自 zhuochong ESP32 桌宠的 volcengine_api.cpp (V3 二进制 WebSocket 协议)
 *
 * 协议: wss://openspeech.bytedance.com/api/v3/tts/bidirection
 * 认证: X-Api-Key (新版控制台 ARK 格式)
 *
 * 流程:
 *   1. WebSocket 连接 (带 X-Api-Key / X-Api-Resource-Id / X-Api-Connect-Id)
 *   2. StartConnection (event 1) → 等 ConnectionStarted (event 50)
 *   3. StartSession (event 100, 带 speaker/audio_params) → 等 SessionStarted (event 150)
 *   4. TaskRequest (event 200, 分块发送文本)
 *   5. FinishSession (event 102) → 收集音频直到 SessionFinished (event 152)
 *   6. FinishConnection (event 2)
 *   7. PCM 16kHz 16bit → 加 WAV 头 → 返回 Buffer
 *
 * 答辩意义: 把装柜系统的语音播报从浏览器内置 TTS (机械音) 升级为
 *   火山引擎豆包语音大模型 (seed-tts-2.0, 自然女声),
 *   与 zhuochong 桌宠共用一套语音能力 — 体现技术栈一致性。
 */

const WebSocket = require('ws');
const crypto = require('crypto');

// V3 二进制协议常量 (与 ESP32 C++ 实现一致)
const MSG_FULL_CLIENT_REQ = 0x01;
const MSG_AUDIO_ONLY_REQ = 0x02;
const MSG_FULL_SERVER_RESP = 0x09;
const MSG_AUDIO_ONLY_RESP = 0x0B;
const MSG_ERROR_INFO = 0x0F;

const FLAG_NO_SEQ = 0x00;
const FLAG_WITH_EVENT = 0x04;

const SER_RAW = 0x00;
const SER_JSON = 0x01;

const EVT_START_CONNECTION = 1;
const EVT_FINISH_CONNECTION = 2;
const EVT_CONNECTION_STARTED = 50;
const EVT_CONNECTION_FAILED = 51;
const EVT_START_SESSION = 100;
const EVT_FINISH_SESSION = 102;
const EVT_SESSION_STARTED = 150;
const EVT_SESSION_FAILED = 153;
const EVT_SESSION_FINISHED = 152;
const EVT_TASK_REQUEST = 200;
const EVT_TTS_RESPONSE = 352;

class VolcTtsService {
  constructor() {
    this.apiKey = process.env.VOLC_TTS_API_KEY || '';
    this.appKey = process.env.VOLC_TTS_APP_KEY || '';
    this.resourceId = process.env.VOLC_TTS_RESOURCE_ID || 'seed-tts-2.0';
    this.speaker = process.env.VOLC_TTS_SPEAKER || 'zh_female_vv_uranus_bigtts';
    this.endpoint = process.env.VOLC_TTS_ENDPOINT || 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';
    this.sampleRate = Number(process.env.VOLC_TTS_SAMPLE_RATE) || 16000;

    console.log('[VolcTtsService] Speaker:', this.speaker);
    console.log('[VolcTtsService] Resource:', this.resourceId);
    console.log('[VolcTtsService] API Key configured:', this.apiKey ? 'YES' : 'NO');
  }

  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * 合成语音
   * @param {string} text - 要合成的文本
   * @returns {Promise<Buffer|null>} WAV 格式音频 Buffer, 失败返回 null
   */
  async synthesize(text) {
    if (!this.apiKey) {
      console.warn('[VolcTtsService] No API key, TTS disabled');
      return null;
    }
    if (!text || typeof text !== 'string') return null;

    const startTime = Date.now();
    console.log(`[VolcTtsService] Synthesizing: "${text.substring(0, 50)}${text.length > 50 ? '…' : ''}"`);

    try {
      const pcmChunks = await this._runTtsSession(text);
      if (!pcmChunks || pcmChunks.length === 0) {
        console.warn('[VolcTtsService] No audio received');
        return null;
      }
      const pcmBuffer = Buffer.concat(pcmChunks);
      const wavBuffer = this._pcmToWav(pcmBuffer, this.sampleRate, 16, 1);
      const elapsed = Date.now() - startTime;
      console.log(`[VolcTtsService] ✓ ${pcmBuffer.length} bytes PCM → ${wavBuffer.length} bytes WAV in ${elapsed}ms`);
      return wavBuffer;
    } catch (error) {
      console.error('[VolcTtsService] synthesize error:', error.message);
      return null;
    }
  }

  /**
   * 执行完整 TTS 会话 (V3 二进制协议)
   */
  async _runTtsSession(text) {
    const sessionId = this._genUuid();
    const connectId = this._genUuid();

    // WebSocket 连接, 带 V3 鉴权 headers
    const ws = new WebSocket(this.endpoint, {
      headers: {
        'X-Api-Key': this.apiKey,
        'X-Api-Resource-Id': this.resourceId,
        'X-Api-Connect-Id': connectId
      },
      perMessageDeflate: false,
      handshakeTimeout: 10000
    });

    const pcmChunks = [];
    let sessionFinished = false;
    let sessionError = null;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!sessionFinished) {
          try { ws.terminate(); } catch (e) { /* noop */ }
          reject(new Error('TTS session timeout (30s)'));
        }
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
        try { ws.close(); } catch (e) { /* noop */ }
      };

      ws.on('open', () => {
        console.log('[VolcTtsService] WebSocket connected, sending StartConnection');
        // 1. StartConnection
        this._sendEventFrame(ws, EVT_START_CONNECTION, Buffer.from('{}'));
      });

      ws.on('message', (data, isBinary) => {
        if (!isBinary) return;
        const buf = Buffer.from(data);
        this._handleServerFrame(buf, ws, sessionId, text, pcmChunks, (err, finished) => {
          if (err) {
            sessionError = err;
            cleanup();
            reject(err);
          } else if (finished) {
            sessionFinished = true;
            cleanup();
            resolve(pcmChunks);
          }
        });
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[VolcTtsService] WS error:', err.message);
        reject(err);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        if (!sessionFinished && !sessionError) {
          resolve(pcmChunks); // 连接关闭, 返回已收集的音频
        }
      });
    });
  }

  /**
   * 处理服务器返回的 V3 二进制帧
   */
  _handleServerFrame(buf, ws, sessionId, text, pcmChunks, callback) {
    if (buf.length < 4) return;

    const msgType = (buf[1] >> 4) & 0x0F;
    const flags = buf[1] & 0x0F;

    // FullServerResp with event
    if (msgType === MSG_FULL_SERVER_RESP && flags === FLAG_WITH_EVENT) {
      const parsed = this._parseEventPayload(buf);
      if (!parsed) return;

      const { event, payload } = parsed;
      console.log(`[VolcTtsService] ← event ${event}`);

      if (event === EVT_CONNECTION_STARTED) {
        // 连接建立, 发送 StartSession
        this._sendStartSession(ws, sessionId);
      } else if (event === EVT_SESSION_STARTED) {
        // 会话建立, 发送文本 (分块)
        this._sendTextChunks(ws, sessionId, text);
      } else if (event === EVT_TTS_RESPONSE) {
        // event 352: TTS 音频响应, payload 就是 PCM 音频数据
        if (payload && payload.length > 0) {
          pcmChunks.push(Buffer.from(payload));
          console.log(`[VolcTtsService]   +${payload.length} bytes PCM (event 352)`);
        }
      } else if (event === EVT_SESSION_FINISHED) {
        // 会话完成, 发送 FinishConnection 并结束
        this._sendEventFrame(ws, EVT_FINISH_CONNECTION, Buffer.from('{}'));
        callback(null, true);
      } else if (event === EVT_CONNECTION_FAILED || event === EVT_SESSION_FAILED) {
        const errMsg = payload ? payload.toString('utf8') : `event ${event} failed`;
        callback(new Error(`Volc TTS failed: ${errMsg}`), false);
      }
      // event 350 (SentenceStart) / 351 (SentenceEnd) 忽略
      return;
    }

    // AudioOnlyResp - 音频数据帧 (另一种可能的音频传输方式)
    if (msgType === MSG_AUDIO_ONLY_RESP) {
      const audioData = this._extractAudioFromFrame(buf);
      if (audioData && audioData.length > 0) {
        pcmChunks.push(Buffer.from(audioData));
        console.log(`[VolcTtsService]   +${audioData.length} bytes PCM (audio frame)`);
      }
      return;
    }

    // Error frame
    if (msgType === MSG_ERROR_INFO) {
      const errInfo = this._parseErrorFrame(buf);
      callback(new Error(`Volc TTS error: ${errInfo}`), false);
      return;
    }
  }

  /**
   * 解析 event payload 帧
   * 格式: header(4) + event(4) + id_len(4) + id + payload_size(4) + payload
   */
  _parseEventPayload(buf) {
    if (buf.length < 12) return null;
    let off = 4;
    const event = buf.readInt32BE(off); off += 4;
    const idLen = buf.readUInt32BE(off); off += 4;
    if (off + idLen > buf.length) return null;
    off += idLen;
    if (off + 4 > buf.length) return null;
    const payloadSize = buf.readUInt32BE(off); off += 4;
    if (off + payloadSize > buf.length) return null;
    const payload = payloadSize > 0 ? buf.subarray(off, off + payloadSize) : null;
    return { event, payload };
  }

  /**
   * 从音频帧提取 PCM 数据
   * 帧格式有多种, 按 ESP32 实现的兼容逻辑处理
   */
  _extractAudioFromFrame(buf) {
    if (buf.length < 8) return null;
    let off = 4;
    const firstVal = buf.readInt32BE(off); off += 4;

    let payloadSize = 0;
    let audioOff = off;

    if (firstVal >= 350 && firstVal <= 400) {
      // event code (TTS_RESPONSE=352) + session_id_len + session_id + payload_size + audio
      if (off + 4 > buf.length) return null;
      const sidLen = buf.readUInt32BE(off); off += 4;
      off += sidLen;
      if (off + 4 > buf.length) return null;
      payloadSize = buf.readUInt32BE(off); off += 4;
      audioOff = off;
    } else {
      // seq + payload_size + audio  或  session_id_len + session_id + payload_size + audio
      if (off + 4 <= buf.length) {
        const maybePs = buf.readUInt32BE(off);
        if (maybePs <= buf.length - off - 4) {
          payloadSize = maybePs;
          audioOff = off + 4;
        } else if (firstVal < 200 && firstVal >= 0) {
          // session_id_len
          off = 4 + 4 + firstVal;
          if (off + 4 <= buf.length) {
            payloadSize = buf.readUInt32BE(off);
            audioOff = off + 4;
          }
        }
      }
    }

    if (payloadSize > 0 && audioOff + payloadSize <= buf.length) {
      return buf.subarray(audioOff, audioOff + payloadSize);
    }
    return null;
  }

  _parseErrorFrame(buf) {
    if (buf.length < 12) return 'unknown error';
    const errCode = buf.readUInt32BE(4);
    const errSize = buf.readUInt32BE(8);
    let errMsg = `code ${errCode}`;
    if (errSize > 0 && 12 + errSize <= buf.length) {
      errMsg += `: ${buf.subarray(12, 12 + errSize).toString('utf8')}`;
    }
    return errMsg;
  }

  /**
   * 发送 StartSession (event 100)
   */
  _sendStartSession(ws, sessionId) {
    const payload = JSON.stringify({
      user: { uid: 'yongui_yisuan_web' },
      event: EVT_START_SESSION,
      namespace: 'BidirectionalTTS',
      req_params: {
        text: '',
        speaker: this.speaker,
        audio_params: {
          format: 'pcm',
          sample_rate: this.sampleRate,
          speech_rate: 0,
          loudness_rate: 0
        }
      }
    });
    this._sendSessionEventFrame(ws, EVT_START_SESSION, sessionId, Buffer.from(payload));
    console.log('[VolcTtsService] → StartSession');
  }

  /**
   * 分块发送文本 (TaskRequest event 200)
   * 按标点切分, 每块不超过 maxBytes
   */
  _sendTextChunks(ws, sessionId, text) {
    const maxBytes = 72;
    const chunks = this._splitTextBySentence(text, maxBytes);
    chunks.forEach((chunk, idx) => {
      const payload = JSON.stringify({
        event: EVT_TASK_REQUEST,
        req_params: { text: chunk }
      });
      this._sendSessionEventFrame(ws, EVT_TASK_REQUEST, sessionId, Buffer.from(payload));
      console.log(`[VolcTtsService] → TaskRequest #${idx + 1} (${chunk.length} chars)`);
    });
    // 发送 FinishSession
    this._sendSessionEventFrame(ws, EVT_FINISH_SESSION, sessionId, Buffer.from('{}'));
    console.log('[VolcTtsService] → FinishSession');
  }

  /**
   * 按句子切分文本 (保留标点, 每块不超过 maxBytes UTF-8)
   */
  _splitTextBySentence(text, maxBytes) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      let end = start;
      let lastBreak = start;
      let byteLen = 0;
      while (end < text.length) {
        const code = text.codePointAt(end);
        const charSize = code > 0xFFFF ? 2 : 1;
        const utf8Bytes = this._utf8BytesForChar(code);
        if (end > start && byteLen + utf8Bytes > maxBytes) {
          if (lastBreak > start) {
            chunks.push(text.substring(start, lastBreak));
            start = lastBreak;
          } else {
            chunks.push(text.substring(start, end));
            start = end;
          }
          break;
        }
        byteLen += utf8Bytes;
        end += charSize;
        const ch = text.charAt(end - charSize);
        if ('。！？.!?'.includes(ch)) {
          lastBreak = end;
        }
      }
      if (end >= text.length) {
        chunks.push(text.substring(start));
        break;
      }
    }
    return chunks.filter((c) => c.length > 0);
  }

  _utf8BytesForChar(code) {
    if (code < 0x80) return 1;
    if (code < 0x800) return 2;
    if (code < 0x10000) return 3;
    return 4;
  }

  /**
   * 构建 V3 二进制帧: header(4) + event(4) + payload_size(4) + payload
   * 用于无 session 的事件 (StartConnection / FinishConnection)
   */
  _sendEventFrame(ws, event, payload) {
    const header = Buffer.alloc(4);
    header[0] = 0x11; // v1, header_size=1
    header[1] = (MSG_FULL_CLIENT_REQ << 4) | FLAG_WITH_EVENT; // 0x14
    header[2] = (SER_JSON << 4) | 0x00; // JSON, no compression
    header[3] = 0x00;
    const eventBuf = Buffer.alloc(4);
    eventBuf.writeInt32BE(event, 0);
    const sizeBuf = Buffer.alloc(4);
    sizeBuf.writeUInt32BE(payload.length, 0);
    ws.send(Buffer.concat([header, eventBuf, sizeBuf, payload]));
  }

  /**
   * 构建 V3 二进制帧: header(4) + event(4) + sid_len(4) + sid + payload_size(4) + payload
   * 用于带 session 的事件 (StartSession / TaskRequest / FinishSession)
   */
  _sendSessionEventFrame(ws, event, sessionId, payload) {
    const sidBuf = Buffer.from(sessionId, 'utf8');
    const header = Buffer.alloc(4);
    header[0] = 0x11;
    header[1] = (MSG_FULL_CLIENT_REQ << 4) | FLAG_WITH_EVENT;
    header[2] = (SER_JSON << 4) | 0x00;
    header[3] = 0x00;
    const eventBuf = Buffer.alloc(4);
    eventBuf.writeInt32BE(event, 0);
    const sidLenBuf = Buffer.alloc(4);
    sidLenBuf.writeUInt32BE(sidBuf.length, 0);
    const sizeBuf = Buffer.alloc(4);
    sizeBuf.writeUInt32BE(payload.length, 0);
    ws.send(Buffer.concat([header, eventBuf, sidLenBuf, sidBuf, sizeBuf, payload]));
  }

  _genUuid() {
    return crypto.randomUUID();
  }

  /**
   * PCM 16kHz 16bit mono → WAV Buffer
   */
  _pcmToWav(pcm, sampleRate, bitsPerSample, channels) {
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;
    const dataSize = pcm.length;
    const buffer = Buffer.alloc(44 + dataSize);
    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // PCM fmt size
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcm.copy(buffer, 44);
    return buffer;
  }
}

module.exports = new VolcTtsService();
