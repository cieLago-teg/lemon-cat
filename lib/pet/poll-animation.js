function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('Cancelled'));
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason || new Error('Cancelled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function pollAnimation(taskId, options = {}) {
  const request = options.fetch || globalThis.fetch;
  const deadline = Date.now() + (options.timeoutMs ?? 15 * 60 * 1000);
  let failures = 0;
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted();
    let data;
    try {
      const timeout = AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now())));
      const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
      const response = await request(`/api/pet/animation-status?taskId=${encodeURIComponent(taskId)}`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`状态查询失败 (${response.status})`);
      data = await response.json();
      if (!data?.task) throw new Error('状态响应缺少任务');
      failures = 0;
    } catch (error) {
      options.signal?.throwIfAborted();
      if (++failures >= 3) throw new Error('暂时无法查询生成进度。任务可能仍在处理，请稍后检查，避免重复提交。', { cause: error });
      await delay(options.intervalMs ?? 2500, options.signal);
      continue;
    }
    const task = data.task;
    if (task.missing) throw new Error('任务记录不存在或服务已重启。请先核对生成结果，避免重复提交。');
    if (task.stage === 'Failure') throw new Error(task.error || task.message || '动画生成失败');
    if (task.stage === 'Success') {
      if (!task.videoUrl) throw new Error('生成任务缺少视频结果，请检查任务记录。');
      return String(task.videoUrl);
    }
    options.onProgress?.(task);
    await delay(options.intervalMs ?? 2500, options.signal);
  }
  throw new Error('等待超过 15 分钟，已停止查询。生成可能仍在继续，请稍后检查，避免重复提交。');
}

module.exports = { pollAnimation };
