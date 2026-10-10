export async function apiRequest(path, options = {}, config = {}) {
  const fetchImpl = config.fetchImpl || globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? 15_000;
  if (typeof fetchImpl !== 'function') throw apiError('当前环境不支持网络请求', 'unsupported');

  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const response = await fetchImpl(path, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      if (response.ok) throw apiError('接口响应不是有效 JSON', 'parse', response.status);
    }
    if (!response.ok || (payload?.code != null && Number(payload.code) >= 400)) {
      throw apiError(payload?.message || `接口返回 HTTP ${response.status}`, 'backend', response.status, payload);
    }
    if (payload?.code != null && Number(payload.code) !== 200 && Number(payload.code) !== 202) {
      throw apiError(payload?.message || `接口状态 ${payload.code}`, 'backend', response.status, payload);
    }
    return payload;
  } catch (error) {
    if (error?.reason) throw error;
    if (controller.signal.aborted) throw apiError('请求已超时或取消', externalSignal?.aborted ? 'cancelled' : 'timeout');
    throw apiError(error?.message || '网络请求失败', 'network');
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export function unwrapApiData(payload) {
  return payload?.data ?? payload;
}

function apiError(message, reason, status = null, payload = null) {
  const error = new Error(message);
  error.reason = reason;
  error.status = status;
  error.payload = payload;
  return error;
}
