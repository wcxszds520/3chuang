import { apiRequest, unwrapApiData } from './apiClient.js';

export async function checkVlmStatus(config = {}) {
  const payload = await apiRequest('/api/vlm/status', {}, config);
  return unwrapApiData(payload);
}

export async function recognizeCargoImage(file, config = {}) {
  const image = await compressImage(file, config.maxSize || 896);
  const payload = await apiRequest('/api/vlm/recognize-cargo', {
    method: 'POST',
    body: JSON.stringify(image),
    signal: config.signal
  }, { fetchImpl: config.fetchImpl, timeoutMs: config.timeoutMs ?? 45_000 });
  const data = unwrapApiData(payload);
  if (!data) {
    const error = new Error('VLM 未返回可确认的识别结果');
    error.reason = 'contract';
    throw error;
  }
  return { ...data, _meta: payload.meta || null };
}

export function compressImage(file, maxSize = 896) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type).startsWith('image/')) {
      reject(new Error('请选择图片文件'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('图片无法解码'));
      image.onload = () => {
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        const ratio = Math.min(1, maxSize / Math.max(width, height));
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('浏览器无法处理图片'));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ image: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
